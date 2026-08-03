import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@22.1.1";
import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  preflight,
  requirePost,
} from "../_shared/runtime.ts";
import { recordAudit } from "../_shared/security.ts";
import { sellerRequirementSummary, verifiedSeller } from "../_shared/marketplace.ts";

function idValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function metadataUserId(object: Record<string, any>): string | null {
  return object.metadata?.supabase_user_id
    || object.metadata?.ednotebook_user_id
    || object.metadata?.user_id
    || object.client_reference_id
    || null;
}

async function findUserId(admin: ReturnType<typeof adminClient>, object: Record<string, any>): Promise<string | null> {
  const explicit = metadataUserId(object);
  if (explicit) return explicit;
  const customerId = idValue(object.customer) || idValue(object.id && object.object === "customer" ? object : null);
  if (!customerId) return null;
  const { data: customer } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (customer?.user_id) return customer.user_id;
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return profile?.id || null;
}

async function planForPrice(admin: ReturnType<typeof adminClient>, priceId: string | null): Promise<string | null> {
  if (!priceId) return null;
  const { data } = await admin
    .from("stripe_price_plan_map")
    .select("plan_key")
    .eq("stripe_price_id", priceId)
    .eq("active", true)
    .maybeSingle();
  if (data?.plan_key) return data.plan_key;

  const environmentMap: Record<string, string | undefined> = {
    starter: Deno.env.get("STRIPE_PRICE_STARTER"),
    professor: Deno.env.get("STRIPE_PRICE_PROFESSOR"),
    institution: Deno.env.get("STRIPE_PRICE_INSTITUTION"),
    enterprise: Deno.env.get("STRIPE_PRICE_ENTERPRISE"),
  };
  return Object.entries(environmentMap).find(([, value]) => value === priceId)?.[0] || null;
}

async function upsertCustomer(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  customerId: string,
  email: string | null,
  livemode: boolean,
) {
  await admin.from("billing_customers").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    email,
    livemode,
  }, { onConflict: "user_id" });
  await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
}

async function applySubscription(admin: ReturnType<typeof adminClient>, subscription: Record<string, any>, livemode: boolean) {
  const userId = await findUserId(admin, subscription);
  if (!userId) throw new Error(`No EdNotebook user is mapped to Stripe customer ${idValue(subscription.customer) || "unknown"}.`);
  const customerId = idValue(subscription.customer);
  if (!customerId) throw new Error("Subscription customer is missing.");
  const item = subscription.items?.data?.[0] || null;
  const priceId = idValue(item?.price);
  const productId = idValue(item?.price?.product);
  const status = String(subscription.status || "unknown");

  await upsertCustomer(admin, userId, customerId, null, livemode);
  await admin.from("billing_subscriptions").upsert({
    stripe_subscription_id: subscription.id,
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_product_id: productId,
    stripe_price_id: priceId,
    status,
    quantity: item?.quantity || 1,
    current_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    livemode,
    metadata: subscription.metadata || {},
  }, { onConflict: "stripe_subscription_id" });

  const planKey = await planForPrice(admin, priceId);
  if (["active", "trialing"].includes(status) && planKey) {
    await admin.from("profiles").update({ plan_key: planKey, subscription_status: status }).eq("id", userId);
  } else if (!["active", "trialing"].includes(status)) {
    const { count } = await admin
      .from("billing_subscriptions")
      .select("stripe_subscription_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["active", "trialing"]);
    if (!count) await admin.from("profiles").update({ plan_key: "free", subscription_status: status }).eq("id", userId);
    else await admin.from("profiles").update({ subscription_status: status }).eq("id", userId);
  }
}

async function applyCheckout(admin: ReturnType<typeof adminClient>, session: Record<string, any>, livemode: boolean) {
  const marketplaceOrderId = session.metadata?.ednotebook_order_id || null;
  if (marketplaceOrderId) {
    if (!["paid", "no_payment_required"].includes(String(session.payment_status || ""))) {
      await admin.from("marketplace_orders").update({
        status: "payment_processing",
      }).eq("id", marketplaceOrderId).eq("stripe_checkout_session_id", session.id);
      return;
    }
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { telemetry: false });
    const paymentIntentId = idValue(session.payment_intent);
    if (!paymentIntentId) throw new Error("Marketplace Checkout Session is missing its PaymentIntent.");
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = typeof paymentIntent.latest_charge === "object"
      ? paymentIntent.latest_charge as unknown as Record<string, any>
      : paymentIntent.latest_charge
      ? await stripe.charges.retrieve(paymentIntent.latest_charge)
      : null;
    const subtotal = Number(session.amount_subtotal ?? session.amount_total ?? 0);
    const tax = Number(session.total_details?.amount_tax || 0);
    const total = Number(session.amount_total || 0);
    const { error: fulfillmentError } = await admin.rpc("marketplace_fulfill_order", {
      p_order_id: marketplaceOrderId,
      p_checkout_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
      p_charge_id: idValue(charge),
      p_customer_id: idValue(session.customer),
      p_transfer_id: idValue(charge?.transfer),
      p_application_fee_id: idValue(charge?.application_fee),
      p_subtotal_cents: subtotal,
      p_tax_cents: tax,
      p_total_cents: total,
      p_processor_payload: {
        stripe_payment_status: session.payment_status,
        stripe_tax_status: session.automatic_tax?.status || null,
        livemode,
      },
    });
    if (fulfillmentError) throw fulfillmentError;
    const { data: dispute, error: disputeError } = await admin
      .from("marketplace_disputes")
      .select("status")
      .eq("order_id", marketplaceOrderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (disputeError) throw disputeError;
    if (dispute) {
      await applyMarketplaceDisputeStatus(admin, marketplaceOrderId, "fulfilled", dispute.status);
    }
    return;
  }

  const userId = await findUserId(admin, session);
  if (!userId) throw new Error("Checkout Session is missing an EdNotebook user mapping.");
  const customerId = idValue(session.customer);
  if (customerId) await upsertCustomer(admin, userId, customerId, session.customer_details?.email || null, livemode);

  const publicationId = session.metadata?.publication_id || null;
  if (publicationId && session.payment_status === "paid") {
    const source = session.metadata?.access_model === "rental" ? "rental" : "purchase";
    const rentalDays = Number(session.metadata?.rental_days || 0);
    await admin.from("publication_entitlements").upsert({
      user_id: userId,
      publication_id: publicationId,
      source,
      active: true,
      starts_at: new Date().toISOString(),
      expires_at: source === "rental" && rentalDays > 0
        ? new Date(Date.now() + rentalDays * 86400000).toISOString()
        : null,
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: idValue(session.payment_intent),
      stripe_subscription_id: idValue(session.subscription),
      metadata: session.metadata || {},
    }, { onConflict: "user_id,publication_id,source" });
  }
}

async function syncSellerAccount(
  admin: ReturnType<typeof adminClient>,
  account: Stripe.Account,
) {
  const status = verifiedSeller(account)
    ? "verified"
    : account.requirements?.disabled_reason
    ? "restricted"
    : "pending";
  const { error } = await admin.from("publisher_applications").update({
    verification_status: status,
    details_submitted: Boolean(account.details_submitted),
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    requirements_due: sellerRequirementSummary(account),
    verification_checked_at: new Date().toISOString(),
  }).eq("stripe_account_id", account.id);
  if (error) throw error;
}

async function applyMarketplacePaymentFailure(
  admin: ReturnType<typeof adminClient>,
  paymentIntent: Record<string, any>,
) {
  const orderId = paymentIntent.metadata?.ednotebook_order_id || null;
  if (!orderId) return false;
  const { error } = await admin.from("marketplace_orders").update({
    status: "payment_failed",
    stripe_payment_intent_id: paymentIntent.id,
    metadata: {
      stripe_last_payment_error_code: paymentIntent.last_payment_error?.code || null,
    },
  }).eq("id", orderId);
  if (error) throw error;
  return true;
}

async function syncMarketplaceRefund(
  admin: ReturnType<typeof adminClient>,
  refund: Record<string, any>,
) {
  const requestId = refund.metadata?.ednotebook_refund_request_id || null;
  const orderId = refund.metadata?.ednotebook_order_id || null;
  if (!requestId && !orderId) return false;
  const status = String(refund.status || "pending");
  let newlySucceeded = !requestId;
  if (requestId) {
    const nextStatus = status === "succeeded"
      ? "succeeded"
      : status === "failed" || status === "canceled"
      ? "failed"
      : "processing";
    const { data: changed, error } = await admin.from("marketplace_refund_requests").update({
      stripe_refund_id: refund.id,
      status: nextStatus,
      processed_at: status === "succeeded" ? new Date().toISOString() : null,
      failure_summary: refund.failure_reason || null,
    })
      .eq("id", requestId)
      .neq("status", "succeeded")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    newlySucceeded = status === "succeeded" && Boolean(changed);
  }
  if (orderId && status === "succeeded" && newlySucceeded) {
    const { data: order, error: orderError } = await admin.from("marketplace_orders")
      .select("id,total_cents,refunded_cents")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (order) {
      const amount = Number(refund.amount || 0);
      const refunded = Math.min(order.total_cents, order.refunded_cents + amount);
      const full = refunded >= order.total_cents;
      const { error } = await admin.from("marketplace_orders").update({
        refunded_cents: refunded,
        status: full ? "refunded" : "partially_refunded",
      }).eq("id", order.id);
      if (error) throw error;
      if (full) {
        const { error: revokeError } = await admin.rpc("marketplace_revoke_order_entitlement", {
          p_order_id: order.id,
          p_status: "refunded",
          p_reason: "Stripe confirmed the full marketplace refund.",
        });
        if (revokeError) throw revokeError;
      }
    }
  }
  return true;
}

async function applyMarketplaceDisputeStatus(
  admin: ReturnType<typeof adminClient>,
  orderId: string,
  orderStatus: string,
  disputeStatus: string,
) {
  if (disputeStatus === "lost") {
    if (!["paid", "fulfilled", "partially_refunded", "disputed"].includes(orderStatus)) return;
    const { error: orderError } = await admin.from("marketplace_orders")
      .update({ status: "chargeback" })
      .eq("id", orderId);
    if (orderError) throw orderError;
    const { error: revokeError } = await admin.rpc("marketplace_revoke_order_entitlement", {
      p_order_id: orderId,
      p_status: "chargeback",
      p_reason: "Stripe closed the dispute as lost.",
    });
    if (revokeError) throw revokeError;
    return;
  }
  if (disputeStatus === "won") {
    if (["fulfilled", "disputed"].includes(orderStatus)) {
      const { error } = await admin.from("marketplace_orders")
        .update({ status: "fulfilled" })
        .eq("id", orderId);
      if (error) throw error;
    }
    return;
  }
  if (["paid", "fulfilled", "partially_refunded"].includes(orderStatus)) {
    const { error } = await admin.from("marketplace_orders")
      .update({ status: "disputed" })
      .eq("id", orderId);
    if (error) throw error;
  }
}

async function syncMarketplaceDispute(
  admin: ReturnType<typeof adminClient>,
  stripe: Stripe,
  dispute: Record<string, any>,
) {
  const chargeId = idValue(dispute.charge);
  const paymentIntentId = idValue(dispute.payment_intent);
  if (!chargeId && !paymentIntentId) return false;
  let orderQuery = admin.from("marketplace_orders")
    .select("id,seller_application_id,status");
  orderQuery = chargeId
    ? orderQuery.eq("stripe_charge_id", chargeId)
    : orderQuery.eq("stripe_payment_intent_id", paymentIntentId);
  let { data: order, error: orderError } = await orderQuery.maybeSingle();
  if (orderError) throw orderError;
  if (!order && paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const orderId = paymentIntent.metadata?.ednotebook_order_id || null;
    if (orderId) {
      const result = await admin.from("marketplace_orders")
        .select("id,seller_application_id,status")
        .eq("id", orderId)
        .maybeSingle();
      if (result.error) throw result.error;
      order = result.data;
    }
  }
  if (!order) return false;
  const status = String(dispute.status || "unknown");
  const closed = ["won", "lost", "warning_closed"].includes(status);
  const { error: disputeError } = await admin.from("marketplace_disputes").upsert({
    order_id: order.id,
    seller_application_id: order.seller_application_id,
    stripe_dispute_id: dispute.id,
    stripe_charge_id: chargeId,
    amount_cents: Number(dispute.amount || 0),
    currency: String(dispute.currency || "usd"),
    reason: dispute.reason || null,
    status,
    evidence_due_at: dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
      : null,
    evidence_submitted: Boolean(dispute.evidence_details?.has_evidence),
    outcome: closed ? status : null,
    processor_payload: {
      network_reason_code: dispute.network_reason_code || null,
      is_charge_refundable: dispute.is_charge_refundable ?? null,
      payment_intent_id: paymentIntentId,
    },
    closed_at: closed ? new Date().toISOString() : null,
  }, { onConflict: "stripe_dispute_id" });
  if (disputeError) throw disputeError;

  await applyMarketplaceDisputeStatus(admin, order.id, order.status, status);
  return true;
}

async function syncMarketplacePayout(
  admin: ReturnType<typeof adminClient>,
  payout: Record<string, any>,
  connectedAccountId: string | null,
) {
  if (!connectedAccountId) return false;
  const { data: seller, error: sellerError } = await admin.from("publisher_applications")
    .select("id")
    .eq("stripe_account_id", connectedAccountId)
    .maybeSingle();
  if (sellerError) throw sellerError;
  if (!seller) return false;
  const { error } = await admin.from("marketplace_payout_events").upsert({
    seller_application_id: seller.id,
    stripe_payout_id: payout.id,
    stripe_account_id: connectedAccountId,
    amount_cents: Number(payout.amount || 0),
    currency: String(payout.currency || "usd"),
    status: String(payout.status || "pending"),
    arrival_at: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
    failure_code: payout.failure_code || null,
    failure_message: payout.failure_message || null,
    processor_payload: {
      automatic: payout.automatic ?? null,
      method: payout.method || null,
      type: payout.type || null,
      reconciliation_status: payout.reconciliation_status || null,
    },
  }, { onConflict: "stripe_payout_id" });
  if (error) throw error;
  return true;
}

async function syncStripeEntitlements(
  stripe: Stripe,
  admin: ReturnType<typeof adminClient>,
  summary: Record<string, any>,
) {
  const customerId = idValue(summary.customer);
  if (!customerId) throw new Error("Entitlement summary is missing a customer.");
  const userId = await findUserId(admin, summary);
  if (!userId) throw new Error(`No EdNotebook user is mapped to Stripe customer ${customerId}.`);

  const activeApi = (stripe.entitlements as any)?.activeEntitlements;
  const list = activeApi?.list
    ? await activeApi.list({ customer: customerId, limit: 100 })
    : { data: summary.active_entitlements || [] };

  await admin.from("user_entitlements").update({ active: false, expires_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("source", "stripe")
    .eq("stripe_customer_id", customerId);

  for (const entitlement of list.data || []) {
    const key = entitlement.lookup_key
      || entitlement.feature?.lookup_key
      || entitlement.feature?.name
      || idValue(entitlement.feature)
      || entitlement.id;
    if (!key) continue;
    await admin.from("entitlement_definitions").upsert({
      entitlement_key: key,
      display_name: key.replace(/[_-]+/g, " "),
      description: "Synchronized from Stripe Entitlements.",
      value_type: "boolean",
    }, { onConflict: "entitlement_key" });
    await admin.from("user_entitlements").upsert({
      user_id: userId,
      entitlement_key: key,
      source: "stripe",
      active: true,
      entitlement_value: true,
      starts_at: new Date().toISOString(),
      expires_at: null,
      stripe_customer_id: customerId,
      stripe_feature_id: idValue(entitlement.feature),
      metadata: entitlement,
    }, { onConflict: "user_id,entitlement_key,source" });
  }
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  let eventId: string | null = null;
  const admin = adminClient();
  try {
    requirePost(req);
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecrets = [
      Deno.env.get("STRIPE_WEBHOOK_SECRET"),
      Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET"),
    ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
    if (!secret || webhookSecrets.length === 0) {
      throw new HttpError(503, "Stripe Edge Function secrets are not configured.");
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new HttpError(400, "Stripe-Signature header is missing.");
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2_000_000) {
      throw new HttpError(413, "Stripe event body is too large.");
    }

    const stripe = new Stripe(secret, { telemetry: false });
    let event: Stripe.Event | null = null;
    for (const webhookSecret of webhookSecrets) {
      try {
        event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
        break;
      } catch {
        // Platform and connected-account destinations have distinct signing secrets.
      }
    }
    if (!event) throw new HttpError(400, "Stripe webhook signature verification failed.");
    eventId = event.id;

    const { data: existing } = await admin
      .from("stripe_webhook_events")
      .select("status")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (existing?.status === "processed" || existing?.status === "ignored") {
      return jsonResponse(req, { received: true, duplicate: true });
    }

    await admin.from("stripe_webhook_events").upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      api_version: event.api_version || null,
      livemode: event.livemode,
      event_created_at: new Date(event.created * 1000).toISOString(),
      payload: event,
      status: "processing",
      processing_error: null,
    }, { onConflict: "stripe_event_id" });

    const object = event.data.object as unknown as Record<string, any>;
    let handled = true;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await applyCheckout(admin, object, event.livemode);
        break;
      case "checkout.session.async_payment_failed": {
        const orderId = object.metadata?.ednotebook_order_id || null;
        if (orderId) {
          await admin.from("marketplace_orders").update({ status: "payment_failed" }).eq("id", orderId);
        } else handled = false;
        break;
      }
      case "payment_intent.payment_failed":
        handled = await applyMarketplacePaymentFailure(admin, object);
        break;
      case "account.updated":
        await syncSellerAccount(admin, object as unknown as Stripe.Account);
        break;
      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        handled = await syncMarketplaceRefund(admin, object);
        break;
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
        handled = await syncMarketplaceDispute(admin, stripe, object);
        break;
      case "payout.created":
      case "payout.updated":
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled":
        handled = await syncMarketplacePayout(admin, object, event.account || null);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await applySubscription(admin, object, event.livemode);
        break;
      case "entitlements.active_entitlement_summary.updated":
        await syncStripeEntitlements(stripe, admin, object);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        const subscriptionId = idValue(object.subscription)
          || idValue(object.parent?.subscription_details?.subscription);
        if (subscriptionId) {
          await admin.from("billing_subscriptions").update({
            status: event.type === "invoice.paid" ? "active" : "past_due",
          }).eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }
      default:
        handled = false;
    }

    await admin.from("stripe_webhook_events").update({
      status: handled ? "processed" : "ignored",
      processed_at: new Date().toISOString(),
    }).eq("stripe_event_id", event.id);
    await recordAudit(admin, req, {
      actorId: null,
      eventType: handled ? "billing.webhook_processed" : "billing.webhook_ignored",
      targetType: "stripe_event",
      targetId: event.id,
      details: { eventType: event.type, livemode: event.livemode },
    });

    return jsonResponse(req, { received: true, handled });
  } catch (error) {
    if (eventId) {
      await admin.from("stripe_webhook_events").update({
        status: "failed",
        processing_error: error instanceof Error ? error.message : String(error),
      }).eq("stripe_event_id", eventId);
    }
    return errorResponse(req, error);
  }
});
