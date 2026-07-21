create table if not exists public.billing_customers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  livemode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_product_id text,
  stripe_price_id text,
  status text not null,
  quantity integer not null default 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,
  livemode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_price_plan_map (
  stripe_price_id text primary key,
  plan_key text not null references public.storage_plan_limits(plan_key) on delete restrict,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlement_definitions (
  entitlement_key text primary key,
  display_name text not null,
  description text not null default '',
  value_type text not null default 'boolean' check (value_type in ('boolean','number','text','json')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  plan_key text not null references public.storage_plan_limits(plan_key) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions(entitlement_key) on delete cascade,
  entitlement_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_key,entitlement_key)
);

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entitlement_key text not null references public.entitlement_definitions(entitlement_key) on delete cascade,
  source text not null check (source in ('plan','stripe','institution','manual','promotion')),
  active boolean not null default true,
  entitlement_value jsonb not null default 'true'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_feature_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,entitlement_key,source)
);

create table if not exists public.publication_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  publication_id uuid not null references public.publications(id) on delete cascade,
  source text not null check (source in ('purchase','rental','assignment','open','publisher','manual')),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,publication_id,source)
);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  api_version text,
  livemode boolean not null default false,
  event_created_at timestamptz,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processing','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

insert into public.entitlement_definitions (entitlement_key,display_name,description,value_type)
values
  ('cloud_storage','Cloud storage','Private educational material storage.','boolean'),
  ('storage_bytes','Storage quota','Maximum stored bytes.','number'),
  ('max_file_bytes','Maximum file size','Maximum bytes for one upload.','number'),
  ('interactive_reader','Interactive reader','EduBook reading and annotations.','boolean'),
  ('publisher_tools','Publisher tools','Publication conversion and catalog tools.','boolean'),
  ('legal_holds','Legal holds','Institutional preservation holds.','boolean'),
  ('audit_export','Audit export','Exportable institutional audit events.','boolean')
on conflict (entitlement_key) do update set
  display_name=excluded.display_name,
  description=excluded.description,
  value_type=excluded.value_type,
  updated_at=now();

insert into public.plan_entitlements (plan_key,entitlement_key,entitlement_value)
select plan_key,'cloud_storage','true'::jsonb from public.storage_plan_limits
on conflict (plan_key,entitlement_key) do nothing;
insert into public.plan_entitlements (plan_key,entitlement_key,entitlement_value)
select plan_key,'storage_bytes',to_jsonb(quota_bytes) from public.storage_plan_limits
on conflict (plan_key,entitlement_key) do update set entitlement_value=excluded.entitlement_value,updated_at=now();
insert into public.plan_entitlements (plan_key,entitlement_key,entitlement_value)
select plan_key,'max_file_bytes',to_jsonb(max_file_bytes) from public.storage_plan_limits
on conflict (plan_key,entitlement_key) do update set entitlement_value=excluded.entitlement_value,updated_at=now();

insert into public.plan_entitlements (plan_key,entitlement_key,entitlement_value)
values
  ('free','interactive_reader','true'::jsonb),
  ('starter','interactive_reader','true'::jsonb),
  ('professor','interactive_reader','true'::jsonb),
  ('institution','interactive_reader','true'::jsonb),
  ('enterprise','interactive_reader','true'::jsonb),
  ('professor','publisher_tools','true'::jsonb),
  ('institution','publisher_tools','true'::jsonb),
  ('enterprise','publisher_tools','true'::jsonb),
  ('institution','legal_holds','true'::jsonb),
  ('enterprise','legal_holds','true'::jsonb),
  ('institution','audit_export','true'::jsonb),
  ('enterprise','audit_export','true'::jsonb)
on conflict (plan_key,entitlement_key) do update set entitlement_value=excluded.entitlement_value,updated_at=now();

create index if not exists billing_subscriptions_user_idx on public.billing_subscriptions(user_id,status);
create index if not exists billing_subscriptions_customer_idx on public.billing_subscriptions(stripe_customer_id);
create index if not exists user_entitlements_user_active_idx on public.user_entitlements(user_id,active,expires_at);
create index if not exists publication_entitlements_user_active_idx on public.publication_entitlements(user_id,active,expires_at);
create index if not exists publication_entitlements_publication_idx on public.publication_entitlements(publication_id,active);
