-- Reconcile one governed marketplace transaction across the student Library,
-- professor/seller workspace, and platform-owner Control Center. Money and
-- access remain authoritative in the existing order and entitlement tables.

alter table public.student_account_notifications
  drop constraint if exists student_account_notifications_notification_type_check;
alter table public.student_account_notifications
  add constraint student_account_notifications_notification_type_check
  check (notification_type in (
    'enrollment_approved','course_assigned','course_completed',
    'marketplace_purchase','marketplace_rental','marketplace_refund',
    'marketplace_dispute','marketplace_access_ended'
  ));

alter table public.student_account_notifications
  drop constraint if exists student_account_notifications_route_check;
alter table public.student_account_notifications
  add constraint student_account_notifications_route_check
  check (route in ('classes','course','rewards','library'));

create or replace function private.notify_marketplace_entitlement_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_title text;
  v_notification_type text;
  v_notification_title text;
  v_body text;
begin
  if tg_op='UPDATE'
     and new.status is not distinct from old.status
     and new.expires_at is not distinct from old.expires_at then
    return new;
  end if;

  select listing.title_snapshot into v_title
  from public.marketplace_listings listing
  where listing.id=new.listing_id;
  v_title := coalesce(nullif(trim(v_title),''),'Library item');

  if new.status='active' and new.access_model='purchase' then
    v_notification_type := 'marketplace_purchase';
    v_notification_title := 'Purchase ready · '||v_title;
    v_body := 'Your verified purchase is available in the Alex B. Morrison Library.';
  elsif new.status='active' and new.access_model='rental' then
    v_notification_type := 'marketplace_rental';
    v_notification_title := 'Rental ready · '||v_title;
    v_body := 'Your rental is available'||case
      when new.expires_at is null then '.'
      else ' through '||to_char(new.expires_at at time zone 'UTC','Mon DD, YYYY')||' UTC.'
    end;
  elsif new.status='refunded' then
    v_notification_type := 'marketplace_refund';
    v_notification_title := 'Refund completed · '||v_title;
    v_body := 'Stripe confirmed the full refund. This order no longer grants access.';
  elsif new.status='disputed' then
    v_notification_type := 'marketplace_dispute';
    v_notification_title := 'Access changed · '||v_title;
    v_body := 'A closed payment dispute changed this order and its marketplace access.';
  elsif new.status in ('expired','revoked') then
    v_notification_type := 'marketplace_access_ended';
    v_notification_title := 'Access ended · '||v_title;
    v_body := 'This marketplace order no longer provides access. Open the Library for details.';
  else
    return new;
  end if;

  perform private.create_student_course_notification(
    new.buyer_id,
    new.course_id,
    v_notification_type,
    v_notification_title,
    v_body,
    'library',
    'marketplace:'||new.order_id::text||':'||new.status
  );
  return new;
end;
$$;

revoke all on function private.notify_marketplace_entitlement_change()
from public,anon,authenticated;

drop trigger if exists marketplace_entitlements_notify_student
on public.marketplace_entitlements;
create trigger marketplace_entitlements_notify_student
after insert or update of status,expires_at
on public.marketplace_entitlements
for each row execute function private.notify_marketplace_entitlement_change();

create or replace function public.get_my_marketplace_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'seller_application',(
      select to_jsonb(application)-'stripe_account_id'
      from public.publisher_applications application
      where application.applicant_id=v_user_id
      order by application.created_at desc limit 1
    ),
    'rights_reviews',coalesce((
      select jsonb_agg(to_jsonb(rights) order by rights.created_at desc)
      from public.publication_rights_reviews rights
      where rights.submitted_by=v_user_id
    ),'[]'::jsonb),
    'listings',coalesce((
      select jsonb_agg(to_jsonb(listing) order by listing.created_at desc)
      from public.marketplace_listings listing
      join public.publisher_applications application
        on application.id=listing.seller_application_id
      where application.applicant_id=v_user_id
    ),'[]'::jsonb),
    'sales',coalesce((
      select jsonb_agg(to_jsonb(sale) order by sale.created_at desc)
      from (
        select
          orders.id,orders.listing_id,orders.item_kind,
          orders.publication_id,orders.course_id,orders.access_model,
          orders.rental_days,orders.currency,orders.tax_liability,
          orders.subtotal_cents,orders.tax_cents,orders.total_cents,
          orders.platform_fee_cents,orders.seller_net_cents,
          orders.refunded_cents,orders.status,orders.paid_at,
          orders.fulfilled_at,orders.created_at,orders.updated_at,
          listing.title_snapshot,
          entitlement.status as entitlement_status,
          entitlement.starts_at as entitlement_starts_at,
          entitlement.expires_at as entitlement_expires_at,
          entitlement.revoked_at as entitlement_revoked_at,
          latest_refund.status as refund_status,
          latest_refund.amount_cents as refund_amount_cents,
          latest_dispute.status as dispute_status,
          latest_dispute.evidence_due_at as dispute_evidence_due_at
        from public.marketplace_orders orders
        join public.marketplace_listings listing on listing.id=orders.listing_id
        join public.publisher_applications application
          on application.id=orders.seller_application_id
        left join public.marketplace_entitlements entitlement
          on entitlement.order_id=orders.id
        left join lateral (
          select refund.status,refund.amount_cents
          from public.marketplace_refund_requests refund
          where refund.order_id=orders.id
          order by refund.created_at desc limit 1
        ) latest_refund on true
        left join lateral (
          select dispute.status,dispute.evidence_due_at
          from public.marketplace_disputes dispute
          where dispute.order_id=orders.id
          order by dispute.opened_at desc limit 1
        ) latest_dispute on true
        where application.applicant_id=v_user_id
        order by orders.created_at desc
        limit 100
      ) sale
    ),'[]'::jsonb),
    'seller_summary',(
      select jsonb_build_object(
        'order_count',count(orders.id),
        'fulfilled_count',count(orders.id) filter (
          where orders.status in ('fulfilled','partially_refunded','refunded','disputed','chargeback')
        ),
        'gross_processed_cents',coalesce(sum(orders.total_cents) filter (
          where orders.status in ('fulfilled','partially_refunded','refunded','disputed','chargeback')
        ),0),
        'platform_fees_cents',coalesce(sum(orders.platform_fee_cents) filter (
          where orders.status in ('fulfilled','partially_refunded','refunded','disputed','chargeback')
        ),0),
        'seller_allocation_cents',coalesce(sum(orders.seller_net_cents) filter (
          where orders.status in ('fulfilled','partially_refunded','refunded','disputed','chargeback')
        ),0),
        'refunded_cents',coalesce(sum(orders.refunded_cents),0),
        'paid_payout_cents',coalesce((
          select sum(payout.amount_cents)
          from public.marketplace_payout_events payout
          join public.publisher_applications seller
            on seller.id=payout.seller_application_id
          where seller.applicant_id=v_user_id
            and payout.status='paid'
        ),0)
      )
      from public.marketplace_orders orders
      join public.publisher_applications application
        on application.id=orders.seller_application_id
      where application.applicant_id=v_user_id
    ),
    'purchases',coalesce((
      select jsonb_agg(to_jsonb(purchase) order by purchase.created_at desc)
      from (
        select
          orders.id,orders.listing_id,orders.item_kind,
          orders.publication_id,orders.course_id,orders.access_model,
          orders.rental_days,orders.currency,orders.tax_liability,
          orders.subtotal_cents,orders.tax_cents,orders.total_cents,
          orders.platform_fee_cents,orders.seller_net_cents,
          orders.refunded_cents,orders.status,orders.paid_at,
          orders.fulfilled_at,orders.created_at,orders.updated_at,
          listing.title_snapshot,
          course_publication.id as course_publication_id,
          course.education_division,
          entitlement.status as entitlement_status,
          entitlement.starts_at as entitlement_starts_at,
          entitlement.expires_at as entitlement_expires_at,
          entitlement.revoked_at as entitlement_revoked_at,
          entitlement.revocation_reason,
          latest_refund.status as refund_status,
          latest_refund.amount_cents as refund_amount_cents,
          latest_dispute.status as dispute_status,
          latest_dispute.evidence_due_at as dispute_evidence_due_at
        from public.marketplace_orders orders
        join public.marketplace_listings listing on listing.id=orders.listing_id
        left join public.marketplace_entitlements entitlement
          on entitlement.order_id=orders.id
        left join public.courses course on course.id=orders.course_id
        left join public.course_publications course_publication
          on course_publication.course_id=orders.course_id
         and course_publication.status='published'
        left join lateral (
          select refund.status,refund.amount_cents
          from public.marketplace_refund_requests refund
          where refund.order_id=orders.id
          order by refund.created_at desc limit 1
        ) latest_refund on true
        left join lateral (
          select dispute.status,dispute.evidence_due_at
          from public.marketplace_disputes dispute
          where dispute.order_id=orders.id
          order by dispute.opened_at desc limit 1
        ) latest_dispute on true
        where orders.buyer_id=v_user_id
        order by orders.created_at desc
        limit 100
      ) purchase
    ),'[]'::jsonb),
    'entitlements',coalesce((
      select jsonb_agg(
        to_jsonb(entitlement)
        || jsonb_build_object('title_snapshot',listing.title_snapshot)
        order by entitlement.created_at desc
      )
      from public.marketplace_entitlements entitlement
      join public.marketplace_listings listing on listing.id=entitlement.listing_id
      where entitlement.buyer_id=v_user_id
    ),'[]'::jsonb),
    'refunds',coalesce((
      select jsonb_agg(
        to_jsonb(refund)-'reviewed_by'-'review_notes'
        order by refund.created_at desc
      )
      from public.marketplace_refund_requests refund
      join public.marketplace_orders orders on orders.id=refund.order_id
      join public.publisher_applications application
        on application.id=orders.seller_application_id
      where refund.requested_by=v_user_id
         or orders.buyer_id=v_user_id
         or application.applicant_id=v_user_id
    ),'[]'::jsonb),
    'disputes',coalesce((
      select jsonb_agg((to_jsonb(dispute)-'processor_payload') order by dispute.opened_at desc)
      from public.marketplace_disputes dispute
      join public.publisher_applications application
        on application.id=dispute.seller_application_id
      where application.applicant_id=v_user_id
    ),'[]'::jsonb),
    'payouts',coalesce((
      select jsonb_agg((to_jsonb(payout)-'processor_payload'-'stripe_account_id') order by payout.created_at desc)
      from public.marketplace_payout_events payout
      join public.publisher_applications application
        on application.id=payout.seller_application_id
      where application.applicant_id=v_user_id
    ),'[]'::jsonb),
    'generated_at',now()
  );
end;
$$;

revoke all on function public.get_my_marketplace_dashboard()
from public,anon;
grant execute on function public.get_my_marketplace_dashboard()
to authenticated;

create or replace function public.get_marketplace_control_center()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not private.is_platform_owner((select auth.uid())) then
    raise exception 'Platform owner marketplace review required';
  end if;
  return jsonb_build_object(
    'applications',coalesce((
      select jsonb_agg(
        to_jsonb(application)
        || jsonb_build_object(
          'applicant_name',profile.full_name,
          'applicant_email',profile.email
        )
        order by application.created_at desc
      )
      from public.publisher_applications application
      join public.profiles profile on profile.id=application.applicant_id
    ),'[]'::jsonb),
    'rights_reviews',coalesce((
      select jsonb_agg(to_jsonb(rights) order by rights.created_at desc)
      from public.publication_rights_reviews rights
    ),'[]'::jsonb),
    'listings',coalesce((
      select jsonb_agg(to_jsonb(listing) order by listing.created_at desc)
      from public.marketplace_listings listing
    ),'[]'::jsonb),
    'orders',coalesce((
      select jsonb_agg(to_jsonb(trace) order by trace.created_at desc)
      from (
        select
          orders.id,orders.item_kind,orders.access_model,orders.currency,
          orders.status,orders.subtotal_cents,orders.tax_cents,
          orders.total_cents,orders.platform_fee_cents,
          orders.seller_net_cents,orders.refunded_cents,
          orders.paid_at,orders.fulfilled_at,orders.created_at,
          listing.title_snapshot,application.organization_name,
          entitlement.status as entitlement_status,
          entitlement.expires_at as entitlement_expires_at,
          latest_refund.status as refund_status,
          latest_dispute.status as dispute_status
        from public.marketplace_orders orders
        join public.marketplace_listings listing on listing.id=orders.listing_id
        join public.publisher_applications application
          on application.id=orders.seller_application_id
        left join public.marketplace_entitlements entitlement
          on entitlement.order_id=orders.id
        left join lateral (
          select refund.status
          from public.marketplace_refund_requests refund
          where refund.order_id=orders.id
          order by refund.created_at desc limit 1
        ) latest_refund on true
        left join lateral (
          select dispute.status
          from public.marketplace_disputes dispute
          where dispute.order_id=orders.id
          order by dispute.opened_at desc limit 1
        ) latest_dispute on true
        order by orders.created_at desc
        limit 200
      ) trace
    ),'[]'::jsonb),
    'refunds',coalesce((
      select jsonb_agg(
        to_jsonb(refund)
        || jsonb_build_object(
          'buyer_id',orders.buyer_id,
          'order_total_cents',orders.total_cents,
          'order_refunded_cents',orders.refunded_cents
        )
        order by refund.created_at desc
      )
      from public.marketplace_refund_requests refund
      join public.marketplace_orders orders on orders.id=refund.order_id
    ),'[]'::jsonb),
    'disputes',coalesce((
      select jsonb_agg((to_jsonb(dispute)-'processor_payload') order by dispute.opened_at desc)
      from public.marketplace_disputes dispute
    ),'[]'::jsonb),
    'tax_controls',coalesce((
      select jsonb_agg(to_jsonb(tax) order by tax.created_at desc)
      from public.marketplace_tax_controls tax
    ),'[]'::jsonb),
    'payouts',coalesce((
      select jsonb_agg((to_jsonb(payout)-'processor_payload'-'stripe_account_id') order by payout.created_at desc)
      from (
        select * from public.marketplace_payout_events
        order by created_at desc limit 200
      ) payout
    ),'[]'::jsonb),
    'statistics',jsonb_build_object(
      'pending_sellers',(select count(*) from public.publisher_applications where status in ('submitted','reviewing')),
      'pending_rights',(select count(*) from public.publication_rights_reviews where status in ('submitted','reviewing')),
      'pending_listings',(select count(*) from public.marketplace_listings where status in ('submitted','reviewing')),
      'open_refunds',(select count(*) from public.marketplace_refund_requests where status in ('requested','reviewing','approved','processing')),
      'open_disputes',(select count(*) from public.marketplace_disputes where status not in ('won','lost','warning_closed')),
      'blocked_tax_controls',(select count(*) from public.marketplace_tax_controls where status<>'approved'),
      'orders',(select count(*) from public.marketplace_orders),
      'gross_processed_cents',coalesce((select sum(total_cents) from public.marketplace_orders where status in ('fulfilled','partially_refunded','refunded','disputed','chargeback')),0),
      'refunded_cents',coalesce((select sum(refunded_cents) from public.marketplace_orders),0),
      'paid_payout_cents',coalesce((select sum(amount_cents) from public.marketplace_payout_events where status='paid'),0)
    ),
    'generated_at',now()
  );
end;
$$;

revoke all on function public.get_marketplace_control_center()
from public,anon;
grant execute on function public.get_marketplace_control_center()
to authenticated;
