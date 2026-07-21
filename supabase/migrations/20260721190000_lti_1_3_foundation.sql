-- LTI 1.3 / LTI Advantage foundation.
-- Existing EdNotebook institutions, courses, memberships, grade items, and student grades
-- remain authoritative. These tables are provider crosswalks and immutable sync evidence.

alter table public.institutions
  add column if not exists institution_code text,
  add column if not exists sis_sourced_id text,
  add column if not exists primary_lms text,
  add column if not exists academic_domain text,
  add column if not exists timezone_name text not null default 'America/Chicago';

alter table public.courses
  add column if not exists section_code text,
  add column if not exists academic_session_sourced_id text,
  add column if not exists external_course_sourced_id text,
  add column if not exists source_system text not null default 'ednotebook',
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

create table public.learning_system_identifiers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  provider text not null check (provider in ('ednotebook','blackboard','institution_sis','oneroster','other')),
  integration_mode text not null check (integration_mode in ('csv','lti_1_3','rest','oneroster_csv','oneroster_rest')),
  object_type text not null check (object_type in ('institution','academic_session','course','section','person','enrollment','grade_item','grade_result')),
  identifier_type text not null check (identifier_type in ('lti_subject','lti_context_id','lti_resource_link_id','lti_line_item_id','oneroster_sourced_id','lms_user_id','sis_user_id','institution_user_id','student_id','username','email','other')),
  identifier_value text not null check (char_length(identifier_value) between 1 and 1000),
  ednotebook_institution_id uuid references public.institutions(id) on delete cascade,
  ednotebook_course_id uuid references public.courses(id) on delete cascade,
  ednotebook_user_id uuid references public.profiles(id) on delete cascade,
  ednotebook_grade_item_id uuid references public.grade_items(id) on delete cascade,
  source_status text,
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object' and octet_length(provenance::text) <= 8192),
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, integration_mode, institution_id, object_type, identifier_type, identifier_value)
);

create table public.lti_platform_registrations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 180),
  platform_product text not null default 'Blackboard Learn',
  issuer text not null check (issuer ~ '^https://'),
  client_id text not null check (char_length(client_id) between 1 and 500),
  oidc_authorization_url text not null check (oidc_authorization_url ~ '^https://'),
  jwks_url text not null check (jwks_url ~ '^https://'),
  oauth_token_url text not null check (oauth_token_url ~ '^https://'),
  oauth_audience text,
  allowed_service_hosts text[] not null default '{}',
  enabled_scopes text[] not null default '{}',
  status text not null default 'setup' check (status in ('setup','testing','active','suspended')),
  settings jsonb not null default '{"retain_roster_profile":true}'::jsonb check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 16384),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, client_id)
);

create table public.lti_deployments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.lti_platform_registrations(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  deployment_id text not null check (char_length(deployment_id) between 1 and 500),
  display_name text not null check (char_length(display_name) between 1 and 180),
  status text not null default 'setup' check (status in ('setup','testing','active','suspended')),
  auto_provision_users boolean not null default false,
  allowed_target_link_urls text[] not null default '{}',
  launch_count bigint not null default 0 check (launch_count >= 0),
  last_launch_at timestamptz,
  last_instructor_launch_at timestamptz,
  last_learner_launch_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, deployment_id)
);

create table public.lti_launch_states (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.lti_platform_registrations(id) on delete cascade,
  deployment_id uuid references public.lti_deployments(id) on delete cascade,
  state_hash text not null unique check (state_hash ~ '^[a-f0-9]{64}$'),
  nonce_hash text not null unique check (nonce_hash ~ '^[a-f0-9]{64}$'),
  login_hint_hash text not null check (login_hint_hash ~ '^[a-f0-9]{64}$'),
  target_link_uri text not null check (char_length(target_link_uri) between 1 and 2000),
  lti_message_hint text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.lti_context_mappings (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  lti_context_id text not null check (char_length(lti_context_id) between 1 and 1000),
  lti_context_label text,
  lti_context_title text,
  lti_context_type text[] not null default '{}',
  ednotebook_course_id uuid references public.courses(id) on delete set null,
  mapping_status text not null default 'pending' check (mapping_status in ('pending','mapped','ignored','conflict')),
  mapped_by uuid references public.profiles(id) on delete set null,
  mapped_at timestamptz,
  last_launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deployment_id, lti_context_id),
  check ((mapping_status = 'mapped' and ednotebook_course_id is not null) or mapping_status <> 'mapped')
);

create table public.lti_user_mappings (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  lti_subject text not null check (char_length(lti_subject) between 1 and 1000),
  ednotebook_user_id uuid references public.profiles(id) on delete set null,
  mapping_status text not null default 'pending' check (mapping_status in ('pending','mapped','ignored','conflict')),
  canonical_role text not null default 'unknown' check (canonical_role in ('administrator','instructor','teaching_assistant','learner','observer','content_developer','unknown')),
  lti_roles text[] not null default '{}',
  external_user_id text,
  lis_person_sourced_id text,
  one_roster_sourced_id text,
  username text,
  given_name text,
  family_name text,
  display_name text,
  email text,
  mapped_by uuid references public.profiles(id) on delete set null,
  mapped_at timestamptz,
  last_launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deployment_id, lti_subject),
  unique (deployment_id, ednotebook_user_id),
  check ((mapping_status = 'mapped' and ednotebook_user_id is not null) or mapping_status <> 'mapped')
);

create table public.lti_context_memberships (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  context_mapping_id uuid not null references public.lti_context_mappings(id) on delete cascade,
  user_mapping_id uuid not null references public.lti_user_mappings(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  external_enrollment_id text,
  canonical_role text not null default 'unknown' check (canonical_role in ('administrator','instructor','teaching_assistant','learner','observer','content_developer','unknown')),
  lti_roles text[] not null default '{}',
  enrollment_status text not null default 'active' check (enrollment_status in ('active','inactive','unknown')),
  begins_at timestamptz,
  ends_at timestamptz,
  last_sync_run_id uuid,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (context_mapping_id, user_mapping_id)
);

create table public.lti_resource_links (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  context_mapping_id uuid references public.lti_context_mappings(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  ednotebook_course_id uuid references public.courses(id) on delete cascade,
  lti_resource_link_id text not null check (char_length(lti_resource_link_id) between 1 and 1000),
  title text,
  description text,
  target_type text not null default 'course' check (target_type in ('course','publication','lesson','assignment')),
  publication_id uuid references public.course_publications(id) on delete set null,
  assignment_id uuid references public.assignments(id) on delete set null,
  lesson_key text,
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  created_by uuid references public.profiles(id) on delete set null,
  last_launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deployment_id, lti_resource_link_id)
);

create table public.lti_service_endpoints (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  context_mapping_id uuid references public.lti_context_mappings(id) on delete cascade,
  resource_link_id uuid references public.lti_resource_links(id) on delete cascade,
  ags_lineitems_url text,
  ags_lineitem_url text,
  nrps_memberships_url text,
  granted_scopes text[] not null default '{}',
  last_validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (deployment_id, context_mapping_id, resource_link_id)
);

create table public.lti_launch_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  context_mapping_id uuid references public.lti_context_mappings(id) on delete cascade,
  user_mapping_id uuid not null references public.lti_user_mappings(id) on delete cascade,
  resource_link_id uuid references public.lti_resource_links(id) on delete cascade,
  service_endpoint_id uuid references public.lti_service_endpoints(id) on delete cascade,
  message_type text not null check (message_type in ('LtiResourceLinkRequest','LtiDeepLinkingRequest')),
  canonical_role text not null check (canonical_role in ('administrator','instructor','teaching_assistant','learner','observer','content_developer','unknown')),
  target_link_uri text not null,
  return_url text,
  deep_link_data text,
  deep_link_accept_multiple boolean not null default false,
  deep_link_accept_types text[] not null default '{}',
  locale text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.lti_grade_item_mappings (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  context_mapping_id uuid not null references public.lti_context_mappings(id) on delete cascade,
  resource_link_id uuid references public.lti_resource_links(id) on delete set null,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  ednotebook_grade_item_id uuid not null references public.grade_items(id) on delete cascade,
  lti_line_item_url text not null check (lti_line_item_url ~ '^https://'),
  lti_line_item_tag text,
  label text not null,
  score_maximum numeric(12,4) not null check (score_maximum > 0),
  resource_id text,
  release_mode text not null default 'manual' check (release_mode in ('manual','automatic','held')),
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deployment_id, ednotebook_grade_item_id),
  unique (deployment_id, lti_line_item_url)
);

create table public.lti_grade_sync_events (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  grade_item_mapping_id uuid not null references public.lti_grade_item_mappings(id) on delete cascade,
  student_grade_id uuid not null references public.student_grades(id) on delete cascade,
  user_mapping_id uuid not null references public.lti_user_mappings(id) on delete cascade,
  initiated_by uuid references public.profiles(id) on delete set null,
  direction text not null default 'ednotebook_to_lms' check (direction in ('ednotebook_to_lms','lms_to_ednotebook')),
  idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  score_given numeric(12,4),
  score_maximum numeric(12,4) not null check (score_maximum > 0),
  activity_progress text not null check (activity_progress in ('Initialized','Started','InProgress','Submitted','Completed')),
  grading_progress text not null check (grading_progress in ('NotReady','Failed','Pending','PendingManual','FullyGraded')),
  status text not null default 'held' check (status in ('held','queued','sending','succeeded','failed','superseded')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 25),
  last_http_status integer,
  error_code text,
  error_summary text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  succeeded_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lti_roster_sync_events (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.lti_deployments(id) on delete cascade,
  context_mapping_id uuid not null references public.lti_context_mappings(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  initiated_by uuid references public.profiles(id) on delete set null,
  status text not null default 'running' check (status in ('running','succeeded','partial','failed')),
  received_count integer not null default 0 check (received_count >= 0),
  mapped_count integer not null default 0 check (mapped_count >= 0),
  pending_count integer not null default 0 check (pending_count >= 0),
  conflict_count integer not null default 0 check (conflict_count >= 0),
  page_count integer not null default 0 check (page_count >= 0),
  error_code text,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index learning_system_identifiers_lookup_idx on public.learning_system_identifiers (provider, institution_id, object_type, identifier_type);
create index learning_system_identifiers_course_idx on public.learning_system_identifiers (ednotebook_course_id);
create index learning_system_identifiers_user_idx on public.learning_system_identifiers (ednotebook_user_id);
create index lti_registrations_institution_idx on public.lti_platform_registrations (institution_id);
create index lti_deployments_institution_idx on public.lti_deployments (institution_id);
create index lti_launch_states_expiry_idx on public.lti_launch_states (expires_at) where consumed_at is null;
create index lti_context_mappings_course_idx on public.lti_context_mappings (ednotebook_course_id);
create index lti_user_mappings_user_idx on public.lti_user_mappings (ednotebook_user_id);
create index lti_context_memberships_course_idx on public.lti_context_memberships (course_id, enrollment_status);
create index lti_launch_sessions_expiry_idx on public.lti_launch_sessions (expires_at) where revoked_at is null;
create index lti_grade_sync_course_idx on public.lti_grade_sync_events (course_id, created_at desc);
create index lti_grade_sync_retry_idx on public.lti_grade_sync_events (next_retry_at) where status = 'failed';
create index lti_roster_sync_course_idx on public.lti_roster_sync_events (course_id, created_at desc);

alter table public.learning_system_identifiers enable row level security;
alter table public.lti_platform_registrations enable row level security;
alter table public.lti_deployments enable row level security;
alter table public.lti_launch_states enable row level security;
alter table public.lti_context_mappings enable row level security;
alter table public.lti_user_mappings enable row level security;
alter table public.lti_context_memberships enable row level security;
alter table public.lti_resource_links enable row level security;
alter table public.lti_service_endpoints enable row level security;
alter table public.lti_launch_sessions enable row level security;
alter table public.lti_grade_item_mappings enable row level security;
alter table public.lti_grade_sync_events enable row level security;
alter table public.lti_roster_sync_events enable row level security;

-- Browser clients can only read approved operational records. State, session, and
-- service endpoint tables intentionally have no client grants or policies.
create policy learning_system_identifiers_manager_select on public.learning_system_identifiers
for select to authenticated using (
  private.is_platform_manager()
  or (institution_id is not null and private.is_institution_manager(institution_id, (select auth.uid())))
  or (ednotebook_course_id is not null and private.can_manage_course(ednotebook_course_id))
);
create policy lti_registrations_manager_select on public.lti_platform_registrations
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())));
create policy lti_deployments_manager_select on public.lti_deployments
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())));
create policy lti_context_mappings_manager_select on public.lti_context_mappings
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())) or (ednotebook_course_id is not null and private.can_manage_course(ednotebook_course_id)));
create policy lti_user_mappings_manager_select on public.lti_user_mappings
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())) or (ednotebook_user_id = (select auth.uid())));
create policy lti_context_memberships_manager_select on public.lti_context_memberships
for select to authenticated using (
  private.is_platform_manager()
  or private.is_institution_manager(institution_id, (select auth.uid()))
  or (course_id is not null and private.can_manage_course(course_id))
  or exists (select 1 from public.lti_user_mappings u where u.id=user_mapping_id and u.ednotebook_user_id=(select auth.uid()))
);
create policy lti_resource_links_manager_select on public.lti_resource_links
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())) or (ednotebook_course_id is not null and private.can_manage_course(ednotebook_course_id)));
create policy lti_grade_item_mappings_manager_select on public.lti_grade_item_mappings
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())) or private.can_manage_course(course_id));
create policy lti_grade_sync_manager_select on public.lti_grade_sync_events
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())) or private.can_manage_course(course_id));
create policy lti_roster_sync_manager_select on public.lti_roster_sync_events
for select to authenticated using (private.is_platform_manager() or private.is_institution_manager(institution_id, (select auth.uid())) or (course_id is not null and private.can_manage_course(course_id)));

grant select on public.learning_system_identifiers, public.lti_platform_registrations, public.lti_deployments,
  public.lti_context_mappings, public.lti_user_mappings, public.lti_resource_links,
  public.lti_context_memberships,
  public.lti_grade_item_mappings, public.lti_grade_sync_events, public.lti_roster_sync_events to authenticated;

create trigger learning_system_identifiers_touch_updated_at before update on public.learning_system_identifiers for each row execute function private.touch_updated_at();
create trigger lti_registrations_touch_updated_at before update on public.lti_platform_registrations for each row execute function private.touch_updated_at();
create trigger lti_deployments_touch_updated_at before update on public.lti_deployments for each row execute function private.touch_updated_at();
create trigger lti_context_mappings_touch_updated_at before update on public.lti_context_mappings for each row execute function private.touch_updated_at();
create trigger lti_user_mappings_touch_updated_at before update on public.lti_user_mappings for each row execute function private.touch_updated_at();
create trigger lti_context_memberships_touch_updated_at before update on public.lti_context_memberships for each row execute function private.touch_updated_at();
create trigger lti_resource_links_touch_updated_at before update on public.lti_resource_links for each row execute function private.touch_updated_at();
create trigger lti_service_endpoints_touch_updated_at before update on public.lti_service_endpoints for each row execute function private.touch_updated_at();
create trigger lti_grade_item_mappings_touch_updated_at before update on public.lti_grade_item_mappings for each row execute function private.touch_updated_at();
create trigger lti_grade_sync_events_touch_updated_at before update on public.lti_grade_sync_events for each row execute function private.touch_updated_at();

create or replace function public.consume_lti_launch_state(p_state_hash text, p_nonce_hash text)
returns public.lti_launch_states
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_state public.lti_launch_states;
begin
  update public.lti_launch_states
  set consumed_at = now()
  where state_hash = p_state_hash
    and nonce_hash = p_nonce_hash
    and consumed_at is null
    and expires_at > now()
  returning * into v_state;
  if not found then raise exception 'invalid, expired, or replayed LTI state'; end if;
  return v_state;
end;
$$;

create or replace function public.claim_lti_grade_sync_event(p_event_id uuid, p_expected_attempt integer)
returns public.lti_grade_sync_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_event public.lti_grade_sync_events;
begin
  update public.lti_grade_sync_events
  set status='sending',attempt_count=attempt_count+1,error_code=null,error_summary=null
  where id=p_event_id
    and status in ('queued','failed')
    and attempt_count=p_expected_attempt
    and attempt_count<25
  returning * into v_event;
  if not found then raise exception 'grade sync event is already claimed or reached its retry limit'; end if;
  return v_event;
end;
$$;

revoke all on function public.consume_lti_launch_state(text,text) from public, anon, authenticated;
grant execute on function public.consume_lti_launch_state(text,text) to service_role;
revoke all on function public.claim_lti_grade_sync_event(uuid,integer) from public, anon, authenticated;
grant execute on function public.claim_lti_grade_sync_event(uuid,integer) to service_role;

create or replace function public.get_lti_owner_setup()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_platform_manager() then raise exception 'platform owner access required'; end if;
  return jsonb_build_object(
    'institutions', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'institution_code',i.institution_code,'primary_lms',i.primary_lms) order by i.name) from public.institutions i), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'institution_id',c.institution_id,'title',c.title,'course_code',c.course_code,'section_code',c.section_code,'teaching_window',c.teaching_window,'status',c.status) order by c.updated_at desc) from public.courses c), '[]'::jsonb),
    'registrations', coalesce((select jsonb_agg(to_jsonb(r) - 'settings' || jsonb_build_object('settings',r.settings - 'secret') order by r.created_at desc) from public.lti_platform_registrations r), '[]'::jsonb),
    'deployments', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.lti_deployments d), '[]'::jsonb),
    'contexts', coalesce((select jsonb_agg(to_jsonb(c) order by c.last_launched_at desc nulls last) from public.lti_context_mappings c), '[]'::jsonb),
    'grade_sync', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at desc) from (select * from public.lti_grade_sync_events order by created_at desc limit 100) g), '[]'::jsonb),
    'roster_sync', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select * from public.lti_roster_sync_events order by created_at desc limit 100) r), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_lti_platform_registration(p_registration_id uuid, p_input jsonb)
returns public.lti_platform_registrations
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_row public.lti_platform_registrations; v_current public.lti_platform_registrations; v_institution_id uuid; v_status text;
begin
  if (select auth.uid()) is null or not private.is_platform_manager() then raise exception 'platform owner access required'; end if;
  v_institution_id := (p_input->>'institution_id')::uuid;
  if not exists (select 1 from public.institutions where id=v_institution_id) then raise exception 'institution not found'; end if;
  if coalesce(p_input->>'issuer','') !~ '^https://' or coalesce(p_input->>'oidc_authorization_url','') !~ '^https://'
    or coalesce(p_input->>'jwks_url','') !~ '^https://' or coalesce(p_input->>'oauth_token_url','') !~ '^https://' then
    raise exception 'LTI platform endpoints must use HTTPS';
  end if;
  v_status := case when p_input->>'status' in ('setup','testing','suspended') then p_input->>'status' else 'setup' end;
  if p_registration_id is null then
    insert into public.lti_platform_registrations (institution_id,created_by,display_name,platform_product,issuer,client_id,oidc_authorization_url,jwks_url,oauth_token_url,oauth_audience,allowed_service_hosts,enabled_scopes,status,settings)
    values (v_institution_id,(select auth.uid()),left(p_input->>'display_name',180),left(coalesce(p_input->>'platform_product','Blackboard Learn'),180),trim(p_input->>'issuer'),left(p_input->>'client_id',500),p_input->>'oidc_authorization_url',p_input->>'jwks_url',p_input->>'oauth_token_url',nullif(p_input->>'oauth_audience',''),coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'allowed_service_hosts','[]'::jsonb))),'{}'),coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'enabled_scopes','[]'::jsonb))),'{}'),v_status,coalesce(p_input->'settings','{}'::jsonb)) returning * into v_row;
  else
    if p_input->>'status'='active' then raise exception 'choose testing or suspended before editing an active registration'; end if;
    select * into v_current from public.lti_platform_registrations where id=p_registration_id;
    if not found then raise exception 'LTI registration not found'; end if;
    if exists (select 1 from public.lti_deployments where registration_id=p_registration_id)
      and (v_current.institution_id<>v_institution_id or v_current.issuer<>trim(p_input->>'issuer') or v_current.client_id<>p_input->>'client_id')
    then raise exception 'institution, issuer, and client ID cannot change after a deployment exists; create a new registration'; end if;
    update public.lti_platform_registrations set institution_id=v_institution_id,display_name=left(p_input->>'display_name',180),platform_product=left(coalesce(p_input->>'platform_product','Blackboard Learn'),180),issuer=trim(p_input->>'issuer'),client_id=left(p_input->>'client_id',500),oidc_authorization_url=p_input->>'oidc_authorization_url',jwks_url=p_input->>'jwks_url',oauth_token_url=p_input->>'oauth_token_url',oauth_audience=nullif(p_input->>'oauth_audience',''),allowed_service_hosts=coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'allowed_service_hosts','[]'::jsonb))),'{}'),enabled_scopes=coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'enabled_scopes','[]'::jsonb))),'{}'),status=v_status,settings=coalesce(p_input->'settings','{}'::jsonb) where id=p_registration_id returning * into v_row;
    if not found then raise exception 'LTI registration not found'; end if;
    if v_status='testing' then update public.lti_deployments set status='testing' where registration_id=p_registration_id and status='active'; end if;
  end if;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash) values ((select auth.uid()),v_institution_id,'lti.registration_saved','lti_platform_registration',v_row.id::text,jsonb_build_object('status',v_row.status,'platform',v_row.platform_product),'');
  return v_row;
end;
$$;

create or replace function public.save_lti_deployment(p_deployment_id uuid, p_input jsonb)
returns public.lti_deployments
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_row public.lti_deployments; v_current public.lti_deployments; v_registration public.lti_platform_registrations; v_status text;
begin
  if (select auth.uid()) is null or not private.is_platform_manager() then raise exception 'platform owner access required'; end if;
  select * into v_registration from public.lti_platform_registrations where id=(p_input->>'registration_id')::uuid;
  if not found then raise exception 'LTI registration not found'; end if;
  v_status := case when p_input->>'status' in ('setup','testing','suspended') then p_input->>'status' else 'setup' end;
  if p_deployment_id is null then
    insert into public.lti_deployments(registration_id,institution_id,deployment_id,display_name,status,auto_provision_users,allowed_target_link_urls)
    values(v_registration.id,v_registration.institution_id,left(p_input->>'deployment_id',500),left(p_input->>'display_name',180),v_status,coalesce((p_input->>'auto_provision_users')::boolean,false),coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'allowed_target_link_urls','[]'::jsonb))),'{}')) returning * into v_row;
  else
    if p_input->>'status'='active' then raise exception 'choose testing or suspended before editing an active deployment'; end if;
    select * into v_current from public.lti_deployments where id=p_deployment_id;
    if not found then raise exception 'LTI deployment not found'; end if;
    if (v_current.registration_id<>v_registration.id or v_current.deployment_id<>p_input->>'deployment_id')
      and (v_current.launch_count>0 or exists (select 1 from public.lti_context_mappings where deployment_id=p_deployment_id))
    then raise exception 'registration and deployment ID cannot change after launch; create a new deployment'; end if;
    update public.lti_deployments set registration_id=v_registration.id,institution_id=v_registration.institution_id,deployment_id=left(p_input->>'deployment_id',500),display_name=left(p_input->>'display_name',180),status=v_status,auto_provision_users=coalesce((p_input->>'auto_provision_users')::boolean,false),allowed_target_link_urls=coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'allowed_target_link_urls','[]'::jsonb))),'{}') where id=p_deployment_id returning * into v_row;
    if not found then raise exception 'LTI deployment not found'; end if;
  end if;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash) values ((select auth.uid()),v_registration.institution_id,'lti.deployment_saved','lti_deployment',v_row.id::text,jsonb_build_object('status',v_row.status),'');
  return v_row;
end;
$$;

create or replace function public.map_lti_context(p_context_mapping_id uuid, p_course_id uuid)
returns public.lti_context_mappings
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_context public.lti_context_mappings; v_course public.courses%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  select * into v_context from public.lti_context_mappings where id=p_context_mapping_id;
  select * into v_course from public.courses where id=p_course_id;
  if v_context.id is null or v_course.id is null then raise exception 'context or course not found'; end if;
  if v_context.institution_id <> v_course.institution_id then raise exception 'LTI context and course must belong to the same institution'; end if;
  if not (private.is_platform_manager() or private.is_institution_manager(v_context.institution_id,(select auth.uid())) or private.can_manage_course(p_course_id)) then raise exception 'course management access required'; end if;
  update public.lti_context_mappings set ednotebook_course_id=p_course_id,mapping_status='mapped',mapped_by=(select auth.uid()),mapped_at=now() where id=p_context_mapping_id returning * into v_context;
  insert into public.learning_system_identifiers(institution_id,provider,integration_mode,object_type,identifier_type,identifier_value,ednotebook_institution_id,ednotebook_course_id,source_status,provenance,last_reconciled_at)
  values(v_context.institution_id,'blackboard','lti_1_3','course','lti_context_id',v_context.lti_context_id,v_context.institution_id,p_course_id,'active',jsonb_build_object('deployment_id',v_context.deployment_id,'contract_version','1.0'),now())
  on conflict (provider,integration_mode,institution_id,object_type,identifier_type,identifier_value) do update set ednotebook_course_id=excluded.ednotebook_course_id,source_status='active',last_reconciled_at=now(),updated_at=now();
  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash) values ((select auth.uid()),v_context.institution_id,p_course_id,'lti.context_mapped','lti_context_mapping',v_context.id::text,jsonb_build_object('lti_context_id',v_context.lti_context_id),'');
  return v_context;
end;
$$;

create or replace function public.activate_tested_lti_deployment(p_deployment_id uuid)
returns public.lti_deployments
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_deployment public.lti_deployments; v_registration public.lti_platform_registrations;
begin
  if (select auth.uid()) is null or not private.is_platform_manager() then raise exception 'platform owner access required'; end if;
  select * into v_deployment from public.lti_deployments where id=p_deployment_id for update;
  if not found then raise exception 'LTI deployment not found'; end if;
  select * into v_registration from public.lti_platform_registrations where id=v_deployment.registration_id for update;
  if v_deployment.status <> 'testing' or v_registration.status not in ('testing','active') then raise exception 'registration must be testing/active and deployment must be testing'; end if;
  if v_deployment.last_instructor_launch_at is null then raise exception 'a real instructor launch is required'; end if;
  if v_deployment.last_learner_launch_at is null then raise exception 'a real learner launch is required'; end if;
  if not exists (select 1 from public.lti_context_mappings where deployment_id=v_deployment.id and mapping_status='mapped') then raise exception 'a Blackboard course context must be mapped'; end if;
  if not exists (select 1 from public.lti_grade_sync_events where deployment_id=v_deployment.id and status='succeeded') then raise exception 'a successful AGS grade passback is required'; end if;
  if 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'=any(v_registration.enabled_scopes)
    and not exists (select 1 from public.lti_roster_sync_events where deployment_id=v_deployment.id and status='succeeded') then raise exception 'a successful NRPS roster sync is required for the approved scope'; end if;
  if 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'=any(v_registration.enabled_scopes)
    and not exists (select 1 from public.lti_grade_item_mappings where deployment_id=v_deployment.id and enabled) then raise exception 'an AGS line item must be reconciled'; end if;
  update public.lti_deployments set status='active' where id=v_deployment.id returning * into v_deployment;
  update public.lti_platform_registrations set status='active',last_verified_at=now() where id=v_registration.id;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_deployment.institution_id,'lti.deployment_activated','lti_deployment',v_deployment.id::text,jsonb_build_object('instructor_launch_at',v_deployment.last_instructor_launch_at,'learner_launch_at',v_deployment.last_learner_launch_at),'');
  return v_deployment;
end;
$$;

revoke all on function public.get_lti_owner_setup() from public;
revoke all on function public.save_lti_platform_registration(uuid,jsonb) from public;
revoke all on function public.save_lti_deployment(uuid,jsonb) from public;
revoke all on function public.map_lti_context(uuid,uuid) from public;
revoke all on function public.activate_tested_lti_deployment(uuid) from public;
grant execute on function public.get_lti_owner_setup() to authenticated;
grant execute on function public.save_lti_platform_registration(uuid,jsonb) to authenticated;
grant execute on function public.save_lti_deployment(uuid,jsonb) to authenticated;
grant execute on function public.map_lti_context(uuid,uuid) to authenticated;
grant execute on function public.activate_tested_lti_deployment(uuid) to authenticated;

-- Registration/deployment records never become active merely because they exist.
-- Activation is a service-side operation after the documented instructor launch,
-- learner launch, roster, deep-link, and grade-passback checks succeed.
