-- Govern commercial course and book publishing through Stripe Connect.
-- Every paid path fails closed until seller, rights, listing, tax, and
-- processor-readiness evidence is approved. Browser redirects never fulfill
-- an order; only the verified Stripe webhook may call the fulfillment RPC.

alter table public.publisher_applications
  add column if not exists stripe_account_id text,
  add column if not exists verification_status text not null default 'not_started'
    check (verification_status in ('not_started','pending','verified','restricted')),
  add column if not exists details_submitted boolean not null default false,
  add column if not exists charges_enabled boolean not null default false,
  add column if not exists payouts_enabled boolean not null default false,
  add column if not exists requirements_due jsonb not null default '[]'::jsonb,
  add column if not exists verification_checked_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text not null default '';

create unique index if not exists publisher_applications_stripe_account_uidx
  on public.publisher_applications (stripe_account_id)
  where stripe_account_id is not null;

alter table public.course_memberships
  add column if not exists access_source text not null default 'direct'
    check (access_source in ('direct','enrollment','assignment','marketplace')),
  add column if not exists access_expires_at timestamptz,
  add column if not exists marketplace_order_id uuid;

create table public.marketplace_tax_controls (
  id uuid primary key default gen_random_uuid(),
  seller_application_id uuid references public.publisher_applications(id) on delete cascade,
  provider text not null default 'stripe_tax' check (provider in ('stripe_tax')),
  country_code text not null default 'US' check (country_code ~ '^[A-Z]{2}$'),
  jurisdiction_label text not null,
  liability text not null default 'platform' check (liability in ('platform','seller')),
  registration_reference text,
  status text not null default 'pending'
    check (status in ('pending','reviewing','approved','suspended','retired')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (seller_application_id,country_code,liability)
);

create table public.publication_rights_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_application_id uuid not null references public.publisher_applications(id) on delete restrict,
  publication_id uuid references public.publications(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  rights_owner_name text not null check (char_length(rights_owner_name) between 2 and 240),
  rights_basis text not null
    check (rights_basis in ('original_owner','exclusive_license','nonexclusive_license','open_license','public_domain')),
  rights_statement text not null check (char_length(rights_statement) between 20 and 5000),
  evidence_url text,
  territories text[] not null default array['US']::text[],
  purchase_allowed boolean not null default false,
  rental_allowed boolean not null default false,
  expires_at timestamptz,
  status text not null default 'submitted'
    check (status in ('draft','submitted','reviewing','approved','declined','expired','suspended')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((publication_id is not null)::integer + (course_id is not null)::integer = 1),
  check (purchase_allowed or rental_allowed),
  check (expires_at is null or expires_at > created_at)
);

create unique index publication_rights_reviews_active_item_uidx
  on public.publication_rights_reviews (
    seller_application_id,
    coalesce(publication_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(course_id,'00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('submitted','reviewing','approved');

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_application_id uuid not null references public.publisher_applications(id) on delete restrict,
  rights_review_id uuid not null references public.publication_rights_reviews(id) on delete restrict,
  tax_control_id uuid not null references public.marketplace_tax_controls(id) on delete restrict,
  publication_id uuid references public.publications(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  item_kind text generated always as (
    case when course_id is not null then 'course' else 'book' end
  ) stored,
  access_model text not null check (access_model in ('purchase','rental')),
  title_snapshot text not null check (char_length(title_snapshot) between 1 and 240),
  price_cents integer not null check (price_cents between 50 and 10000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  rental_days integer,
  platform_fee_bps integer not null default 1500 check (platform_fee_bps between 0 and 5000),
  stripe_tax_code text not null default 'txcd_10000000',
  tax_behavior text not null default 'exclusive' check (tax_behavior in ('exclusive','inclusive')),
  status text not null default 'submitted'
    check (status in ('draft','submitted','reviewing','approved','published','suspended','retired')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((publication_id is not null)::integer + (course_id is not null)::integer = 1),
  check (
    (access_model='purchase' and rental_days is null)
    or (access_model='rental' and rental_days between 1 and 365)
  )
);

create unique index marketplace_listings_active_item_uidx
  on public.marketplace_listings (
    coalesce(publication_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(course_id,'00000000-0000-0000-0000-000000000000'::uuid),
    access_model
  )
  where status <> 'retired';

create index marketplace_listings_catalog_idx
  on public.marketplace_listings (status,published_at desc);

create table public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  seller_application_id uuid not null references public.publisher_applications(id) on delete restrict,
  client_request_key uuid not null,
  item_kind text not null check (item_kind in ('course','book')),
  publication_id uuid references public.publications(id) on delete restrict,
  course_id uuid references public.courses(id) on delete restrict,
  access_model text not null check (access_model in ('purchase','rental')),
  rental_days integer,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  tax_liability text not null default 'platform'
    check (tax_liability in ('platform','seller')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  seller_net_cents integer not null check (seller_net_cents >= 0),
  status text not null default 'pending'
    check (status in (
      'pending','checkout_created','payment_processing','paid','fulfilled',
      'payment_failed','canceled','partially_refunded','refunded',
      'disputed','chargeback'
    )),
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  stripe_customer_id text,
  stripe_transfer_id text,
  stripe_application_fee_id text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id,listing_id,client_request_key),
  check ((publication_id is not null)::integer + (course_id is not null)::integer = 1),
  check (refunded_cents <= total_cents)
);

create index marketplace_orders_buyer_idx
  on public.marketplace_orders (buyer_id,created_at desc);
create index marketplace_orders_seller_idx
  on public.marketplace_orders (seller_application_id,created_at desc);

create table public.marketplace_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  item_kind text not null check (item_kind in ('course','book')),
  publication_id uuid references public.publications(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  access_model text not null check (access_model in ('purchase','rental')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active'
    check (status in ('active','expired','revoked','refunded','disputed')),
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id),
  check ((publication_id is not null)::integer + (course_id is not null)::integer = 1),
  check (expires_at is null or expires_at > starts_at)
);

create index marketplace_entitlements_access_idx
  on public.marketplace_entitlements (buyer_id,status,expires_at);

create table public.marketplace_refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'requested'
    check (status in ('requested','reviewing','approved','processing','succeeded','declined','failed','canceled')),
  stripe_refund_id text unique,
  review_notes text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  processed_at timestamptz,
  failure_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index marketplace_refund_requests_open_order_uidx
  on public.marketplace_refund_requests (order_id)
  where status in ('requested','reviewing','approved','processing');

create table public.marketplace_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.marketplace_orders(id) on delete restrict,
  seller_application_id uuid not null references public.publisher_applications(id) on delete restrict,
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  reason text,
  status text not null,
  evidence_due_at timestamptz,
  evidence_submitted boolean not null default false,
  outcome text,
  processor_payload jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.marketplace_payout_events (
  id uuid primary key default gen_random_uuid(),
  seller_application_id uuid not null references public.publisher_applications(id) on delete restrict,
  stripe_payout_id text not null unique,
  stripe_account_id text not null,
  amount_cents integer not null,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null,
  arrival_at timestamptz,
  failure_code text,
  failure_message text,
  processor_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.course_memberships
  add constraint course_memberships_marketplace_order_fk
  foreign key (marketplace_order_id) references public.marketplace_orders(id) on delete set null;

create trigger marketplace_tax_controls_touch_updated_at
before update on public.marketplace_tax_controls
for each row execute function private.touch_updated_at();
create trigger publication_rights_reviews_touch_updated_at
before update on public.publication_rights_reviews
for each row execute function private.touch_updated_at();
create trigger marketplace_listings_touch_updated_at
before update on public.marketplace_listings
for each row execute function private.touch_updated_at();
create trigger marketplace_orders_touch_updated_at
before update on public.marketplace_orders
for each row execute function private.touch_updated_at();
create trigger marketplace_entitlements_touch_updated_at
before update on public.marketplace_entitlements
for each row execute function private.touch_updated_at();
create trigger marketplace_refund_requests_touch_updated_at
before update on public.marketplace_refund_requests
for each row execute function private.touch_updated_at();
create trigger marketplace_disputes_touch_updated_at
before update on public.marketplace_disputes
for each row execute function private.touch_updated_at();
create trigger marketplace_payout_events_touch_updated_at
before update on public.marketplace_payout_events
for each row execute function private.touch_updated_at();

alter table public.marketplace_tax_controls enable row level security;
alter table public.publication_rights_reviews enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_entitlements enable row level security;
alter table public.marketplace_refund_requests enable row level security;
alter table public.marketplace_disputes enable row level security;
alter table public.marketplace_payout_events enable row level security;

revoke all on
  public.marketplace_tax_controls,
  public.publication_rights_reviews,
  public.marketplace_listings,
  public.marketplace_orders,
  public.marketplace_entitlements,
  public.marketplace_refund_requests,
  public.marketplace_disputes,
  public.marketplace_payout_events
from anon,authenticated;

-- The browser uses narrow RPC projections for marketplace operations. Only a
-- buyer's own entitlement rows need direct select access for existing
-- publication/course policy checks.
grant select on public.marketplace_entitlements to authenticated;

create policy marketplace_tax_controls_select
on public.marketplace_tax_controls for select to authenticated
using (
  private.is_platform_owner((select auth.uid()))
  or seller_application_id in (
    select application.id
    from public.publisher_applications application
    where application.applicant_id=(select auth.uid())
  )
);

create policy publication_rights_reviews_select
on public.publication_rights_reviews for select to authenticated
using (
  submitted_by=(select auth.uid())
  or private.is_platform_owner((select auth.uid()))
);

create policy marketplace_listings_select
on public.marketplace_listings for select to authenticated
using (
  status='published'
  or private.is_platform_owner((select auth.uid()))
  or seller_application_id in (
    select application.id
    from public.publisher_applications application
    where application.applicant_id=(select auth.uid())
  )
);

create policy marketplace_orders_select
on public.marketplace_orders for select to authenticated
using (
  buyer_id=(select auth.uid())
  or private.is_platform_owner((select auth.uid()))
  or seller_application_id in (
    select application.id
    from public.publisher_applications application
    where application.applicant_id=(select auth.uid())
  )
);

create policy marketplace_entitlements_select
on public.marketplace_entitlements for select to authenticated
using (
  buyer_id=(select auth.uid())
  or private.is_platform_owner((select auth.uid()))
);

create policy marketplace_refund_requests_select
on public.marketplace_refund_requests for select to authenticated
using (
  requested_by=(select auth.uid())
  or private.is_platform_owner((select auth.uid()))
  or order_id in (
    select orders.id
    from public.marketplace_orders orders
    join public.publisher_applications application
      on application.id=orders.seller_application_id
    where orders.buyer_id=(select auth.uid())
       or application.applicant_id=(select auth.uid())
  )
);

create policy marketplace_refund_requests_insert
on public.marketplace_refund_requests for insert to authenticated
with check (
  requested_by=(select auth.uid())
  and order_id in (
    select orders.id
    from public.marketplace_orders orders
    where orders.buyer_id=(select auth.uid())
      and orders.status in ('paid','fulfilled','partially_refunded')
      and amount_cents <= orders.total_cents-orders.refunded_cents
  )
);

create policy marketplace_disputes_select
on public.marketplace_disputes for select to authenticated
using (
  private.is_platform_owner((select auth.uid()))
  or seller_application_id in (
    select application.id
    from public.publisher_applications application
    where application.applicant_id=(select auth.uid())
  )
);

create policy marketplace_payout_events_select
on public.marketplace_payout_events for select to authenticated
using (
  private.is_platform_owner((select auth.uid()))
  or seller_application_id in (
    select application.id
    from public.publisher_applications application
    where application.applicant_id=(select auth.uid())
  )
);

drop policy if exists publisher_applications_update on public.publisher_applications;
create policy publisher_applications_update
on public.publisher_applications for update to authenticated
using (
  applicant_id=(select auth.uid())
  or private.is_platform_owner((select auth.uid()))
)
with check (
  applicant_id=(select auth.uid())
  or private.is_platform_owner((select auth.uid()))
);

drop policy if exists publisher_applications_delete on public.publisher_applications;
create policy publisher_applications_delete
on public.publisher_applications for delete to authenticated
using (
  applicant_id=(select auth.uid())
  and status='draft'
);

create or replace function private.protect_publisher_application_review_fields()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is not null
     and not private.is_platform_owner((select auth.uid()))
     and (
       new.applicant_id is distinct from old.applicant_id
       or new.stripe_account_id is distinct from old.stripe_account_id
       or new.verification_status is distinct from old.verification_status
       or new.details_submitted is distinct from old.details_submitted
       or new.charges_enabled is distinct from old.charges_enabled
       or new.payouts_enabled is distinct from old.payouts_enabled
       or new.requirements_due is distinct from old.requirements_due
       or new.verification_checked_at is distinct from old.verification_checked_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.review_notes is distinct from old.review_notes
       or new.status not in ('draft','submitted')
     ) then
    raise exception 'Seller verification and review fields are controlled by EdNotebook governance';
  end if;
  if new.status='submitted' and not new.rights_attestation then
    raise exception 'Rights attestation is required before seller review';
  end if;
  if new.status in ('submitted','reviewing','approved')
     and not new.rights_attestation then
    raise exception 'Rights attestation must remain active during seller review';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_publisher_application_review_fields()
from public,anon,authenticated;

drop trigger if exists publisher_applications_review_guard
on public.publisher_applications;
create trigger publisher_applications_review_guard
before update on public.publisher_applications
for each row execute function private.protect_publisher_application_review_fields();

create or replace function private.marketplace_listing_is_ready(
  p_listing_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.marketplace_listings listing
    join public.publisher_applications seller
      on seller.id=listing.seller_application_id
    join public.publication_rights_reviews rights
      on rights.id=listing.rights_review_id
    join public.marketplace_tax_controls tax
      on tax.id=listing.tax_control_id
    where listing.id=p_listing_id
      and listing.status in ('approved','published')
      and seller.status='approved'
      and seller.verification_status='verified'
      and seller.details_submitted
      and seller.charges_enabled
      and seller.payouts_enabled
      and rights.status='approved'
      and (rights.expires_at is null or rights.expires_at>now())
      and (
        (listing.access_model='purchase' and rights.purchase_allowed)
        or (listing.access_model='rental' and rights.rental_allowed)
      )
      and tax.status='approved'
      and (
        tax.seller_application_id is null
        or tax.seller_application_id=listing.seller_application_id
      )
  );
$$;

revoke all on function private.marketplace_listing_is_ready(uuid)
from public,anon;
grant execute on function private.marketplace_listing_is_ready(uuid)
to authenticated;

create or replace function private.enforce_marketplace_listing_release()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_rights public.publication_rights_reviews%rowtype;
  v_tax public.marketplace_tax_controls%rowtype;
begin
  select * into v_rights
  from public.publication_rights_reviews
  where id=new.rights_review_id;
  if not found
     or v_rights.seller_application_id<>new.seller_application_id
     or v_rights.publication_id is distinct from new.publication_id
     or v_rights.course_id is distinct from new.course_id then
    raise exception 'The rights review does not match this seller and item';
  end if;

  select * into v_tax
  from public.marketplace_tax_controls
  where id=new.tax_control_id;
  if not found
     or (
       v_tax.seller_application_id is not null
       and v_tax.seller_application_id<>new.seller_application_id
     ) then
    raise exception 'The tax control does not cover this seller';
  end if;

  if new.status in ('approved','published') then
    if not exists (
      select 1 from public.publisher_applications seller
      where seller.id=new.seller_application_id
        and seller.status='approved'
        and seller.verification_status='verified'
        and seller.details_submitted
        and seller.charges_enabled
        and seller.payouts_enabled
    ) then
      raise exception 'Seller verification, charging, and payouts must be approved';
    end if;
    if v_rights.status<>'approved'
       or (v_rights.expires_at is not null and v_rights.expires_at<=now())
       or (new.access_model='purchase' and not v_rights.purchase_allowed)
       or (new.access_model='rental' and not v_rights.rental_allowed) then
      raise exception 'Approved rights do not cover this commercial access model';
    end if;
    if v_tax.status<>'approved' then
      raise exception 'Tax responsibility must be approved before commercial release';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_marketplace_listing_release()
from public,anon,authenticated;

create trigger marketplace_listings_release_guard
before insert or update on public.marketplace_listings
for each row execute function private.enforce_marketplace_listing_release();

alter table public.published_course_directory
  drop constraint if exists published_course_directory_library_status_check;
alter table public.published_course_directory
  add constraint published_course_directory_library_status_check
  check (
    (library_access_model='not_listed' and library_listing_status='not_listed')
    or
    (library_access_model='open_free' and library_listing_status in ('published','suspended'))
    or
    (library_access_model in ('purchase','rental')
      and library_listing_status in ('review','published','suspended'))
  );

create or replace function private.enforce_publication_release()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status in ('review','approved','published')
     and not new.rights_confirmed then
    raise exception 'Publication rights must be confirmed before review or release';
  end if;
  if new.status='published'
     and new.conversion_status<>'ready' then
    raise exception 'Publication conversion must be ready before release';
  end if;
  if new.access_model='assigned' and new.course_id is null then
    raise exception 'Assigned publication requires a course';
  end if;
  if new.access_model in ('purchase','rental')
     and coalesce(new.price_cents,0)<=0 then
    raise exception 'Commercial publication requires a price';
  end if;
  if new.access_model='rental'
     and coalesce(new.rental_days,0) not between 1 and 365 then
    raise exception 'Rental publication requires 1 to 365 rental days';
  end if;
  if new.status='published'
     and new.access_model in ('purchase','rental')
     and not exists (
       select 1
       from public.marketplace_listings listing
       where listing.publication_id=new.id
         and listing.access_model=new.access_model
         and private.marketplace_listing_is_ready(listing.id)
     ) then
    raise exception 'Commercial publication governance is not approved';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_publication_release()
from public,anon,authenticated;

create or replace function private.can_access_course(
  p_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_course_id is not null and (
    private.is_platform_owner((select auth.uid()))
    or exists (
      select 1 from public.courses course
      where course.id=p_course_id
        and course.owner_id=(select auth.uid())
        and private.course_membership_is_current(
          course.id,
          course.owner_id,
          'owner'
        )
    )
    or exists (
      select 1 from public.course_memberships membership
      where membership.course_id=p_course_id
        and membership.user_id=(select auth.uid())
        and private.course_membership_is_current(
          membership.course_id,
          membership.user_id,
          membership.role
        )
        and (
          membership.access_source<>'marketplace'
          or membership.access_expires_at is null
          or membership.access_expires_at>now()
        )
    )
    or exists (
      select 1 from public.marketplace_entitlements entitlement
      where entitlement.course_id=p_course_id
        and entitlement.buyer_id=(select auth.uid())
        and entitlement.status='active'
        and entitlement.starts_at<=now()
        and (entitlement.expires_at is null or entitlement.expires_at>now())
        and exists (
          select 1
          from public.courses course
          where course.id=entitlement.course_id
            and (
              course.institution_id is null
              or private.has_active_institution_affiliation(
                (select auth.uid()),
                course.institution_id,
                'student'
              )
            )
        )
    )
  );
$$;

revoke all on function private.can_access_course(uuid) from public;
grant execute on function private.can_access_course(uuid) to authenticated;

drop policy if exists publications_select on public.publications;
create policy publications_select
on public.publications for select to authenticated
using (
  owner_id=(select auth.uid())
  or private.is_platform_manager()
  or (status='published' and access_model='open')
  or (
    status='published'
    and access_model='assigned'
    and course_id is not null
    and private.can_access_course(course_id)
  )
  or exists (
    select 1
    from public.marketplace_entitlements entitlement
    where entitlement.publication_id=publications.id
      and entitlement.buyer_id=(select auth.uid())
      and entitlement.status='active'
      and entitlement.starts_at<=now()
      and (entitlement.expires_at is null or entitlement.expires_at>now())
  )
);

create or replace function public.submit_marketplace_seller_application(
  p_organization_name text,
  p_applicant_type text,
  p_website_url text,
  p_catalog_summary text,
  p_rights_attestation boolean
)
returns public.publisher_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.publisher_applications%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_applicant_type not in ('publisher','author','professor','institution','supplier') then
    raise exception 'Choose a supported seller type';
  end if;
  if not p_rights_attestation then
    raise exception 'Rights attestation is required';
  end if;
  if char_length(trim(coalesce(p_organization_name,'')))<2 then
    raise exception 'Seller or organization name is required';
  end if;
  if char_length(trim(coalesce(p_catalog_summary,'')))<20 then
    raise exception 'Describe the material and intended catalog';
  end if;

  select * into v_application
  from public.publisher_applications
  where applicant_id=v_user_id
    and status<>'declined'
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.publisher_applications
    set organization_name=trim(p_organization_name),
        applicant_type=p_applicant_type,
        website_url=nullif(trim(coalesce(p_website_url,'')),''),
        catalog_summary=trim(p_catalog_summary),
        rights_attestation=true,
        status=case
          when status in ('approved','suspended') then status
          else 'submitted'
        end,
        submitted_at=coalesce(submitted_at,now()),
        updated_at=now()
    where id=v_application.id
    returning * into v_application;
  else
    insert into public.publisher_applications (
      applicant_id,organization_name,applicant_type,website_url,
      catalog_summary,rights_attestation,status,submitted_at
    ) values (
      v_user_id,trim(p_organization_name),p_applicant_type,
      nullif(trim(coalesce(p_website_url,'')),''),
      trim(p_catalog_summary),true,'submitted',now()
    )
    returning * into v_application;
  end if;
  return v_application;
end;
$$;

create or replace function public.submit_marketplace_rights_review(
  p_item_kind text,
  p_item_id uuid,
  p_rights_owner_name text,
  p_rights_basis text,
  p_rights_statement text,
  p_evidence_url text,
  p_purchase_allowed boolean,
  p_rental_allowed boolean,
  p_expires_at timestamptz default null
)
returns public.publication_rights_reviews
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.publisher_applications%rowtype;
  v_review public.publication_rights_reviews%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_item_kind not in ('course','book') then raise exception 'Choose course or book'; end if;
  if p_rights_basis not in ('original_owner','exclusive_license','nonexclusive_license','open_license','public_domain') then
    raise exception 'Choose a supported rights basis';
  end if;
  if not coalesce(p_purchase_allowed,false) and not coalesce(p_rental_allowed,false) then
    raise exception 'Rights must allow purchase, rental, or both';
  end if;
  if char_length(trim(coalesce(p_rights_statement,'')))<20 then
    raise exception 'A detailed rights statement is required';
  end if;

  select * into v_application
  from public.publisher_applications
  where applicant_id=v_user_id
    and status in ('submitted','reviewing','approved')
  order by created_at desc limit 1;
  if not found then raise exception 'Submit seller verification before rights review'; end if;

  if p_item_kind='course' and not exists (
    select 1 from public.courses course
    where course.id=p_item_id and private.can_manage_course(course.id)
  ) then
    raise exception 'Course publishing access denied';
  end if;
  if p_item_kind='book' and not exists (
    select 1 from public.publications publication
    where publication.id=p_item_id and publication.owner_id=v_user_id
  ) then
    raise exception 'Book publishing access denied';
  end if;

  insert into public.publication_rights_reviews (
    seller_application_id,publication_id,course_id,submitted_by,
    rights_owner_name,rights_basis,rights_statement,evidence_url,
    purchase_allowed,rental_allowed,expires_at,status
  ) values (
    v_application.id,
    case when p_item_kind='book' then p_item_id end,
    case when p_item_kind='course' then p_item_id end,
    v_user_id,
    trim(p_rights_owner_name),p_rights_basis,trim(p_rights_statement),
    nullif(trim(coalesce(p_evidence_url,'')),''),
    coalesce(p_purchase_allowed,false),coalesce(p_rental_allowed,false),
    p_expires_at,'submitted'
  )
  returning * into v_review;
  return v_review;
end;
$$;

create or replace function public.submit_marketplace_listing(
  p_item_kind text,
  p_item_id uuid,
  p_rights_review_id uuid,
  p_access_model text,
  p_price_cents integer,
  p_rental_days integer default null
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_application public.publisher_applications%rowtype;
  v_rights public.publication_rights_reviews%rowtype;
  v_tax public.marketplace_tax_controls%rowtype;
  v_title text;
  v_listing public.marketplace_listings%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_item_kind not in ('course','book') then raise exception 'Choose course or book'; end if;
  if p_access_model not in ('purchase','rental') then raise exception 'Choose purchase or rental'; end if;
  if coalesce(p_price_cents,0)<50 then raise exception 'Commercial price must be at least 50 cents'; end if;
  if p_access_model='purchase' and p_rental_days is not null then
    raise exception 'Purchase access does not use rental days';
  end if;
  if p_access_model='rental' and coalesce(p_rental_days,0) not between 1 and 365 then
    raise exception 'Rental access must be 1 to 365 days';
  end if;

  select * into v_application
  from public.publisher_applications
  where applicant_id=v_user_id
    and status in ('submitted','reviewing','approved')
  order by created_at desc limit 1;
  if not found then raise exception 'Submit seller verification before listing'; end if;

  select * into v_rights
  from public.publication_rights_reviews
  where id=p_rights_review_id
    and seller_application_id=v_application.id
    and submitted_by=v_user_id
    and publication_id is not distinct from case when p_item_kind='book' then p_item_id end
    and course_id is not distinct from case when p_item_kind='course' then p_item_id end;
  if not found then raise exception 'Matching rights review is required'; end if;

  select * into v_tax
  from public.marketplace_tax_controls
  where status in ('pending','reviewing','approved')
    and (seller_application_id is null or seller_application_id=v_application.id)
  order by (seller_application_id is not null) desc,created_at desc
  limit 1;
  if not found then raise exception 'Marketplace tax responsibility is not configured'; end if;

  if p_item_kind='course' then
    select course.title into v_title
    from public.courses course
    where course.id=p_item_id and private.can_manage_course(course.id);
  else
    select publication.title into v_title
    from public.publications publication
    where publication.id=p_item_id and publication.owner_id=v_user_id;
  end if;
  if v_title is null then raise exception 'Publishing item not found or access denied'; end if;

  insert into public.marketplace_listings (
    seller_application_id,rights_review_id,tax_control_id,
    publication_id,course_id,access_model,title_snapshot,
    price_cents,rental_days,status
  ) values (
    v_application.id,v_rights.id,v_tax.id,
    case when p_item_kind='book' then p_item_id end,
    case when p_item_kind='course' then p_item_id end,
    p_access_model,v_title,p_price_cents,
    case when p_access_model='rental' then p_rental_days end,
    'submitted'
  )
  on conflict (
    coalesce(publication_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(course_id,'00000000-0000-0000-0000-000000000000'::uuid),
    access_model
  ) where status<>'retired'
  do update set
    seller_application_id=excluded.seller_application_id,
    rights_review_id=excluded.rights_review_id,
    tax_control_id=excluded.tax_control_id,
    title_snapshot=excluded.title_snapshot,
    price_cents=excluded.price_cents,
    rental_days=excluded.rental_days,
    status='submitted',
    reviewed_by=null,
    reviewed_at=null,
    review_notes='',
    published_at=null,
    updated_at=now()
  returning * into v_listing;

  if p_item_kind='course' then
    update public.published_course_directory
    set library_access_model=p_access_model,
        library_listing_status='review',
        library_price_cents=p_price_cents,
        library_rental_days=case when p_access_model='rental' then p_rental_days end,
        library_published_at=coalesce(library_published_at,now()),
        updated_at=now()
    where course_id=p_item_id;
    if not found then raise exception 'Publish the course package before marketplace review'; end if;
  else
    update public.publications
    set access_model=p_access_model,
        price_cents=p_price_cents,
        rental_days=case when p_access_model='rental' then p_rental_days end,
        status='review',
        published_at=coalesce(published_at,now()),
        updated_at=now()
    where id=p_item_id;
  end if;

  return v_listing;
end;
$$;

create or replace function public.request_marketplace_refund(
  p_order_id uuid,
  p_amount_cents integer,
  p_reason text
)
returns public.marketplace_refund_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  v_request public.marketplace_refund_requests%rowtype;
  v_order public.marketplace_orders%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_order
  from public.marketplace_orders
  where id=p_order_id
    and buyer_id=(select auth.uid())
    and status in ('paid','fulfilled','partially_refunded')
  for update;
  if not found then raise exception 'Order is not eligible for a buyer refund request'; end if;
  if p_amount_cents<=0 or p_amount_cents>v_order.total_cents-v_order.refunded_cents then
    raise exception 'Refund amount exceeds the remaining paid amount';
  end if;
  if char_length(trim(coalesce(p_reason,'')))<10 then
    raise exception 'Refund reason must include at least ten characters';
  end if;
  if exists (
    select 1 from public.marketplace_refund_requests request
    where request.order_id=v_order.id
      and request.status in ('requested','reviewing','approved','processing')
  ) then
    raise exception 'An open refund request already exists for this order';
  end if;
  insert into public.marketplace_refund_requests (
    order_id,requested_by,amount_cents,reason
  ) values (
    p_order_id,(select auth.uid()),p_amount_cents,trim(p_reason)
  )
  returning * into v_request;
  return v_request;
end;
$$;

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
      select jsonb_agg(
        to_jsonb(orders)
          -'buyer_id'
          -'client_request_key'
          -'stripe_customer_id'
          -'stripe_checkout_url'
          -'stripe_payment_intent_id'
          -'stripe_charge_id'
          -'stripe_transfer_id'
          -'stripe_application_fee_id'
          -'metadata'
        order by orders.created_at desc
      )
      from public.marketplace_orders orders
      join public.publisher_applications application
        on application.id=orders.seller_application_id
      where application.applicant_id=v_user_id
      limit 100
    ),'[]'::jsonb),
    'purchases',coalesce((
      select jsonb_agg(
        to_jsonb(orders)
          -'client_request_key'
          -'stripe_customer_id'
          -'stripe_checkout_url'
          -'stripe_payment_intent_id'
          -'stripe_charge_id'
          -'stripe_transfer_id'
          -'stripe_application_fee_id'
          -'metadata'
        order by orders.created_at desc
      )
      from public.marketplace_orders orders
      where orders.buyer_id=v_user_id
      limit 100
    ),'[]'::jsonb),
    'entitlements',coalesce((
      select jsonb_agg(to_jsonb(entitlement) order by entitlement.created_at desc)
      from public.marketplace_entitlements entitlement
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
      select jsonb_agg((to_jsonb(payout)-'processor_payload') order by payout.created_at desc)
      from public.marketplace_payout_events payout
      join public.publisher_applications application
        on application.id=payout.seller_application_id
      where application.applicant_id=v_user_id
    ),'[]'::jsonb),
    'generated_at',now()
  );
end;
$$;

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
      select jsonb_agg((to_jsonb(payout)-'processor_payload') order by payout.created_at desc)
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
      'blocked_tax_controls',(select count(*) from public.marketplace_tax_controls where status<>'approved')
    ),
    'generated_at',now()
  );
end;
$$;

create or replace function public.review_marketplace_case(
  p_case_type text,
  p_case_id uuid,
  p_decision text,
  p_review_notes text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_listing public.marketplace_listings%rowtype;
begin
  if not private.is_platform_owner(v_user_id) then
    raise exception 'Only the platform owner can decide marketplace reviews';
  end if;
  if char_length(trim(coalesce(p_review_notes,'')))<8 then
    raise exception 'Review notes with at least eight characters are required';
  end if;

  if p_case_type='seller' then
    if p_decision not in ('approved','declined','suspended') then
      raise exception 'Choose approved, declined, or suspended';
    end if;
    if p_decision='approved' and not exists (
      select 1 from public.publisher_applications application
      where application.id=p_case_id
        and application.rights_attestation
        and application.verification_status='verified'
        and application.details_submitted
        and application.charges_enabled
        and application.payouts_enabled
    ) then
      raise exception 'Stripe seller verification, charging, and payouts are not ready';
    end if;
    update public.publisher_applications
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id;
  elsif p_case_type='rights' then
    if p_decision not in ('approved','declined','suspended') then
      raise exception 'Choose approved, declined, or suspended';
    end if;
    update public.publication_rights_reviews
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id;
  elsif p_case_type='tax' then
    if p_decision not in ('approved','suspended','retired') then
      raise exception 'Choose approved, suspended, or retired';
    end if;
    if p_decision='approved' and not exists (
      select 1 from public.marketplace_tax_controls tax
      where tax.id=p_case_id
        and char_length(trim(coalesce(tax.registration_reference,'')))>=6
    ) then
      raise exception 'Stripe Tax registration or liability evidence is required before approval';
    end if;
    update public.marketplace_tax_controls
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id;
  elsif p_case_type='listing' then
    if p_decision not in ('approved','suspended','retired') then
      raise exception 'Choose approved, suspended, or retired';
    end if;
    update public.marketplace_listings
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        published_at=case when p_decision='approved' then coalesce(published_at,now()) else published_at end,
        updated_at=now()
    where id=p_case_id
    returning * into v_listing;
    if not found then raise exception 'Marketplace listing not found'; end if;

    if p_decision='approved' then
      if v_listing.item_kind='course' then
        update public.published_course_directory
        set library_access_model=v_listing.access_model,
            library_listing_status='published',
            library_price_cents=v_listing.price_cents,
            library_rental_days=v_listing.rental_days,
            library_published_at=coalesce(library_published_at,now()),
            updated_at=now()
        where course_id=v_listing.course_id;
      else
        update public.publications
        set access_model=v_listing.access_model,
            price_cents=v_listing.price_cents,
            rental_days=v_listing.rental_days,
            status='published',
            published_at=coalesce(published_at,now()),
            updated_at=now()
        where id=v_listing.publication_id;
      end if;
      update public.marketplace_listings
      set status='published',updated_at=now()
      where id=v_listing.id;
    else
      if v_listing.item_kind='course' then
        update public.published_course_directory
        set library_listing_status='suspended',updated_at=now()
        where course_id=v_listing.course_id;
      else
        update public.publications
        set status='suspended',updated_at=now()
        where id=v_listing.publication_id;
      end if;
    end if;
  elsif p_case_type='refund' then
    if p_decision not in ('approved','declined') then
      raise exception 'Choose approved or declined';
    end if;
    update public.marketplace_refund_requests
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id
      and status in ('requested','reviewing');
  else
    raise exception 'Unknown marketplace case type';
  end if;

  if not found then raise exception 'Marketplace review record not found or no longer reviewable'; end if;
  return jsonb_build_object(
    'case_type',p_case_type,
    'case_id',p_case_id,
    'decision',p_decision,
    'reviewed_by',v_user_id,
    'reviewed_at',now()
  );
end;
$$;

create or replace function public.configure_marketplace_tax_control(
  p_tax_control_id uuid,
  p_registration_reference text,
  p_liability text,
  p_review_notes text
)
returns public.marketplace_tax_controls
language plpgsql
security definer
set search_path=''
as $$
declare
  v_control public.marketplace_tax_controls%rowtype;
begin
  if not private.is_platform_owner((select auth.uid())) then
    raise exception 'Only the platform owner can configure marketplace tax responsibility';
  end if;
  if p_liability not in ('platform','seller') then
    raise exception 'Choose platform or seller tax liability';
  end if;
  if char_length(trim(coalesce(p_registration_reference,'')))<6 then
    raise exception 'A Stripe Tax registration or evidence reference is required';
  end if;
  if char_length(trim(coalesce(p_review_notes,'')))<8 then
    raise exception 'Tax configuration notes with at least eight characters are required';
  end if;
  update public.marketplace_tax_controls
  set registration_reference=trim(p_registration_reference),
      liability=p_liability,
      status='reviewing',
      reviewed_by=null,
      reviewed_at=null,
      review_notes=trim(p_review_notes),
      updated_at=now()
  where id=p_tax_control_id
  returning * into v_control;
  if not found then raise exception 'Marketplace tax control not found'; end if;
  return v_control;
end;
$$;

create or replace function public.marketplace_fulfill_order(
  p_order_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_customer_id text,
  p_transfer_id text,
  p_application_fee_id text,
  p_subtotal_cents integer,
  p_tax_cents integer,
  p_total_cents integer,
  p_processor_payload jsonb default '{}'::jsonb
)
returns public.marketplace_orders
language plpgsql
security definer
set search_path=''
as $$
declare
  v_order public.marketplace_orders%rowtype;
  v_expiry timestamptz;
begin
  select * into v_order
  from public.marketplace_orders
  where id=p_order_id
  for update;
  if not found then raise exception 'Marketplace order not found'; end if;
  if v_order.stripe_checkout_session_id<>p_checkout_session_id then
    raise exception 'Checkout Session does not match the order';
  end if;
  if p_subtotal_cents<>v_order.subtotal_cents
     or p_total_cents<v_order.subtotal_cents
     or p_total_cents<>p_subtotal_cents+p_tax_cents then
    raise exception 'Processor amount does not match the governed order';
  end if;
  if v_order.status='fulfilled' then return v_order; end if;
  if v_order.status not in ('checkout_created','payment_processing','paid') then
    raise exception 'Order cannot be fulfilled from its current state';
  end if;

  v_expiry := case
    when v_order.access_model='rental'
      then now()+make_interval(days=>v_order.rental_days)
    else null
  end;

  update public.marketplace_orders
  set status='fulfilled',
      stripe_payment_intent_id=p_payment_intent_id,
      stripe_charge_id=p_charge_id,
      stripe_customer_id=p_customer_id,
      stripe_transfer_id=p_transfer_id,
      stripe_application_fee_id=p_application_fee_id,
      tax_cents=p_tax_cents,
      total_cents=p_total_cents,
      seller_net_cents=case
        when v_order.tax_liability='platform'
          then p_subtotal_cents-v_order.platform_fee_cents
        else p_total_cents-v_order.platform_fee_cents
      end,
      paid_at=coalesce(paid_at,now()),
      fulfilled_at=now(),
      metadata=metadata||coalesce(p_processor_payload,'{}'::jsonb),
      updated_at=now()
  where id=v_order.id
  returning * into v_order;

  insert into public.marketplace_entitlements (
    order_id,buyer_id,listing_id,item_kind,publication_id,course_id,
    access_model,starts_at,expires_at,status
  ) values (
    v_order.id,v_order.buyer_id,v_order.listing_id,v_order.item_kind,
    v_order.publication_id,v_order.course_id,v_order.access_model,
    now(),v_expiry,'active'
  )
  on conflict (order_id) do update set
    status='active',
    starts_at=excluded.starts_at,
    expires_at=excluded.expires_at,
    revoked_at=null,
    revocation_reason=null,
    updated_at=now();

  if v_order.item_kind='book' then
    insert into public.publication_entitlements (
      user_id,publication_id,source,active,starts_at,expires_at,
      stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,
      metadata
    ) values (
      v_order.buyer_id,v_order.publication_id,v_order.access_model,true,
      now(),v_expiry,p_customer_id,p_checkout_session_id,p_payment_intent_id,
      jsonb_build_object('marketplace_order_id',v_order.id)
    )
    on conflict (user_id,publication_id,source) do update set
      active=true,
      starts_at=excluded.starts_at,
      expires_at=excluded.expires_at,
      stripe_customer_id=excluded.stripe_customer_id,
      stripe_checkout_session_id=excluded.stripe_checkout_session_id,
      stripe_payment_intent_id=excluded.stripe_payment_intent_id,
      metadata=excluded.metadata,
      updated_at=now();
  else
    insert into public.course_memberships (
      course_id,user_id,role,access_source,access_expires_at,marketplace_order_id
    ) values (
      v_order.course_id,v_order.buyer_id,'learner','marketplace',v_expiry,v_order.id
    )
    on conflict (course_id,user_id) do update set
      access_expires_at=excluded.access_expires_at,
      marketplace_order_id=excluded.marketplace_order_id
    where course_memberships.access_source='marketplace';
  end if;
  return v_order;
end;
$$;

create or replace function public.marketplace_revoke_order_entitlement(
  p_order_id uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_order public.marketplace_orders%rowtype;
begin
  select * into v_order from public.marketplace_orders where id=p_order_id for update;
  if not found then raise exception 'Marketplace order not found'; end if;
  if p_status not in ('refunded','disputed','chargeback') then
    raise exception 'Choose a governed revocation status';
  end if;

  update public.marketplace_entitlements
  set status=case when p_status='refunded' then 'refunded' else 'disputed' end,
      revoked_at=now(),
      revocation_reason=left(coalesce(p_reason,p_status),500),
      updated_at=now()
  where order_id=v_order.id;

  if v_order.item_kind='book' then
    update public.publication_entitlements
    set active=false,expires_at=least(coalesce(expires_at,now()),now()),updated_at=now()
    where user_id=v_order.buyer_id
      and publication_id=v_order.publication_id
      and source=v_order.access_model
      and metadata->>'marketplace_order_id'=v_order.id::text;
  else
    delete from public.course_memberships
    where course_id=v_order.course_id
      and user_id=v_order.buyer_id
      and access_source='marketplace'
      and marketplace_order_id=v_order.id;
  end if;
end;
$$;

revoke all on function public.submit_marketplace_seller_application(text,text,text,text,boolean)
from public,anon;
revoke all on function public.submit_marketplace_rights_review(text,uuid,text,text,text,text,boolean,boolean,timestamptz)
from public,anon;
revoke all on function public.submit_marketplace_listing(text,uuid,uuid,text,integer,integer)
from public,anon;
revoke all on function public.request_marketplace_refund(uuid,integer,text)
from public,anon;
revoke all on function public.get_my_marketplace_dashboard()
from public,anon;
revoke all on function public.get_marketplace_control_center()
from public,anon;
revoke all on function public.review_marketplace_case(text,uuid,text,text)
from public,anon;
revoke all on function public.configure_marketplace_tax_control(uuid,text,text,text)
from public,anon;
revoke all on function public.marketplace_fulfill_order(uuid,text,text,text,text,text,text,integer,integer,integer,jsonb)
from public,anon,authenticated;
revoke all on function public.marketplace_revoke_order_entitlement(uuid,text,text)
from public,anon,authenticated;
grant execute on function public.marketplace_fulfill_order(uuid,text,text,text,text,text,text,integer,integer,integer,jsonb)
to service_role;
grant execute on function public.marketplace_revoke_order_entitlement(uuid,text,text)
to service_role;

grant execute on function public.submit_marketplace_seller_application(text,text,text,text,boolean)
to authenticated;
grant execute on function public.submit_marketplace_rights_review(text,uuid,text,text,text,text,boolean,boolean,timestamptz)
to authenticated;
grant execute on function public.submit_marketplace_listing(text,uuid,uuid,text,integer,integer)
to authenticated;
grant execute on function public.request_marketplace_refund(uuid,integer,text)
to authenticated;
grant execute on function public.get_my_marketplace_dashboard()
to authenticated;
grant execute on function public.get_marketplace_control_center()
to authenticated;
grant execute on function public.review_marketplace_case(text,uuid,text,text)
to authenticated;
grant execute on function public.configure_marketplace_tax_control(uuid,text,text,text)
to authenticated;

drop function if exists public.list_alex_morrison_catalog(text);
create or replace function public.list_alex_morrison_catalog(
  p_query text default ''
)
returns table (
  item_kind text,
  item_id uuid,
  course_id uuid,
  course_publication_id uuid,
  title text,
  creator_name text,
  description text,
  access_model text,
  listing_status text,
  reading_mode text,
  price_cents integer,
  rental_days integer,
  enrollment_policy text,
  universal_assignment boolean,
  education_division text,
  published_at timestamptz,
  checkout_available boolean,
  marketplace_listing_id uuid,
  currency text
)
language sql
stable
security definer
set search_path=''
as $$
  select catalog.*
  from (
    select
      'course'::text as item_kind,
      directory.course_id as item_id,
      directory.course_id,
      course_publication.id as course_publication_id,
      directory.title,
      directory.professor_display_name as creator_name,
      coalesce(directory.summary,'') as description,
      directory.library_access_model as access_model,
      directory.library_listing_status as listing_status,
      'interactive'::text as reading_mode,
      coalesce(listing.price_cents,directory.library_price_cents) as price_cents,
      coalesce(listing.rental_days,directory.library_rental_days) as rental_days,
      directory.enrollment_policy,
      directory.universal_assignment,
      directory.education_division,
      coalesce(listing.published_at,directory.library_published_at,directory.published_at) as published_at,
      coalesce(private.marketplace_listing_is_ready(listing.id),false) as checkout_available,
      listing.id as marketplace_listing_id,
      coalesce(listing.currency,'usd') as currency
    from public.published_course_directory directory
    join public.course_publications course_publication
      on course_publication.course_id=directory.course_id
     and course_publication.status='published'
    left join public.marketplace_listings listing
      on listing.course_id=directory.course_id
     and listing.access_model=directory.library_access_model
     and listing.status='published'
    where directory.is_listed
      and directory.library_listing_status in ('published','review')
      and (
        directory.library_access_model='open_free'
        or listing.id is not null
        or directory.library_listing_status='review'
      )

    union all

    select
      'book'::text,
      publication.id,
      publication.course_id,
      null::uuid,
      publication.title,
      coalesce(nullif(publication.author_name,''),'Professor author'),
      publication.description,
      publication.access_model,
      case when publication.status='review' then 'review' else 'published' end,
      publication.reading_mode,
      coalesce(listing.price_cents,publication.price_cents),
      coalesce(listing.rental_days,publication.rental_days),
      null::text,
      false,
      coalesce(course.education_division,'university'),
      coalesce(listing.published_at,publication.published_at,publication.created_at),
      coalesce(private.marketplace_listing_is_ready(listing.id),false),
      listing.id,
      coalesce(listing.currency,'usd')
    from public.publications publication
    left join public.courses course on course.id=publication.course_id
    left join public.marketplace_listings listing
      on listing.publication_id=publication.id
     and listing.access_model=publication.access_model
     and listing.status='published'
    where publication.status in ('published','review')
      and publication.access_model in ('open','purchase','rental')
      and (
        publication.access_model='open'
        or listing.id is not null
        or publication.status='review'
      )
  ) catalog
  where coalesce(nullif(trim(p_query),''),'')=''
     or concat_ws(
       ' ',catalog.title,catalog.creator_name,catalog.description,catalog.item_kind
     ) ilike '%'||trim(p_query)||'%'
  order by catalog.published_at desc nulls last,catalog.title
  limit 100;
$$;

revoke all on function public.list_alex_morrison_catalog(text) from public;
grant execute on function public.list_alex_morrison_catalog(text) to anon,authenticated;

-- Initial tax responsibility is deliberately pending. The platform owner must
-- verify the Stripe Tax registration/liability evidence in the Control Center
-- before any paid listing can be approved or checked out.
insert into public.marketplace_tax_controls (
  seller_application_id,provider,country_code,jurisdiction_label,
  liability,status,review_notes
) values (
  null,'stripe_tax','US','United States marketplace sales',
  'platform','pending','Awaiting platform-owner Stripe Tax registration review.'
)
on conflict (seller_application_id,country_code,liability) do nothing;
