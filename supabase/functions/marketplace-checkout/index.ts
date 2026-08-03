import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  requirePost,
  requireUser,
} from "../_shared/runtime.ts";
import {
  marketplaceFee,
  requireUniversityMarketplaceListing,
  requireMarketplaceCheckoutMode,
  stripeClient,
  trustedMarketplaceUrl,
  verifiedSeller,
} from "../_shared/marketplace.ts";
import { recordAuditRequired } from "../_shared/security.ts";

interface CheckoutRequest {
  listingId?: string;
  clientRequestKey?: string;
  successUrl?: string;
  cancelUrl?: string;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  const admin = adminClient();
  let pendingOrderId: string | null = null;
  try {
    requirePost(req);
    const { user } = await requireUser(req);
    const input = await parseJson<CheckoutRequest>(req, 20_000);
    if (!input.listingId || !input.clientRequestKey) {
      throw new HttpError(400, "Listing and checkout request identifiers are required.");
    }
    await requireMarketplaceCheckoutMode(admin);

    const { data: existing } = await admin
      .from("marketplace_orders")
      .select("id,status,stripe_checkout_session_id,stripe_checkout_url")
      .eq("buyer_id", user.id)
      .eq("listing_id", input.listingId)
      .eq("client_request_key", input.clientRequestKey)
      .maybeSingle();
    if (existing?.stripe_checkout_url && ["checkout_created", "payment_processing"].includes(existing.status)) {
      return jsonResponse(req, {
        orderId: existing.id,
        checkoutUrl: existing.stripe_checkout_url,
        reused: true,
      });
    }
    if (existing) throw new HttpError(409, "This checkout request has already reached a final state.");

    const { data: listing, error: listingError } = await admin
      .from("marketplace_listings")
      .select("*")
      .eq("id", input.listingId)
      .eq("status", "published")
      .maybeSingle();
    if (listingError) throw listingError;
    if (!listing) throw new HttpError(404, "This marketplace listing is not available.");
    await requireUniversityMarketplaceListing(admin, listing, user.id);
    const { data: activeEntitlement, error: entitlementError } = await admin
      .from("marketplace_entitlements")
      .select("id,expires_at")
      .eq("buyer_id", user.id)
      .eq("listing_id", listing.id)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (activeEntitlement) {
      throw new HttpError(409, "This purchase or rental is already active in your Library.");
    }

    const [{ data: seller }, { data: rights }, { data: tax }] = await Promise.all([
      admin.from("publisher_applications").select("*").eq("id", listing.seller_application_id).maybeSingle(),
      admin.from("publication_rights_reviews").select("*").eq("id", listing.rights_review_id).maybeSingle(),
      admin.from("marketplace_tax_controls").select("*").eq("id", listing.tax_control_id).maybeSingle(),
    ]);
    if (!seller || !rights || !tax) throw new HttpError(409, "Marketplace governance evidence is incomplete.");
    if (seller.applicant_id === user.id) throw new HttpError(409, "A seller cannot purchase their own listing.");
    if (
      seller.status !== "approved"
      || seller.verification_status !== "verified"
      || !seller.details_submitted
      || !seller.charges_enabled
      || !seller.payouts_enabled
    ) throw new HttpError(409, "Seller verification or payout readiness is not active.");
    if (
      rights.status !== "approved"
      || (rights.expires_at && new Date(rights.expires_at) <= new Date())
      || (listing.access_model === "purchase" && !rights.purchase_allowed)
      || (listing.access_model === "rental" && !rights.rental_allowed)
    ) throw new HttpError(409, "Approved commercial rights are unavailable for this listing.");
    if (
      tax.status !== "approved"
      || (tax.seller_application_id && tax.seller_application_id !== seller.id)
    ) throw new HttpError(409, "Tax responsibility has not been approved for this listing.");
    if (!seller.stripe_account_id) throw new HttpError(409, "Seller payout account is missing.");

    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve(seller.stripe_account_id);
    if (!verifiedSeller(account)) {
      await admin.from("publisher_applications").update({
        verification_status: account.requirements?.disabled_reason ? "restricted" : "pending",
        details_submitted: Boolean(account.details_submitted),
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        requirements_due: account.requirements?.currently_due || [],
        verification_checked_at: new Date().toISOString(),
      }).eq("id", seller.id);
      throw new HttpError(409, "Stripe seller verification or payouts require attention.");
    }

    let customerId: string | null = null;
    const { data: billingCustomer } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    customerId = billingCustomer?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { ednotebook_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("billing_customers").upsert({
        user_id: user.id,
        stripe_customer_id: customer.id,
        email: user.email || null,
        livemode: customer.livemode,
      }, { onConflict: "user_id" });
    }

    const feeCents = marketplaceFee(listing.price_cents, listing.platform_fee_bps);
    const orderId = crypto.randomUUID();
    const { error: orderError } = await admin.from("marketplace_orders").insert({
      id: orderId,
      buyer_id: user.id,
      listing_id: listing.id,
      seller_application_id: seller.id,
      client_request_key: input.clientRequestKey,
      item_kind: listing.item_kind,
      publication_id: listing.publication_id,
      course_id: listing.course_id,
      access_model: listing.access_model,
      rental_days: listing.rental_days,
      currency: listing.currency,
      tax_liability: tax.liability,
      subtotal_cents: listing.price_cents,
      total_cents: listing.price_cents,
      platform_fee_cents: feeCents,
      seller_net_cents: listing.price_cents - feeCents,
      stripe_customer_id: customerId,
      status: "pending",
    });
    if (orderError) throw orderError;
    pendingOrderId = orderId;

    const automaticTax = tax.liability === "seller"
      ? { enabled: true, liability: { type: "account", account: seller.stripe_account_id } }
      : { enabled: true, liability: { type: "self" } };
    const paymentIntentData = tax.liability === "platform"
      ? {
        receipt_email: user.email || undefined,
        transfer_data: {
          destination: seller.stripe_account_id,
          amount: listing.price_cents - feeCents,
        },
        metadata: {
          ednotebook_order_id: orderId,
          ednotebook_listing_id: listing.id,
        },
      }
      : {
        receipt_email: user.email || undefined,
        application_fee_amount: feeCents,
        transfer_data: { destination: seller.stripe_account_id },
        on_behalf_of: seller.stripe_account_id,
        metadata: {
          ednotebook_order_id: orderId,
          ednotebook_listing_id: listing.id,
        },
      };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      success_url: trustedMarketplaceUrl(input.successUrl, `#/publishers?checkout=success&order=${orderId}`),
      cancel_url: trustedMarketplaceUrl(input.cancelUrl, `#/publishers?checkout=canceled&order=${orderId}`),
      automatic_tax: automaticTax,
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: listing.currency,
          unit_amount: listing.price_cents,
          tax_behavior: listing.tax_behavior,
          product_data: {
            name: listing.title_snapshot,
            tax_code: listing.stripe_tax_code,
            metadata: {
              ednotebook_listing_id: listing.id,
              ednotebook_item_kind: listing.item_kind,
            },
          },
        },
      }],
      payment_intent_data: paymentIntentData,
      metadata: {
        ednotebook_order_id: orderId,
        ednotebook_listing_id: listing.id,
        ednotebook_user_id: user.id,
      },
    } as any, { idempotencyKey: `ednotebook-marketplace-checkout:${orderId}` });
    if (!session.url) throw new Error("Stripe Checkout did not return a hosted URL.");

    const { error: sessionUpdateError } = await admin
      .from("marketplace_orders")
      .update({
        status: "checkout_created",
        stripe_checkout_session_id: session.id,
        stripe_checkout_url: session.url,
      })
      .eq("id", orderId);
    if (sessionUpdateError) throw sessionUpdateError;

    await recordAuditRequired(admin, req, {
      actorId: user.id,
      eventType: "marketplace.checkout_created",
      targetType: "marketplace_order",
      targetId: orderId,
      details: {
        listingId: listing.id,
        itemKind: listing.item_kind,
        accessModel: listing.access_model,
        currency: listing.currency,
        subtotalCents: listing.price_cents,
      },
    });
    return jsonResponse(req, { orderId, checkoutUrl: session.url });
  } catch (error) {
    if (pendingOrderId) {
      const { error: cleanupError } = await admin.from("marketplace_orders").update({
        status: "payment_failed",
        metadata: { checkout_creation_failed: true },
      })
        .eq("id", pendingOrderId)
        .eq("status", "pending");
      if (cleanupError) console.error("checkout order cleanup failed", cleanupError);
    }
    return errorResponse(req, error);
  }
});
