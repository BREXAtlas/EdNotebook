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
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret || !webhookSecret) throw new HttpError(503, "Stripe Edge Function secrets are not configured.");

    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new HttpError(400, "Stripe-Signature header is missing.");
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2_000_000) {
      throw new HttpError(413, "Stripe event body is too large.");
    }

    const stripe = new Stripe(secret, { telemetry: false });
    const event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
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
        await applyCheckout(admin, object, event.livemode);
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
