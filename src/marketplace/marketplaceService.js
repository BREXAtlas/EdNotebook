import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

function unavailable(message) {
  return { data: null, error: new Error(message) };
}

export async function loadMarketplaceDashboard() {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  const { data, error } = await supabase.rpc("get_my_marketplace_dashboard");
  return { data: data || {}, error };
}

export async function loadMarketplaceReceipt(orderId) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  return supabase.rpc("get_my_marketplace_receipt", {
    p_order_id: orderId,
  });
}

export async function loadMarketplaceSalesReport({ startAt, endAt }) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  return supabase.rpc("get_my_marketplace_sales_report", {
    p_period_start: startAt,
    p_period_end: endAt,
  });
}

export async function submitSellerApplication({
  organizationName,
  applicantType,
  websiteUrl,
  catalogSummary,
  rightsAttestation,
}) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  return supabase.rpc("submit_marketplace_seller_application", {
    p_organization_name: organizationName,
    p_applicant_type: applicantType,
    p_website_url: websiteUrl || "",
    p_catalog_summary: catalogSummary,
    p_rights_attestation: Boolean(rightsAttestation),
  });
}

export async function startSellerOnboarding({ refresh = false } = {}) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  const current = window.location.href;
  return supabase.functions.invoke("marketplace-seller-onboarding", {
    body: {
      action: refresh ? "refresh" : "start",
      returnUrl: current,
      refreshUrl: current,
    },
  });
}

export async function openSellerPayoutDashboard() {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  return supabase.functions.invoke("marketplace-seller-onboarding", {
    body: { action: "dashboard" },
  });
}

export async function submitRightsReview({
  itemKind,
  itemId,
  rightsOwnerName,
  rightsBasis,
  rightsStatement,
  evidenceUrl,
  purchaseAllowed,
  rentalAllowed,
  expiresAt,
}) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  return supabase.rpc("submit_marketplace_rights_review", {
    p_item_kind: itemKind,
    p_item_id: itemId,
    p_rights_owner_name: rightsOwnerName,
    p_rights_basis: rightsBasis,
    p_rights_statement: rightsStatement,
    p_evidence_url: evidenceUrl || "",
    p_purchase_allowed: Boolean(purchaseAllowed),
    p_rental_allowed: Boolean(rentalAllowed),
    p_expires_at: expiresAt || null,
  });
}

export async function submitCommercialListing({
  itemKind,
  itemId,
  rightsReviewId,
  accessModel,
  priceCents,
  rentalDays,
}) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  return supabase.rpc("submit_marketplace_listing", {
    p_item_kind: itemKind,
    p_item_id: itemId,
    p_rights_review_id: rightsReviewId,
    p_access_model: accessModel,
    p_price_cents: priceCents,
    p_rental_days: accessModel === "rental" ? rentalDays : null,
  });
}

export async function beginMarketplaceCheckout(listingId) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  const base = `${window.location.origin}${window.location.pathname}`;
  return supabase.functions.invoke("marketplace-checkout", {
    body: {
      listingId,
      clientRequestKey: crypto.randomUUID(),
      successUrl: `${base}#/publishers?checkout=success`,
      cancelUrl: `${base}#/publishers?checkout=canceled`,
    },
  });
}

export async function requestMarketplaceRefund({ orderId, amountCents, reason }) {
  if (!isSupabaseConfigured) return unavailable("The marketplace service is not connected.");
  return supabase.rpc("request_marketplace_refund", {
    p_order_id: orderId,
    p_amount_cents: amountCents,
    p_reason: reason,
  });
}
