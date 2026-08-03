# Commercial EduBook purchase, rental, and payout acceptance

Status: **implemented locally; requires merge and staging acceptance**

Commercial publishing is optional. Free and course-assigned books remain the
normal path, including the Digital Literacy pilot fixture. A professor may
separately submit an eligible book for permanent purchase, time-limited rental,
or both.

## How the professor gets paid

1. The professor submits the EdNotebook seller and item-rights records.
2. The professor opens Stripe's hosted payout form from Learning Studio.
3. Stripe collects and verifies legal identity, tax information, and the bank
   account or eligible debit-card payout destination. EdNotebook never stores
   those credentials or identity documents.
4. After TOS owner approval, Stripe Checkout creates a destination charge. The
   approved seller allocation moves to the connected Stripe balance; the
   governed platform fee and approved tax treatment remain separately recorded.
5. Stripe pays the connected balance to the verified external account on the
   account's payout schedule. Signed Connect webhook events update EdNotebook's
   payout-status ledger without exposing bank information.
6. A verified professor can use **Manage bank account and payouts** to open
   Stripe's embedded Account Management and Payouts controls. Legacy Express
   accounts receive a single-use Express Dashboard login link. Access is created
   only by the authenticated server function and is recorded in audit history.

## Purchase and rental boundary

- The free Digital Literacy publication is not converted into a paid listing.
- A commercial book needs current seller, Stripe, rights, tax, source, and
  listing approval before checkout appears.
- The browser sends only a listing identifier and request key; it cannot set a
  price, fee, seller destination, entitlement, or payout.
- Permanent purchases create non-expiring book entitlements.
- Rentals create expiring entitlements using the owner-approved rental period.
- Only a signature-verified Stripe webhook fulfills access.
- Full refunds and lost disputes revoke only the affected commercial
  entitlement. The reader and progress RPCs recheck current access.
- Seller records show title, status, amounts, refunds, disputes, and payout
  status, but omit buyer learning answers, reflections, and bank details.

## Automated evidence

- `npm run test:commercial-publishing`
- `npm run test:edubook-publishing`
- `supabase/tests/commercial_publishing_gate.sql`
- production and staging builds
- Deno type checks for every Supabase Edge Function

The SQL gate now proves both permanent purchase and fourteen-day rental access
for a commercial interactive book, purchase refund revocation, rental
restoration, Library notifications, and seller payout reconciliation. It runs
inside a transaction and rolls back all synthetic records.

## Staging acceptance after merge

Use a separate sandbox publication; leave the free Digital Literacy book open.

1. Professor: open Commercial publishing and confirm the payout flow is clear.
2. Professor: open **Manage bank account and payouts** and verify the correct
   Stripe sandbox Account Management and Payouts controls render without
   exposing credentials to EdNotebook.
3. Professor: submit book rights for both purchase and rental and create two
   sandbox listings with different prices and a short rental period.
4. Owner: approve rights, tax evidence, and both listings in the TOS Control
   Center.
5. Student: complete one sandbox purchase and one rental through Stripe-hosted
   Checkout, then open each entitlement inside Alex B. Morrison Library.
6. Confirm the rental shows an expiration date and the purchase is permanent.
7. Process a full sandbox refund and confirm only that entitlement is revoked.
8. Reconcile the seller allocation and a Connect payout event without exposing
   buyer identity, learning records, or payout-account details.

Live charging stays disabled until the production legal/tax, finance, security,
webhook, payout, and account-approval gates are signed off.
