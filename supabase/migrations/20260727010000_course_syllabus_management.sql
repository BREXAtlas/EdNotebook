-- Versioned institutional syllabus drafts and LMS mapping for Phase 3.

create table if not exists public.course_syllabi (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete restrict,
  institution_id uuid references public.institutions(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  requirement_profile_key text not null,
  requirement_profile_version text not null,
  status text not null default 'draft' check (status in ('draft','professor_reviewed','institution_approved','published','archived')),
  current_version integer not null default 0 check (current_version >= 0),
  source_type text not null default 'pasted' check (source_type in ('pasted','pdf','docx','text','blank','imported')),
  source_name text not null default '',
  source_checksum_sha256 text check (source_checksum_sha256 is null or source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  draft_payload jsonb not null default '{}'::jsonb,
  compliance_summary jsonb not null default '{}'::jsonb,
  lms_mapping jsonb not null default '{}'::jsonb,
  professor_reviewed_by uuid references public.profiles(id) on delete set null,
  professor_reviewed_at timestamptz,
  institution_approved_by uuid references public.profiles(id) on delete set null,
  institution_approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_syllabus_versions (
  syllabus_id uuid not null references public.course_syllabi(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  review_state text not null check (review_state in ('draft','professor_reviewed','institution_approved','published')),
  payload jsonb not null,
  compliance_summary jsonb not null default '{}'::jsonb,
  lms_mapping jsonb not null default '{}'::jsonb,
  change_summary text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (syllabus_id, version_number)
);

create table if not exists public.course_syllabus_lms_links (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.course_syllabi(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  platform text not null default 'blackboard',
  deployment_id text,
  context_id text,
  resource_link_id text,
  platform_course_key text,
  status text not null default 'draft' check (status in ('draft','active','disabled','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (syllabus_id, platform)
);

create index if not exists course_syllabi_course_idx on public.course_syllabi(course_id);
create index if not exists course_syllabi_institution_idx on public.course_syllabi(institution_id, status);
create index if not exists course_syllabus_versions_latest_idx on public.course_syllabus_versions(syllabus_id, version_number desc);
create index if not exists course_syllabus_lms_links_course_idx on public.course_syllabus_lms_links(course_id, platform);

alter table public.course_syllabi enable row level security;
alter table public.course_syllabus_versions enable row level security;
alter table public.course_syllabus_lms_links enable row level security;

revoke all on public.course_syllabi from anon;
revoke all on public.course_syllabus_versions from anon;
revoke all on public.course_syllabus_lms_links from anon;
revoke all on public.course_syllabi from authenticated;
revoke all on public.course_syllabus_versions from authenticated;
revoke all on public.course_syllabus_lms_links from authenticated;

grant select on public.course_syllabi to authenticated;
grant select on public.course_syllabus_versions to authenticated;
grant select on public.course_syllabus_lms_links to authenticated;

create policy course_syllabi_select on public.course_syllabi
for select to authenticated
using (
  private.can_manage_course(course_id)
  or (status = 'published' and private.can_access_course(course_id))
);

create policy course_syllabus_versions_select on public.course_syllabus_versions
for select to authenticated
using (
  exists (
    select 1
    from public.course_syllabi s
    where s.id = syllabus_id
      and (
        private.can_manage_course(s.course_id)
        or (s.status = 'published' and private.can_access_course(s.course_id))
      )
  )
);

create policy course_syllabus_lms_links_select on public.course_syllabus_lms_links
for select to authenticated
using (private.can_manage_course(course_id));

create or replace function private.course_syllabus_payload_valid(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    coalesce(p_payload->>'format','') = 'EdNotebookStructuredSyllabus/1.0'
    and jsonb_typeof(p_payload->'profile') = 'object'
    and length(trim(coalesce(p_payload->'profile'->>'profileKey',''))) > 0
    and length(trim(coalesce(p_payload->'profile'->>'version',''))) > 0
    and jsonb_typeof(p_payload->'structuredContent') = 'object'
    and jsonb_typeof(p_payload->'compliance') = 'object'
    and jsonb_typeof(p_payload->'lmsMapping') = 'object';
$$;

create or replace function public.save_course_syllabus_draft(
  p_course_id uuid,
  p_payload jsonb,
  p_source_type text default 'pasted',
  p_source_name text default '',
  p_source_checksum_sha256 text default null,
  p_change_summary text default 'Professor-reviewed syllabus draft'
)
returns public.course_syllabi
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_course public.courses;
  v_syllabus public.course_syllabi;
  v_next_version integer;
  v_source_type text;
begin
  if auth.uid() is null or not private.can_manage_course(p_course_id) then
    raise exception 'course access denied';
  end if;
  if not private.course_syllabus_payload_valid(p_payload) then
    raise exception 'invalid EdNotebookStructuredSyllabus/1.0 payload';
  end if;
  if p_source_checksum_sha256 is not null and p_source_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid syllabus checksum';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found then raise exception 'course not found'; end if;

  v_source_type := case
    when p_source_type in ('pasted','pdf','docx','text','blank','imported') then p_source_type
    else 'pasted'
  end;

  insert into public.course_syllabi (
    course_id,
    institution_id,
    created_by,
    requirement_profile_key,
    requirement_profile_version,
    status,
    source_type,
    source_name,
    source_checksum_sha256,
    draft_payload,
    compliance_summary,
    lms_mapping,
    professor_reviewed_by,
    professor_reviewed_at
  ) values (
    p_course_id,
    v_course.institution_id,
    auth.uid(),
    p_payload->'profile'->>'profileKey',
    p_payload->'profile'->>'version',
    'professor_reviewed',
    v_source_type,
    left(coalesce(p_source_name,''),500),
    p_source_checksum_sha256,
    p_payload,
    coalesce(p_payload->'compliance','{}'::jsonb),
    coalesce(p_payload->'lmsMapping','{}'::jsonb),
    auth.uid(),
    now()
  )
  on conflict (course_id) do update set
    institution_id = excluded.institution_id,
    requirement_profile_key = excluded.requirement_profile_key,
    requirement_profile_version = excluded.requirement_profile_version,
    status = 'professor_reviewed',
    source_type = excluded.source_type,
    source_name = excluded.source_name,
    source_checksum_sha256 = excluded.source_checksum_sha256,
    draft_payload = excluded.draft_payload,
    compliance_summary = excluded.compliance_summary,
    lms_mapping = excluded.lms_mapping,
    professor_reviewed_by = auth.uid(),
    professor_reviewed_at = now(),
    institution_approved_by = null,
    institution_approved_at = null,
    updated_at = now()
  returning * into v_syllabus;

  v_next_version := v_syllabus.current_version + 1;

  insert into public.course_syllabus_versions (
    syllabus_id,
    version_number,
    review_state,
    payload,
    compliance_summary,
    lms_mapping,
    change_summary,
    created_by
  ) values (
    v_syllabus.id,
    v_next_version,
    'professor_reviewed',
    p_payload,
    coalesce(p_payload->'compliance','{}'::jsonb),
    coalesce(p_payload->'lmsMapping','{}'::jsonb),
    left(coalesce(p_change_summary,''),1000),
    auth.uid()
  );

  update public.course_syllabi
  set current_version = v_next_version, updated_at = now()
  where id = v_syllabus.id
  returning * into v_syllabus;

  insert into public.course_syllabus_lms_links (
    syllabus_id,
    course_id,
    platform,
    platform_course_key,
    status
  ) values (
    v_syllabus.id,
    p_course_id,
    coalesce(nullif(p_payload->'lmsMapping'->>'platform',''),'blackboard'),
    nullif(p_payload->'lmsMapping'->>'courseId',''),
    case when nullif(p_payload->'lmsMapping'->>'courseId','') is null then 'draft' else 'active' end
  )
  on conflict (syllabus_id, platform) do update set
    platform_course_key = excluded.platform_course_key,
    status = excluded.status,
    updated_at = now();

  return v_syllabus;
end;
$$;

create or replace function public.set_course_syllabus_state(
  p_course_id uuid,
  p_status text
)
returns public.course_syllabi
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_row public.course_syllabi;
begin
  if auth.uid() is null or not private.can_manage_course(p_course_id) then
    raise exception 'course access denied';
  end if;
  if p_status not in ('draft','professor_reviewed','archived') then
    raise exception 'institution approval and publication require the governed approval workflow';
  end if;
  update public.course_syllabi
  set status = p_status,
      updated_at = now()
  where course_id = p_course_id
  returning * into v_row;
  if not found then raise exception 'syllabus not found'; end if;
  return v_row;
end;
$$;

revoke all on function public.save_course_syllabus_draft(uuid,jsonb,text,text,text,text) from public;
revoke all on function public.set_course_syllabus_state(uuid,text) from public;
grant execute on function public.save_course_syllabus_draft(uuid,jsonb,text,text,text,text) to authenticated;
grant execute on function public.set_course_syllabus_state(uuid,text) to authenticated;
