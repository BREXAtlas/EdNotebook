# Marketplace receipts, reporting, and launch-readiness acceptance

Status: **staging database and checkout gate deployed; UI requires merge and staging acceptance**

This controlled unit completes the operational record around the already
accepted Stripe Connect purchase, rental, refund, dispute, and payout flows. It
does not enable live charging.

## Buyer receipt acceptance

1. Sign in with the staging student account and open Alex B. Morrison Library.
2. Under **Purchases & rentals**, choose a fulfilled sandbox purchase or rental.
3. Select **View receipt** and confirm the seller, title, access model, subtotal,
   tax, total, refund amount, and status match the governed order.
4. Download the PDF and confirm it uses the same immutable EdNotebook receipt
   number and states that it is not a tax invoice.
5. Confirm another student cannot retrieve the receipt RPC for this order.

## Seller report acceptance

1. Sign in with the staging professor account.
2. Open Learning Studio → Reader & publisher → Commercial publishing.
3. In **Sales and payout activity**, compare the last-30-days totals with the
   existing transaction and payout ledger.
4. Change to month-to-date and year-to-date and confirm the date range changes.
5. Export CSV and confirm it contains receipt, item, amount, fee, allocation,
   and refund fields without buyer identity, payment credentials, or learning
   records.

## Owner launch-control acceptance

1. Sign in with the staging platform-owner fixture and open TOS Control Center
   → Commercial publishing.
2. Confirm the production gate says **LIVE CHARGING BLOCKED** and every seeded
   legal, tax, finance, security, support, and operations control starts pending.
3. Record only synthetic staging evidence; do not mark real legal or tax review
   complete and do not activate live charging.
4. Confirm the activation button remains disabled while any required control is
   pending, blocked, expired, or missing evidence.
5. Run the disposable SQL gate, which proves that full synthetic approval can
   activate the runtime gate and that withdrawing one required control
   immediately disables it again.

## Automated evidence

- `npm run test:commercial-publishing`
- `npm run build`
- `npm run build:staging`
- `supabase/tests/commercial_publishing_gate.sql`
- Deno type checking for the shared marketplace module and Edge Functions
- Supabase security and performance advisors after staging migration

## Explicit production hold

Production charging remains blocked until named legal, tax, finance, security,
support, and operations owners review actual production evidence. Synthetic
tests and staging owner clicks are not legal or tax approval.
