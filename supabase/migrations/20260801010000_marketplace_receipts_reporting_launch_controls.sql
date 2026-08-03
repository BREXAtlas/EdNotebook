-- Add buyer receipts, seller-period reporting, and a fail-closed production
-- launch gate. Test-mode commerce remains available for governed staging
-- evidence; a live Stripe key cannot create Checkout Sessions until every
-- required production control is approved and current.

alter table public.marketplace_orders
  add column if not exists receipt_number text,
  add column if not exists receipt_issued_at timestamptz;

create unique index if not exists marketplace_orders_receipt_number_uidx
  on public.marketplace_orders (receipt_number)
  where receipt_number is not null;

create or replace function private.assign_marketplace_order_receipt()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if tg_op='UPDATE' and old.receipt_number is not null then
    if new.receipt_number is distinct from old.receipt_number
       or new.receipt_issued_at is distinct from old.receipt_issued_at then
      raise exception 'Marketplace receipt identity is immutable';
    end if;
    return new;
  end if;

  if new.receipt_number is null
     and new.status in ('paid','fulfilled','partially_refunded','refunded','disputed','chargeback') then
    new.receipt_number := 'EDN-'
      ||to_char(coalesce(new.paid_at,new.fulfilled_at,new.created_at,now()) at time zone 'UTC','YYYYMMDD')
      ||'-'||upper(right(replace(new.id::text,'-',''),10));
    new.receipt_issued_at := coalesce(new.paid_at,new.fulfilled_at,now());
  end if;
  return new;
end;
$$;

revoke all on function private.assign_marketplace_order_receipt()
from public,anon,authenticated;

drop trigger if exists marketplace_orders_assign_receipt
on public.marketplace_orders;
create trigger marketplace_orders_assign_receipt
before insert or update of status,paid_at,fulfilled_at,receipt_number,receipt_issued_at
on public.marketplace_orders
for each row execute function private.assign_marketplace_order_receipt();

update public.marketplace_orders
set receipt_number='EDN-'
      ||to_char(coalesce(paid_at,fulfilled_at,created_at) at time zone 'UTC','YYYYMMDD')
      ||'-'||upper(right(replace(id::text,'-',''),10)),
    receipt_issued_at=coalesce(paid_at,fulfilled_at,created_at)
where receipt_number is null
  and status in ('paid','fulfilled','partially_refunded','refunded','disputed','chargeback');

create table public.marketplace_commerce_launch (
  environment text primary key check (environment in ('production')),
  checkout_mode text not null default 'test_only'
    check (checkout_mode in ('test_only','live')),
  live_charging_enabled boolean not null default false,
  activated_by uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  deactivated_at timestamptz,
  change_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (checkout_mode='test_only' and not live_charging_enabled)
    or (checkout_mode='live' and live_charging_enabled)
  )
);

create table public.marketplace_launch_controls (
  id uuid primary key default gen_random_uuid(),
  environment text not null references public.marketplace_commerce_launch(environment) on delete restrict,
  control_key text not null check (control_key ~ '^[a-z0-9_.-]+$'),
  category text not null
    check (category in ('legal','tax','finance','security','support','operations')),
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 20 and 1000),
  required boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending','approved','blocked')),
  evidence_reference text,
  review_notes text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment,control_key)
);

create index marketplace_launch_controls_readiness_idx
  on public.marketplace_launch_controls (environment,required,status,expires_at);

create trigger marketplace_commerce_launch_touch_updated_at
before update on public.marketplace_commerce_launch
for each row execute function private.touch_updated_at();
create trigger marketplace_launch_controls_touch_updated_at
before update on public.marketplace_launch_controls
for each row execute function private.touch_updated_at();

alter table public.marketplace_commerce_launch enable row level security;
alter table public.marketplace_launch_controls enable row level security;

revoke all on public.marketplace_commerce_launch,public.marketplace_launch_controls
from anon,authenticated;

insert into public.marketplace_commerce_launch (
  environment,checkout_mode,live_charging_enabled,change_reason
) values (
  'production','test_only',false,
  'Live charging remains blocked until every required production control is approved.'
)
on conflict (environment) do nothing;

insert into public.marketplace_launch_controls (
  environment,control_key,category,title,description,required
) values
  ('production','legal.marketplace_terms','legal','Marketplace terms and seller agreement','Counsel-approved buyer terms, seller agreement, refund policy, rental terms, and prohibited-content rules are published and versioned.',true),
  ('production','legal.rights_takedown','legal','Rights, takedown, and appeal process','Copyright ownership review, notice-and-takedown handling, repeat-infringer response, and seller appeal ownership are approved.',true),
  ('production','tax.registration_nexus','tax','Tax registrations and nexus review','Finance or tax counsel verified where EdNotebook must register, collect, report, and remit marketplace taxes.',true),
  ('production','tax.product_codes_liability','tax','Product tax codes and liability','Stripe Tax product codes, transaction locations, marketplace-facilitator liability, and connected-seller liability are documented and tested.',true),
  ('production','finance.reconciliation_refunds','finance','Reconciliation, refunds, and reserves','Finance approved settlement reconciliation, fee treatment, refund reversals, dispute reserves, negative balances, and payout exception handling.',true),
  ('production','security.production_webhooks','security','Production keys, webhooks, and monitoring','Production key custody, least-privilege access, signed platform and Connect webhooks, alerting, replay handling, and incident ownership are verified.',true),
  ('production','support.customer_operations','support','Customer support and dispute operations','Named owners, response targets, buyer support, refund review, dispute evidence, seller escalation, and accessibility support are documented.',true),
  ('production','operations.receipts_retention','operations','Receipts, records, and retention','Buyer receipts, seller reporting, ledger retention, export access, privacy minimization, and accounting record ownership are approved.',true)
on conflict (environment,control_key) do update set
  category=excluded.category,
  title=excluded.title,
  description=excluded.description,
  required=excluded.required,
  updated_at=now();

create or replace function private.marketplace_launch_ready(
  p_environment text default 'production'
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1 from public.marketplace_launch_controls control
    where control.environment=p_environment and control.required
  ) and not exists (
    select 1 from public.marketplace_launch_controls control
    where control.environment=p_environment
      and control.required
      and (
        control.status<>'approved'
        or control.evidence_reference is null
        or char_length(trim(control.review_notes))<20
        or (control.expires_at is not null and control.expires_at<=now())
      )
  );
$$;

revoke all on function private.marketplace_launch_ready(text)
from public,anon,authenticated;

create or replace function private.disable_marketplace_live_on_control_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.marketplace_launch_ready(new.environment) then
    update public.marketplace_commerce_launch
    set checkout_mode='test_only',
        live_charging_enabled=false,
        deactivated_at=case when live_charging_enabled then now() else deactivated_at end,
        change_reason=case
          when live_charging_enabled then 'Automatically disabled because a required launch control is no longer current.'
          else change_reason
        end
    where environment=new.environment
      and live_charging_enabled;
  end if;
  return new;
end;
$$;

revoke all on function private.disable_marketplace_live_on_control_change()
from public,anon,authenticated;

drop trigger if exists marketplace_launch_controls_fail_closed
on public.marketplace_launch_controls;
create trigger marketplace_launch_controls_fail_closed
after insert or update of required,status,evidence_reference,review_notes,expires_at
on public.marketplace_launch_controls
for each row execute function private.disable_marketplace_live_on_control_change();

create or replace function public.get_my_marketplace_receipt(
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_receipt jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select jsonb_build_object(
    'order_id',orders.id,
    'receipt_number',orders.receipt_number,
    'issued_at',orders.receipt_issued_at,
    'order_status',orders.status,
    'seller_name',application.organization_name,
    'title_snapshot',listing.title_snapshot,
    'item_kind',orders.item_kind,
    'access_model',orders.access_model,
    'rental_days',orders.rental_days,
    'currency',orders.currency,
    'subtotal_cents',orders.subtotal_cents,
    'tax_cents',orders.tax_cents,
    'total_cents',orders.total_cents,
    'refunded_cents',orders.refunded_cents,
    'tax_liability',orders.tax_liability,
    'paid_at',orders.paid_at,
    'entitlement_status',entitlement.status,
    'entitlement_expires_at',entitlement.expires_at,
    'refund_status',latest_refund.status,
    'dispute_status',latest_dispute.status,
    'record_kind','transaction_receipt',
    'tax_invoice',false
  ) into v_receipt
  from public.marketplace_orders orders
  join public.marketplace_listings listing on listing.id=orders.listing_id
  join public.publisher_applications application on application.id=orders.seller_application_id
  left join public.marketplace_entitlements entitlement on entitlement.order_id=orders.id
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
  where orders.id=p_order_id
    and orders.receipt_number is not null
    and (
      orders.buyer_id=v_user_id
      or private.is_platform_owner(v_user_id)
    );

  if v_receipt is null then
    raise exception 'Marketplace receipt is unavailable or access is denied';
  end if;
  return v_receipt;
end;
$$;

create or replace function public.get_my_marketplace_sales_report(
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.publisher_applications%rowtype;
  v_report jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_period_start is null or p_period_end is null or p_period_end<=p_period_start then
    raise exception 'Choose a valid sales report period';
  end if;
  if p_period_end-p_period_start>interval '366 days' then
    raise exception 'Sales reports are limited to 366 days';
  end if;

  select * into v_application
  from public.publisher_applications application
  where application.applicant_id=v_user_id
  order by application.created_at desc
  limit 1;
  if not found then raise exception 'A seller application is required for sales reporting'; end if;

  with period_orders as (
    select
      orders.id,orders.listing_id,orders.item_kind,orders.access_model,
      orders.currency,orders.status,orders.subtotal_cents,orders.tax_cents,
      orders.total_cents,orders.platform_fee_cents,orders.seller_net_cents,
      orders.refunded_cents,orders.paid_at,orders.fulfilled_at,
      orders.receipt_number,orders.receipt_issued_at,listing.title_snapshot
    from public.marketplace_orders orders
    join public.marketplace_listings listing on listing.id=orders.listing_id
    where orders.seller_application_id=v_application.id
      and orders.paid_at>=p_period_start
      and orders.paid_at<p_period_end
  ), period_payouts as (
    select payout.id,payout.amount_cents,payout.currency,payout.status,
           payout.arrival_at,payout.created_at
    from public.marketplace_payout_events payout
    where payout.seller_application_id=v_application.id
      and payout.created_at>=p_period_start
      and payout.created_at<p_period_end
  )
  select jsonb_build_object(
    'seller',jsonb_build_object(
      'organization_name',v_application.organization_name,
      'seller_status',v_application.status,
      'verification_status',v_application.verification_status
    ),
    'period',jsonb_build_object(
      'start_at',p_period_start,
      'end_at',p_period_end,
      'timezone','UTC'
    ),
    'totals',(
      select jsonb_build_object(
        'order_count',count(*),
        'purchase_count',count(*) filter (where access_model='purchase'),
        'rental_count',count(*) filter (where access_model='rental'),
        'subtotal_cents',coalesce(sum(subtotal_cents),0),
        'tax_cents',coalesce(sum(tax_cents),0),
        'gross_customer_cents',coalesce(sum(total_cents),0),
        'platform_fee_cents',coalesce(sum(platform_fee_cents),0),
        'seller_allocation_cents',coalesce(sum(seller_net_cents),0),
        'refunded_customer_cents',coalesce(sum(refunded_cents),0),
        'chargeback_customer_cents',coalesce(sum(total_cents-refunded_cents) filter (where status='chargeback'),0),
        'paid_payout_cents',coalesce((select sum(amount_cents) from period_payouts where status='paid'),0)
      ) from period_orders
    ),
    'items',coalesce((
      select jsonb_agg(to_jsonb(item_summary) order by item_summary.gross_customer_cents desc,item_summary.title_snapshot)
      from (
        select listing_id,title_snapshot,item_kind,access_model,currency,
          count(*) as order_count,
          sum(total_cents) as gross_customer_cents,
          sum(platform_fee_cents) as platform_fee_cents,
          sum(seller_net_cents) as seller_allocation_cents,
          sum(refunded_cents) as refunded_customer_cents
        from period_orders
        group by listing_id,title_snapshot,item_kind,access_model,currency
      ) item_summary
    ),'[]'::jsonb),
    'transactions',coalesce((
      select jsonb_agg(to_jsonb(transaction) order by transaction.paid_at desc)
      from (
        select id,receipt_number,receipt_issued_at,title_snapshot,item_kind,
          access_model,currency,status,subtotal_cents,tax_cents,total_cents,
          platform_fee_cents,seller_net_cents,refunded_cents,paid_at,fulfilled_at
        from period_orders
      ) transaction
    ),'[]'::jsonb),
    'payouts',coalesce((
      select jsonb_agg(to_jsonb(payout) order by payout.created_at desc)
      from period_payouts payout
    ),'[]'::jsonb),
    'generated_at',now(),
    'report_note','Operational sales report only; not a tax filing or Stripe payout statement.'
  ) into v_report;
  return v_report;
end;
$$;

create or replace function public.get_marketplace_launch_control_center()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not private.is_platform_owner((select auth.uid())) then
    raise exception 'Platform owner marketplace launch review required';
  end if;
  return jsonb_build_object(
    'state',(
      select to_jsonb(state)
        ||jsonb_build_object(
          'effective_live_charging_enabled',state.live_charging_enabled
            and private.marketplace_launch_ready(state.environment)
        )
      from public.marketplace_commerce_launch state
      where state.environment='production'
    ),
    'controls',coalesce((
      select jsonb_agg(
        to_jsonb(control)
        ||jsonb_build_object(
          'effective_status',case
            when control.status='approved'
             and control.expires_at is not null
             and control.expires_at<=now() then 'expired'
            else control.status
          end,
          'is_current',control.status='approved'
            and (control.expires_at is null or control.expires_at>now())
        ) order by control.category,control.title
      )
      from public.marketplace_launch_controls control
      where control.environment='production'
    ),'[]'::jsonb),
    'readiness',jsonb_build_object(
      'ready',private.marketplace_launch_ready('production'),
      'required_controls',(select count(*) from public.marketplace_launch_controls where environment='production' and required),
      'approved_current_controls',(select count(*) from public.marketplace_launch_controls where environment='production' and required and status='approved' and (expires_at is null or expires_at>now())),
      'remaining_controls',(select count(*) from public.marketplace_launch_controls where environment='production' and required and (status<>'approved' or evidence_reference is null or char_length(trim(review_notes))<20 or (expires_at is not null and expires_at<=now())))
    ),
    'generated_at',now()
  );
end;
$$;

create or replace function public.get_marketplace_launch_runtime_gate()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'environment',state.environment,
    'checkout_mode',state.checkout_mode,
    'live_charging_enabled',state.live_charging_enabled,
    'controls_ready',private.marketplace_launch_ready(state.environment),
    'effective_live_charging_enabled',state.live_charging_enabled
      and state.checkout_mode='live'
      and private.marketplace_launch_ready(state.environment)
  )
  from public.marketplace_commerce_launch state
  where state.environment='production';
$$;

create or replace function public.review_marketplace_launch_control(
  p_control_key text,
  p_decision text,
  p_evidence_reference text,
  p_review_notes text,
  p_expires_at timestamptz default null,
  p_attestation boolean default false
)
returns public.marketplace_launch_controls
language plpgsql
security definer
set search_path=''
as $$
declare
  v_control public.marketplace_launch_controls%rowtype;
  v_decision text := lower(trim(coalesce(p_decision,'')));
begin
  if not private.is_platform_owner((select auth.uid())) then
    raise exception 'Only the platform owner can decide marketplace launch controls';
  end if;
  if v_decision not in ('pending','approved','blocked') then
    raise exception 'Choose pending, approved, or blocked for the launch control';
  end if;
  if char_length(trim(coalesce(p_review_notes,'')))<20 then
    raise exception 'Launch review notes must contain at least twenty characters';
  end if;
  if v_decision='approved' then
    if not p_attestation then raise exception 'Launch-control approval requires an explicit attestation'; end if;
    if char_length(trim(coalesce(p_evidence_reference,'')))<8 then
      raise exception 'Approved launch controls require an evidence reference';
    end if;
    if p_expires_at is not null and p_expires_at<=now() then
      raise exception 'Launch-control evidence cannot already be expired';
    end if;
  end if;

  update public.marketplace_launch_controls
  set status=v_decision,
      evidence_reference=nullif(trim(coalesce(p_evidence_reference,'')),''),
      review_notes=trim(p_review_notes),
      reviewed_by=(select auth.uid()),
      reviewed_at=now(),
      expires_at=case when v_decision='approved' then p_expires_at else null end
  where environment='production' and control_key=p_control_key
  returning * into v_control;
  if not found then raise exception 'Marketplace launch control not found'; end if;

  insert into public.audit_events (
    actor_id,event_type,target_type,target_id,details,event_hash
  ) values (
    (select auth.uid()),'marketplace.launch_control_reviewed',
    'marketplace_launch_control',v_control.id::text,
    jsonb_build_object(
      'controlKey',v_control.control_key,
      'decision',v_control.status,
      'evidenceRecorded',v_control.evidence_reference is not null,
      'expiresAt',v_control.expires_at
    ),''
  );
  return v_control;
end;
$$;

create or replace function public.set_marketplace_live_charging(
  p_enable boolean,
  p_expected_updated_at timestamptz,
  p_reason text,
  p_attestation boolean default false
)
returns public.marketplace_commerce_launch
language plpgsql
security definer
set search_path=''
as $$
declare
  v_state public.marketplace_commerce_launch%rowtype;
begin
  if not private.is_platform_owner((select auth.uid())) then
    raise exception 'Only the platform owner can change live marketplace charging';
  end if;
  if char_length(trim(coalesce(p_reason,'')))<20 then
    raise exception 'Explain the live-charging decision using at least twenty characters';
  end if;

  select * into v_state
  from public.marketplace_commerce_launch
  where environment='production'
  for update;
  if not found then raise exception 'Marketplace production launch state is missing'; end if;
  if p_expected_updated_at is null or v_state.updated_at is distinct from p_expected_updated_at then
    raise exception 'Marketplace launch state changed; refresh before deciding live charging';
  end if;

  if p_enable then
    if not p_attestation then raise exception 'Live charging requires an explicit final attestation'; end if;
    if not private.marketplace_launch_ready('production') then
      raise exception 'Every required legal, tax, finance, security, support, and operations control must be approved and current';
    end if;
  end if;

  update public.marketplace_commerce_launch
  set checkout_mode=case when p_enable then 'live' else 'test_only' end,
      live_charging_enabled=p_enable,
      activated_by=case when p_enable then (select auth.uid()) else activated_by end,
      activated_at=case when p_enable then now() else activated_at end,
      deactivated_at=case when not p_enable then now() else null end,
      change_reason=trim(p_reason)
  where environment='production'
  returning * into v_state;

  insert into public.audit_events (
    actor_id,event_type,target_type,target_id,details,event_hash
  ) values (
    (select auth.uid()),
    case when p_enable then 'marketplace.live_charging_enabled' else 'marketplace.live_charging_disabled' end,
    'marketplace_commerce_launch','production',
    jsonb_build_object(
      'enabled',v_state.live_charging_enabled,
      'checkoutMode',v_state.checkout_mode,
      'requiredControlsReady',private.marketplace_launch_ready('production')
    ),''
  );
  return v_state;
end;
$$;

revoke all on function public.get_my_marketplace_receipt(uuid)
from public,anon;
revoke all on function public.get_my_marketplace_sales_report(timestamptz,timestamptz)
from public,anon;
revoke all on function public.get_marketplace_launch_control_center()
from public,anon;
revoke all on function public.get_marketplace_launch_runtime_gate()
from public,anon,authenticated;
revoke all on function public.review_marketplace_launch_control(text,text,text,text,timestamptz,boolean)
from public,anon;
revoke all on function public.set_marketplace_live_charging(boolean,timestamptz,text,boolean)
from public,anon;

grant execute on function public.get_my_marketplace_receipt(uuid)
to authenticated;
grant execute on function public.get_my_marketplace_sales_report(timestamptz,timestamptz)
to authenticated;
grant execute on function public.get_marketplace_launch_control_center()
to authenticated;
grant execute on function public.get_marketplace_launch_runtime_gate()
to service_role;
grant execute on function public.review_marketplace_launch_control(text,text,text,text,timestamptz,boolean)
to authenticated;
grant execute on function public.set_marketplace_live_charging(boolean,timestamptz,text,boolean)
to authenticated;
