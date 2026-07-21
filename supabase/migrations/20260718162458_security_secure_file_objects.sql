create table if not exists public.secure_file_objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  institution_id uuid references public.institutions(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  publication_id uuid references public.publications(id) on delete set null,
  purpose text not null check (purpose in ('private','course','submission','publication','preview','export')),
  original_name text not null,
  safe_name text not null,
  claimed_mime_type text,
  detected_mime_type text,
  expected_size_bytes bigint not null check (expected_size_bytes >= 0),
  actual_size_bytes bigint check (actual_size_bytes is null or actual_size_bytes >= 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  quarantine_bucket text not null default 'ed-quarantine',
  quarantine_path text not null unique,
  destination_bucket text not null,
  destination_path text not null unique,
  upload_status text not null default 'reserved' check (upload_status in ('reserved','uploading','uploaded','expired','failed')),
  security_status text not null default 'pending' check (security_status in ('pending','scanning','clean','infected','suspicious','manual_review','error')),
  archive_status text not null default 'pending' check (archive_status in ('pending','not_archive','clean','suspicious','blocked','error')),
  preview_status text not null default 'not_requested' check (preview_status in ('not_requested','pending','processing','ready','unsupported','error')),
  conversion_status text not null default 'not_requested' check (conversion_status in ('not_requested','queued','processing','ready','error')),
  availability_status text not null default 'quarantined' check (availability_status in ('quarantined','released','blocked','pending_delete','deleted')),
  scanner_provider text,
  scanner_engine_version text,
  scanner_signature_version text,
  scan_result jsonb not null default '{}'::jsonb,
  archive_result jsonb not null default '{}'::jsonb,
  worker_callback_token_hash text,
  retention_until timestamptz,
  upload_expires_at timestamptz not null default (now() + interval '24 hours'),
  released_at timestamptz,
  delete_requested_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (purpose='course' and course_id is not null)
    or (purpose='submission' and course_id is not null and assignment_id is not null)
    or (purpose='publication' and publication_id is not null)
    or purpose in ('private','preview','export')
  )
);

create table if not exists public.file_previews (
  id uuid primary key default gen_random_uuid(),
  secure_file_id uuid not null references public.secure_file_objects(id) on delete cascade,
  kind text not null check (kind in ('thumbnail','page','text','html','cover','slides','metadata')),
  bucket_id text not null default 'ed-previews',
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  page_number integer check (page_number is null or page_number > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.upload_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  secure_file_id uuid not null unique references public.secure_file_objects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reserved_bytes bigint not null check (reserved_bytes >= 0),
  status text not null default 'reserved' check (status in ('reserved','committed','released','expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.learning_resources add column if not exists secure_file_id uuid references public.secure_file_objects(id) on delete set null;
alter table public.learning_resources add column if not exists security_status text not null default 'not_applicable';
alter table public.learning_resources add column if not exists deleted_at timestamptz;
alter table public.publications add column if not exists secure_file_id uuid references public.secure_file_objects(id) on delete set null;
alter table public.publications add column if not exists preview_status text not null default 'not_requested';

create index if not exists secure_file_objects_owner_status_idx on public.secure_file_objects(owner_id,availability_status,created_at desc);
create index if not exists secure_file_objects_course_idx on public.secure_file_objects(course_id,created_at desc);
create index if not exists secure_file_objects_assignment_idx on public.secure_file_objects(assignment_id,created_at desc);
create index if not exists secure_file_objects_publication_idx on public.secure_file_objects(publication_id);
create index if not exists secure_file_objects_retention_idx on public.secure_file_objects(retention_until) where availability_status <> 'deleted';
create index if not exists file_previews_secure_file_idx on public.file_previews(secure_file_id,kind,page_number);
create index if not exists quota_reservations_user_status_idx on public.upload_quota_reservations(user_id,status,expires_at);
create index if not exists learning_resources_secure_file_idx on public.learning_resources(secure_file_id);
create index if not exists learning_resources_not_deleted_idx on public.learning_resources(owner_id,created_at desc) where deleted_at is null;
