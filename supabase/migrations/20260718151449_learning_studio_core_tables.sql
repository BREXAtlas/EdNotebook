create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.courses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180), course_code text, subject text, audience text,
  teaching_window text, status text not null default 'draft' check (status in ('draft','review','published','archived')),
  settings jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.course_memberships (
  course_id uuid not null references public.courses(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'learner' check (role in ('owner','admin','professor','learner','publisher')),
  created_at timestamptz not null default now(), primary key (course_id,user_id)
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade, title text not null check (char_length(title) between 1 and 220),
  instructions text not null default '', due_at timestamptz, status text not null default 'draft' check (status in ('draft','review','published','closed','archived')),
  syllabus_section jsonb not null default '{}'::jsonb, learner_preview jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.learning_resources (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade, assignment_id uuid references public.assignments(id) on delete cascade,
  resource_type text not null check (resource_type in ('file','image','link','youtube','quote','book','slide_deck','audio','video','dataset','other')),
  title text not null check (char_length(title) between 1 and 220), description text not null default '',
  placement text not null default 'course-library' check (placement in ('course-overview','lesson','assignment','reading-list','course-library','private-vault','submission','publisher-catalog')),
  storage_mode text not null default 'cloud' check (storage_mode in ('cloud','device','external')),
  bucket_id text, storage_path text, external_url text, mime_type text, size_bytes bigint, original_name text, safe_name text,
  checksum_sha256 text, alt_text text, source_label text, license_label text,
  visibility text not null default 'private' check (visibility in ('private','course','public','publisher')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((storage_mode='cloud' and bucket_id is not null and storage_path is not null) or (storage_mode='external' and external_url is not null) or storage_mode='device')
);
create table public.rubrics (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade, title text not null default 'Custom rubric',
  total_points numeric(8,2) not null default 100 check (total_points>0), criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.assignment_drafts (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, content jsonb not null default '{}'::jsonb,
  storage_mode text not null default 'cloud' check (storage_mode in ('cloud','device')),
  status text not null default 'draft' check (status in ('draft','submitted','returned','graded')), submitted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (assignment_id,student_id)
);
create table public.learning_messages (
  id uuid primary key default gen_random_uuid(), course_id uuid references public.courses(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade, sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade, body text not null check (char_length(body) between 1 and 5000),
  attachment_resource_id uuid references public.learning_resources(id) on delete set null, created_at timestamptz not null default now()
);
create table public.publications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null, title text not null check (char_length(title) between 1 and 240),
  author_name text not null default '', description text not null default '', source_format text, bucket_id text, storage_path text,
  rights_confirmed boolean not null default false, rights_statement text not null default '',
  conversion_status text not null default 'draft' check (conversion_status in ('draft','uploaded','queued','processing','ready','failed')),
  edubook_manifest jsonb not null default '{}'::jsonb,
  access_model text not null default 'private' check (access_model in ('private','assigned','purchase','rental','open')),
  price_cents integer check (price_cents is null or price_cents>=0), rental_days integer check (rental_days is null or rental_days>0),
  status text not null default 'draft' check (status in ('draft','review','approved','published','suspended','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reading_annotations (
  id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, locator text not null default '', selected_text text not null default '',
  note text not null default '', annotation_type text not null default 'note' check (annotation_type in ('note','highlight','question','bookmark')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.publisher_applications (
  id uuid primary key default gen_random_uuid(), applicant_id uuid not null references public.profiles(id) on delete cascade,
  organization_name text not null, applicant_type text not null check (applicant_type in ('publisher','author','professor','institution','supplier')),
  website_url text, catalog_summary text not null default '', rights_attestation boolean not null default false,
  status text not null default 'draft' check (status in ('draft','submitted','reviewing','approved','declined','suspended')),
  submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.slide_decks (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade, title text not null check (char_length(title) between 1 and 220),
  slides jsonb not null default '[]'::jsonb, source_plugin text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function private.is_platform_manager() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'));
$$;
create or replace function private.can_access_course(p_course_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select p_course_id is not null and (
 exists(select 1 from public.courses c where c.id=p_course_id and c.owner_id=auth.uid())
 or exists(select 1 from public.course_memberships cm where cm.course_id=p_course_id and cm.user_id=auth.uid())
 or private.is_platform_manager());
$$;
create or replace function private.can_manage_course(p_course_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select p_course_id is not null and (
 exists(select 1 from public.courses c where c.id=p_course_id and c.owner_id=auth.uid())
 or exists(select 1 from public.course_memberships cm where cm.course_id=p_course_id and cm.user_id=auth.uid() and cm.role in ('owner','admin','professor'))
 or private.is_platform_manager());
$$;
create or replace function private.can_access_assignment(p_assignment_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.assignments a where a.id=p_assignment_id and private.can_access_course(a.course_id));
$$;
create or replace function private.can_manage_assignment(p_assignment_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.assignments a where a.id=p_assignment_id and private.can_manage_course(a.course_id));
$$;
create or replace function private.touch_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
create or replace function private.add_course_owner_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.course_memberships(course_id,user_id,role) values(new.id,new.owner_id,'owner') on conflict(course_id,user_id) do update set role=excluded.role; return new; end; $$;

revoke all on function private.is_platform_manager() from public;
revoke all on function private.can_access_course(uuid) from public;
revoke all on function private.can_manage_course(uuid) from public;
revoke all on function private.can_access_assignment(uuid) from public;
revoke all on function private.can_manage_assignment(uuid) from public;
revoke all on function private.touch_updated_at() from public;
revoke all on function private.add_course_owner_membership() from public;
grant execute on function private.is_platform_manager() to authenticated;
grant execute on function private.can_access_course(uuid) to authenticated;
grant execute on function private.can_manage_course(uuid) to authenticated;
grant execute on function private.can_access_assignment(uuid) to authenticated;
grant execute on function private.can_manage_assignment(uuid) to authenticated;

create trigger courses_add_owner_membership after insert on public.courses for each row execute function private.add_course_owner_membership();
create trigger courses_touch_updated_at before update on public.courses for each row execute function private.touch_updated_at();
create trigger learning_resources_touch_updated_at before update on public.learning_resources for each row execute function private.touch_updated_at();
create trigger assignments_touch_updated_at before update on public.assignments for each row execute function private.touch_updated_at();
create trigger rubrics_touch_updated_at before update on public.rubrics for each row execute function private.touch_updated_at();
create trigger assignment_drafts_touch_updated_at before update on public.assignment_drafts for each row execute function private.touch_updated_at();
create trigger publications_touch_updated_at before update on public.publications for each row execute function private.touch_updated_at();
create trigger reading_annotations_touch_updated_at before update on public.reading_annotations for each row execute function private.touch_updated_at();
create trigger publisher_applications_touch_updated_at before update on public.publisher_applications for each row execute function private.touch_updated_at();
create trigger slide_decks_touch_updated_at before update on public.slide_decks for each row execute function private.touch_updated_at();

alter table public.courses enable row level security;
alter table public.course_memberships enable row level security;
alter table public.learning_resources enable row level security;
alter table public.assignments enable row level security;
alter table public.rubrics enable row level security;
alter table public.assignment_drafts enable row level security;
alter table public.learning_messages enable row level security;
alter table public.publications enable row level security;
alter table public.reading_annotations enable row level security;
alter table public.publisher_applications enable row level security;
alter table public.slide_decks enable row level security;

grant select,insert,update,delete on public.courses,public.course_memberships,public.learning_resources,public.assignments,public.rubrics,public.assignment_drafts,public.publications,public.reading_annotations,public.publisher_applications,public.slide_decks to authenticated;
grant select,insert,delete on public.learning_messages to authenticated;
