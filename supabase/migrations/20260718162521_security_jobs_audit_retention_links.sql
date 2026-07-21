create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  secure_file_id uuid references public.secure_file_objects(id) on delete cascade,
  job_type text not null check (job_type in ('malware_scan','archive_inspection','document_preview','edubook_conversion','retention_delete','link_preview')),
  status text not null default 'queued' check (status in ('queued','dispatched','processing','succeeded','failed','dead_letter','cancelled')),
  priority integer not null default 100,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 50),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  institution_id uuid references public.institutions(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  secure_file_id uuid references public.secure_file_objects(id) on delete set null,
  resource_id uuid references public.learning_resources(id) on delete set null,
  event_type text not null,
  target_type text not null,
  target_id text,
  request_id text,
  ip_hash text,
  user_agent_hash text,
  details jsonb not null default '{}'::jsonb,
  event_hash text not null
);

create table if not exists public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  name text not null,
  purpose text,
  retention_days integer not null check (retention_days between 0 and 36500),
  resource_types text[] not null default '{}'::text[],
  disposition text not null default 'delete' check (disposition in ('delete','archive','review')),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (institution_id is not null or course_id is not null)
);

create table if not exists public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  name text not null,
  reason text not null,
  scope jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (institution_id is not null or course_id is not null)
);

create table if not exists public.legal_hold_files (
  legal_hold_id uuid not null references public.legal_holds(id) on delete cascade,
  secure_file_id uuid not null references public.secure_file_objects(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (legal_hold_id,secure_file_id)
);

create table if not exists public.file_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  secure_file_id uuid not null references public.secure_file_objects(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','deferred_retention','blocked_legal_hold','eligible','processing','completed','failed','cancelled')),
  eligible_at timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.link_previews (
  id uuid primary key default gen_random_uuid(),
  normalized_url text not null unique,
  url_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','ready','blocked','error')),
  title text,
  description text,
  site_name text,
  image_url text,
  favicon_url text,
  canonical_url text,
  content_type text,
  http_status integer,
  fetched_at timestamptz,
  expires_at timestamptz,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.learning_resources add column if not exists link_preview_id uuid references public.link_previews(id) on delete set null;

create index if not exists processing_jobs_claim_idx on public.processing_jobs(status,available_at,priority,created_at);
create index if not exists audit_events_actor_time_idx on public.audit_events(actor_id,occurred_at desc);
create index if not exists audit_events_course_time_idx on public.audit_events(course_id,occurred_at desc);
create index if not exists audit_events_file_time_idx on public.audit_events(secure_file_id,occurred_at desc);
create index if not exists retention_policies_institution_idx on public.retention_policies(institution_id,active);
create index if not exists retention_policies_course_idx on public.retention_policies(course_id,active);
create index if not exists legal_holds_institution_idx on public.legal_holds(institution_id,active);
create index if not exists legal_holds_course_idx on public.legal_holds(course_id,active);
create index if not exists file_deletion_requests_status_idx on public.file_deletion_requests(status,eligible_at);
