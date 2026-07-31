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
  sellerRequirementSummary,
  stripeClient,
  trustedMarketplaceUrl,
  verifiedSeller,
} from "../_shared/marketplace.ts";
import { recordAuditRequired } from "../_shared/security.ts";

interface OnboardingRequest {
  action?: "start" | "refresh";
  returnUrl?: string;
  refreshUrl?: string;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  const admin = adminClient();
  try {
    requirePost(req);
    const { user } = await requireUser(req);
    const input = await parseJson<OnboardingRequest>(req, 20_000);
    const { data: application, error: applicationError } = await admin
      .from("publisher_applications")
      .select("*")
      .eq("applicant_id", user.id)
      .in("status", ["submitted", "reviewing", "approved", "suspended"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (applicationError) throw applicationError;
    if (!application) {
      throw new HttpError(409, "Submit the EdNotebook seller application before Stripe verification.");
    }

    const stripe = stripeClient();
    let account;
    if (application.stripe_account_id) {
      account = await stripe.accounts.retrieve(application.stripe_account_id);
    } else {
      account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: user.email || undefined,
        business_profile: {
          name: application.organization_name,
          product_description: application.catalog_summary.slice(0, 400),
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          ednotebook_application_id: application.id,
          ednotebook_user_id: user.id,
        },
      });
    }

    const verificationStatus = verifiedSeller(account)
      ? "verified"
      : account.requirements?.disabled_reason
      ? "restricted"
      : "pending";
    const { error: updateError } = await admin
      .from("publisher_applications")
      .update({
        stripe_account_id: account.id,
        verification_status: verificationStatus,
        details_submitted: Boolean(account.details_submitted),
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        requirements_due: sellerRequirementSummary(account),
        verification_checked_at: new Date().toISOString(),
        status: application.status === "submitted" ? "reviewing" : application.status,
      })
      .eq("id", application.id);
    if (updateError) throw updateError;

    await recordAuditRequired(admin, req, {
      actorId: user.id,
      eventType: "marketplace.seller_verification_refreshed",
      targetType: "publisher_application",
      targetId: application.id,
      details: {
        verificationStatus,
        detailsSubmitted: Boolean(account.details_submitted),
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
      },
    });

    if (verificationStatus === "verified" && input.action === "refresh") {
      return jsonResponse(req, {
        applicationId: application.id,
        verificationStatus,
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      return_url: trustedMarketplaceUrl(input.returnUrl, "#/app/studio?tab=reader&marketplace=returned"),
      refresh_url: trustedMarketplaceUrl(input.refreshUrl, "#/app/studio?tab=reader&marketplace=refresh"),
      collection_options: { fields: "eventually_due" },
    });
    return jsonResponse(req, {
      applicationId: application.id,
      verificationStatus,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
