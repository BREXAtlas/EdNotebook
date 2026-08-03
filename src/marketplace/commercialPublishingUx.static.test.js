import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasActiveMarketplaceAccess,
  marketplaceAccessHref,
  marketplaceReportRange,
  marketplaceReceiptLabel,
  marketplaceSalesReportCsv,
} from "./marketplacePresentation.js";
import { marketplaceReceiptLines } from "./marketplaceReceiptDocument.js";

const ROOT = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("commercial catalog exposes checkout only through the governed Edge Function", async () => {
  const [landing, service, catalogMigration] = await Promise.all([
    source("src/portal/PublishingLanding.jsx"),
    source("src/marketplace/marketplaceService.js"),
    source("supabase/migrations/20260731233500_expose_commercial_edubook_purchase_rental.sql"),
  ]);
  assert.match(landing, /item\.checkout_available/u);
  assert.match(landing, /verified payment webhook/u);
  assert.match(service, /functions\.invoke\("marketplace-checkout"/u);
  assert.doesNotMatch(service, /\.from\("marketplace_entitlements"\)\.insert/u);
  const checkout = await source("supabase/functions/marketplace-checkout/index.ts");
  assert.match(checkout, /tax\.liability === "platform"/u);
  assert.match(checkout, /amount: listing\.price_cents - feeCents/u);
  assert.match(checkout, /checkout_creation_failed: true/u);
  assert.match(checkout, /\.eq\("status", "pending"\)/u);
  assert.match(catalogMigration, /coalesce\(listing\.access_model,publication\.access_model\)/u);
  assert.doesNotMatch(catalogMigration, /listing\.access_model=publication\.access_model/u);
});

test("professor workflow separates seller, Stripe, rights, and listing approval", async () => {
  const [studio, service, onboarding] = await Promise.all([
    source("src/studio/PublisherStudio.jsx"),
    source("src/marketplace/marketplaceService.js"),
    source("supabase/functions/marketplace-seller-onboarding/index.ts"),
  ]);
  assert.match(studio, /Professor \/ seller application/u);
  assert.match(studio, /Secure payout form and Stripe Connect verification/u);
  assert.match(studio, /Manage bank account and payouts/u);
  assert.match(studio, /loadConnectAndInitialize/u);
  assert.match(studio, /stripeConnect\.create\("account-management"\)/u);
  assert.match(studio, /stripeConnect\.create\("payouts"\)/u);
  assert.match(studio, /EdNotebook never asks the professor to type banking credentials/u);
  assert.match(studio, /Rights scope and evidence/u);
  assert.match(studio, /Price and submit the governed listing/u);
  assert.match(studio, /EdNotebook review is still required/u);
  assert.match(studio, /SellerCommerceLedger/u);
  assert.match(studio, /Gross processed/u);
  assert.match(studio, /Buyer identity and payment credentials remain private/u);
  assert.match(service, /action: "dashboard"/u);
  assert.match(onboarding, /stripeDashboardType = account\.controller\?\.stripe_dashboard\?\.type \|\| account\.type/u);
  assert.match(onboarding, /stripe\.accounts\.createLoginLink\(account\.id\)/u);
  assert.match(onboarding, /stripe\.accountSessions\.create/u);
  assert.match(onboarding, /STRIPE_PUBLISHABLE_KEY/u);
  assert.match(onboarding, /marketplace\.seller_payout_dashboard_opened/u);
});

test("control center includes tax, refunds, disputes, and payouts", async () => {
  const control = await source("src/admin-control/AdminControlCenter.jsx");
  assert.match(control, /Commercial publishing/u);
  assert.match(control, /Tax responsibility/u);
  assert.match(control, /Send approved refund to Stripe/u);
  assert.match(control, /Disputes and payouts/u);
  assert.match(control, /Transaction trace/u);
  assert.match(control, /marketplace\?\.orders/u);
});

test("Stripe webhook owns fulfillment and processor reconciliation", async () => {
  const [webhook, config] = await Promise.all([
    source("supabase/functions/stripe-webhook/index.ts"),
    source("supabase/config.toml"),
  ]);
  assert.match(webhook, /marketplace_fulfill_order/u);
  assert.match(webhook, /account\.updated/u);
  assert.match(webhook, /charge\.dispute\.created/u);
  assert.match(webhook, /payout\.paid/u);
  assert.match(webhook, /marketplace_revoke_order_entitlement/u);
  assert.match(webhook, /STRIPE_CONNECT_WEBHOOK_SECRET/u);
  assert.match(webhook, /for \(const webhookSecret of webhookSecrets\)/u);
  assert.match(config, /\[functions\.stripe-webhook\][\s\S]*verify_jwt = false/u);
});

test("Stripe dispute reconciliation tolerates events arriving before checkout fulfillment", async () => {
  const webhook = await source("supabase/functions/stripe-webhook/index.ts");
  assert.match(webhook, /paymentIntent\.metadata\?\.ednotebook_order_id/u);
  assert.match(webhook, /applyMarketplaceDisputeStatus\(admin, marketplaceOrderId, "fulfilled", dispute\.status\)/u);
  assert.match(webhook, /syncMarketplaceDispute\(admin, stripe, object\)/u);
});

test("one commerce view model connects student access, seller operations, and notifications", async () => {
  const [landing, migration, student] = await Promise.all([
    source("src/portal/PublishingLanding.jsx"),
    source("supabase/migrations/20260731211205_reconcile_marketplace_experience.sql"),
    source("src/portal/StudentDashboard.jsx"),
  ]);
  assert.match(landing, /marketplaceAccessHref/u);
  assert.match(landing, /title_snapshot/u);
  assert.match(landing, /Refresh records/u);
  assert.match(migration, /'seller_summary'/u);
  assert.match(migration, /'orders'/u);
  assert.match(migration, /notify_marketplace_entitlement_change/u);
  assert.match(migration, /'marketplace_purchase','marketplace_rental','marketplace_refund'/u);
  assert.match(student, /notification\.route === "library"/u);
});

test("marketplace presentation opens only a current entitlement", () => {
  const order = {
    id: "12345678-1234-4234-8234-1234567890ab",
    item_kind: "book",
    publication_id: "87654321-4321-4321-8321-ba0987654321",
    entitlement_status: "active",
    entitlement_expires_at: "2099-01-01T00:00:00.000Z",
  };
  assert.equal(hasActiveMarketplaceAccess(order), true);
  assert.equal(marketplaceAccessHref(order), "#/library/book/87654321-4321-4321-8321-ba0987654321");
  assert.equal(marketplaceReceiptLabel(order.id), "EDN-34567890AB");
  assert.equal(marketplaceAccessHref({ ...order, entitlement_status: "refunded" }), "");
});

test("buyer receipts and seller-period reports remain sanitized and exportable", async () => {
  const [landing, studio, service, migration] = await Promise.all([
    source("src/portal/PublishingLanding.jsx"),
    source("src/studio/PublisherStudio.jsx"),
    source("src/marketplace/marketplaceService.js"),
    source("supabase/migrations/20260801010000_marketplace_receipts_reporting_launch_controls.sql"),
  ]);
  assert.match(landing, /View receipt/u);
  assert.match(landing, /Download PDF receipt/u);
  assert.match(service, /get_my_marketplace_receipt/u);
  assert.match(service, /get_my_marketplace_sales_report/u);
  assert.match(studio, /Sales and payout activity/u);
  assert.match(studio, /Export CSV/u);
  assert.match(studio, /Buyer identity, payment credentials, and learning activity are excluded/u);
  assert.match(migration, /Marketplace receipt identity is immutable/u);
  assert.match(migration, /Operational sales report only; not a tax filing or Stripe payout statement/u);
  assert.doesNotMatch(migration.match(/create or replace function public\.get_my_marketplace_sales_report[\s\S]*?end;\n\$\$;/u)?.[0] || "", /buyer_id/u);
});

test("receipt PDF content and CSV accounting rows use governed transaction fields", () => {
  const receipt = {
    receipt_number: "EDN-20260801-1234567890",
    issued_at: "2026-08-01T00:00:00.000Z",
    title_snapshot: "Digital Literacy",
    seller_name: "Example Professor Press",
    access_model: "purchase",
    order_status: "fulfilled",
    currency: "usd",
    subtotal_cents: 500,
    tax_cents: 40,
    total_cents: 540,
    refunded_cents: 0,
  };
  const lines = marketplaceReceiptLines(receipt).join("\n");
  assert.match(lines, /EDN-20260801-1234567890/u);
  assert.match(lines, /not a tax invoice/u);
  const csv = marketplaceSalesReportCsv({ transactions: [{
    id: "12345678-1234-4234-8234-1234567890ab",
    ...receipt,
    paid_at: receipt.issued_at,
    item_kind: "book",
    platform_fee_cents: 81,
    seller_net_cents: 459,
    status: "fulfilled",
  }] });
  assert.match(csv, /receipt_number,paid_at,title/u);
  assert.match(csv, /Digital Literacy/u);
  assert.doesNotMatch(csv, /buyer/u);
  const formulaCsv = marketplaceSalesReportCsv({ transactions: [{
    ...receipt,
    title_snapshot: "=HYPERLINK(\"https://example.invalid\",\"Open\")",
  }] });
  assert.match(formulaCsv, /'=HYPERLINK/u);
  const range = marketplaceReportRange("month_to_date", new Date("2026-08-15T12:00:00.000Z"));
  const start = new Date(range.startAt);
  assert.equal(start.getMonth(), 7);
  assert.equal(start.getDate(), 1);
  assert.equal(start.getHours(), 0);
});

test("production checkout is separately blocked behind the launch-control ledger", async () => {
  const [control, checkout, shared, migration] = await Promise.all([
    source("src/admin-control/AdminControlCenter.jsx"),
    source("supabase/functions/marketplace-checkout/index.ts"),
    source("supabase/functions/_shared/marketplace.ts"),
    source("supabase/migrations/20260801010000_marketplace_receipts_reporting_launch_controls.sql"),
  ]);
  assert.match(control, /LIVE CHARGING BLOCKED/u);
  assert.match(control, /Activate live charging/u);
  assert.match(control, /I confirm that production legal, tax, finance, security, support, and operations owners approved this activation/u);
  assert.match(checkout, /requireMarketplaceCheckoutMode\(admin\)/u);
  assert.match(checkout, /receipt_email: user\.email/u);
  assert.match(shared, /\(\?:sk\|rk\)_live_/u);
  assert.match(shared, /\(\?:sk\|rk\)_test_/u);
  assert.match(shared, /get_marketplace_launch_runtime_gate/u);
  assert.match(migration, /private\.marketplace_launch_ready/u);
  assert.match(migration, /marketplace_launch_controls_fail_closed/u);
  assert.match(migration, /marketplace\.live_charging_enabled/u);
});
