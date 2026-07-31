import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("commercial catalog exposes checkout only through the governed Edge Function", async () => {
  const [landing, service] = await Promise.all([
    source("src/portal/PublishingLanding.jsx"),
    source("src/marketplace/marketplaceService.js"),
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
});

test("professor workflow separates seller, Stripe, rights, and listing approval", async () => {
  const studio = await source("src/studio/PublisherStudio.jsx");
  assert.match(studio, /Professor \/ seller application/u);
  assert.match(studio, /Stripe Connect verification and payouts/u);
  assert.match(studio, /Rights scope and evidence/u);
  assert.match(studio, /Price and submit the governed listing/u);
  assert.match(studio, /EdNotebook review is still required/u);
});

test("control center includes tax, refunds, disputes, and payouts", async () => {
  const control = await source("src/admin-control/AdminControlCenter.jsx");
  assert.match(control, /Commercial publishing/u);
  assert.match(control, /Tax responsibility/u);
  assert.match(control, /Send approved refund to Stripe/u);
  assert.match(control, /Disputes and payouts/u);
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
