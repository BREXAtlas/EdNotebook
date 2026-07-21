create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  default_retention_days integer not null default 365 check (default_retention_days between 0 and 36500),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institution_memberships (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','security','records','professor','learner','publisher')),
  created_at timestamptz not null default now(),
  primary key (institution_id,user_id)
);

alter table public.courses add column if not exists institution_id uuid references public.institutions(id) on delete set null;
alter table public.profiles add column if not exists plan_key text not null default 'free';

create table if not exists public.storage_plan_limits (
  plan_key text primary key,
  display_name text not null,
  quota_bytes bigint not null check (quota_bytes > 0),
  max_file_bytes bigint not null check (max_file_bytes > 0),
  default_retention_days integer not null check (default_retention_days between 0 and 36500),
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.storage_plan_limits (plan_key,display_name,quota_bytes,max_file_bytes,default_retention_days,features)
values
  ('free','Free',262144000,26214400,30,'{"cloud_storage":true,"resumable_uploads":true,"previews":true}'::jsonb),
  ('starter','Starter',2147483648,104857600,90,'{"cloud_storage":true,"resumable_uploads":true,"previews":true}'::jsonb),
  ('professor','Professor',10737418240,262144000,365,'{"cloud_storage":true,"resumable_uploads":true,"previews":true,"publications":true}'::jsonb),
  ('institution','Institution',107374182400,1073741824,2555,'{"cloud_storage":true,"resumable_uploads":true,"previews":true,"legal_holds":true,"audit_export":true}'::jsonb),
  ('enterprise','Enterprise',1099511627776,5368709120,3650,'{"cloud_storage":true,"resumable_uploads":true,"previews":true,"legal_holds":true,"audit_export":true,"custom_retention":true}'::jsonb)
on conflict (plan_key) do update set
  display_name=excluded.display_name,
  quota_bytes=excluded.quota_bytes,
  max_file_bytes=excluded.max_file_bytes,
  default_retention_days=excluded.default_retention_days,
  features=excluded.features,
  active=true,
  updated_at=now();

create index if not exists institutions_owner_id_idx on public.institutions(owner_id);
create index if not exists institution_memberships_user_id_idx on public.institution_memberships(user_id);
create index if not exists courses_institution_id_idx on public.courses(institution_id);
