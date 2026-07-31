# Stripe Connect staging commerce evidence

Date: 2026-07-31

Environment: EdNotebook Supabase staging (`gfalgonektwdylsxsgzc`) and Stripe sandbox

Result: **Staging acceptance passed with corrections. Live commerce remains disabled.**

No live keys, real payment details, or production records were used. This record intentionally excludes all secret values and webhook signing secrets.

## Governed platform and seller

- Stripe Connect platform: `acct_1TuSNGDLH5oPuxxs`
- Verified connected seller: `acct_1TzM8PDkkE2TAFEL`
- EdNotebook seller application: `dc03a588-b3a8-4492-a873-cd5d3213d860`
- Seller state: approved, Stripe verification verified, charges enabled, payouts enabled
- Rights review: `ebcffeac-a376-49b3-a8ad-814cde3b1015` (approved for purchase and rental)
- Tax control: `0a7b44e7-b786-4997-b91b-7dadd022448e` (platform liability, approved)
- Stripe Tax status: active in sandbox; the staging head-office address is test data and must be replaced and legally reviewed before live activation

Webhook destinations:

- Platform events: `we_1TzM3mDLH5oPuxxsSMUZIj6d`
- Connected-account events: `we_1TzM3nDLH5oPuxxskfJMpaHp`
- Both destinations target the staging `stripe-webhook` Edge Function and use distinct signing secrets.

## Checkout and entitlements

### Rental

- Listing: `2a908702-c476-48bb-8045-3a3f7690efeb`
- Order: `98e8dd2b-8ea5-4058-8171-3719e0ca5950`
- Amount: $2.00; platform fee $0.30; seller net $1.70
- Result: fulfilled by `checkout.session.completed`
- Entitlement: `f4a95c62-3808-44c7-8193-17e1dc011b44`
- Access: active for 30 days, through 2026-08-30 19:51:31 UTC
- Course membership uses the same marketplace order and expiration.

### Purchase and refund

- Listing: `98c7bd30-2c0f-4ca8-a56f-822ac6a6cd8e`
- Order: `cc5d75e8-02ff-45ac-874a-f71066dcc448`
- Amount: $5.00; platform fee $0.75; seller net $4.25
- Initial result: fulfilled with permanent access (`expires_at` null)
- Refund request: `f5055550-bce2-4a0a-9091-8083cdff7248`
- Stripe refund: `re_3TzMUeDLH5oPuxxs2wntohhD`
- Final result: full refund succeeded; order and entitlement were revoked by the verified webhook.
- Overlapping-access check: the learner's valid rental membership was restored after the permanent purchase was refunded.

## Dispute and chargeback

- Order: `ea1852ee-e9f6-4af9-a06c-7a62c993e5d9`
- Stripe dispute: `du_1TzMd3DLH5oPuxxsoMqKvxyz`
- Simulated lifecycle: `needs_response` → `under_review` → `lost`
- Webhooks processed: `charge.dispute.created`, `charge.dispute.updated`, and `charge.dispute.closed`
- Final result: order `chargeback`; entitlement `disputed` and revoked; the still-valid rental membership remained active.

## Connected seller payout

- Payout: `po_1TzMjeDkkE2TAFELpGtDVYwK`
- Amount: $1.70 USD
- Destination: verified sandbox bank account ending in 6789
- Result: paid; arrival date 2026-08-03
- Connected-account `payout.created`, `payout.updated`, and `payout.paid` deliveries reconciled to the approved seller application.

## Corrections proven by the gate

1. `marketplace_revoke_order_entitlement` now reconciles the strongest remaining active course entitlement instead of deleting marketplace membership unconditionally.
2. Dispute webhooks now resolve an order from PaymentIntent metadata when Stripe delivers a dispute before Checkout fulfillment, and fulfillment reapplies the recorded dispute state.
3. Checkout session creation failures now move the just-created order from `pending` to `payment_failed`, preventing a permanent stale record in the student Library.
4. The owner listing-review RPC now rechecks approved tax evidence, seller/Stripe readiness, and access-specific commercial rights before publication.

The first failed checkout record (`35d31483-1474-4d5b-92de-26517462def8`) was corrected to `payment_failed` after Stripe Tax setup was completed.

## Automated checks

- `npm run test:commercial-publishing`: 5 tests passed
- `npm run build:staging`: passed
- `supabase/tests/commercial_publishing_gate.sql`: full transactional gate passed and rolled back cleanly against staging
- Supabase migration `20260731200010_reconcile_marketplace_course_access`: applied to staging
- Supabase migration `20260731201312_enforce_marketplace_listing_dependencies`: applied to staging
- `stripe-webhook`: staging version 6 active, signature verification retained
- `marketplace-checkout`: staging version 5 active, JWT verification retained
- Revocation RPC privileges: anonymous false, authenticated false, service role true

## Live-mode blockers

- Replace and legally review the sandbox tax address, registrations, nexus, product tax codes, and tax liability decisions.
- Complete live Stripe account and seller onboarding, production webhook destinations, secret rotation, refund/dispute operations, and payout controls.
- Run the same evidence suite in a production-readiness environment with finance, legal/tax, security, and institutional approval.
- Do not copy sandbox account IDs, fixture records, or test credentials into production.
