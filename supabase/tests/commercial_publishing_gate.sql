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
  'The professor authored the complete work and controls permanent-sale and rental rights.',
  'https://example.invalid/rights/book',
  true,
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
        and item->>'access_model'='purchase'
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
      and item->>'access_model'='purchase'
  ),
  'approved',
  'Seller, permanent-sale rights, tax, price, and source release verified.'
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
  'rental',
  499,
  14
);

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.review_marketplace_case(
  'listing',
  (
    select (item->>'id')::uuid
    from jsonb_array_elements(public.get_marketplace_control_center()->'listings') item
    where item->>'publication_id'='22000000-0000-4000-8000-000000000020'
      and item->>'access_model'='rental'
  ),
  'approved',
  'Seller, rental rights, tax, price, duration, and source release verified.'
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
      and access_model='purchase'
      and price_cents=1299
      and checkout_available
      and marketplace_listing_id is not null
  ) then
    raise exception 'Approved commercial book purchase did not expose governed checkout';
  end if;
  if not exists (
    select 1 from public.list_alex_morrison_catalog('Governed Marketplace Book')
    where item_kind='book'
      and item_id='22000000-0000-4000-8000-000000000020'
      and listing_status='published'
      and access_model='rental'
      and price_cents=499
      and rental_days=14
      and checkout_available
      and marketplace_listing_id is not null
  ) then
    raise exception 'Approved commercial book rental did not expose governed checkout';
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
  (select id from public.marketplace_listings where publication_id='22000000-0000-4000-8000-000000000020' and access_model='purchase'),
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
      and item->>'title_snapshot'='Governed Marketplace Book'
      and item->>'entitlement_status'='active'
  ) then
    raise exception 'Student commerce record did not reconcile title, access, and seller net';
  end if;
  if not exists (
    select 1 from public.student_account_notifications
    where student_id='22000000-0000-4000-8000-000000000002'
      and notification_type='marketplace_purchase'
      and route='library'
      and dedupe_key='marketplace:22000000-0000-4000-8000-000000000030:active'
  ) then
    raise exception 'Verified purchase did not create the Library notification';
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
  if not exists (
    select 1 from public.student_account_notifications
    where student_id='22000000-0000-4000-8000-000000000002'
      and notification_type='marketplace_refund'
      and route='library'
      and dedupe_key='marketplace:22000000-0000-4000-8000-000000000030:refunded'
  ) then
    raise exception 'Confirmed refund did not create the Library notification';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','',true);
insert into public.marketplace_orders (
  id,buyer_id,listing_id,seller_application_id,client_request_key,
  item_kind,publication_id,access_model,rental_days,currency,subtotal_cents,
  tax_cents,total_cents,platform_fee_cents,seller_net_cents,status,
  stripe_checkout_session_id
) values (
  '22000000-0000-4000-8000-000000000032',
  '22000000-0000-4000-8000-000000000002',
  (select id from public.marketplace_listings where publication_id='22000000-0000-4000-8000-000000000020' and access_model='rental'),
  (select id from public.publisher_applications where applicant_id='22000000-0000-4000-8000-000000000001'),
  '22000000-0000-4000-8000-000000000033',
  'book','22000000-0000-4000-8000-000000000020',
  'rental',14,'usd',499,0,499,75,424,'checkout_created','cs_marketplace_book_rental'
);

select id,status
from public.marketplace_fulfill_order(
  '22000000-0000-4000-8000-000000000032',
  'cs_marketplace_book_rental','pi_marketplace_book_rental','ch_marketplace_book_rental',
  'cus_marketplace_buyer','tr_marketplace_book_rental','fee_marketplace_book_rental',
  499,40,539,'{"webhook":"checkout.session.completed"}'::jsonb
);

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
begin
  if not exists (
    select 1 from public.publications
    where id='22000000-0000-4000-8000-000000000020'
  ) then
    raise exception 'Webhook-fulfilled rental did not restore book access';
  end if;
  if not exists (
    select 1 from public.marketplace_entitlements
    where order_id='22000000-0000-4000-8000-000000000032'
      and status='active'
      and expires_at between now()+interval '13 days' and now()+interval '15 days'
  ) then
    raise exception 'Book rental entitlement did not receive its governed expiration';
  end if;
  if not exists (
    select 1 from public.student_account_notifications
    where student_id='22000000-0000-4000-8000-000000000002'
      and notification_type='marketplace_rental'
      and route='library'
      and dedupe_key='marketplace:22000000-0000-4000-8000-000000000032:active'
  ) then
    raise exception 'Verified book rental did not create the Library notification';
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

select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare dashboard jsonb;
begin
  dashboard := public.get_my_marketplace_dashboard();
  if not exists (
    select 1 from jsonb_array_elements(dashboard->'sales') item
    where item->>'id'='22000000-0000-4000-8000-000000000030'
      and item->>'title_snapshot'='Governed Marketplace Book'
      and item->>'entitlement_status'='refunded'
  ) or (dashboard->'seller_summary'->>'paid_payout_cents')::integer<>849 then
    raise exception 'Seller ledger did not reconcile the titled sale, access state, and paid payout';
  end if;
end;
$$;

do $$
declare report jsonb;
begin
  report := public.get_my_marketplace_sales_report(now()-interval '1 day',now()+interval '1 day');
  if (report->'totals'->>'order_count')::integer<4
     or not exists (
       select 1 from jsonb_array_elements(report->'transactions') item
       where item->>'id'='22000000-0000-4000-8000-000000000030'
         and item->>'receipt_number' is not null
     )
     or report::text like '%buyer_id%' then
    raise exception 'Seller-period report did not reconcile sanitized receipts and sales totals';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare receipt jsonb;
begin
  receipt := public.get_my_marketplace_receipt('22000000-0000-4000-8000-000000000030');
  if receipt->>'receipt_number' is null
     or receipt->>'seller_name'<>'Marketplace Seller Press'
     or receipt->>'title_snapshot'<>'Governed Marketplace Book'
     or (receipt->>'tax_invoice')::boolean then
    raise exception 'Buyer receipt did not preserve the governed transaction record';
  end if;
end;
$$;

reset role;
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
  ) or not exists (
    select 1 from jsonb_array_elements(center->'orders') item
    where item->>'id'='22000000-0000-4000-8000-000000000030'
      and item->>'title_snapshot'='Governed Marketplace Book'
      and item->>'entitlement_status'='refunded'
      and item->>'refund_status'='succeeded'
  ) then
    raise exception 'Control Center did not reconcile the order, access, refund, dispute, and payout evidence';
  end if;
end;
$$;

do $$
declare
  control record;
  gate jsonb;
  state_updated_at timestamptz;
begin
  gate := public.get_marketplace_launch_control_center();
  if (gate->'readiness'->>'ready')::boolean
     or (gate->'state'->>'effective_live_charging_enabled')::boolean then
    raise exception 'Production marketplace launch must begin fail-closed';
  end if;

  begin
    state_updated_at := (gate->'state'->>'updated_at')::timestamptz;
    perform public.set_marketplace_live_charging(
      true,state_updated_at,
      'Fixture attempted activation before required launch evidence.',true
    );
    raise exception 'Expected premature live charging activation to fail';
  exception when others then
    if sqlerrm='Expected premature live charging activation to fail' then raise; end if;
  end;

  for control in
    select item->>'control_key' as control_key
    from jsonb_array_elements(gate->'controls') item
    where (item->>'required')::boolean
  loop
    perform public.review_marketplace_launch_control(
      control.control_key,'approved',
      'fixture-evidence-'||control.control_key,
      'Disposable SQL gate independently reviewed this synthetic launch evidence.',
      now()+interval '30 days',true
    );
  end loop;

  gate := public.get_marketplace_launch_control_center();
  if not (gate->'readiness'->>'ready')::boolean then
    raise exception 'Current required launch controls did not satisfy readiness';
  end if;
  state_updated_at := (gate->'state'->>'updated_at')::timestamptz;
  perform public.set_marketplace_live_charging(
    true,state_updated_at,
    'Disposable SQL gate activated live mode only after every synthetic approval.',true
  );
  gate := public.get_marketplace_launch_control_center();
  if not (gate->'state'->>'effective_live_charging_enabled')::boolean then
    raise exception 'Approved launch state did not expose the service-role runtime gate';
  end if;

  perform public.review_marketplace_launch_control(
    'security.production_webhooks','blocked','fixture-blocked-evidence',
    'Synthetic webhook evidence was withdrawn to prove automatic fail-closed behavior.',
    null,false
  );
  gate := public.get_marketplace_launch_control_center();
  if (gate->'state'->>'live_charging_enabled')::boolean then
    raise exception 'A blocked required control did not automatically disable live charging';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
do $$
declare gate jsonb;
begin
  gate := public.get_marketplace_launch_runtime_gate();
  if (gate->>'effective_live_charging_enabled')::boolean then
    raise exception 'Service-role launch gate did not remain fail-closed after evidence withdrawal';
  end if;
end;
$$;
reset role;
rollback;
