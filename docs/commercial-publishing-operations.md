# Commercial publishing operations

EdNotebook uses Stripe Connect for commercial course and book publishing. The
processor handles hosted seller onboarding, card collection, tax calculation,
connected-account transfers, refunds, disputes, and payouts. EdNotebook keeps
the marketplace governance and learning-access ledger.

## Release gates

A paid listing is unavailable unless all of the following are current:

1. The professor, author, or publisher submitted an EdNotebook seller
   application and rights attestation.
2. Stripe Connect reports identity details submitted, charges enabled, payouts
   enabled, and no blocking requirements.
3. A platform owner approves the seller in the TOS Control Center.
4. An item-specific rights review is approved for purchase, rental, or both.
5. The platform owner records and separately approves the applicable Stripe Tax
   registration and marketplace tax liability.
6. The source course package or EduBook is release-ready.
7. The platform owner approves the priced listing.

Suspending any governed seller, tax, rights, or listing record removes checkout
availability. Stripe secrets, bank details, and identity documents never enter
the browser or EdNotebook tables.

## Checkout and entitlement rule

The browser sends only the listing ID and a one-time request key. The
`marketplace-checkout` Edge Function reloads price, currency, seller, rights,
tax, and payout readiness from server-owned records. It creates a Stripe hosted
Checkout Session using a destination charge, governed fee split, and Stripe Tax.
When EdNotebook is tax liable, Checkout transfers only the approved seller
amount (price minus platform fee), leaving calculated tax on the platform for
remittance. When the connected seller is tax liable, Stripe transfers the
tax-inclusive charge and returns the governed application fee to EdNotebook.

The success return URL does not grant course or book access. Only a
signature-verified `checkout.session.completed` or
`checkout.session.async_payment_succeeded` webhook may call
`marketplace_fulfill_order`. The database then records the order and creates:

- a permanent or expiring `marketplace_entitlements` record;
- a publication entitlement for an EduBook; or
- a marketplace-scoped course membership for a course.

Full confirmed refunds and lost disputes revoke only marketplace-created access;
they do not remove an independently assigned or enrolled course membership.

Interactive EduBooks use the same commercial entitlement. Their professor
teaching layer is versioned separately from source chapters, answer keys remain
server-side, and learner progress writes recheck current publication access.
Refund or dispute revocation therefore blocks subsequent book-content and
progress writes without exposing learning records in the seller ledger.

## Refunds, disputes, and payouts

Buyers submit a refund reason from Purchases & rentals. A platform owner records
an approval or decline in the Control Center. Approved refunds are sent by the
server with connected-transfer reversal and application-fee reversal when that
fee flow applies. Stripe webhook confirmation updates the final refunded amount
and access state.

Destination-charge disputes debit the platform balance, so dispute events are
recorded against both the order and seller. Lost disputes revoke the affected
marketplace entitlement. Connected-account payout events are recorded as status
and amount only; bank information is never stored.

### Professor payout form

The professor opens Stripe's hosted or embedded Connect onboarding from Learning
Studio. Stripe collects legal identity, tax information, and the bank account or
eligible debit-card destination. EdNotebook stores only the connected-account
identifier and readiness flags.

After details are submitted, **Manage bank account and payouts** requests a
short-lived connected-account session from the authenticated
`marketplace-seller-onboarding` Edge Function. Accounts configured for Stripe's
fully embedded dashboard render Stripe Account Management and Payouts inside
Learning Studio; legacy Express accounts receive a single-use Express Dashboard
login link. In either case Stripe owns sensitive fields and authentication. The
server records the payout-controls audit event; the browser never receives a
Stripe secret key or bank data.

## Buyer receipts and seller reports

Payment fulfillment assigns one immutable EdNotebook receipt number to the
governed order. The buyer can open the receipt from **Purchases & rentals** and
download a PDF containing the item, seller, access model, subtotal, calculated
tax, total, current refund amount, and order status. Stripe remains the payment
processor and may send its own processor receipt. The EdNotebook PDF is labeled
as a transaction receipt, not a tax invoice.

Professors can open a 30-day, 90-day, month-to-date, or year-to-date sales
report in Commercial publishing and export the same sanitized transaction rows
as CSV. Reports include item totals, tax, platform fees, seller allocations,
refunds, and payout events. They exclude buyer identity, payment credentials,
and every learning record. The report is operational evidence, not a tax filing
or a substitute for Stripe's connected-account payout statement.

## Production launch control

Test-mode acceptance and live charging are separate decisions. The Control
Center starts with live charging blocked and requires current evidence for:

- buyer terms, seller terms, refunds, rentals, and prohibited content;
- rights review, takedown, repeat-infringer response, and appeals;
- tax registrations, nexus, product codes, and marketplace liability;
- settlement reconciliation, refunds, reserves, disputes, and payouts;
- production key custody, signed webhooks, monitoring, replay handling, and
  incident ownership;
- buyer/seller support and dispute-response ownership; and
- receipts, ledger retention, privacy minimization, and accounting ownership.

Approving the checklist does not enable charging. A separate owner action needs
an attestation, decision reason, and current-record version. Any required
control that becomes blocked or non-current automatically disables the live
state. In addition, `marketplace-checkout` inspects the Stripe secret-key mode:
test keys remain confined to test transactions, while a live key is rejected
unless the server-only runtime gate confirms both the complete checklist and
the separate activation decision.

## Required Stripe setup

Configure these Supabase Edge Function secrets separately for staging and
production:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `MARKETPLACE_RETURN_URL`

Create two Stripe webhook destinations that point to the same `stripe-webhook`
Edge Function URL. Stripe gives each destination a distinct signing secret, and
the function verifies every request against both configured secrets:

- **Platform account** (`STRIPE_WEBHOOK_SECRET`) subscribes to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `refund.created`, `refund.updated`, and `refund.failed`
- `charge.dispute.created`, `charge.dispute.updated`, and
  `charge.dispute.closed`
- **Connected accounts** (`STRIPE_CONNECT_WEBHOOK_SECRET`) subscribes to:

- `account.updated`
- `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, and
  `payout.canceled`

`stripe-webhook` intentionally disables Supabase JWT verification because Stripe
cannot send a Supabase JWT. The function must continue verifying the unmodified
request body against the signing secret for its platform or connected-account
destination; never place it behind a JSON body parser or accept unsigned events.

## Evidence gate

Before deployment, run:

```text
npm run test:commercial-publishing
npx supabase db reset --local --no-seed
psql ... --file=supabase/tests/commercial_publishing_gate.sql
deno check --config supabase/functions/deno.json supabase/functions/_shared/*.ts supabase/functions/*/index.ts
```

The SQL gate uses synthetic processor identifiers in a transaction that rolls
back. A real staging smoke test still requires Stripe test-mode Connect
onboarding, a test purchase, webhook fulfillment, a refund, and a connected
payout event before production activation.
