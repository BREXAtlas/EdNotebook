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

## Required Stripe setup

Configure these Supabase Edge Function secrets separately for staging and
production:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MARKETPLACE_RETURN_URL`

The Stripe webhook endpoint must subscribe to:

- `account.updated`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `refund.created`, `refund.updated`, and `refund.failed`
- `charge.dispute.created`, `charge.dispute.updated`, and
  `charge.dispute.closed`
- `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, and
  `payout.canceled` for connected accounts

`stripe-webhook` intentionally disables Supabase JWT verification because Stripe
cannot send a Supabase JWT. The function must continue verifying the unmodified
request body against `STRIPE_WEBHOOK_SECRET`; never place it behind a JSON body
parser or accept unsigned events.

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
