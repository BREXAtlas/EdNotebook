-- Run only against a disposable Supabase database after every migration.
-- Proves fail-closed seller/rights/tax/listing review, webhook-only purchase
-- and rental entitlements, full-refund revocation, dispute state, and payout
-- visibility without using a real Stripe account.

begin;
set local statement_timeout='45s';

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('22000000-0000-4000-8000-000000000001','authenticated','authenticated','market-seller@safety.invalid','not-a-login',now(),'{}','{"full_name":"Marketplace Seller"}',now(),now()),
  ('22000000-0000-4000-8000-000000000002','authenticated','authenticated','market-buyer@safety.invalid','not-a-login',now(),'{}','{"full_name":"Marketplace Buyer"}',now(),now()),
  ('22000000-0000-4000-8000-000000000003','authenticated','authenticated','market-owner@safety.invalid','not-a-login',now(),'{}','{"full_name":"Marketplace Owner"}',now(),now());

update public.profiles set role='professor'
where id='22000000-0000-4000-8000-000000000001';
update public.profiles set role='owner'
where id='22000000-0000-4000-8000-000000000003';

insert into public.courses (
  id,owner_id,title,course_code,status,education_division,access_scope
) values (
  '22000000-0000-4000-8000-000000000010',
  '22000000-0000-4000-8000-000000000001',
  'Commercial Digital Literacy Gate',
  'MARKET 1000',
  'published',
  'university',
  'public_free'
);

insert into public.course_publications (
  id,course_id,created_by,current_version,status,draft_manifest,published_at
) values (
  '22000000-0000-4000-8000-000000000011',
  '22000000-0000-4000-8000-000000000010',
  '22000000-0000-4000-8000-000000000001',
  1,
  'published',
  '{"format":"EdNotebookCourse/1.0","course":{"title":"Commercial Digital Literacy Gate"},"paths":[]}'::jsonb,
  now()
);

insert into public.published_course_directory (
  course_id,professor_id,institution_name,professor_display_name,course_code,
  title,summary,enrollment_open,is_listed,published_at,education_division,
  enrollment_policy,universal_assignment,completion_badge_name,
  completion_badge_description
) values (
  '22000000-0000-4000-8000-000000000010',
  '22000000-0000-4000-8000-000000000001',
  'Independent course',
  'Marketplace Seller',
  'MARKET 1000',
  'Commercial Digital Literacy Gate',
  'A governed commercial course fixture.',
  true,true,now(),'university','open_self_enroll',false,
  'Commercial Literacy Complete',
  'Recognizes completion of the governed commercial fixture.'
);

insert into public.publications (
  id,owner_id,title,author_name,description,rights_confirmed,rights_statement,
  conversion_status,edubook_manifest,access_model,status,reading_mode
) values (
  '22000000-0000-4000-8000-000000000020',
  '22000000-0000-4000-8000-000000000001',
  'Governed Marketplace Book',
  'Marketplace Seller',
  'A book used to prove purchase entitlement and refund revocation.',
  true,
  'The fixture seller owns all commercial distribution rights.',
  'ready',
  '{"format":"EduBook/1.0","chapters":[{"id":"one","title":"One","blocks":[]}]}'::jsonb,
  'private',
  'draft',
  'interactive'
);

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,status
from public.submit_marketplace_seller_application(
  'Marketplace Seller Press',
  'professor',
  'https://example.invalid/marketplace-seller',
  'Original Digital Literacy courses and interactive books for university learners.',
  true
);

reset role;
select set_config('request.jwt.claim.sub','',true);
update public.publisher_applications
set stripe_account_id='acct_marketplace_gate',
    verification_status='verified',
    details_submitted=true,
    charges_enabled=true,
    payouts_enabled=true,
    requirements_due='[]'::jsonb,
    verification_checked_at=now()
where applicant_id='22000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.review_marketplace_case(
  'seller',
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  'approved',
  'Stripe identity, charging, payout, and catalog evidence verified.'
);

reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.marketplace_tax_controls (
  seller_application_id,provider,country_code,jurisdiction_label,
  liability,status,review_notes
) values (
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  'stripe_tax','US','United States marketplace sales','platform','pending',
  'Awaiting fixture-specific Stripe Tax review.'
)
on conflict (seller_application_id,country_code,liability) do update set
  registration_reference=null,
  status='pending',
  reviewed_by=null,
  reviewed_at=null,
  review_notes=excluded.review_notes,
  updated_at=now();

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,status
from public.submit_marketplace_rights_review(
  'book',
  '22000000-0000-4000-8000-000000000020',
  'Marketplace Seller',
  'original_owner',
  'The professor authored the complete work and controls permanent-sale rights.',
  'https://example.invalid/rights/book',
  true,
  false,
  null
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.review_marketplace_case(
  'rights',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'rights_reviews') item
    where item->>'publication_id'='22000000-0000-4000-8000-000000000020'
  ),
  'approved',
  'Original ownership and permanent-sale scope verified.'
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,status
from public.submit_marketplace_listing(
  'book',
  '22000000-0000-4000-8000-000000000020',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_my_marketplace_dashboard()->'rights_reviews') item
    where item->>'publication_id'='22000000-0000-4000-8000-000000000020'
  ),
  'purchase',
  1299,
  null
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
begin
  perform public.review_marketplace_case(
    'listing',
    (
      select (item->>'id')::uuid
      from jsonb_array_elements(public.get_marketplace_control_center()->'listings') item
      where item->>'publication_id'='22000000-0000-4000-8000-000000000020'
    ),
    'approved',
    'Attempted before tax approval for a fail-closed proof.'
  );
  raise exception 'Expected listing approval to fail while tax control is pending';
exception
  when others then
    if sqlerrm not like '%Tax responsibility must be approved%' then raise; end if;
end;
$$;

select id,status
from public.configure_marketplace_tax_control(
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'tax_controls') item
    where item->>'country_code'='US'
      and item->>'seller_application_id'=(
        select id::text from public.publisher_applications
        where applicant_id='22000000-0000-4000-8000-000000000001'
      )
  ),
  'stripe-tax-registration-gate',
  'platform',
  'Registration evidence saved before the separate approval decision.'
);
select public.review_marketplace_case(
  'tax',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'tax_controls') item
    where item->>'country_code'='US'
      and item->>'seller_application_id'=(
        select id::text from public.publisher_applications
        where applicant_id='22000000-0000-4000-8000-000000000001'
      )
  ),
  'approved',
  'Stripe Tax registration and platform marketplace liability verified.'
);
select public.review_marketplace_case(
  'listing',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'listings') item
    where item->>'publication_id'='22000000-0000-4000-8000-000000000020'
  ),
  'approved',
  'Seller, permanent-sale rights, tax, price, and source release verified.'
);

reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
  if not exists (
    select 1 from public.list_alex_morrison_catalog('Governed Marketplace Book')
    where item_kind='book'
      and item_id='22000000-0000-4000-8000-000000000020'
      and listing_status='published'
      and price_cents=1299
      and checkout_available
      and marketplace_listing_id is not null
  ) then
    raise exception 'Approved commercial book did not expose governed checkout';
  end if;
end;
$$;

reset role;
insert into public.marketplace_orders (
  id,buyer_id,listing_id,seller_application_id,client_request_key,
  item_kind,publication_id,access_model,currency,subtotal_cents,tax_cents,
  total_cents,platform_fee_cents,seller_net_cents,status,
  stripe_checkout_session_id
) values (
  '22000000-0000-4000-8000-000000000030',
  '22000000-0000-4000-8000-000000000002',
  (select id from public.marketplace_listings where publication_id='22000000-0000-4000-8000-000000000020'),
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  '22000000-0000-4000-8000-000000000031',
  'book',
  '22000000-0000-4000-8000-000000000020',
  'purchase','usd',1299,0,1299,195,1104,'checkout_created','cs_marketplace_book'
);

select id,status
from public.marketplace_fulfill_order(
  '22000000-0000-4000-8000-000000000030',
  'cs_marketplace_book','pi_marketplace_book','ch_marketplace_book',
  'cus_marketplace_buyer','tr_marketplace_book','fee_marketplace_book',
  1299,100,1399,'{"webhook":"checkout.session.completed"}'::jsonb
);

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
begin
  if not exists (
    select 1 from public.publications
    where id='22000000-0000-4000-8000-000000000020'
  ) then
    raise exception 'Webhook-fulfilled purchase did not grant book access';
  end if;
  if not exists (
    select 1 from public.marketplace_entitlements
    where order_id='22000000-0000-4000-8000-000000000030'
      and status='active'
      and expires_at is null
  ) then
    raise exception 'Permanent purchase entitlement is missing';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(public.get_my_marketplace_dashboard()->'purchases') item
    where item->>'id'='22000000-0000-4000-8000-000000000030'
      and item->>'tax_liability'='platform'
      and (item->>'seller_net_cents')::integer=1104
  ) then
    raise exception 'Platform-liable tax did not preserve the governed seller net';
  end if;
end;
$$;

select id,status
from public.request_marketplace_refund(
  '22000000-0000-4000-8000-000000000030',
  1399,
  'The buyer requested a full refund during the governed test window.'
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.review_marketplace_case(
  'refund',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'refunds') item
    where item->>'order_id'='22000000-0000-4000-8000-000000000030'
  ),
  'approved',
  'Full refund reason and remaining paid balance verified.'
);

reset role;
select set_config('request.jwt.claim.sub','',true);
update public.marketplace_refund_requests
set status='succeeded',stripe_refund_id='re_marketplace_book',processed_at=now()
where order_id='22000000-0000-4000-8000-000000000030';
update public.marketplace_orders
set status='refunded',refunded_cents=total_cents
where id='22000000-0000-4000-8000-000000000030';
select public.marketplace_revoke_order_entitlement(
  '22000000-0000-4000-8000-000000000030',
  'refunded',
  'Stripe confirmed the full marketplace refund.'
);

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.publications
    where id='22000000-0000-4000-8000-000000000020'
  ) then
    raise exception 'Full refund did not revoke commercial book access';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,status
from public.submit_marketplace_rights_review(
  'course',
  '22000000-0000-4000-8000-000000000010',
  'Marketplace Seller',
  'original_owner',
  'The professor owns this complete course and permits a thirty-day rental.',
  'https://example.invalid/rights/course',
  false,
  true,
  null
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.review_marketplace_case(
  'rights',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'rights_reviews') item
    where item->>'course_id'='22000000-0000-4000-8000-000000000010'
  ),
  'approved',
  'Original course ownership and rental scope verified.'
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,status
from public.submit_marketplace_listing(
  'course',
  '22000000-0000-4000-8000-000000000010',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_my_marketplace_dashboard()->'rights_reviews') item
    where item->>'course_id'='22000000-0000-4000-8000-000000000010'
  ),
  'rental',
  999,
  30
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.review_marketplace_case(
  'listing',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'listings') item
    where item->>'course_id'='22000000-0000-4000-8000-000000000010'
  ),
  'approved',
  'Seller, rental rights, tax, price, duration, and course package verified.'
);

reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.marketplace_orders (
  id,buyer_id,listing_id,seller_application_id,client_request_key,
  item_kind,course_id,access_model,rental_days,currency,subtotal_cents,
  tax_cents,total_cents,platform_fee_cents,seller_net_cents,status,
  stripe_checkout_session_id
) values (
  '22000000-0000-4000-8000-000000000040',
  '22000000-0000-4000-8000-000000000002',
  (select id from public.marketplace_listings where course_id='22000000-0000-4000-8000-000000000010'),
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  '22000000-0000-4000-8000-000000000041',
  'course','22000000-0000-4000-8000-000000000010',
  'rental',30,'usd',999,0,999,150,849,'checkout_created','cs_marketplace_course'
);
select id,status
from public.marketplace_fulfill_order(
  '22000000-0000-4000-8000-000000000040',
  'cs_marketplace_course','pi_marketplace_course','ch_marketplace_course',
  'cus_marketplace_buyer','tr_marketplace_course','fee_marketplace_course',
  999,0,999,'{"webhook":"checkout.session.completed"}'::jsonb
);

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
begin
  if not private.can_access_course('22000000-0000-4000-8000-000000000010') then
    raise exception 'Webhook-fulfilled rental did not grant course access';
  end if;
  if not exists (
    select 1 from public.marketplace_entitlements
    where order_id='22000000-0000-4000-8000-000000000040'
      and status='active'
      and expires_at between now()+interval '29 days' and now()+interval '31 days'
  ) then
    raise exception 'Course rental entitlement did not receive its governed expiration';
  end if;
end;
$$;

-- A permanent purchase can supersede an active rental in the one-row course
-- membership projection. Refunding that purchase must restore the rental
-- instead of removing access that the learner still owns.
reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.marketplace_orders (
  id,buyer_id,listing_id,seller_application_id,client_request_key,
  item_kind,course_id,access_model,currency,subtotal_cents,
  tax_cents,total_cents,platform_fee_cents,seller_net_cents,status,
  stripe_checkout_session_id
) values (
  '22000000-0000-4000-8000-000000000042',
  '22000000-0000-4000-8000-000000000002',
  (select id from public.marketplace_listings where course_id='22000000-0000-4000-8000-000000000010'),
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  '22000000-0000-4000-8000-000000000043',
  'course','22000000-0000-4000-8000-000000000010',
  'purchase','usd',499,0,499,75,424,'checkout_created','cs_marketplace_course_purchase'
);
select id,status
from public.marketplace_fulfill_order(
  '22000000-0000-4000-8000-000000000042',
  'cs_marketplace_course_purchase','pi_marketplace_course_purchase',
  'ch_marketplace_course_purchase','cus_marketplace_buyer',
  'tr_marketplace_course_purchase','fee_marketplace_course_purchase',
  499,0,499,'{"webhook":"checkout.session.completed"}'::jsonb
);

select public.marketplace_revoke_order_entitlement(
  '22000000-0000-4000-8000-000000000042',
  'refunded',
  'Stripe confirmed the overlapping purchase refund.'
);

do $$
begin
  if not exists (
    select 1 from public.marketplace_entitlements
    where order_id='22000000-0000-4000-8000-000000000042'
      and status='refunded'
  ) then
    raise exception 'Overlapping purchase entitlement was not revoked';
  end if;
  if not exists (
    select 1 from public.course_memberships
    where course_id='22000000-0000-4000-8000-000000000010'
      and user_id='22000000-0000-4000-8000-000000000002'
      and access_source='marketplace'
      and marketplace_order_id='22000000-0000-4000-8000-000000000040'
      and access_expires_at between now()+interval '29 days' and now()+interval '31 days'
  ) then
    raise exception 'Refund did not restore the active rental membership';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.marketplace_disputes (
  order_id,seller_application_id,stripe_dispute_id,stripe_charge_id,
  amount_cents,currency,reason,status
) values (
  '22000000-0000-4000-8000-000000000040',
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  'dp_marketplace_course','ch_marketplace_course',999,'usd','fraudulent','needs_response'
);
insert into public.marketplace_payout_events (
  seller_application_id,stripe_payout_id,stripe_account_id,
  amount_cents,currency,status,arrival_at
) values (
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  'po_marketplace_seller','acct_marketplace_gate',849,'usd','paid',now()
);

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare center jsonb;
begin
  center := public.get_marketplace_control_center();
  if not exists (
    select 1 from jsonb_array_elements(center->'disputes') item
    where item->>'stripe_dispute_id'='dp_marketplace_course'
  ) or not exists (
    select 1 from jsonb_array_elements(center->'payouts') item
    where item->>'stripe_payout_id'='po_marketplace_seller'
  ) then
    raise exception 'Control Center did not reconcile dispute and payout evidence';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','',true);
rollback;
