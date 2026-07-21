-- Institution-aware administration and feature-control foundation.
-- This migration is additive: existing course, membership, grade, audit, LTI,
-- storage, and entitlement records remain authoritative.

alter table public.institutions
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status in ('pending','active','suspended','retired')),
  add column if not exists institution_type text not null default 'university'
    check (institution_type in ('university','college','community_college','school_district','school','system','other')),
  add column if not exists system_name text,
  add column if not exists country_code text not null default 'US',
  add column if not exists region_code text,
  add column if not exists enrollment_selectable boolean not null default true,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.institution_memberships
  add column if not exists status text not null default 'active'
    check (status in ('pending','active','suspended','ended')),
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists joined_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists last_active_at timestamptz;

update public.institution_memberships
set joined_at = coalesce(joined_at, created_at)
where joined_at is null;

alter table public.courses
  add column if not exists access_scope text
    check (access_scope in ('institution','independent','public_free'));

update public.courses
set access_scope = case when institution_id is null then 'independent' else 'institution' end
where access_scope is null;

alter table public.courses alter column access_scope set default 'independent';
alter table public.courses alter column access_scope set not null;

create table public.institution_directory_entries (
  directory_key text primary key check (directory_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  canonical_name text not null check (char_length(trim(canonical_name)) between 2 and 240),
  parent_directory_key text references public.institution_directory_entries(directory_key) on delete set null,
  institution_id uuid unique references public.institutions(id) on delete set null,
  entity_type text not null default 'university'
    check (entity_type in ('university','college','community_college','school_district','school','system','other')),
  education_division text not null default 'university'
    check (education_division in ('university','k12')),
  system_name text,
  city text,
  region_code text,
  country_code text not null default 'US',
  website_url text,
  academic_domain text,
  directory_status text not null default 'listed'
    check (directory_status in ('listed','pending','verified','inactive')),
  is_selectable boolean not null default true,
  is_public boolean not null default true,
  sort_name text generated always as (lower(canonical_name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_directory_aliases (
  id bigint generated always as identity primary key,
  directory_key text not null references public.institution_directory_entries(directory_key) on delete cascade,
  alias_name text not null check (char_length(trim(alias_name)) between 2 and 240),
  normalized_alias text generated always as (lower(trim(alias_name))) stored,
  created_at timestamptz not null default now(),
  unique (directory_key, normalized_alias)
);

create table public.institution_access_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  directory_key text references public.institution_directory_entries(directory_key) on delete set null,
  legal_name text not null check (char_length(trim(legal_name)) between 2 and 240),
  display_name text not null check (char_length(trim(display_name)) between 2 and 180),
  parent_system_name text,
  institution_type text not null
    check (institution_type in ('university','college','community_college','school_district','school','system','other')),
  website_url text,
  academic_domain text,
  country_code text not null default 'US',
  region_code text,
  city text,
  primary_lms text,
  student_information_system text,
  expected_accounts integer check (expected_accounts is null or expected_accounts between 1 and 10000000),
  requested_pathways text[] not null default '{student,professor,publisher}'::text[],
  administrator_name text not null,
  administrator_title text,
  administrator_email text not null,
  administrator_phone text,
  security_contact_email text,
  privacy_contact_email text,
  accessibility_contact_email text,
  intended_use text,
  attested_authority boolean not null default false,
  attested_terms boolean not null default false,
  status text not null default 'pending'
    check (status in ('draft','pending','reviewing','approved','rejected','withdrawn')),
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_institution_id uuid references public.institutions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_affiliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pathway text not null check (pathway in ('student','professor','publisher')),
  institution_id uuid references public.institutions(id) on delete restrict,
  directory_key text references public.institution_directory_entries(directory_key) on delete set null,
  relationship text not null default 'member'
    check (relationship in ('student','faculty','staff','publisher','applicant','member','independent')),
  status text not null default 'pending'
    check (status in ('pending','active','rejected','transfer_pending','ended','independent')),
  source text not null default 'signup'
    check (source in ('signup','institution_admin','platform_owner','lti','sis','roster','transfer','invitation')),
  verification_method text,
  identifier_hash text,
  identifier_last4 text,
  is_primary boolean not null default true,
  started_at timestamptz,
  ended_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'independent' and institution_id is null and relationship = 'independent')
    or status <> 'independent'
  )
);

create unique index institution_affiliations_one_primary_active_idx
  on public.institution_affiliations (user_id, pathway)
  where is_primary and status in ('active','independent','transfer_pending');

create table public.institution_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pathway text not null check (pathway in ('student','professor','publisher')),
  from_affiliation_id uuid references public.institution_affiliations(id) on delete restrict,
  from_institution_id uuid references public.institutions(id) on delete restrict,
  to_directory_key text references public.institution_directory_entries(directory_key) on delete set null,
  to_institution_id uuid references public.institutions(id) on delete restrict,
  requested_institution_name text,
  reason text not null check (char_length(trim(reason)) between 5 and 2000),
  effective_on date,
  preserve_history boolean not null default true check (preserve_history),
  status text not null default 'pending'
    check (status in ('pending','reviewing','approved','rejected','cancelled','completed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index institution_transfer_one_pending_idx
  on public.institution_transfer_requests (user_id, pathway)
  where status in ('pending','reviewing','approved');

create table public.institution_team_invitations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  email text not null,
  intended_role text not null check (intended_role in ('admin','security','records')),
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, email, status)
);

create table public.platform_admin_authorizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  access_level text not null check (access_level in ('operator','auditor','support')),
  capabilities jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.identity_onboarding_requests
  add column if not exists institution_id uuid references public.institutions(id) on delete set null,
  add column if not exists institution_directory_key text references public.institution_directory_entries(directory_key) on delete set null,
  add column if not exists affiliation_choice text not null default 'institution'
    check (affiliation_choice in ('institution','other','independent'));

create table public.feature_definitions (
  feature_key text primary key check (feature_key ~ '^[a-z][a-z0-9]*(?:\.[a-z0-9_]+)+$'),
  display_name text not null,
  pathway text not null check (pathway in ('shared','student','professor','publisher','security','accessibility','theme','integration')),
  category text not null,
  description text not null,
  help_text text not null,
  control_type text not null check (control_type in ('boolean','number','select','text','status_only')),
  value_type text not null check (value_type in ('boolean','number','text','json')),
  default_value jsonb not null,
  allowed_values jsonb not null default '[]'::jsonb,
  minimum_value numeric,
  maximum_value numeric,
  allowed_scopes text[] not null default '{platform,institution,pathway,course,account}'::text[],
  institution_delegable boolean not null default true,
  lockable boolean not null default true,
  control_class text not null default 'ordinary'
    check (control_class in ('ordinary','integration','accessibility_required','security_required','kernel')),
  risk_level text not null default 'low' check (risk_level in ('low','moderate','high','critical')),
  build_status text not null default 'implemented'
    check (build_status in ('demonstration','built_in_part','implemented','deployment_required','pilot_testing','planned')),
  disable_behavior text not null default 'hide'
    check (disable_behavior in ('hide','read_only','block','degrade','status_only')),
  impact_explanation text not null,
  accessibility_notes text,
  data_classification text not null default 'internal'
    check (data_classification in ('public','internal','education_record','restricted')),
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feature_dependencies (
  feature_key text not null references public.feature_definitions(feature_key) on delete cascade,
  depends_on_feature_key text not null references public.feature_definitions(feature_key) on delete cascade,
  dependency_kind text not null default 'requires'
    check (dependency_kind in ('requires','uses','conflicts_with')),
  explanation text not null,
  primary key (feature_key, depends_on_feature_key),
  check (feature_key <> depends_on_feature_key)
);

create table public.feature_policy_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  template_key text not null,
  display_name text not null,
  pathway text not null check (pathway in ('shared','student','professor','publisher')),
  description text not null,
  owner_managed boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, template_key)
);

create table public.feature_policy_template_items (
  template_id uuid not null references public.feature_policy_templates(id) on delete cascade,
  feature_key text not null references public.feature_definitions(feature_key) on delete cascade,
  control_value jsonb not null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (template_id, feature_key)
);

create table public.feature_policies (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null references public.feature_definitions(feature_key) on delete restrict,
  scope_type text not null
    check (scope_type in ('platform','platform_pathway','institution','institution_pathway','course','account')),
  institution_id uuid references public.institutions(id) on delete cascade,
  pathway text check (pathway in ('shared','student','professor','publisher')),
  course_id uuid references public.courses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  control_value jsonb not null,
  control_status text not null default 'active'
    check (control_status in ('draft','scheduled','active','expired','revoked')),
  lock_descendants boolean not null default false,
  reason text not null check (char_length(trim(reason)) between 3 and 2000),
  warning_acknowledgements text[] not null default '{}'::text[],
  starts_at timestamptz,
  ends_at timestamptz,
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}'::smallint[],
  local_start_time time,
  local_end_time time,
  timezone_name text not null default 'America/Chicago',
  revision integer not null default 1 check (revision > 0),
  supersedes_policy_id uuid references public.feature_policies(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  check (cardinality(weekdays) > 0 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (
    (scope_type = 'platform' and institution_id is null and pathway is null and course_id is null and user_id is null)
    or (scope_type = 'platform_pathway' and institution_id is null and pathway is not null and course_id is null and user_id is null)
    or (scope_type = 'institution' and institution_id is not null and pathway is null and course_id is null and user_id is null)
    or (scope_type = 'institution_pathway' and institution_id is not null and pathway is not null and course_id is null and user_id is null)
    or (scope_type = 'course' and institution_id is not null and course_id is not null and user_id is null)
    or (scope_type = 'account' and user_id is not null and course_id is null)
  )
);

create unique index feature_policies_one_current_scope_idx
  on public.feature_policies (
    feature_key,
    scope_type,
    coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(pathway, ''),
    coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where control_status in ('scheduled','active');

create table public.feature_change_sets (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  scope_summary text not null,
  change_summary text not null,
  reason text not null,
  affected_account_count integer not null default 0 check (affected_account_count >= 0),
  affected_course_count integer not null default 0 check (affected_course_count >= 0),
  warnings jsonb not null default '[]'::jsonb,
  warning_acknowledgements text[] not null default '{}'::text[],
  rollback_of_change_set_id uuid references public.feature_change_sets(id) on delete set null,
  status text not null default 'applied' check (status in ('scheduled','applied','partially_applied','rolled_back','failed')),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.feature_change_items (
  id bigint generated always as identity primary key,
  change_set_id uuid not null references public.feature_change_sets(id) on delete cascade,
  feature_key text not null references public.feature_definitions(feature_key) on delete restrict,
  policy_id uuid references public.feature_policies(id) on delete set null,
  before_value jsonb,
  after_value jsonb not null,
  before_status text,
  after_status text not null,
  created_at timestamptz not null default now()
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  connection_key text not null,
  institution_id uuid references public.institutions(id) on delete cascade,
  provider text not null,
  display_name text not null,
  category text not null,
  pathway text check (pathway in ('shared','student','professor','publisher','admin')),
  activation_status text not null default 'not_configured'
    check (activation_status in ('not_configured','setup','testing','ready','active','degraded','suspended','retired')),
  health_status text not null default 'unknown'
    check (health_status in ('unknown','healthy','warning','failed')),
  institution_controllable boolean not null default false,
  activation_managed_by text not null default 'control_center'
    check (activation_managed_by in ('control_center','deployment_evidence','external_provider','code_deployment')),
  connected_to text[] not null default '{}'::text[],
  redacted_configuration jsonb not null default '{}'::jsonb,
  secret_reference_names text[] not null default '{}'::text[],
  responsible_team text,
  next_step text,
  last_tested_at timestamptz,
  last_test_status text check (last_test_status is null or last_test_status in ('passed','failed','warning')),
  last_synced_at timestamptz,
  last_successful_sync_at timestamptz,
  last_failed_sync_at timestamptz,
  activated_at timestamptz,
  activated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index integration_connections_scope_key_idx
  on public.integration_connections (
    connection_key,
    coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table public.integration_connection_capabilities (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  capability_key text not null,
  display_name text not null,
  readiness_status text not null default 'setup'
    check (readiness_status in ('not_available','setup','testing','ready','active','blocked')),
  required_evidence text[] not null default '{}'::text[],
  evidence_summary jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  unique (connection_id, capability_key)
);

create table public.integration_test_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  capability_key text,
  status text not null check (status in ('passed','failed','warning')),
  safe_summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  tested_by uuid not null references public.profiles(id) on delete restrict,
  tested_at timestamptz not null default now()
);

create table public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  sync_type text not null,
  status text not null check (status in ('queued','running','succeeded','partial','failed','cancelled')),
  records_received integer not null default 0 check (records_received >= 0),
  records_changed integer not null default 0 check (records_changed >= 0),
  records_rejected integer not null default 0 check (records_rejected >= 0),
  safe_error_summary text,
  initiated_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.admin_report_exports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  report_type text not null
    check (report_type in ('feature_inventory','connection_status','change_log','account_access','course_access','student_data_reconciliation','retention_deletion')),
  filters jsonb not null default '{}'::jsonb,
  redaction_level text not null default 'standard' check (redaction_level in ('standard','strict')),
  status text not null default 'generated' check (status in ('requested','generating','generated','downloaded','expired','failed')),
  row_count integer not null default 0 check (row_count >= 0),
  schema_version text not null default '1.0',
  content_hash text,
  secure_file_id uuid references public.secure_file_objects(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  downloaded_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function private.is_platform_owner(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'owner'
  );
$$;

create or replace function private.has_platform_control_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_owner(p_user_id) or exists (
    select 1 from public.platform_admin_authorizations paa
    where paa.user_id = p_user_id
      and paa.status = 'active'
      and (paa.expires_at is null or paa.expires_at > now())
  );
$$;

create or replace function private.has_institution_capability(
  p_institution_id uuid,
  p_capability text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_institution_id is not null and p_user_id is not null and (
    private.is_platform_owner(p_user_id)
    or exists (
      select 1
      from public.institution_memberships im
      where im.institution_id = p_institution_id
        and im.user_id = p_user_id
        and im.status = 'active'
        and (
          im.role in ('owner','admin')
          or coalesce((im.permissions ->> p_capability)::boolean, false)
          or (im.role = 'security' and p_capability in ('view_security','view_audit','test_integrations'))
          or (im.role = 'records' and p_capability in ('view_records','view_audit','export_reports','manage_retention'))
        )
    )
  );
$$;

create or replace function private.is_institution_manager(
  p_institution_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_institution_id is not null and (
    private.is_platform_manager()
    or exists (
      select 1
      from public.institutions i
      where i.id = p_institution_id
        and i.owner_id = p_user_id
        and i.lifecycle_status = 'active'
    )
    or exists (
      select 1
      from public.institution_memberships im
      where im.institution_id = p_institution_id
        and im.user_id = p_user_id
        and im.status = 'active'
        and im.role in ('owner','admin','security','records')
    )
  );
$$;

create or replace function private.has_active_institution_affiliation(
  p_user_id uuid,
  p_institution_id uuid,
  p_pathway text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and p_institution_id is not null and exists (
    select 1
    from public.institution_affiliations ia
    where ia.user_id = p_user_id
      and ia.institution_id = p_institution_id
      and ia.status = 'active'
      and (p_pathway is null or ia.pathway = p_pathway)
  );
$$;

create or replace function private.can_join_course(p_user_id uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and p_course_id is not null and exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and (
        (c.access_scope = 'public_free' and c.institution_id is null)
        or (c.access_scope = 'independent' and c.institution_id is null)
        or (
          c.access_scope = 'institution'
          and c.institution_id is not null
          and (
            private.has_active_institution_affiliation(p_user_id, c.institution_id, null)
            or private.is_platform_owner(p_user_id)
          )
        )
      )
  );
$$;

revoke all on function private.is_platform_owner(uuid) from public;
revoke all on function private.has_platform_control_access(uuid) from public;
revoke all on function private.has_institution_capability(uuid,text,uuid) from public;
revoke all on function private.has_active_institution_affiliation(uuid,uuid,text) from public;
revoke all on function private.can_join_course(uuid,uuid) from public;
grant execute on function private.is_platform_owner(uuid) to authenticated;
grant execute on function private.has_platform_control_access(uuid) to authenticated;
grant execute on function private.has_institution_capability(uuid,text,uuid) to authenticated;
grant execute on function private.has_active_institution_affiliation(uuid,uuid,text) to authenticated;
grant execute on function private.can_join_course(uuid,uuid) to authenticated;

drop policy if exists institutions_insert on public.institutions;
create policy institutions_insert
on public.institutions for insert to authenticated
with check (private.is_platform_owner((select auth.uid())));

drop policy if exists institutions_update on public.institutions;
create policy institutions_update
on public.institutions for update to authenticated
using (
  private.is_platform_owner((select auth.uid()))
  or private.has_institution_capability(id, 'manage_institution_profile', (select auth.uid()))
)
with check (
  private.is_platform_owner((select auth.uid()))
  or (
    private.has_institution_capability(id, 'manage_institution_profile', (select auth.uid()))
    and owner_id = (select i.owner_id from public.institutions i where i.id = institutions.id)
    and lifecycle_status = (select i.lifecycle_status from public.institutions i where i.id = institutions.id)
  )
);

drop policy if exists courses_insert on public.courses;
create policy courses_insert
on public.courses for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    (institution_id is null and access_scope in ('independent','public_free'))
    or (
      institution_id is not null
      and access_scope = 'institution'
      and (
        private.has_active_institution_affiliation((select auth.uid()), institution_id, 'professor')
        or private.is_platform_owner((select auth.uid()))
      )
    )
  )
);

drop policy if exists courses_update on public.courses;
create policy courses_update
on public.courses for update to authenticated
using (private.can_manage_course(id))
with check (
  private.can_manage_course(id)
  and (
    (institution_id is null and access_scope in ('independent','public_free'))
    or (
      institution_id is not null
      and access_scope = 'institution'
      and (
        private.has_active_institution_affiliation(owner_id, institution_id, 'professor')
        or private.is_platform_owner((select auth.uid()))
      )
    )
  )
);

drop policy if exists course_memberships_insert on public.course_memberships;
create policy course_memberships_insert
on public.course_memberships for insert to authenticated
with check (
  private.can_manage_course(course_id)
  and private.can_join_course(user_id, course_id)
);

drop policy if exists course_memberships_update on public.course_memberships;
create policy course_memberships_update
on public.course_memberships for update to authenticated
using (private.can_manage_course(course_id))
with check (
  private.can_manage_course(course_id)
  and private.can_join_course(user_id, course_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_role text;
  v_pathway text;
  v_institution_name text;
  v_directory_key text;
  v_directory public.institution_directory_entries%rowtype;
  v_education_division text;
  v_affiliation_choice text;
begin
  v_requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'learner');
  v_pathway := case
    when v_requested_role = 'professor' then 'professor'
    when v_requested_role = 'publisher' then 'publisher'
    else 'student'
  end;
  v_education_division := coalesce(nullif(new.raw_user_meta_data ->> 'education_division', ''), 'university');
  v_affiliation_choice := coalesce(nullif(new.raw_user_meta_data ->> 'affiliation_choice', ''), 'independent');
  v_directory_key := nullif(new.raw_user_meta_data ->> 'institution_directory_key', '');
  v_institution_name := nullif(trim(new.raw_user_meta_data ->> 'institution_name'), '');

  if v_education_division not in ('university','k12','both') then v_education_division := 'university'; end if;
  if v_pathway = 'student' and v_education_division = 'both' then v_education_division := 'university'; end if;
  if v_affiliation_choice not in ('institution','other','independent') then v_affiliation_choice := 'independent'; end if;

  if v_directory_key is not null then
    select * into v_directory
    from public.institution_directory_entries ide
    where ide.directory_key = v_directory_key
      and ide.is_selectable
      and ide.directory_status <> 'inactive';
    if found then v_institution_name := v_directory.canonical_name; else v_directory_key := null; end if;
  end if;

  -- Signup metadata records a requested pathway only. It never grants professor,
  -- publisher, institution-admin, or platform-admin authorization.
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'learner');

  if v_requested_role <> 'institution_applicant' then
    if v_affiliation_choice = 'independent' then
      insert into public.institution_affiliations (
        user_id, pathway, relationship, status, source, is_primary, started_at
      ) values (
        new.id, v_pathway, 'independent', 'independent', 'signup', true, now()
      );
    elsif v_institution_name is not null then
      insert into public.identity_onboarding_requests (
        user_id, requested_role, institution_name, department,
        identifier_hash, identifier_last4, education_division,
        institution_id, institution_directory_key, affiliation_choice
      ) values (
        new.id,
        case when v_pathway = 'professor' then 'professor' else 'learner' end,
        v_institution_name,
        nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
        nullif(new.raw_user_meta_data ->> 'institution_identifier_hash', ''),
        nullif(new.raw_user_meta_data ->> 'institution_identifier_last4', ''),
        v_education_division,
        v_directory.institution_id,
        v_directory_key,
        v_affiliation_choice
      );

      insert into public.institution_affiliations (
        user_id, pathway, institution_id, directory_key, relationship, status,
        source, identifier_hash, identifier_last4, is_primary
      ) values (
        new.id, v_pathway, v_directory.institution_id, v_directory_key,
        case when v_pathway = 'professor' then 'faculty' else 'student' end,
        'pending', 'signup',
        nullif(new.raw_user_meta_data ->> 'institution_identifier_hash', ''),
        nullif(new.raw_user_meta_data ->> 'institution_identifier_last4', ''), true
      );

      if v_directory.institution_id is not null then
        insert into public.institution_memberships (institution_id, user_id, role, status)
        values (
          v_directory.institution_id,
          new.id,
          case when v_pathway = 'professor' then 'professor' else 'learner' end,
          'pending'
        )
        on conflict (institution_id, user_id) do nothing;
      end if;
    end if;
  end if;

  if v_pathway = 'student' then
    insert into public.student_education_paths (user_id, started_in, current_division)
    values (new.id, v_education_division, v_education_division)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.review_identity_onboarding(
  p_user_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.identity_onboarding_requests%rowtype;
  v_pathway text;
begin
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into v_request
  from public.identity_onboarding_requests
  where user_id = p_user_id
  for update;

  if not found then raise exception 'Onboarding request not found'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or (
      v_request.institution_id is not null
      and private.has_institution_capability(v_request.institution_id, 'manage_affiliations', (select auth.uid()))
    )
  ) then
    raise exception 'Institution affiliation review access required';
  end if;

  v_pathway := case when v_request.requested_role = 'professor' then 'professor' else 'student' end;

  update public.identity_onboarding_requests
  set verification_status = p_decision,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where user_id = p_user_id;

  update public.institution_affiliations
  set status = case when p_decision = 'approved' then 'active' else 'rejected' end,
      verification_method = 'admin_review',
      verified_by = (select auth.uid()),
      verified_at = now(),
      started_at = case when p_decision = 'approved' then coalesce(started_at, now()) else started_at end,
      ended_at = case when p_decision = 'rejected' then now() else null end,
      updated_at = now()
  where user_id = p_user_id
    and pathway = v_pathway
    and status = 'pending';

  if v_request.institution_id is not null then
    update public.institution_memberships
    set status = case when p_decision = 'approved' then 'active' else 'ended' end,
        joined_at = case when p_decision = 'approved' then coalesce(joined_at, now()) else joined_at end,
        ended_at = case when p_decision = 'rejected' then now() else null end
    where institution_id = v_request.institution_id
      and user_id = p_user_id;
  end if;

  if p_decision = 'approved' and v_request.requested_role = 'professor' then
    update public.profiles set role = 'professor', updated_at = now() where id = p_user_id;
  end if;

  insert into public.audit_events (
    actor_id, institution_id, event_type, target_type, target_id, details, event_hash
  ) values (
    (select auth.uid()), v_request.institution_id, 'institution.affiliation_reviewed',
    'profile', p_user_id::text,
    jsonb_build_object('decision', p_decision, 'pathway', v_pathway), ''
  );
end;
$$;

revoke all on function public.review_identity_onboarding(uuid,text) from public, anon;
grant execute on function public.review_identity_onboarding(uuid,text) to authenticated;

create or replace function public.approve_student_enrollment(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.student_enrollment_requests%rowtype;
  v_course public.courses%rowtype;
begin
  select * into v_request
  from public.student_enrollment_requests
  where id = p_request_id
  for update;

  if not found or not private.can_manage_course(v_request.course_id) then
    raise exception 'Enrollment request not found or not manageable';
  end if;

  select * into v_course from public.courses where id = v_request.course_id;
  if not private.can_join_course(v_request.student_id, v_request.course_id) then
    raise exception 'The learner does not have an active affiliation for this institution';
  end if;

  update public.student_enrollment_requests
  set status = 'approved', approved_by = (select auth.uid()), decided_at = now()
  where id = p_request_id;

  update public.student_roster_entries
  set matched_user_id = v_request.student_id,
      match_status = 'approved',
      updated_at = now()
  where id = v_request.roster_entry_id;

  insert into public.course_memberships (course_id, user_id, role)
  values (v_request.course_id, v_request.student_id, 'learner')
  on conflict (course_id, user_id) do update set role = 'learner';

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id, details, event_hash
  ) values (
    (select auth.uid()), v_course.institution_id, v_course.id,
    'course.enrollment_approved', 'profile', v_request.student_id::text,
    jsonb_build_object('institution_checked', true), ''
  );
end;
$$;

revoke all on function public.approve_student_enrollment(uuid) from public, anon;
grant execute on function public.approve_student_enrollment(uuid) to authenticated;

create or replace function private.can_view_integration_connection(
  p_connection_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.integration_connections c
    where c.id = p_connection_id
      and (
        private.has_platform_control_access(p_user_id)
        or (
          c.institution_id is not null
          and private.has_institution_capability(c.institution_id, 'view_integrations', p_user_id)
        )
      )
  );
$$;

revoke all on function private.can_view_integration_connection(uuid,uuid) from public;
grant execute on function private.can_view_integration_connection(uuid,uuid) to authenticated;

create index institution_memberships_scope_status_idx
  on public.institution_memberships (institution_id, status, role, user_id);
create index institution_affiliations_user_status_idx
  on public.institution_affiliations (user_id, status, pathway, institution_id);
create index institution_affiliations_institution_status_idx
  on public.institution_affiliations (institution_id, status, pathway, user_id);
create index institution_directory_search_idx
  on public.institution_directory_entries (directory_status, is_selectable, sort_name);
create index institution_applications_status_idx
  on public.institution_access_applications (status, created_at desc);
create index institution_applications_applicant_idx
  on public.institution_access_applications (applicant_id, created_at desc);
create index institution_transfers_institution_idx
  on public.institution_transfer_requests (to_institution_id, status, created_at desc);
create index institution_team_invites_scope_idx
  on public.institution_team_invitations (institution_id, status, expires_at);
create index feature_definitions_pathway_idx
  on public.feature_definitions (pathway, active, sort_order);
create index feature_policies_resolution_idx
  on public.feature_policies (feature_key, control_status, institution_id, pathway, course_id, user_id, starts_at, ends_at);
create index feature_change_sets_scope_idx
  on public.feature_change_sets (institution_id, created_at desc);
create index integration_connections_scope_idx
  on public.integration_connections (institution_id, activation_status, category);
create index integration_test_runs_connection_idx
  on public.integration_test_runs (connection_id, tested_at desc);
create index integration_sync_runs_connection_idx
  on public.integration_sync_runs (connection_id, started_at desc);
create index admin_report_exports_scope_idx
  on public.admin_report_exports (institution_id, requested_by, created_at desc);
create index courses_institution_access_scope_idx
  on public.courses (institution_id, access_scope, status);

create trigger institution_directory_entries_touch_updated_at
before update on public.institution_directory_entries
for each row execute function private.touch_updated_at();
create trigger institution_access_applications_touch_updated_at
before update on public.institution_access_applications
for each row execute function private.touch_updated_at();
create trigger institution_affiliations_touch_updated_at
before update on public.institution_affiliations
for each row execute function private.touch_updated_at();
create trigger institution_transfer_requests_touch_updated_at
before update on public.institution_transfer_requests
for each row execute function private.touch_updated_at();
create trigger institution_team_invitations_touch_updated_at
before update on public.institution_team_invitations
for each row execute function private.touch_updated_at();
create trigger platform_admin_authorizations_touch_updated_at
before update on public.platform_admin_authorizations
for each row execute function private.touch_updated_at();
create trigger feature_definitions_touch_updated_at
before update on public.feature_definitions
for each row execute function private.touch_updated_at();
create trigger feature_policy_templates_touch_updated_at
before update on public.feature_policy_templates
for each row execute function private.touch_updated_at();
create trigger integration_connections_touch_updated_at
before update on public.integration_connections
for each row execute function private.touch_updated_at();

alter table public.institution_directory_entries enable row level security;
alter table public.institution_directory_aliases enable row level security;
alter table public.institution_access_applications enable row level security;
alter table public.institution_affiliations enable row level security;
alter table public.institution_transfer_requests enable row level security;
alter table public.institution_team_invitations enable row level security;
alter table public.platform_admin_authorizations enable row level security;
alter table public.feature_definitions enable row level security;
alter table public.feature_dependencies enable row level security;
alter table public.feature_policy_templates enable row level security;
alter table public.feature_policy_template_items enable row level security;
alter table public.feature_policies enable row level security;
alter table public.feature_change_sets enable row level security;
alter table public.feature_change_items enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_connection_capabilities enable row level security;
alter table public.integration_test_runs enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.admin_report_exports enable row level security;

revoke all on public.institution_directory_entries, public.institution_directory_aliases,
  public.institution_access_applications, public.institution_affiliations,
  public.institution_transfer_requests, public.institution_team_invitations,
  public.platform_admin_authorizations, public.feature_definitions,
  public.feature_dependencies, public.feature_policy_templates,
  public.feature_policy_template_items, public.feature_policies,
  public.feature_change_sets, public.feature_change_items,
  public.integration_connections, public.integration_connection_capabilities,
  public.integration_test_runs, public.integration_sync_runs,
  public.admin_report_exports
from anon, authenticated;

grant select on public.institution_directory_entries, public.institution_directory_aliases to anon, authenticated;
grant select on public.institution_access_applications, public.institution_affiliations,
  public.institution_transfer_requests, public.institution_team_invitations,
  public.platform_admin_authorizations, public.feature_definitions,
  public.feature_dependencies, public.feature_policy_templates,
  public.feature_policy_template_items, public.feature_policies,
  public.feature_change_sets, public.feature_change_items,
  public.integration_connections, public.integration_connection_capabilities,
  public.integration_test_runs, public.integration_sync_runs,
  public.admin_report_exports
to authenticated;

create policy institution_directory_public_select
on public.institution_directory_entries for select to anon, authenticated
using (is_public and directory_status <> 'inactive');

create policy institution_directory_aliases_public_select
on public.institution_directory_aliases for select to anon, authenticated
using (exists (
  select 1 from public.institution_directory_entries ide
  where ide.directory_key = institution_directory_aliases.directory_key
    and ide.is_public and ide.directory_status <> 'inactive'
));

create policy institution_applications_select
on public.institution_access_applications for select to authenticated
using (applicant_id = (select auth.uid()) or private.has_platform_control_access((select auth.uid())));

create policy institution_affiliations_select
on public.institution_affiliations for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_platform_control_access((select auth.uid()))
  or (
    institution_id is not null
    and private.has_institution_capability(institution_id, 'view_accounts', (select auth.uid()))
  )
);

create policy institution_transfers_select
on public.institution_transfer_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_platform_control_access((select auth.uid()))
  or (from_institution_id is not null and private.has_institution_capability(from_institution_id, 'manage_affiliations', (select auth.uid())))
  or (to_institution_id is not null and private.has_institution_capability(to_institution_id, 'manage_affiliations', (select auth.uid())))
);

create policy institution_team_invitations_select
on public.institution_team_invitations for select to authenticated
using (
  private.has_platform_control_access((select auth.uid()))
  or private.has_institution_capability(institution_id, 'manage_team', (select auth.uid()))
  or lower(email) = lower(coalesce((select p.email from public.profiles p where p.id = (select auth.uid())), ''))
);

create policy platform_admin_authorizations_select
on public.platform_admin_authorizations for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_owner((select auth.uid())));

create policy feature_definitions_select
on public.feature_definitions for select to authenticated
using (active);

create policy feature_dependencies_select
on public.feature_dependencies for select to authenticated
using (true);

create policy feature_templates_select
on public.feature_policy_templates for select to authenticated
using (
  institution_id is null
  or private.has_platform_control_access((select auth.uid()))
  or private.has_institution_capability(institution_id, 'control_features', (select auth.uid()))
);

create policy feature_template_items_select
on public.feature_policy_template_items for select to authenticated
using (exists (
  select 1 from public.feature_policy_templates t
  where t.id = feature_policy_template_items.template_id
    and (
      t.institution_id is null
      or private.has_platform_control_access((select auth.uid()))
      or private.has_institution_capability(t.institution_id, 'control_features', (select auth.uid()))
    )
));

create policy feature_policies_select
on public.feature_policies for select to authenticated
using (
  private.has_platform_control_access((select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'control_features', (select auth.uid())))
);

create policy feature_change_sets_select
on public.feature_change_sets for select to authenticated
using (
  private.has_platform_control_access((select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'view_audit', (select auth.uid())))
);

create policy feature_change_items_select
on public.feature_change_items for select to authenticated
using (exists (
  select 1 from public.feature_change_sets cs
  where cs.id = feature_change_items.change_set_id
    and (
      private.has_platform_control_access((select auth.uid()))
      or (cs.institution_id is not null and private.has_institution_capability(cs.institution_id, 'view_audit', (select auth.uid())))
    )
));

create policy integration_connections_select
on public.integration_connections for select to authenticated
using (
  private.has_platform_control_access((select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'view_integrations', (select auth.uid())))
);

create policy integration_capabilities_select
on public.integration_connection_capabilities for select to authenticated
using (private.can_view_integration_connection(connection_id, (select auth.uid())));

create policy integration_test_runs_select
on public.integration_test_runs for select to authenticated
using (private.can_view_integration_connection(connection_id, (select auth.uid())));

create policy integration_sync_runs_select
on public.integration_sync_runs for select to authenticated
using (private.can_view_integration_connection(connection_id, (select auth.uid())));

create policy admin_report_exports_select
on public.admin_report_exports for select to authenticated
using (
  requested_by = (select auth.uid())
  or private.has_platform_control_access((select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'export_reports', (select auth.uid())))
);

create or replace function private.policy_is_effective(p_policy public.feature_policies, p_at timestamptz default now())
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_policy.control_status in ('active','scheduled')
    and (p_policy.starts_at is null or p_policy.starts_at <= p_at)
    and (p_policy.ends_at is null or p_policy.ends_at > p_at)
    and extract(dow from (p_at at time zone p_policy.timezone_name))::smallint = any(p_policy.weekdays)
    and (
      p_policy.local_start_time is null
      or p_policy.local_end_time is null
      or (
        p_policy.local_start_time <= p_policy.local_end_time
        and (p_at at time zone p_policy.timezone_name)::time between p_policy.local_start_time and p_policy.local_end_time
      )
      or (
        p_policy.local_start_time > p_policy.local_end_time
        and (
          (p_at at time zone p_policy.timezone_name)::time >= p_policy.local_start_time
          or (p_at at time zone p_policy.timezone_name)::time <= p_policy.local_end_time
        )
      )
    );
$$;

create or replace function private.resolve_feature_control(
  p_feature_key text,
  p_pathway text,
  p_institution_id uuid,
  p_course_id uuid,
  p_user_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_definition public.feature_definitions%rowtype;
  v_policy public.feature_policies%rowtype;
begin
  select * into v_definition
  from public.feature_definitions fd
  where fd.feature_key = p_feature_key and fd.active;
  if not found then return null; end if;

  select fp.* into v_policy
  from public.feature_policies fp
  where fp.feature_key = p_feature_key
    and private.policy_is_effective(fp, p_at)
    and (
      (fp.scope_type = 'platform')
      or (fp.scope_type = 'platform_pathway' and fp.pathway = p_pathway)
      or (fp.scope_type = 'institution' and fp.institution_id = p_institution_id)
      or (fp.scope_type = 'institution_pathway' and fp.institution_id = p_institution_id and fp.pathway = p_pathway)
      or (fp.scope_type = 'course' and fp.course_id = p_course_id)
      or (fp.scope_type = 'account' and fp.user_id = p_user_id and (fp.institution_id is null or fp.institution_id = p_institution_id))
    )
  order by
    case
      when fp.lock_descendants and fp.scope_type in ('platform','platform_pathway') then 100
      when fp.lock_descendants and fp.scope_type in ('institution','institution_pathway') then 95
      when fp.scope_type = 'account' then 80
      when fp.scope_type = 'course' then 70
      when fp.scope_type = 'institution_pathway' then 60
      when fp.scope_type = 'institution' then 50
      when fp.scope_type = 'platform_pathway' then 40
      when fp.scope_type = 'platform' then 30
      else 0
    end desc,
    fp.created_at desc
  limit 1;

  return jsonb_build_object(
    'feature_key', v_definition.feature_key,
    'display_name', v_definition.display_name,
    'pathway', v_definition.pathway,
    'value', coalesce(v_policy.control_value, v_definition.default_value),
    'source_scope', coalesce(v_policy.scope_type, 'default'),
    'locked', coalesce(v_policy.lock_descendants, false),
    'reason', coalesce(v_policy.reason, 'Platform default'),
    'disable_behavior', v_definition.disable_behavior,
    'build_status', v_definition.build_status,
    'control_class', v_definition.control_class
  );
end;
$$;

create or replace function public.get_effective_feature_manifest(
  p_pathway text,
  p_course_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_institution_id uuid;
  v_manifest jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_pathway not in ('student','professor','publisher','shared') then raise exception 'Unknown pathway'; end if;

  if p_course_id is not null then
    select c.institution_id into v_institution_id
    from public.courses c
    where c.id = p_course_id and private.can_access_course(c.id);
    if not found then raise exception 'Course access required'; end if;
  else
    select ia.institution_id into v_institution_id
    from public.institution_affiliations ia
    where ia.user_id = v_user_id
      and ia.pathway = p_pathway
      and ia.status = 'active'
      and ia.is_primary
    order by ia.updated_at desc
    limit 1;
  end if;

  select coalesce(jsonb_agg(
    private.resolve_feature_control(fd.feature_key, p_pathway, v_institution_id, p_course_id, v_user_id, now())
    order by fd.sort_order, fd.display_name
  ), '[]'::jsonb)
  into v_manifest
  from public.feature_definitions fd
  where fd.active and fd.pathway in ('shared', p_pathway, 'security', 'accessibility', 'theme', 'integration');

  return jsonb_build_object(
    'revision', coalesce((select max(revision) from public.feature_policies), 0),
    'pathway', p_pathway,
    'institution_id', v_institution_id,
    'course_id', p_course_id,
    'features', v_manifest,
    'generated_at', now()
  );
end;
$$;

revoke all on function private.policy_is_effective(public.feature_policies,timestamptz) from public;
revoke all on function private.resolve_feature_control(text,text,uuid,uuid,uuid,timestamptz) from public;
revoke all on function public.get_effective_feature_manifest(text,uuid) from public, anon;
grant execute on function public.get_effective_feature_manifest(text,uuid) to authenticated;

create or replace function public.get_admin_control_center(p_institution_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_platform_access boolean;
  v_owner boolean;
  v_institution_access boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  v_owner := private.is_platform_owner(v_user_id);
  v_platform_access := private.has_platform_control_access(v_user_id);
  v_institution_access := p_institution_id is not null
    and private.has_institution_capability(p_institution_id, 'view_control_center', v_user_id);

  if p_institution_id is null and not v_platform_access then
    raise exception 'Platform control-center access required';
  end if;
  if p_institution_id is not null and not (v_platform_access or v_institution_access) then
    raise exception 'Institution control-center access required';
  end if;

  return jsonb_build_object(
    'access', jsonb_build_object(
      'platform_owner', v_owner,
      'platform_access', v_platform_access,
      'institution_id', p_institution_id,
      'can_control_features', v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id, 'control_features', v_user_id)),
      'can_manage_team', v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id, 'manage_team', v_user_id)),
      'can_manage_affiliations', v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id, 'manage_affiliations', v_user_id)),
      'can_manage_integrations', v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id, 'manage_integrations', v_user_id)),
      'can_export_reports', v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id, 'export_reports', v_user_id))
    ),
    'institutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'slug', i.slug,
        'institution_code', i.institution_code, 'primary_lms', i.primary_lms,
        'lifecycle_status', i.lifecycle_status, 'institution_type', i.institution_type,
        'system_name', i.system_name, 'timezone_name', i.timezone_name
      ) order by i.name)
      from public.institutions i
      where (p_institution_id is null and v_platform_access) or i.id = p_institution_id
    ), '[]'::jsonb),
    'statistics', jsonb_build_object(
      'accounts', (select count(*) from public.institution_memberships im where p_institution_id is null or im.institution_id = p_institution_id),
      'courses', (select count(*) from public.courses c where p_institution_id is null or c.institution_id = p_institution_id),
      'active_features', (select count(*) from public.feature_definitions fd where fd.active),
      'pending_applications', case when v_platform_access then (select count(*) from public.institution_access_applications a where a.status in ('pending','reviewing')) else 0 end,
      'pending_affiliations', (select count(*) from public.identity_onboarding_requests ior where ior.verification_status='pending' and (p_institution_id is null or ior.institution_id=p_institution_id)),
      'pending_transfers', (select count(*) from public.institution_transfer_requests tr where tr.status in ('pending','reviewing') and (p_institution_id is null or tr.from_institution_id = p_institution_id or tr.to_institution_id = p_institution_id))
    ),
    'features', coalesce((select jsonb_agg(to_jsonb(fd) order by fd.pathway, fd.sort_order, fd.display_name) from public.feature_definitions fd where fd.active), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(to_jsonb(fp) order by fp.created_at desc) from public.feature_policies fp where fp.control_status in ('scheduled','active') and (p_institution_id is null or fp.institution_id = p_institution_id or fp.scope_type in ('platform','platform_pathway'))), '[]'::jsonb),
    'connections', coalesce((select jsonb_agg((to_jsonb(ic) - 'secret_reference_names') order by ic.category, ic.display_name) from public.integration_connections ic where p_institution_id is null or ic.institution_id is null or ic.institution_id = p_institution_id), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(to_jsonb(cs) order by cs.created_at desc) from (select * from public.feature_change_sets fcs where p_institution_id is null or fcs.institution_id = p_institution_id order by created_at desc limit 200) cs), '[]'::jsonb),
    'applications', case when v_platform_access then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.institution_access_applications order by created_at desc limit 100) a), '[]'::jsonb) else '[]'::jsonb end,
    'onboarding_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',ior.user_id,'requested_role',ior.requested_role,
        'institution_id',ior.institution_id,'institution_directory_key',ior.institution_directory_key,
        'institution_name',ior.institution_name,'department',ior.department,
        'identifier_last4',ior.identifier_last4,'education_division',ior.education_division,
        'verification_status',ior.verification_status,'created_at',ior.created_at,
        'full_name',p.full_name,'email',p.email
      ) order by ior.created_at)
      from public.identity_onboarding_requests ior
      join public.profiles p on p.id=ior.user_id
      where ior.verification_status='pending'
        and (p_institution_id is null or ior.institution_id=p_institution_id)
    ), '[]'::jsonb),
    'transfers', coalesce((select jsonb_agg(to_jsonb(tr) order by tr.created_at desc) from (select * from public.institution_transfer_requests itr where p_institution_id is null or itr.from_institution_id = p_institution_id or itr.to_institution_id = p_institution_id order by created_at desc limit 100) tr), '[]'::jsonb),
    'team', coalesce((select jsonb_agg(jsonb_build_object('institution_id',im.institution_id,'user_id',im.user_id,'role',im.role,'status',im.status,'permissions',im.permissions,'joined_at',im.joined_at,'last_active_at',im.last_active_at,'full_name',p.full_name,'email',p.email) order by p.full_name) from public.institution_memberships im join public.profiles p on p.id=im.user_id where p_institution_id is not null and im.institution_id=p_institution_id and im.role in ('owner','admin','security','records')), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select * from public.admin_report_exports ar where ar.requested_by=v_user_id or p_institution_id is null or ar.institution_id=p_institution_id order by created_at desc limit 100) r), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

create or replace function public.get_my_admin_workspaces()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'platform_access', private.has_platform_control_access(v_user_id),
    'platform_owner', private.is_platform_owner(v_user_id),
    'institutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'name',i.name,'slug',i.slug,'role',im.role,'permissions',im.permissions,
        'lifecycle_status',i.lifecycle_status,'institution_code',i.institution_code
      ) order by i.name)
      from public.institution_memberships im
      join public.institutions i on i.id=im.institution_id
      where im.user_id=v_user_id and im.status='active' and im.role in ('owner','admin','security','records')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_search_accounts_courses(
  p_query text,
  p_institution_id uuid default null,
  p_pathway text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_query text := lower(trim(coalesce(p_query,'')));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_institution_id is null and not private.has_platform_control_access(v_user_id) then raise exception 'Platform search access required'; end if;
  if p_institution_id is not null and not (
    private.has_platform_control_access(v_user_id)
    or private.has_institution_capability(p_institution_id, 'view_accounts', v_user_id)
  ) then raise exception 'Institution account-search access required'; end if;

  return jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(row_data order by row_data->>'full_name')
      from (
        select distinct jsonb_build_object(
          'user_id', p.id, 'full_name', p.full_name, 'email', p.email,
          'platform_role', p.role, 'institution_id', ia.institution_id,
          'pathway', ia.pathway, 'affiliation_status', ia.status,
          'membership_role', im.role, 'membership_status', im.status
        ) as row_data
        from public.profiles p
        left join public.institution_affiliations ia on ia.user_id=p.id
          and (p_institution_id is null or ia.institution_id=p_institution_id)
        left join public.institution_memberships im on im.user_id=p.id
          and (p_institution_id is null or im.institution_id=p_institution_id)
        where (p_institution_id is null or ia.institution_id=p_institution_id or im.institution_id=p_institution_id)
          and (p_pathway is null or ia.pathway=p_pathway)
          and (v_query='' or lower(coalesce(p.full_name,'')) like '%'||v_query||'%' or lower(coalesce(p.email,'')) like '%'||v_query||'%')
        limit 75
      ) account_rows
    ), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'institution_id',c.institution_id,'title',c.title,
        'course_code',c.course_code,'section_code',c.section_code,
        'teaching_window',c.teaching_window,'status',c.status,'access_scope',c.access_scope,
        'member_count',(select count(*) from public.course_memberships cm where cm.course_id=c.id)
      ) order by c.title)
      from public.courses c
      where (p_institution_id is null or c.institution_id=p_institution_id)
        and (v_query='' or lower(c.title) like '%'||v_query||'%' or lower(coalesce(c.course_code,'')) like '%'||v_query||'%')
      limit 75
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_control_center(uuid) from public, anon;
revoke all on function public.get_my_admin_workspaces() from public, anon;
revoke all on function public.admin_search_accounts_courses(text,uuid,text) from public, anon;
grant execute on function public.get_admin_control_center(uuid) to authenticated;
grant execute on function public.get_my_admin_workspaces() to authenticated;
grant execute on function public.admin_search_accounts_courses(text,uuid,text) to authenticated;

create or replace function private.preview_feature_control_change(p_input jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_definition public.feature_definitions%rowtype;
  v_scope_type text := p_input->>'scope_type';
  v_institution_id uuid := nullif(p_input->>'institution_id','')::uuid;
  v_pathway text := nullif(p_input->>'pathway','');
  v_course_id uuid := nullif(p_input->>'course_id','')::uuid;
  v_target_user_id uuid := nullif(p_input->>'user_id','')::uuid;
  v_control_value jsonb := p_input->'control_value';
  v_allowed_scope text;
  v_accounts integer := 0;
  v_courses integer := 0;
  v_warnings jsonb := '[]'::jsonb;
  v_existing public.feature_policies%rowtype;
  v_checksum text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_definition from public.feature_definitions where feature_key=p_input->>'feature_key' and active;
  if not found then raise exception 'Feature not found'; end if;
  if v_definition.control_type = 'status_only' or v_definition.control_class = 'kernel' then
    raise exception 'This is a required platform safeguard and is status-only';
  end if;
  if v_scope_type not in ('platform','platform_pathway','institution','institution_pathway','course','account') then
    raise exception 'Invalid control scope';
  end if;

  v_allowed_scope := case
    when v_scope_type in ('platform','platform_pathway') then case when v_scope_type='platform' then 'platform' else 'pathway' end
    when v_scope_type in ('institution','institution_pathway') then case when v_scope_type='institution' then 'institution' else 'pathway' end
    when v_scope_type='course' then 'course'
    else 'account'
  end;
  if not (v_allowed_scope = any(v_definition.allowed_scopes)) then raise exception 'This feature cannot be controlled at the selected scope'; end if;

  if v_scope_type in ('platform','platform_pathway') then
    if not private.is_platform_owner(v_user_id) then raise exception 'Only the platform owner can change platform controls'; end if;
  else
    if v_institution_id is null then raise exception 'Institution is required for this scope'; end if;
    if not (
      private.is_platform_owner(v_user_id)
      or (
        v_definition.institution_delegable
        and private.has_institution_capability(v_institution_id, 'control_features', v_user_id)
      )
    ) then raise exception 'Institution feature-control access required'; end if;
    if exists (
      select 1 from public.feature_policies fp
      where fp.feature_key=v_definition.feature_key
        and fp.scope_type in ('platform','platform_pathway')
        and fp.lock_descendants
        and private.policy_is_effective(fp, now())
        and (fp.pathway is null or fp.pathway=coalesce(v_pathway,v_definition.pathway))
    ) then raise exception 'The platform owner locked this feature for lower scopes'; end if;
  end if;

  if v_scope_type='course' and not exists (select 1 from public.courses c where c.id=v_course_id and c.institution_id=v_institution_id) then
    raise exception 'Course does not belong to the selected institution';
  end if;
  if v_scope_type='account' and not exists (
    select 1 from public.institution_affiliations ia
    where ia.user_id=v_target_user_id and ia.institution_id=v_institution_id and ia.status in ('active','pending')
  ) then raise exception 'Account does not belong to the selected institution'; end if;

  if v_control_value is null then raise exception 'Control value is required'; end if;
  if v_definition.value_type='boolean' and jsonb_typeof(v_control_value)<>'boolean' then raise exception 'This control requires an on or off value'; end if;
  if v_definition.value_type='number' and jsonb_typeof(v_control_value)<>'number' then raise exception 'This control requires a number'; end if;
  if v_definition.value_type='text' and jsonb_typeof(v_control_value)<>'string' then raise exception 'This control requires a listed text value'; end if;
  if v_definition.control_type='select' and jsonb_array_length(v_definition.allowed_values)>0 and not exists (
    select 1 from jsonb_array_elements(v_definition.allowed_values) allowed where allowed=v_control_value
  ) then raise exception 'Select one of the allowed values'; end if;
  if v_definition.value_type='number' and (
    (v_definition.minimum_value is not null and (v_control_value#>>'{}')::numeric < v_definition.minimum_value)
    or (v_definition.maximum_value is not null and (v_control_value#>>'{}')::numeric > v_definition.maximum_value)
  ) then raise exception 'Number is outside the allowed range'; end if;

  if jsonb_typeof(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb)) = 0
    or exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb)) as schedule_day(value)
      where value::smallint not between 0 and 6
    )
  then raise exception 'Choose one or more valid schedule days'; end if;
  if (nullif(p_input->>'local_start_time','') is null) <> (nullif(p_input->>'local_end_time','') is null) then
    raise exception 'A daily schedule requires both a start time and an end time';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names
    where name=coalesce(nullif(p_input->>'timezone_name',''),'America/Chicago')
  ) then raise exception 'Choose a recognized timezone'; end if;

  select * into v_existing
  from public.feature_policies fp
  where fp.feature_key=v_definition.feature_key
    and fp.scope_type=v_scope_type
    and fp.institution_id is not distinct from v_institution_id
    and fp.pathway is not distinct from v_pathway
    and fp.course_id is not distinct from v_course_id
    and fp.user_id is not distinct from v_target_user_id
    and fp.control_status in ('scheduled','active')
  order by fp.created_at desc limit 1;

  if v_scope_type in ('platform','platform_pathway') then
    select count(*)::integer into v_accounts from public.profiles;
    select count(*)::integer into v_courses from public.courses;
  elsif v_scope_type in ('institution','institution_pathway') then
    select count(*)::integer into v_accounts from public.institution_memberships im where im.institution_id=v_institution_id and im.status in ('active','pending');
    select count(*)::integer into v_courses from public.courses c where c.institution_id=v_institution_id;
  elsif v_scope_type='course' then
    select count(*)::integer into v_accounts from public.course_memberships cm where cm.course_id=v_course_id;
    v_courses := 1;
  else
    v_accounts := 1;
    v_courses := 0;
  end if;

  if v_definition.risk_level in ('high','critical') then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','high_impact','severity',v_definition.risk_level,'message',v_definition.impact_explanation));
  end if;
  if v_control_value='false'::jsonb then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','access_removed','severity','high','message','People in this scope may lose access to this feature. Existing records are preserved.'));
  end if;
  if coalesce((p_input->>'lock_descendants')::boolean,false) then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','lower_overrides_locked','severity','high','message','Lower-level institution, course, and account overrides will no longer apply while this lock is active.'));
  end if;
  if v_definition.control_class in ('security_required','accessibility_required') then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','required_control','severity','critical','message','This control protects security or accessibility. The platform owner must acknowledge the impact before changing it.'));
  end if;

  v_checksum := md5(
    p_input::text || '|' || coalesce(v_existing.id::text,'none') || '|' || coalesce(v_existing.revision::text,'0')
  );
  return jsonb_build_object(
    'checksum',v_checksum,
    'feature_key',v_definition.feature_key,
    'display_name',v_definition.display_name,
    'scope_type',v_scope_type,
    'institution_id',v_institution_id,
    'pathway',v_pathway,
    'course_id',v_course_id,
    'user_id',v_target_user_id,
    'current_value',v_existing.control_value,
    'proposed_value',v_control_value,
    'warnings',v_warnings,
    'affected_accounts',v_accounts,
    'affected_courses',v_courses,
    'summary',format('%s will change for %s account(s) and %s course(s).',v_definition.display_name,v_accounts,v_courses)
  );
end;
$$;

create or replace function public.preview_feature_control_change(p_input jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.preview_feature_control_change(p_input); $$;

create or replace function public.apply_feature_control_change(
  p_input jsonb,
  p_expected_checksum text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preview jsonb;
  v_existing public.feature_policies%rowtype;
  v_policy public.feature_policies%rowtype;
  v_change_set public.feature_change_sets%rowtype;
  v_revision integer;
  v_control_status text;
  v_starts_at timestamptz := nullif(p_input->>'starts_at','')::timestamptz;
  v_acks text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'warning_acknowledgements','[]'::jsonb))), '{}');
begin
  v_preview := private.preview_feature_control_change(p_input);
  if p_expected_checksum is null or p_expected_checksum <> v_preview->>'checksum' then
    raise exception 'The control changed after preview. Review the latest impact before applying.';
  end if;
  if jsonb_array_length(v_preview->'warnings') > 0 and cardinality(v_acks) = 0 then
    raise exception 'Acknowledge the listed warnings before applying this change';
  end if;
  if nullif(trim(p_input->>'reason'),'') is null then raise exception 'A plain-language reason is required'; end if;

  select * into v_existing from public.feature_policies fp
  where fp.feature_key=p_input->>'feature_key'
    and fp.scope_type=p_input->>'scope_type'
    and fp.institution_id is not distinct from nullif(p_input->>'institution_id','')::uuid
    and fp.pathway is not distinct from nullif(p_input->>'pathway','')
    and fp.course_id is not distinct from nullif(p_input->>'course_id','')::uuid
    and fp.user_id is not distinct from nullif(p_input->>'user_id','')::uuid
    and fp.control_status in ('scheduled','active')
  order by fp.created_at desc limit 1 for update;

  v_revision := coalesce(v_existing.revision,0)+1;
  if found then
    update public.feature_policies
    set control_status='revoked', revoked_by=(select auth.uid()), revoked_at=now()
    where id=v_existing.id;
  end if;
  v_control_status := case when v_starts_at is not null and v_starts_at>now() then 'scheduled' else 'active' end;

  insert into public.feature_policies (
    feature_key,scope_type,institution_id,pathway,course_id,user_id,control_value,
    control_status,lock_descendants,reason,warning_acknowledgements,starts_at,ends_at,
    weekdays,local_start_time,local_end_time,timezone_name,revision,supersedes_policy_id,created_by
  ) values (
    p_input->>'feature_key',p_input->>'scope_type',nullif(p_input->>'institution_id','')::uuid,
    nullif(p_input->>'pathway',''),nullif(p_input->>'course_id','')::uuid,nullif(p_input->>'user_id','')::uuid,
    p_input->'control_value',v_control_status,coalesce((p_input->>'lock_descendants')::boolean,false),
    trim(p_input->>'reason'),v_acks,v_starts_at,nullif(p_input->>'ends_at','')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb))::smallint),'{0,1,2,3,4,5,6}'::smallint[]),
    nullif(p_input->>'local_start_time','')::time,nullif(p_input->>'local_end_time','')::time,
    coalesce(nullif(p_input->>'timezone_name',''),'America/Chicago'),v_revision,v_existing.id,(select auth.uid())
  ) returning * into v_policy;

  insert into public.feature_change_sets (
    institution_id,actor_id,scope_summary,change_summary,reason,
    affected_account_count,affected_course_count,warnings,warning_acknowledgements,status,applied_at
  ) values (
    v_policy.institution_id,(select auth.uid()),v_policy.scope_type,v_preview->>'summary',v_policy.reason,
    (v_preview->>'affected_accounts')::integer,(v_preview->>'affected_courses')::integer,
    v_preview->'warnings',v_acks,'applied',now()
  ) returning * into v_change_set;

  insert into public.feature_change_items (
    change_set_id,feature_key,policy_id,before_value,after_value,before_status,after_status
  ) values (
    v_change_set.id,v_policy.feature_key,v_policy.id,v_existing.control_value,v_policy.control_value,
    v_existing.control_status,v_policy.control_status
  );

  insert into public.audit_events (actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values ((select auth.uid()),v_policy.institution_id,v_policy.course_id,'admin.feature_control_changed','feature_policy',v_policy.id::text,
    jsonb_build_object('feature_key',v_policy.feature_key,'scope_type',v_policy.scope_type,'revision',v_policy.revision,'change_set_id',v_change_set.id), '');

  return jsonb_build_object('policy',to_jsonb(v_policy),'change_set',to_jsonb(v_change_set),'preview',v_preview);
end;
$$;

revoke all on function private.preview_feature_control_change(jsonb) from public;
revoke all on function public.preview_feature_control_change(jsonb) from public, anon;
revoke all on function public.apply_feature_control_change(jsonb,text) from public, anon;
grant execute on function private.preview_feature_control_change(jsonb) to authenticated;
grant execute on function public.preview_feature_control_change(jsonb) to authenticated;
grant execute on function public.apply_feature_control_change(jsonb,text) to authenticated;

create or replace function public.submit_institution_access_application(p_input jsonb)
returns public.institution_access_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.institution_access_applications;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before submitting an institution application'; end if;
  if coalesce((p_input->>'attested_authority')::boolean,false) is not true
    or coalesce((p_input->>'attested_terms')::boolean,false) is not true then
    raise exception 'Authority and terms attestations are required';
  end if;
  if exists (
    select 1 from public.institution_access_applications a
    where a.applicant_id=(select auth.uid()) and a.status in ('pending','reviewing','approved')
  ) then raise exception 'This account already has an active institution application'; end if;

  insert into public.institution_access_applications (
    applicant_id,directory_key,legal_name,display_name,parent_system_name,institution_type,
    website_url,academic_domain,country_code,region_code,city,primary_lms,student_information_system,
    expected_accounts,requested_pathways,administrator_name,administrator_title,administrator_email,
    administrator_phone,security_contact_email,privacy_contact_email,accessibility_contact_email,
    intended_use,attested_authority,attested_terms,status
  ) values (
    (select auth.uid()),nullif(p_input->>'directory_key',''),trim(p_input->>'legal_name'),trim(p_input->>'display_name'),
    nullif(trim(p_input->>'parent_system_name'),''),coalesce(nullif(p_input->>'institution_type',''),'university'),
    nullif(trim(p_input->>'website_url'),''),lower(nullif(trim(p_input->>'academic_domain'),'')),
    coalesce(nullif(p_input->>'country_code',''),'US'),nullif(p_input->>'region_code',''),nullif(trim(p_input->>'city'),''),
    nullif(trim(p_input->>'primary_lms'),''),nullif(trim(p_input->>'student_information_system'),''),
    nullif(p_input->>'expected_accounts','')::integer,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'requested_pathways','["student","professor","publisher"]'::jsonb))),'{student,professor,publisher}'),
    trim(p_input->>'administrator_name'),nullif(trim(p_input->>'administrator_title'),''),lower(trim(p_input->>'administrator_email')),
    nullif(trim(p_input->>'administrator_phone'),''),lower(nullif(trim(p_input->>'security_contact_email'),'')),
    lower(nullif(trim(p_input->>'privacy_contact_email'),'')),lower(nullif(trim(p_input->>'accessibility_contact_email'),'')),
    nullif(trim(p_input->>'intended_use'),''),true,true,'pending'
  ) returning * into v_row;

  insert into public.audit_events (actor_id,event_type,target_type,target_id,details,event_hash)
  values ((select auth.uid()),'institution.application_submitted','institution_access_application',v_row.id::text,
    jsonb_build_object('display_name',v_row.display_name,'institution_type',v_row.institution_type), '');
  return v_row;
end;
$$;

create or replace function public.review_institution_access_application(
  p_application_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns public.institution_access_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.institution_access_applications%rowtype;
  v_institution public.institutions%rowtype;
  v_slug text;
  v_directory_key text;
begin
  if not private.is_platform_owner((select auth.uid())) then raise exception 'Only the platform owner can approve institution access'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into v_application from public.institution_access_applications where id=p_application_id for update;
  if not found or v_application.status not in ('pending','reviewing') then raise exception 'Application is not available for review'; end if;

  if p_decision='approved' then
    v_slug := trim(both '-' from regexp_replace(lower(v_application.display_name),'[^a-z0-9]+','-','g'));
    if exists (select 1 from public.institutions where slug=v_slug) then v_slug := v_slug || '-' || left(replace(p_application_id::text,'-',''),8); end if;
    insert into public.institutions (
      owner_id,name,slug,institution_type,system_name,country_code,region_code,
      academic_domain,primary_lms,lifecycle_status,enrollment_selectable,approved_at,approved_by
    ) values (
      v_application.applicant_id,v_application.display_name,v_slug,v_application.institution_type,
      v_application.parent_system_name,v_application.country_code,v_application.region_code,
      v_application.academic_domain,coalesce(v_application.primary_lms,'none'),'active',true,now(),(select auth.uid())
    ) returning * into v_institution;

    insert into public.institution_memberships (
      institution_id,user_id,role,status,permissions,invited_by,joined_at
    ) values (
      v_institution.id,v_application.applicant_id,'owner','active',
      '{"view_control_center":true,"control_features":true,"manage_team":true,"manage_integrations":true,"view_integrations":true,"view_accounts":true,"manage_affiliations":true,"view_audit":true,"export_reports":true,"manage_institution_profile":true}'::jsonb,
      (select auth.uid()),now()
    ) on conflict (institution_id,user_id) do update set role='owner',status='active',permissions=excluded.permissions,joined_at=coalesce(public.institution_memberships.joined_at,now());

    v_directory_key := coalesce(v_application.directory_key, trim(both '-' from regexp_replace(lower(v_application.display_name),'[^a-z0-9]+','-','g')));
    insert into public.institution_directory_entries (
      directory_key,canonical_name,institution_id,entity_type,system_name,city,region_code,country_code,
      website_url,academic_domain,directory_status,is_selectable,is_public
    ) values (
      v_directory_key,v_application.display_name,v_institution.id,v_application.institution_type,
      v_application.parent_system_name,v_application.city,v_application.region_code,v_application.country_code,
      v_application.website_url,v_application.academic_domain,'verified',true,true
    ) on conflict (directory_key) do update set institution_id=excluded.institution_id,canonical_name=excluded.canonical_name,
      directory_status='verified',is_selectable=true,updated_at=now();

    update public.institution_access_applications
    set status='approved',review_notes=p_review_notes,reviewed_by=(select auth.uid()),reviewed_at=now(),
        approved_institution_id=v_institution.id,updated_at=now()
    where id=p_application_id returning * into v_application;
  else
    update public.institution_access_applications
    set status='rejected',review_notes=p_review_notes,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now()
    where id=p_application_id returning * into v_application;
  end if;

  insert into public.audit_events (actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values ((select auth.uid()),v_application.approved_institution_id,'institution.application_reviewed','institution_access_application',v_application.id::text,
    jsonb_build_object('decision',p_decision), '');
  return v_application;
end;
$$;

create or replace function public.invite_institution_team_member(
  p_institution_id uuid,
  p_email text,
  p_role text,
  p_permissions jsonb default '{}'::jsonb
)
returns public.institution_team_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.institution_team_invitations;
begin
  if not private.has_institution_capability(p_institution_id,'manage_team',(select auth.uid())) then raise exception 'Institution team-management access required'; end if;
  if p_role not in ('admin','security','records') then raise exception 'Only institution admin, security, or records roles can be invited here'; end if;
  insert into public.institution_team_invitations (institution_id,email,intended_role,permissions,invited_by)
  values (p_institution_id,lower(trim(p_email)),p_role,coalesce(p_permissions,'{}'::jsonb),(select auth.uid()))
  returning * into v_row;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'institution.team_invited','institution_team_invitation',v_row.id::text,
    jsonb_build_object('role',p_role,'email_domain',split_part(v_row.email,'@',2)), '');
  return v_row;
end;
$$;

create or replace function public.accept_institution_team_invitation(p_invitation_id uuid)
returns public.institution_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare v_invite public.institution_team_invitations%rowtype; v_profile public.profiles%rowtype; v_member public.institution_memberships;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_profile from public.profiles where id=(select auth.uid());
  select * into v_invite from public.institution_team_invitations where id=p_invitation_id for update;
  if not found or v_invite.status<>'pending' or v_invite.expires_at<=now() then raise exception 'Invitation is not available'; end if;
  if lower(coalesce(v_profile.email,''))<>lower(v_invite.email) then raise exception 'Sign in with the invited email address'; end if;
  insert into public.institution_memberships(institution_id,user_id,role,status,permissions,invited_by,joined_at)
  values(v_invite.institution_id,v_profile.id,v_invite.intended_role,'active',v_invite.permissions,v_invite.invited_by,now())
  on conflict(institution_id,user_id) do update set role=excluded.role,status='active',permissions=excluded.permissions,joined_at=coalesce(public.institution_memberships.joined_at,now())
  returning * into v_member;
  update public.institution_team_invitations set status='accepted',accepted_by=v_profile.id,accepted_at=now(),updated_at=now() where id=p_invitation_id;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values(v_profile.id,v_invite.institution_id,'institution.team_invitation_accepted','institution_membership',v_profile.id::text,jsonb_build_object('role',v_member.role),'');
  return v_member;
end;
$$;

create or replace function public.request_institution_transfer(p_input jsonb)
returns public.institution_transfer_requests
language plpgsql
security definer
set search_path = ''
as $$
declare v_current public.institution_affiliations%rowtype; v_target public.institution_directory_entries%rowtype; v_row public.institution_transfer_requests;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_current from public.institution_affiliations
  where user_id=(select auth.uid()) and pathway=p_input->>'pathway' and is_primary and status in ('active','independent')
  for update;
  if not found then raise exception 'No current primary affiliation was found'; end if;
  select * into v_target from public.institution_directory_entries where directory_key=nullif(p_input->>'to_directory_key','') and is_selectable;
  if v_target.directory_key is null and nullif(trim(p_input->>'requested_institution_name'),'') is null then
    raise exception 'Choose a destination institution or provide an institution name for review';
  end if;
  if v_current.institution_id is not null and v_current.institution_id=v_target.institution_id then raise exception 'Select a different institution'; end if;
  insert into public.institution_transfer_requests(user_id,pathway,from_affiliation_id,from_institution_id,to_directory_key,to_institution_id,requested_institution_name,reason,effective_on)
  values((select auth.uid()),v_current.pathway,v_current.id,v_current.institution_id,v_target.directory_key,v_target.institution_id,
    coalesce(v_target.canonical_name,nullif(trim(p_input->>'requested_institution_name'),'')),trim(p_input->>'reason'),nullif(p_input->>'effective_on','')::date)
  returning * into v_row;
  -- Requesting a transfer does not remove current access. The existing
  -- affiliation is ended atomically only after the platform owner approves a
  -- verified destination, so a pending or rejected request cannot strand the
  -- student or professor outside their current courses.
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_current.institution_id,'institution.transfer_requested','institution_transfer_request',v_row.id::text,
    jsonb_build_object('pathway',v_row.pathway,'to_directory_key',v_row.to_directory_key,'history_preserved',true),'');
  return v_row;
end;
$$;

revoke all on function public.submit_institution_access_application(jsonb) from public, anon;
revoke all on function public.review_institution_access_application(uuid,text,text) from public, anon;
revoke all on function public.invite_institution_team_member(uuid,text,text,jsonb) from public, anon;
revoke all on function public.accept_institution_team_invitation(uuid) from public, anon;
revoke all on function public.request_institution_transfer(jsonb) from public, anon;
grant execute on function public.submit_institution_access_application(jsonb) to authenticated;
grant execute on function public.review_institution_access_application(uuid,text,text) to authenticated;
grant execute on function public.invite_institution_team_member(uuid,text,text,jsonb) to authenticated;
grant execute on function public.accept_institution_team_invitation(uuid) to authenticated;
grant execute on function public.request_institution_transfer(jsonb) to authenticated;

create or replace function public.review_institution_transfer(
  p_request_id uuid,
  p_decision text,
  p_review_notes text default null
)
returns public.institution_transfer_requests
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.institution_transfer_requests%rowtype; v_role text;
begin
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into v_row from public.institution_transfer_requests where id=p_request_id for update;
  if not found or v_row.status not in ('pending','reviewing') then raise exception 'Transfer request is not available'; end if;
  if not private.is_platform_owner((select auth.uid())) then
    raise exception 'Only the platform owner can approve a cross-institution transfer';
  end if;

  if p_decision='approved' then
    if v_row.to_institution_id is null then raise exception 'The destination institution must be approved before the transfer can complete'; end if;
    if v_row.effective_on is not null and v_row.effective_on > current_date then
      raise exception 'This transfer cannot complete before its requested effective date';
    end if;
    update public.institution_affiliations
    set status='ended',is_primary=false,ended_at=now(),updated_at=now()
    where id=v_row.from_affiliation_id;

    insert into public.institution_affiliations(
      user_id,pathway,institution_id,directory_key,relationship,status,source,verification_method,
      is_primary,started_at,verified_by,verified_at
    ) values(
      v_row.user_id,v_row.pathway,v_row.to_institution_id,v_row.to_directory_key,
      case when v_row.pathway='professor' then 'faculty' when v_row.pathway='publisher' then 'publisher' else 'student' end,
      'active','transfer','admin_review',true,now(),(select auth.uid()),now()
    );

    v_role := case when v_row.pathway='professor' then 'professor' when v_row.pathway='publisher' then 'publisher' else 'learner' end;
    insert into public.institution_memberships(institution_id,user_id,role,status,joined_at)
    values(v_row.to_institution_id,v_row.user_id,v_role,'active',now())
    on conflict(institution_id,user_id) do update set role=excluded.role,status='active',joined_at=coalesce(public.institution_memberships.joined_at,now()),ended_at=null;

    if v_row.from_institution_id is not null and not exists(
      select 1 from public.institution_affiliations ia
      where ia.user_id=v_row.user_id and ia.institution_id=v_row.from_institution_id and ia.status='active'
    ) then
      update public.institution_memberships set status='ended',ended_at=now()
      where institution_id=v_row.from_institution_id and user_id=v_row.user_id;
    end if;

    update public.institution_transfer_requests
    set status='completed',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=p_review_notes,completed_at=now(),updated_at=now()
    where id=p_request_id returning * into v_row;
  else
    update public.institution_transfer_requests
    set status='rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=p_review_notes,updated_at=now()
    where id=p_request_id returning * into v_row;
  end if;

  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_row.from_institution_id,'institution.transfer_reviewed','institution_transfer_request',v_row.id::text,
    jsonb_build_object('decision',p_decision,'to_institution_id',v_row.to_institution_id,'history_preserved',true),'');
  return v_row;
end;
$$;

create or replace function public.set_platform_admin_authorization(
  p_user_id uuid,
  p_access_level text,
  p_capabilities jsonb,
  p_status text default 'active',
  p_expires_at timestamptz default null
)
returns public.platform_admin_authorizations
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.platform_admin_authorizations;
begin
  if not private.is_platform_owner((select auth.uid())) then raise exception 'Only the platform owner can grant platform control-center access'; end if;
  if p_user_id=(select auth.uid()) and p_status<>'active' then raise exception 'The platform owner cannot revoke their own owner access here'; end if;
  insert into public.platform_admin_authorizations(user_id,access_level,capabilities,status,granted_by,expires_at,revoked_at)
  values(p_user_id,p_access_level,coalesce(p_capabilities,'{}'::jsonb),p_status,(select auth.uid()),p_expires_at,case when p_status='revoked' then now() else null end)
  on conflict(user_id) do update set access_level=excluded.access_level,capabilities=excluded.capabilities,status=excluded.status,
    granted_by=excluded.granted_by,granted_at=now(),expires_at=excluded.expires_at,revoked_at=excluded.revoked_at,updated_at=now()
  returning * into v_row;
  insert into public.audit_events(actor_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),'admin.platform_authorization_changed','profile',p_user_id::text,jsonb_build_object('access_level',p_access_level,'status',p_status),'');
  return v_row;
end;
$$;

create or replace function public.set_institution_team_member(
  p_institution_id uuid,
  p_user_id uuid,
  p_role text,
  p_permissions jsonb,
  p_status text
)
returns public.institution_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor_role text; v_target public.institution_memberships%rowtype; v_row public.institution_memberships;
begin
  if not private.has_institution_capability(p_institution_id,'manage_team',(select auth.uid())) then raise exception 'Institution team-management access required'; end if;
  select im.role into v_actor_role from public.institution_memberships im where im.institution_id=p_institution_id and im.user_id=(select auth.uid()) and im.status='active';
  select * into v_target from public.institution_memberships where institution_id=p_institution_id and user_id=p_user_id for update;
  if p_role='owner' and not private.is_platform_owner((select auth.uid())) then raise exception 'Only the platform owner can assign institution ownership'; end if;
  if v_target.role='owner' and not private.is_platform_owner((select auth.uid())) then raise exception 'Institution ownership cannot be changed here'; end if;
  if p_user_id=(select auth.uid()) and p_status<>'active' then raise exception 'A team administrator cannot suspend their own membership'; end if;
  if p_role not in ('owner','admin','security','records') or p_status not in ('active','suspended','ended') then raise exception 'Invalid team role or status'; end if;
  update public.institution_memberships set role=p_role,permissions=coalesce(p_permissions,'{}'::jsonb),status=p_status,
    ended_at=case when p_status='ended' then now() else null end
  where institution_id=p_institution_id and user_id=p_user_id returning * into v_row;
  if not found then raise exception 'Institution team member not found'; end if;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'institution.team_member_changed','institution_membership',p_user_id::text,jsonb_build_object('role',p_role,'status',p_status),'');
  return v_row;
end;
$$;

create or replace function public.record_integration_test(
  p_connection_id uuid,
  p_capability_key text,
  p_status text,
  p_safe_summary text,
  p_evidence jsonb default '{}'::jsonb
)
returns public.integration_test_runs
language plpgsql
security definer
set search_path = ''
as $$
declare v_connection public.integration_connections%rowtype; v_run public.integration_test_runs;
begin
  select * into v_connection from public.integration_connections where id=p_connection_id for update;
  if not found then raise exception 'Connection not found'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or (v_connection.institution_id is not null and v_connection.institution_controllable and private.has_institution_capability(v_connection.institution_id,'test_integrations',(select auth.uid())))
  ) then raise exception 'Connection testing access required'; end if;
  if p_status not in ('passed','failed','warning') then raise exception 'Invalid test result'; end if;
  insert into public.integration_test_runs(connection_id,capability_key,status,safe_summary,evidence,tested_by)
  values(p_connection_id,nullif(p_capability_key,''),p_status,left(trim(p_safe_summary),1000),coalesce(p_evidence,'{}'::jsonb),(select auth.uid())) returning * into v_run;
  update public.integration_connections set last_tested_at=now(),last_test_status=p_status,
    health_status=case when p_status='passed' then 'healthy' when p_status='warning' then 'warning' else 'failed' end,
    activation_status=case when p_status='passed' and activation_status in ('setup','testing') then 'ready' else activation_status end,
    updated_at=now() where id=p_connection_id;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_connection.institution_id,'integration.test_recorded','integration_connection',p_connection_id::text,
    jsonb_build_object('capability_key',p_capability_key,'status',p_status),'');
  return v_run;
end;
$$;

create or replace function public.set_integration_connection_status(
  p_connection_id uuid,
  p_status text,
  p_reason text
)
returns public.integration_connections
language plpgsql
security definer
set search_path = ''
as $$
declare v_connection public.integration_connections%rowtype;
begin
  select * into v_connection from public.integration_connections where id=p_connection_id for update;
  if not found then raise exception 'Connection not found'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or (v_connection.institution_id is not null and v_connection.institution_controllable and private.has_institution_capability(v_connection.institution_id,'manage_integrations',(select auth.uid())))
  ) then raise exception 'Connection management access required'; end if;
  if p_status not in ('setup','testing','ready','active','suspended','retired') then raise exception 'Invalid connection status'; end if;
  if p_status='active' and v_connection.activation_managed_by<>'control_center' then raise exception 'This connection activates only through its required deployment or evidence workflow'; end if;
  if p_status='active' and v_connection.last_test_status<>'passed' then raise exception 'Record a passing connection test before activation'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reason is required'; end if;
  update public.integration_connections set activation_status=p_status,
    activated_at=case when p_status='active' then now() else activated_at end,
    activated_by=case when p_status='active' then (select auth.uid()) else activated_by end,
    next_step=case when p_status='active' then 'Monitor health and synchronization evidence.' else next_step end,
    updated_at=now() where id=p_connection_id returning * into v_connection;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_connection.institution_id,'integration.status_changed','integration_connection',p_connection_id::text,
    jsonb_build_object('status',p_status,'reason',left(trim(p_reason),500)),'');
  return v_connection;
end;
$$;

create or replace function public.generate_admin_control_report(
  p_institution_id uuid,
  p_report_type text,
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_export public.admin_report_exports; v_data jsonb; v_count integer;
begin
  if p_institution_id is null then
    if not private.is_platform_owner((select auth.uid())) then raise exception 'Only the platform owner can export a platform-wide report'; end if;
  elsif not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'export_reports',(select auth.uid()))
  ) then raise exception 'Institution report-export access required'; end if;

  if p_report_type='feature_inventory' then
    select coalesce(jsonb_agg(jsonb_build_object('feature_key',fd.feature_key,'name',fd.display_name,'pathway',fd.pathway,'build_status',fd.build_status,'control_class',fd.control_class,'risk_level',fd.risk_level) order by fd.pathway,fd.display_name),'[]'::jsonb),count(*)::integer into v_data,v_count from public.feature_definitions fd where fd.active;
  elsif p_report_type='connection_status' then
    select coalesce(jsonb_agg(to_jsonb(c)-'secret_reference_names' order by c.category,c.display_name),'[]'::jsonb),count(*)::integer into v_data,v_count from public.integration_connections c where p_institution_id is null or c.institution_id is null or c.institution_id=p_institution_id;
  elsif p_report_type='change_log' then
    select coalesce(jsonb_agg(to_jsonb(cs) order by cs.created_at desc),'[]'::jsonb),count(*)::integer into v_data,v_count from public.feature_change_sets cs where p_institution_id is null or cs.institution_id=p_institution_id;
  elsif p_report_type='account_access' then
    select coalesce(jsonb_agg(jsonb_build_object('user_id',im.user_id,'institution_id',im.institution_id,'role',im.role,'status',im.status,'joined_at',im.joined_at) order by im.created_at),'[]'::jsonb),count(*)::integer into v_data,v_count from public.institution_memberships im where p_institution_id is null or im.institution_id=p_institution_id;
  elsif p_report_type='course_access' then
    select coalesce(jsonb_agg(jsonb_build_object('course_id',c.id,'institution_id',c.institution_id,'course_code',c.course_code,'title',c.title,'status',c.status,'access_scope',c.access_scope) order by c.title),'[]'::jsonb),count(*)::integer into v_data,v_count from public.courses c where p_institution_id is null or c.institution_id=p_institution_id;
  else
    v_data := '[]'::jsonb; v_count := 0;
  end if;

  insert into public.admin_report_exports(institution_id,requested_by,report_type,filters,status,row_count,content_hash)
  values(p_institution_id,(select auth.uid()),p_report_type,coalesce(p_filters,'{}'::jsonb),'generated',v_count,md5(v_data::text))
  returning * into v_export;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'admin.report_generated','admin_report_export',v_export.id::text,
    jsonb_build_object('report_type',p_report_type,'row_count',v_count,'redaction_level','standard'),'');
  return jsonb_build_object('export',to_jsonb(v_export),'data',v_data,'generated_at',now());
end;
$$;

revoke all on function public.review_institution_transfer(uuid,text,text) from public, anon;
revoke all on function public.set_platform_admin_authorization(uuid,text,jsonb,text,timestamptz) from public, anon;
revoke all on function public.set_institution_team_member(uuid,uuid,text,jsonb,text) from public, anon;
revoke all on function public.record_integration_test(uuid,text,text,text,jsonb) from public, anon;
revoke all on function public.set_integration_connection_status(uuid,text,text) from public, anon;
revoke all on function public.generate_admin_control_report(uuid,text,jsonb) from public, anon;
grant execute on function public.review_institution_transfer(uuid,text,text) to authenticated;
grant execute on function public.set_platform_admin_authorization(uuid,text,jsonb,text,timestamptz) to authenticated;
grant execute on function public.set_institution_team_member(uuid,uuid,text,jsonb,text) to authenticated;
grant execute on function public.record_integration_test(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.set_integration_connection_status(uuid,text,text) to authenticated;
grant execute on function public.generate_admin_control_report(uuid,text,jsonb) to authenticated;


-- Canonical feature catalog seed. Keep this section synchronized with
-- src/admin-control/featureCatalog.js. It contains no credentials or secret values.
insert into public.feature_definitions (
  feature_key,display_name,pathway,category,description,help_text,
  control_type,value_type,default_value,allowed_values,minimum_value,maximum_value,
  allowed_scopes,institution_delegable,lockable,control_class,risk_level,
  build_status,disable_behavior,impact_explanation,accessibility_notes,
  data_classification,sort_order,active
) values
  ('shared.authentication','Account sign-in','shared','Accounts and access','Allows approved people to sign in to EdNotebook and open their permitted workspace.','Turning this off blocks ordinary account access. Use it only for a planned maintenance window or a confirmed security incident.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'ordinary','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',100,true),
  ('shared.institution_selection','Institution selection','shared','Accounts and access','Shows the institution choice used to place students, professors, and administrators in the correct school environment.','Institution selection is the first tenant boundary. Free independent use can remain available, but institutional enrollment requires an approved school relationship.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',110,true),
  ('shared.institution_affiliation','Institution affiliation','shared','Accounts and access','Links an account to one approved institution for institutional courses, rosters, grades, and school-only services.','Affiliation must use an approved institution record, not a typed school name. Changing schools should use a reviewed transfer request.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',120,true),
  ('shared.course_access','Course access','shared','Courses','Allows an enrolled learner or authorized educator to open protected course content.','The visible control must be backed by course membership and institution-aware server authorization.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'restricted',130,true),
  ('shared.account_settings','Account settings','shared','Accounts and access','Lets a person manage profile, visibility, assistant, social, and account preferences.','Some current settings are device-only. Institution controls can set safe limits without silently changing personal profile content.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'internal',140,true),
  ('shared.people_search','People search','shared','Community','Lets users find visible student and educator profiles inside an allowed audience.','Institution deployments should limit results to the active institution and respect every profile''s discoverability setting.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','built_in_part','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'education_record',150,true),
  ('shared.community','Community spaces','shared','Community','Provides class, institution, and approved public discussion spaces with visible audience labels.','Turning this off should preserve required professor, support, and appeal communication channels.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'education_record',160,true),
  ('shared.private_files','Private file storage','shared','Files and storage','Stores course, assignment, and publication files outside the public website in protected storage.','Disabling new uploads should not remove existing files. Existing approved files should become read-only unless a security hold requires blocking them.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','deployment_required','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'restricted',170,true),
  ('shared.audit_history','Audit history','shared','Governance','Records important administrative, security, file, course, roster, grade, and integration changes.','Audit history is an accountability control and must not be disabled by an institution administrator.','status_only','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,false,'kernel','critical','implemented','status_only','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',180,true),
  ('shared.data_export','Approved data exports','shared','Governance','Creates scoped reports for authorized users without exposing records from another institution.','Exports should be logged, time-limited, protected from spreadsheet formula injection, and limited to the administrator''s assigned institution.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',190,true),
  ('shared.retention','Retention rules','shared','Governance','Keeps or removes records according to approved institution, course, and legal requirements.','Changing retention can affect future deletion dates. Existing legal holds must always take priority.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',200,true),
  ('shared.ai_assistant','AI assistant','shared','AI and automation','Provides approved assistance through the built-in experience or an institution-approved server gateway.','No provider key belongs in the browser. Institutions can turn off external AI while leaving ordinary course tools available.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','demonstration','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'education_record',210,true),
  ('shared.notifications','Course notifications','shared','Communication','Sends approved course and account notices using configured delivery channels.','Required security and account notices must remain available even when optional reminders are disabled.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','planned','degrade','Turning this off uses the documented reduced experience or fallback. It can affect student, professor, publisher pathways.',null,'education_record',220,true),
  ('shared.billing','Paid services','shared','Billing and plans','Applies verified subscription and purchase entitlements without storing card information in EdNotebook.','Turning paid services off must preserve already-authorized records and must not invent or remove a payment status.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'restricted',230,true),
  ('student.dashboard','Student dashboard','student','Student workspace','Shows the learner''s classes, progress, due work, and account tools in one place.','Institution controls can simplify the dashboard without exposing another school''s records.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','implemented','hide','Turning this off hides the feature while preserving its records. It can affect student pathways.',null,'internal',240,true),
  ('student.course_search','Course search','student','Student workspace','Finds public course listings by institution, course, subject, or professor.','Public listings contain directory information only; lessons, rosters, files, and grades stay protected.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','hide','Turning this off hides the feature while preserving its records. It can affect student pathways.',null,'education_record',250,true),
  ('student.enrollment','Enrollment requests','student','Student workspace','Lets a student request a course link that an authorized professor can approve.','An institutional course request requires the same active institution and a protected roster match.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student pathways.',null,'restricted',260,true),
  ('student.course_runtime','Interactive course player','student','Learning','Opens published lessons, decisions, knowledge checks, progress, and course completion.','Disabling this feature should preserve learner records and show a plain-language access message.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect student pathways.',null,'education_record',270,true),
  ('student.assignments','Student assignments','student','Learning','Shows assigned work and provides the approved student work area.','Existing submissions must remain preserved when new assignment work is paused.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect student pathways.',null,'restricted',280,true),
  ('student.grade_report','Student grade report','student','Grades','Shows only the signed-in student''s finalized grades and the professor''s published scale.','This control must never broaden grade visibility. Turning it off hides the report but does not delete grades.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','hide','Turning this off hides the feature while preserving its records. It can affect student pathways.',null,'restricted',290,true),
  ('student.notes','Student notes','student','Learning','Keeps personal study notes beside the relevant course.','Current notes may be device-only. A control should clearly distinguish device notes from cloud-synchronized notes.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect student pathways.',null,'internal',300,true),
  ('student.community','Student community','student','Community','Provides class and institution learning groups with clear audience boundaries.','An institution can make community spaces read-only while preserving professor and support communication.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect student pathways.',null,'education_record',310,true),
  ('student.people_search','Student people search','student','Community','Searches discoverable people within the student''s approved institution and audience.','Private or undiscoverable profiles and people from another institution must never appear.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','hide','Turning this off hides the feature while preserving its records. It can affect student pathways.',null,'restricted',320,true),
  ('student.messaging','Student messaging','student','Communication','Lets a learner use permitted class, educator, and peer conversations.','Peer messaging may be restricted while required professor, support, safety, and appeal channels remain open.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect student pathways.',null,'restricted',330,true),
  ('student.public_page','Student profile page','student','Community','Lets a learner publish only the profile details and work they choose.','New pages should remain private and hidden from search until the learner changes both settings.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','hide','Turning this off hides the feature while preserving its records. It can affect student pathways.',null,'restricted',340,true),
  ('student.opportunities','Student opportunities','student','Opportunities','Shows approved advisory, internship, literacy, and future-work opportunities.','Do not activate broad matching until privacy terms, moderation, and partner verification are ready.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','planned','hide','Turning this off hides the feature while preserving its records. It can affect student pathways.',null,'education_record',350,true),
  ('student.demo_workspace','Student demonstration workspace','student','Demonstration','Provides clearly labeled sample records so a user can explore without affecting an account.','Demonstration records must remain visibly separate from live institutional records.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway' ]::text[],true,true,'ordinary','low','implemented','hide','Turning this off hides the feature while preserving its records. It can affect student pathways.',null,'internal',360,true),
  ('student.institution_transfer','Institution transfer request','student','Accounts and access','Moves a learner to another institution through a reviewed request instead of an immediate school switch.','Approval should end prior environment access while preserving historical records and a complete change log.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student pathways.',null,'restricted',370,true),
  ('professor.dashboard','Professor dashboard','professor','Professor workspace','Shows the educator''s classes, pending links, grades, and teaching tools.','Every count and search must be limited to courses the educator is authorized to manage.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','built_in_part','hide','Turning this off hides the feature while preserving its records. It can affect professor pathways.',null,'internal',380,true),
  ('professor.course_builder','Course builder','professor','Course creation','Builds a structured course from professor-approved content and templates.','Generated material remains a draft until the professor reviews and publishes it.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'education_record',390,true),
  ('professor.course_publish','Course publishing','professor','Course creation','Publishes an approved course version to enrolled learners.','Turning publishing off should leave existing published versions readable unless a separate emergency control blocks them.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'restricted',400,true),
  ('professor.assignment_templates','Assignment templates','professor','Assignments','Creates reusable assignment structures, rubrics, limits, and learner instructions.','Templates do not publish themselves; the professor controls placement and release.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','implemented','hide','Turning this off hides the feature while preserving its records. It can affect professor pathways.',null,'internal',410,true),
  ('professor.roster','Roster and account linking','professor','Rosters','Imports or reviews institution-scoped learners and approves account-to-roster matches.','Raw identifiers must remain protected, and educators must not search the platform-wide student population.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'restricted',420,true),
  ('professor.gradebook','Professor gradebook','professor','Grades','Lets an authorized professor manage grades only for courses they control.','This area should require recent verification and must never display grades from another educator''s course.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'restricted',430,true),
  ('professor.grade_publish','Grade publishing','professor','Grades','Makes finalized grades visible to the correct learner after professor confirmation.','Pending or missing grades must not be released as final results.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect professor pathways.',null,'restricted',440,true),
  ('professor.attendance','Attendance','professor','Class management','Records attendance for an authorized class and date.','Local attendance can remain available even when an external SIS connection is off.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','demonstration','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'restricted',450,true),
  ('professor.announcements','Professor announcements','professor','Communication','Sends an announcement to a selected class, institution, faculty, or approved public audience.','The selected audience must be shown before publishing and enforced by course or institution membership.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'education_record',460,true),
  ('professor.verification','Educator affiliation verification','professor','Accounts and access','Reviews evidence for a public verified institution-affiliation badge.','Verification affects the badge and institutional trust; it must not silently grant platform-wide administrator access.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect professor pathways.',null,'restricted',470,true),
  ('professor.studio_materials','Learning Studio materials','professor','Learning Studio','Adds files, links, videos, quotations, and course-library resources.','Cloud files must pass security review before learners can open them.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'education_record',480,true),
  ('professor.studio_assignments','Learning Studio assignments','professor','Learning Studio','Builds assignment instructions, rubrics, files, and syllabus placement.','A disabled editor should not remove existing assignments or student submissions.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'education_record',490,true),
  ('professor.studio_tools','Subject tools','professor','Learning Studio','Provides calculators, tables, maps, and subject-specific learning builders.','Institutions can turn off individual tool families without disabling the course itself.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','implemented','hide','Turning this off hides the feature while preserving its records. It can affect professor pathways.',null,'internal',500,true),
  ('professor.studio_reader','Reader and publishing tools','professor','Learning Studio','Creates and assigns interactive readings and professor-authored publications.','Commercial publishing controls remain separate from class-only professor authoring.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'education_record',510,true),
  ('professor.studio_slides','Slide studio','professor','Learning Studio','Creates structured academic presentations and exportable slide packages.','External design connections must preserve course placement, ownership, and accessibility metadata.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','implemented','hide','Turning this off hides the feature while preserving its records. It can affect professor pathways.',null,'internal',520,true),
  ('professor.studio_room','Private course room','professor','Learning Studio','Provides course conversations or clearly labeled device-only notes.','Cloud conversations require course membership; device notes never represent an official course message.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'education_record',530,true),
  ('publisher.application','Publisher application','publisher','Publisher access','Collects an application from a publisher, author, professor-author, institution, or supplier.','Submitting an application does not grant catalog, sales, or institution-administrator access.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','hide','Turning this off hides the feature while preserving its records. It can affect publisher pathways.',null,'education_record',540,true),
  ('publisher.account_pathway','Publisher account pathway','publisher','Publisher access','Provides an approved publisher with a dedicated workspace separate from professor-only tools.','Publisher approval and institution membership must be checked independently from professor status.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','planned','hide','Turning this off hides the feature while preserving its records. It can affect publisher pathways.',null,'restricted',550,true),
  ('publisher.source_import','Publication source import','publisher','Publishing','Uploads a source document into private quarantine and creates a publication record.','Source files remain unavailable until security, rights, and conversion checks allow release.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect publisher pathways.',null,'restricted',560,true),
  ('publisher.conversion','EduBook conversion','publisher','Publishing','Converts approved source files into an interactive teaching publication.','Conversion requires the document-security worker and human review of the result.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','deployment_required','read_only','Turning this off stops new changes while preserving readable records. It can affect publisher pathways.',null,'education_record',570,true),
  ('publisher.interactive_reader','Interactive reader','publisher','Publishing','Reads approved publications with chapters, notes, highlights, bookmarks, and questions.','Access still depends on the publication''s open, assigned, purchased, or rental entitlement.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect publisher pathways.',null,'education_record',580,true),
  ('publisher.editorial_workflow','Editorial and accessibility review','publisher','Publishing','Tracks rights, accessibility, editorial status, revisions, and approval before publication.','A publication must not bypass required review simply because its source conversion succeeded.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect publisher pathways.','A publication must not bypass required review simply because its source conversion succeeded.','restricted',590,true),
  ('publisher.course_assignment','Assign publications to courses','publisher','Distribution','Makes an approved publication or chapter available in an authorized course.','Course assignment creates a scoped entitlement; it does not make the source file public.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect publisher pathways.',null,'restricted',600,true),
  ('publisher.catalog','Publisher catalog','publisher','Distribution','Lists approved publications for professor review and course selection.','Only reviewed records should appear, and institutions may restrict catalogs available to their users.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','planned','hide','Turning this off hides the feature while preserving its records. It can affect publisher pathways.',null,'education_record',610,true),
  ('publisher.commerce','Publication purchases and rentals','publisher','Commerce','Creates access after a verified purchase or rental event.','The browser never grants paid access. Tax, refund, seller, and mobile-store rules must be approved first.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','planned','read_only','Turning this off stops new changes while preserving readable records. It can affect publisher pathways.',null,'restricted',620,true),
  ('publisher.analytics','Publisher analytics','publisher','Reporting','Shows privacy-protected adoption and usage summaries to an approved publisher.','Reports require minimum group sizes and must never reveal individual student activity or grades.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','critical','planned','hide','Turning this off hides the feature while preserving its records. It can affect publisher pathways.',null,'restricted',630,true),
  ('security.row_level_access','Database access boundaries','security','Security','Limits each account to rows allowed by its identity, institution, course, and role.','This is a required server-side boundary. A screen-level switch is never a substitute for database authorization.','status_only','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,false,'kernel','critical','implemented','status_only','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',640,true),
  ('security.secure_uploads','Secure upload pipeline','security','Security','Reserves storage, uploads to quarantine, and releases a file only after approved checks.','If the security pipeline is unavailable, new cloud uploads should fail closed while existing approved files remain readable.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution' ]::text[],true,true,'security_required','critical','deployment_required','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',650,true),
  ('security.malware_scanning','Malware and archive scanning','security','Security','Inspects files and archives before learners or educators can open them.','Do not mark scanning active until the deployed worker has passed health, malware, archive, timeout, and callback tests.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution' ]::text[],true,true,'security_required','critical','deployment_required','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',660,true),
  ('security.retention_and_legal_hold','Retention and legal holds','security','Security','Prevents deletion when an approved retention date or legal hold still applies.','Institution controls may add scoped rules but cannot release a platform or legal hold they do not own.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution' ]::text[],true,true,'security_required','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',670,true),
  ('security.sensitive_area_reauth','Sensitive-area verification','security','Security','Requires recent account verification before opening sensitive student and grade tools.','The short unlock is an extra protection; normal course and database authorization still applies to every action.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution' ]::text[],true,true,'security_required','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect professor pathways.',null,'restricted',680,true),
  ('security.admin_change_log','Administrative change log','security','Security','Records who changed a control, what changed, who was affected, and when it happened.','Rollback creates another logged change; administrators must not erase prior versions.','status_only','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,false,'security_required','critical','built_in_part','status_only','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',690,true),
  ('security.emergency_shutdown','Emergency feature shutdown','security','Security','Lets the platform owner stop a risky feature across every institution while preserving evidence and records.','This master-only control requires recent verification, a reason, impact preview, and multiple confirmations.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'security_required','critical','built_in_part','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',700,true),
  ('accessibility.keyboard_navigation','Keyboard navigation','accessibility','Accessibility','Keeps interactive controls usable without a mouse.','Keyboard access is a required product behavior and cannot be disabled by a platform or institution setting.','status_only','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,false,'accessibility_required','critical','implemented','status_only','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.','Keyboard access is a required product behavior and cannot be disabled by a platform or institution setting.','restricted',710,true),
  ('accessibility.reduced_motion','Reduced motion','accessibility','Accessibility','Removes nonessential animation when the user''s device requests reduced motion.','An institution may require reduced motion, but it must not force animation on for a user who requested less motion.','status_only','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','account' ]::text[],true,false,'accessibility_required','high','implemented','status_only','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.','An institution may require reduced motion, but it must not force animation on for a user who requested less motion.','education_record',720,true),
  ('accessibility.text_alternatives','Text alternatives','accessibility','Accessibility','Requires meaningful text alternatives for instructional figures and important images.','Decorative images may use an empty alternative; instructional meaning must always have a readable equivalent.','status_only','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,false,'accessibility_required','critical','implemented','status_only','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.','Decorative images may use an empty alternative; instructional meaning must always have a readable equivalent.','restricted',730,true),
  ('accessibility.contrast_mode','High-contrast appearance','accessibility','Accessibility','Offers a readable high-contrast appearance without changing course records or content.','Theme locks must preserve contrast and may not block a user''s required accessibility setting.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','account' ]::text[],true,true,'accessibility_required','low','built_in_part','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.','Theme locks must preserve contrast and may not block a user''s required accessibility setting.','internal',740,true),
  ('accessibility.reporting','Accessibility reporting','accessibility','Accessibility','Tracks test evidence, findings, owners, status, and retest dates for platform and course experiences.','A report documents evidence and open work; it does not by itself certify compliance.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution' ]::text[],true,true,'accessibility_required','high','planned','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.','A report documents evidence and open work; it does not by itself certify compliance.','education_record',750,true),
  ('theme.course_preset','Course theme preset','theme','Themes','Applies an approved course color and layout preset inside the unchanged EdNotebook account shell.','A course theme must preserve navigation, warnings, accessibility controls, and sufficient contrast.','select','text','"ednotebook-default"'::jsonb,'["ednotebook-default","angelo-state-inspired","ram-ready"]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','high','implemented','degrade','Turning this off uses the documented reduced experience or fallback. It can affect student, professor pathways.',null,'education_record',760,true),
  ('theme.account_choice','Personal theme choice','theme','Themes','Lets a user choose from approved visual themes without changing records or permissions.','A platform or institution lock may narrow visual choices, but accessibility preferences retain priority.','select','text','"classic"'::jsonb,'["classic","ram-ready","nightshift","letterpress"]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'ordinary','low','built_in_part','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'internal',770,true),
  ('theme.institution_brand','Institution theme','theme','Themes','Applies approved institution colors, name, and brand assets to that institution''s environment.','Institution branding must not mimic a false login page or hide EdNotebook security and accessibility controls.','select','text','"inherit"'::jsonb,'[]'::jsonb,null,null,array['platform','institution' ]::text[],true,true,'ordinary','high','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'education_record',780,true),
  ('theme.platform_campaign','Platform campaign theme','theme','Themes','Schedules an approved seasonal or platform-wide visual treatment.','Campaign themes should change appearance only and must have a start date, end date, rollback, and accessibility review.','select','text','"none"'::jsonb,'["none","seasonal","awareness","institution-event"]'::jsonb,null,null,array['platform' ]::text[],false,true,'ordinary','high','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.','Campaign themes should change appearance only and must have a start date, end date, rollback, and accessibility review.','education_record',790,true),
  ('theme.platform_lock','Theme lock','theme','Themes','Temporarily locks users to an approved platform or institution theme.','The lock cannot override reduced motion, readable contrast, zoom, or other accessibility needs.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution' ]::text[],true,true,'ordinary','high','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'education_record',800,true),
  ('integration.supabase_auth','Supabase account service','integration','Core services','Provides authenticated sessions used by EdNotebook account and access controls.','Only public browser configuration may appear in the client; privileged keys stay server-side.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','implemented','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',810,true),
  ('integration.supabase_database','Supabase database','integration','Core services','Stores authoritative institutions, courses, memberships, grades, publications, and audit records.','This connection cannot be controlled as a cosmetic switch; an outage requires a read-only or maintenance response.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','implemented','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'restricted',820,true),
  ('integration.supabase_storage','Supabase private storage','integration','Core services','Stores protected files and approved derived artifacts in private buckets.','Connection status should come from deployed storage configuration and a safe health test, not from a manual label.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','deployment_required','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'restricted',830,true),
  ('integration.supabase_functions','Supabase server functions','integration','Core services','Runs secure uploads, previews, retention, billing, and LMS integration endpoints.','Each function has separate deployment, secret, health, and authorization requirements.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','deployment_required','degrade','Turning this off uses the documented reduced experience or fallback. It can affect student, professor, publisher pathways.',null,'restricted',840,true),
  ('integration.railway_worker','Document security worker','integration','Files and documents','Inspects, scans, previews, and converts protected documents in an isolated server worker.','Mark active only after deployment, health, malware, archive, timeout, callback, and cleanup tests pass.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','deployment_required','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',850,true),
  ('integration.blackboard_csv','Blackboard grade CSV','integration','Learning systems','Lets a professor safely prepare finalized EdNotebook grades in a Blackboard-compatible CSV file.','This remains a professor-confirmed fallback. Raw Blackboard files stay in browser memory during processing.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','pilot_testing','hide','Turning this off hides the feature while preserving its records. It can affect professor pathways.',null,'restricted',860,true),
  ('integration.blackboard_lti_launch','Blackboard LTI launch','integration','Learning systems','Opens EdNotebook from a validated Blackboard instructor or learner launch.','Activation requires real instructor and learner launch evidence. A saved registration is not an active connection.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','pilot_testing','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor pathways.',null,'restricted',870,true),
  ('integration.blackboard_deep_link','Blackboard content placement','integration','Learning systems','Returns professor-selected EdNotebook content to the correct Blackboard course.','Content must belong to the mapped institution and course before it can be returned.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','pilot_testing','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect professor pathways.',null,'restricted',880,true),
  ('integration.blackboard_nrps','Blackboard roster sync','integration','Learning systems','Synchronizes permitted course membership information through LTI Names and Roles.','Only approved fields and scopes should be retained, and stale memberships must be reconciled without crossing institutions.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','pilot_testing','read_only','Turning this off stops new changes while preserving readable records. It can affect professor pathways.',null,'restricted',890,true),
  ('integration.blackboard_ags','Blackboard grade passback','integration','Learning systems','Sends a professor-confirmed finalized grade to the mapped Blackboard line item.','Passback requires course, learner, line-item, score, status, freshness, idempotency, and professor-release checks.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','pilot_testing','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect professor pathways.',null,'restricted',900,true),
  ('integration.blackboard_rest','Blackboard REST connection','integration','Learning systems','Reserves a server-side adapter for Blackboard-specific courses, users, content, and grade operations.','Use only when LTI or standardized roster exchange cannot provide an approved operation.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','planned','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect professor pathways.',null,'restricted',910,true),
  ('integration.powerschool','PowerSchool SIS','integration','Learning systems','Reserves institution-approved attendance, roster, and grade exchange with PowerSchool.','Local EdNotebook attendance and grades must remain clearly separate until a district connection passes testing.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','planned','hide','Turning this off hides the feature while preserving its records. It can affect professor pathways.',null,'restricted',920,true),
  ('integration.stripe','Stripe billing connection','integration','Billing','Processes verified server-side payment events and maps them to EdNotebook entitlements.','Card details never enter EdNotebook. Live billing requires finance, legal, refund, tax, and support approval.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','built_in_part','read_only','Turning this off stops new changes while preserving readable records. It can affect student, professor, publisher pathways.',null,'restricted',930,true),
  ('integration.youtube','YouTube privacy-enhanced embeds','integration','Media','Recognizes YouTube links and uses privacy-enhanced lesson embeds without a basic API key.','Institutions can disable embeds while leaving the source link and readable lesson context available.','boolean','boolean','true'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','high','implemented','degrade','Turning this off uses the documented reduced experience or fallback. It can affect student, professor pathways.',null,'education_record',940,true),
  ('integration.microsoft_word','Microsoft Word and EduSync','integration','Documents','Reserves an approved Microsoft 365 add-in for document import, export, comments, and versions.','Activation requires institution-owned Entra registration, approved scopes, and a server sync service.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','high','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'education_record',950,true),
  ('integration.canva','Canva connection','integration','Design','Reserves approved slide and image exchange through a Canva application.','Activation requires partner approval, OAuth review, and server retrieval of short-lived exports.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','high','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'education_record',960,true),
  ('integration.cengage','Cengage LTI connection','integration','Learning systems','Reserves partner-managed content placement, course context, roster, and grade return through LTI.','This cannot become active without publisher and institution onboarding credentials and test evidence.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'restricted',970,true),
  ('integration.google_drive','Google Drive connection','integration','Documents','Reserves approved document import and export from institution-managed Google Drive.','Activation requires OAuth consent, minimum scopes, permission mapping, and administrator policy review.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'restricted',980,true),
  ('integration.cloudflare_r2','Cloudflare R2 storage adapter','integration','Files and documents','Reserves private overflow or publication storage through the existing file adapter contract.','Write credentials stay server-side and every object remains subject to EdNotebook metadata and access rules.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'restricted',990,true),
  ('integration.ai_gateway','Institution-approved AI gateway','integration','AI and automation','Routes approved AI requests through a server service with provider, privacy, evaluation, and spending controls.','A no-external-AI option must remain supported. Provider tokens and private course content never belong in browser settings.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform','institution','pathway','course','account' ]::text[],true,true,'integration','critical','planned','block','Turning this off blocks the related action until an authorized administrator restores access. It can affect student, professor, publisher pathways.',null,'restricted',1000,true),
  ('integration.monitoring','Production monitoring','integration','Operations','Collects approved availability, error, job, and security signals without logging student content.','Activation requires a redaction policy, retention period, alerts, ownership, and incident procedures.','boolean','boolean','false'::jsonb,'[]'::jsonb,null,null,array['platform' ]::text[],false,true,'integration','critical','planned','hide','Turning this off hides the feature while preserving its records. It can affect student, professor, publisher pathways.',null,'restricted',1010,true)
on conflict (feature_key) do update set
  display_name=excluded.display_name,
  pathway=excluded.pathway,
  category=excluded.category,
  description=excluded.description,
  help_text=excluded.help_text,
  control_type=excluded.control_type,
  value_type=excluded.value_type,
  default_value=excluded.default_value,
  allowed_values=excluded.allowed_values,
  minimum_value=excluded.minimum_value,
  maximum_value=excluded.maximum_value,
  allowed_scopes=excluded.allowed_scopes,
  institution_delegable=excluded.institution_delegable,
  lockable=excluded.lockable,
  control_class=excluded.control_class,
  risk_level=excluded.risk_level,
  build_status=excluded.build_status,
  disable_behavior=excluded.disable_behavior,
  impact_explanation=excluded.impact_explanation,
  accessibility_notes=excluded.accessibility_notes,
  data_classification=excluded.data_classification,
  sort_order=excluded.sort_order,
  active=excluded.active,
  updated_at=now();

insert into public.feature_dependencies (
  feature_key,depends_on_feature_key,dependency_kind,explanation
) values
  ('shared.institution_selection','shared.authentication','requires','Institution selection uses Account sign-in and should not be enabled without that required control or service.'),
  ('shared.institution_affiliation','shared.institution_selection','requires','Institution affiliation uses Institution selection and should not be enabled without that required control or service.'),
  ('shared.course_access','shared.authentication','requires','Course access uses Account sign-in and should not be enabled without that required control or service.'),
  ('shared.course_access','shared.institution_affiliation','requires','Course access uses Institution affiliation and should not be enabled without that required control or service.'),
  ('shared.people_search','shared.institution_affiliation','requires','People search uses Institution affiliation and should not be enabled without that required control or service.'),
  ('shared.community','shared.authentication','requires','Community spaces uses Account sign-in and should not be enabled without that required control or service.'),
  ('shared.private_files','shared.authentication','requires','Private file storage uses Account sign-in and should not be enabled without that required control or service.'),
  ('shared.private_files','security.row_level_access','requires','Private file storage uses Database access boundaries and should not be enabled without that required control or service.'),
  ('shared.data_export','shared.audit_history','requires','Approved data exports uses Audit history and should not be enabled without that required control or service.'),
  ('shared.retention','shared.audit_history','requires','Retention rules uses Audit history and should not be enabled without that required control or service.'),
  ('shared.ai_assistant','integration.ai_gateway','requires','AI assistant uses Institution-approved AI gateway and should not be enabled without that required control or service.'),
  ('shared.billing','integration.stripe','requires','Paid services uses Stripe billing connection and should not be enabled without that required control or service.'),
  ('student.dashboard','shared.authentication','requires','Student dashboard uses Account sign-in and should not be enabled without that required control or service.'),
  ('student.course_search','shared.institution_selection','requires','Course search uses Institution selection and should not be enabled without that required control or service.'),
  ('student.enrollment','shared.institution_affiliation','requires','Enrollment requests uses Institution affiliation and should not be enabled without that required control or service.'),
  ('student.enrollment','student.course_search','requires','Enrollment requests uses Course search and should not be enabled without that required control or service.'),
  ('student.course_runtime','shared.course_access','requires','Interactive course player uses Course access and should not be enabled without that required control or service.'),
  ('student.assignments','shared.course_access','requires','Student assignments uses Course access and should not be enabled without that required control or service.'),
  ('student.grade_report','shared.course_access','requires','Student grade report uses Course access and should not be enabled without that required control or service.'),
  ('student.community','shared.community','requires','Student community uses Community spaces and should not be enabled without that required control or service.'),
  ('student.community','shared.institution_affiliation','requires','Student community uses Institution affiliation and should not be enabled without that required control or service.'),
  ('student.people_search','shared.people_search','requires','Student people search uses People search and should not be enabled without that required control or service.'),
  ('student.people_search','shared.institution_affiliation','requires','Student people search uses Institution affiliation and should not be enabled without that required control or service.'),
  ('student.messaging','shared.authentication','requires','Student messaging uses Account sign-in and should not be enabled without that required control or service.'),
  ('student.public_page','shared.account_settings','requires','Student profile page uses Account settings and should not be enabled without that required control or service.'),
  ('student.institution_transfer','shared.institution_affiliation','requires','Institution transfer request uses Institution affiliation and should not be enabled without that required control or service.'),
  ('student.institution_transfer','shared.audit_history','requires','Institution transfer request uses Audit history and should not be enabled without that required control or service.'),
  ('professor.dashboard','shared.authentication','requires','Professor dashboard uses Account sign-in and should not be enabled without that required control or service.'),
  ('professor.course_publish','professor.course_builder','requires','Course publishing uses Course builder and should not be enabled without that required control or service.'),
  ('professor.course_publish','shared.audit_history','requires','Course publishing uses Audit history and should not be enabled without that required control or service.'),
  ('professor.assignment_templates','shared.course_access','requires','Assignment templates uses Course access and should not be enabled without that required control or service.'),
  ('professor.roster','shared.institution_affiliation','requires','Roster and account linking uses Institution affiliation and should not be enabled without that required control or service.'),
  ('professor.roster','shared.audit_history','requires','Roster and account linking uses Audit history and should not be enabled without that required control or service.'),
  ('professor.gradebook','security.sensitive_area_reauth','requires','Professor gradebook uses Sensitive-area verification and should not be enabled without that required control or service.'),
  ('professor.gradebook','shared.course_access','requires','Professor gradebook uses Course access and should not be enabled without that required control or service.'),
  ('professor.grade_publish','professor.gradebook','requires','Grade publishing uses Professor gradebook and should not be enabled without that required control or service.'),
  ('professor.grade_publish','shared.audit_history','requires','Grade publishing uses Audit history and should not be enabled without that required control or service.'),
  ('professor.attendance','shared.course_access','requires','Attendance uses Course access and should not be enabled without that required control or service.'),
  ('professor.announcements','shared.community','requires','Professor announcements uses Community spaces and should not be enabled without that required control or service.'),
  ('professor.verification','shared.institution_affiliation','requires','Educator affiliation verification uses Institution affiliation and should not be enabled without that required control or service.'),
  ('professor.verification','security.secure_uploads','requires','Educator affiliation verification uses Secure upload pipeline and should not be enabled without that required control or service.'),
  ('professor.studio_materials','shared.private_files','requires','Learning Studio materials uses Private file storage and should not be enabled without that required control or service.'),
  ('professor.studio_assignments','professor.assignment_templates','requires','Learning Studio assignments uses Assignment templates and should not be enabled without that required control or service.'),
  ('professor.studio_reader','publisher.interactive_reader','requires','Reader and publishing tools uses Interactive reader and should not be enabled without that required control or service.'),
  ('professor.studio_room','shared.course_access','requires','Private course room uses Course access and should not be enabled without that required control or service.'),
  ('publisher.application','shared.authentication','requires','Publisher application uses Account sign-in and should not be enabled without that required control or service.'),
  ('publisher.account_pathway','publisher.application','requires','Publisher account pathway uses Publisher application and should not be enabled without that required control or service.'),
  ('publisher.source_import','publisher.account_pathway','requires','Publication source import uses Publisher account pathway and should not be enabled without that required control or service.'),
  ('publisher.source_import','security.secure_uploads','requires','Publication source import uses Secure upload pipeline and should not be enabled without that required control or service.'),
  ('publisher.conversion','publisher.source_import','requires','EduBook conversion uses Publication source import and should not be enabled without that required control or service.'),
  ('publisher.conversion','integration.railway_worker','requires','EduBook conversion uses Document security worker and should not be enabled without that required control or service.'),
  ('publisher.interactive_reader','shared.course_access','requires','Interactive reader uses Course access and should not be enabled without that required control or service.'),
  ('publisher.editorial_workflow','publisher.conversion','requires','Editorial and accessibility review uses EduBook conversion and should not be enabled without that required control or service.'),
  ('publisher.editorial_workflow','accessibility.reporting','requires','Editorial and accessibility review uses Accessibility reporting and should not be enabled without that required control or service.'),
  ('publisher.course_assignment','publisher.editorial_workflow','requires','Assign publications to courses uses Editorial and accessibility review and should not be enabled without that required control or service.'),
  ('publisher.course_assignment','shared.course_access','requires','Assign publications to courses uses Course access and should not be enabled without that required control or service.'),
  ('publisher.catalog','publisher.editorial_workflow','requires','Publisher catalog uses Editorial and accessibility review and should not be enabled without that required control or service.'),
  ('publisher.commerce','publisher.catalog','requires','Publication purchases and rentals uses Publisher catalog and should not be enabled without that required control or service.'),
  ('publisher.commerce','shared.billing','requires','Publication purchases and rentals uses Paid services and should not be enabled without that required control or service.'),
  ('publisher.analytics','shared.data_export','requires','Publisher analytics uses Approved data exports and should not be enabled without that required control or service.'),
  ('security.secure_uploads','shared.private_files','requires','Secure upload pipeline uses Private file storage and should not be enabled without that required control or service.'),
  ('security.malware_scanning','security.secure_uploads','requires','Malware and archive scanning uses Secure upload pipeline and should not be enabled without that required control or service.'),
  ('security.malware_scanning','integration.railway_worker','requires','Malware and archive scanning uses Document security worker and should not be enabled without that required control or service.'),
  ('security.retention_and_legal_hold','shared.retention','requires','Retention and legal holds uses Retention rules and should not be enabled without that required control or service.'),
  ('security.retention_and_legal_hold','shared.audit_history','requires','Retention and legal holds uses Audit history and should not be enabled without that required control or service.'),
  ('security.admin_change_log','shared.audit_history','requires','Administrative change log uses Audit history and should not be enabled without that required control or service.'),
  ('security.emergency_shutdown','security.admin_change_log','requires','Emergency feature shutdown uses Administrative change log and should not be enabled without that required control or service.'),
  ('accessibility.contrast_mode','theme.account_choice','requires','High-contrast appearance uses Personal theme choice and should not be enabled without that required control or service.'),
  ('accessibility.reporting','shared.audit_history','requires','Accessibility reporting uses Audit history and should not be enabled without that required control or service.'),
  ('theme.platform_campaign','accessibility.reporting','requires','Platform campaign theme uses Accessibility reporting and should not be enabled without that required control or service.'),
  ('theme.platform_lock','theme.account_choice','requires','Theme lock uses Personal theme choice and should not be enabled without that required control or service.'),
  ('integration.supabase_database','security.row_level_access','requires','Supabase database uses Database access boundaries and should not be enabled without that required control or service.'),
  ('integration.supabase_storage','security.secure_uploads','requires','Supabase private storage uses Secure upload pipeline and should not be enabled without that required control or service.'),
  ('integration.blackboard_csv','professor.grade_publish','requires','Blackboard grade CSV uses Grade publishing and should not be enabled without that required control or service.'),
  ('integration.blackboard_csv','shared.audit_history','requires','Blackboard grade CSV uses Audit history and should not be enabled without that required control or service.'),
  ('integration.blackboard_lti_launch','integration.supabase_functions','requires','Blackboard LTI launch uses Supabase server functions and should not be enabled without that required control or service.'),
  ('integration.blackboard_lti_launch','shared.institution_affiliation','requires','Blackboard LTI launch uses Institution affiliation and should not be enabled without that required control or service.'),
  ('integration.blackboard_deep_link','integration.blackboard_lti_launch','requires','Blackboard content placement uses Blackboard LTI launch and should not be enabled without that required control or service.'),
  ('integration.blackboard_nrps','integration.blackboard_lti_launch','requires','Blackboard roster sync uses Blackboard LTI launch and should not be enabled without that required control or service.'),
  ('integration.blackboard_nrps','professor.roster','requires','Blackboard roster sync uses Roster and account linking and should not be enabled without that required control or service.'),
  ('integration.blackboard_ags','integration.blackboard_lti_launch','requires','Blackboard grade passback uses Blackboard LTI launch and should not be enabled without that required control or service.'),
  ('integration.blackboard_ags','professor.grade_publish','requires','Blackboard grade passback uses Grade publishing and should not be enabled without that required control or service.')
on conflict (feature_key,depends_on_feature_key) do update set
  dependency_kind=excluded.dependency_kind,
  explanation=excluded.explanation;

-- These institution-null templates are owned by the platform. The shared
-- baseline also holds security, accessibility, theme, and integration controls.
insert into public.feature_policy_templates (
  id,institution_id,template_key,display_name,pathway,description,owner_managed,active
) values
  ('00000000-0000-4000-8000-000000000101',null,'platform-shared-baseline','Platform shared baseline','shared','Common account, security, accessibility, theme, and integration defaults managed by the platform owner.',true,true),
  ('00000000-0000-4000-8000-000000000102',null,'platform-student-baseline','Platform student baseline','student','Default student-pathway feature values managed by the platform owner.',true,true),
  ('00000000-0000-4000-8000-000000000103',null,'platform-professor-baseline','Platform professor baseline','professor','Default professor-pathway feature values managed by the platform owner.',true,true),
  ('00000000-0000-4000-8000-000000000104',null,'platform-publisher-baseline','Platform publisher baseline','publisher','Default publisher-pathway feature values managed by the platform owner.',true,true)
on conflict (id) do update set
  institution_id=excluded.institution_id,
  template_key=excluded.template_key,
  display_name=excluded.display_name,
  pathway=excluded.pathway,
  description=excluded.description,
  owner_managed=excluded.owner_managed,
  active=excluded.active,
  updated_at=now();

with canonical_features(feature_key) as (
  select unnest(array[
    'shared.authentication',
    'shared.institution_selection',
    'shared.institution_affiliation',
    'shared.course_access',
    'shared.account_settings',
    'shared.people_search',
    'shared.community',
    'shared.private_files',
    'shared.audit_history',
    'shared.data_export',
    'shared.retention',
    'shared.ai_assistant',
    'shared.notifications',
    'shared.billing',
    'student.dashboard',
    'student.course_search',
    'student.enrollment',
    'student.course_runtime',
    'student.assignments',
    'student.grade_report',
    'student.notes',
    'student.community',
    'student.people_search',
    'student.messaging',
    'student.public_page',
    'student.opportunities',
    'student.demo_workspace',
    'student.institution_transfer',
    'professor.dashboard',
    'professor.course_builder',
    'professor.course_publish',
    'professor.assignment_templates',
    'professor.roster',
    'professor.gradebook',
    'professor.grade_publish',
    'professor.attendance',
    'professor.announcements',
    'professor.verification',
    'professor.studio_materials',
    'professor.studio_assignments',
    'professor.studio_tools',
    'professor.studio_reader',
    'professor.studio_slides',
    'professor.studio_room',
    'publisher.application',
    'publisher.account_pathway',
    'publisher.source_import',
    'publisher.conversion',
    'publisher.interactive_reader',
    'publisher.editorial_workflow',
    'publisher.course_assignment',
    'publisher.catalog',
    'publisher.commerce',
    'publisher.analytics',
    'security.row_level_access',
    'security.secure_uploads',
    'security.malware_scanning',
    'security.retention_and_legal_hold',
    'security.sensitive_area_reauth',
    'security.admin_change_log',
    'security.emergency_shutdown',
    'accessibility.keyboard_navigation',
    'accessibility.reduced_motion',
    'accessibility.text_alternatives',
    'accessibility.contrast_mode',
    'accessibility.reporting',
    'theme.course_preset',
    'theme.account_choice',
    'theme.institution_brand',
    'theme.platform_campaign',
    'theme.platform_lock',
    'integration.supabase_auth',
    'integration.supabase_database',
    'integration.supabase_storage',
    'integration.supabase_functions',
    'integration.railway_worker',
    'integration.blackboard_csv',
    'integration.blackboard_lti_launch',
    'integration.blackboard_deep_link',
    'integration.blackboard_nrps',
    'integration.blackboard_ags',
    'integration.blackboard_rest',
    'integration.powerschool',
    'integration.stripe',
    'integration.youtube',
    'integration.microsoft_word',
    'integration.canva',
    'integration.cengage',
    'integration.google_drive',
    'integration.cloudflare_r2',
    'integration.ai_gateway',
    'integration.monitoring'
  ]::text[])
), template_features as (
  select
    case fd.pathway
      when 'student' then '00000000-0000-4000-8000-000000000102'::uuid
      when 'professor' then '00000000-0000-4000-8000-000000000103'::uuid
      when 'publisher' then '00000000-0000-4000-8000-000000000104'::uuid
      else '00000000-0000-4000-8000-000000000101'::uuid
    end as template_id,
    fd.feature_key,
    fd.default_value as control_value,
    (fd.control_type='status_only' or fd.control_class='kernel') as locked
  from public.feature_definitions fd
  join canonical_features cf on cf.feature_key=fd.feature_key
)
insert into public.feature_policy_template_items(template_id,feature_key,control_value,locked)
select template_id,feature_key,control_value,locked from template_features
on conflict (template_id,feature_key) do update set
  control_value=excluded.control_value,
  locked=excluded.locked;

-- Fail the migration instead of silently shipping an incomplete catalog seed.
do $$
declare
  v_feature_count integer;
  v_dependency_count integer;
  v_template_item_count integer;
begin
  select count(distinct fpti.feature_key),count(*)
  into v_feature_count,v_template_item_count
  from public.feature_policy_template_items fpti
  where fpti.template_id in (
    '00000000-0000-4000-8000-000000000101'::uuid,
    '00000000-0000-4000-8000-000000000102'::uuid,
    '00000000-0000-4000-8000-000000000103'::uuid,
    '00000000-0000-4000-8000-000000000104'::uuid
  );

  select count(*) into v_dependency_count
  from public.feature_dependencies fd
  where exists (
    select 1 from public.feature_policy_template_items fpti
    where fpti.feature_key=fd.feature_key
      and fpti.template_id in (
        '00000000-0000-4000-8000-000000000101'::uuid,
        '00000000-0000-4000-8000-000000000102'::uuid,
        '00000000-0000-4000-8000-000000000103'::uuid,
        '00000000-0000-4000-8000-000000000104'::uuid
      )
  );

  if v_feature_count<>92 or v_template_item_count<>92 then
    raise exception 'Canonical feature seed expected 92 definitions and template items, found % and %',v_feature_count,v_template_item_count;
  end if;
  if v_dependency_count<>82 then
    raise exception 'Canonical feature seed expected 82 dependencies, found %',v_dependency_count;
  end if;
end;
$$;


-- A safe, public directory contains names and hierarchy only. A directory entry
-- does not become a tenant or grant access until it is linked to an approved
-- institutions row.
insert into public.institution_directory_entries (
  directory_key, canonical_name, entity_type, education_division, system_name,
  city, region_code, country_code, website_url, academic_domain,
  directory_status, is_selectable, is_public
) values
  ('texas-am-university-system','Texas A&M University System','system','university','Texas A&M University System',null,'TX','US','https://www.tamus.edu','tamus.edu','listed',false,true),
  ('texas-state-university-system','Texas State University System','system','university','Texas State University System',null,'TX','US','https://www.tsus.edu','tsus.edu','listed',false,true),
  ('texas-tech-university-system','Texas Tech University System','system','university','Texas Tech University System',null,'TX','US','https://www.texastech.edu','texastech.edu','verified',false,true),
  ('university-of-houston-system','University of Houston System','system','university','University of Houston System',null,'TX','US','https://www.uhsystem.edu','uhsystem.edu','listed',false,true),
  ('university-of-north-texas-system','University of North Texas System','system','university','University of North Texas System',null,'TX','US','https://www.untsystem.edu','untsystem.edu','listed',false,true),
  ('university-of-texas-system','The University of Texas System','system','university','The University of Texas System',null,'TX','US','https://www.utsystem.edu','utsystem.edu','listed',false,true)
on conflict (directory_key) do nothing;

insert into public.institution_directory_entries (
  directory_key, canonical_name, parent_directory_key, entity_type, education_division,
  system_name, city, region_code, country_code, website_url, academic_domain,
  directory_status, is_selectable, is_public
) values
  ('angelo-state-university','Angelo State University','texas-tech-university-system','university','university','Texas Tech University System','San Angelo','TX','US','https://www.angelo.edu','angelo.edu','verified',true,true),
  ('east-texas-am-university','East Texas A&M University','texas-am-university-system','university','university','Texas A&M University System','Commerce','TX','US','https://www.etamu.edu','etamu.edu','listed',true,true),
  ('houston-community-college','Houston Community College',null,'community_college','university',null,'Houston','TX','US','https://www.hccs.edu','hccs.edu','listed',true,true),
  ('lamar-university','Lamar University','texas-state-university-system','university','university','Texas State University System','Beaumont','TX','US','https://www.lamar.edu','lamar.edu','listed',true,true),
  ('midwestern-state-university','Midwestern State University','texas-tech-university-system','university','university','Texas Tech University System','Wichita Falls','TX','US','https://msutexas.edu','msutexas.edu','listed',true,true),
  ('prairie-view-am-university','Prairie View A&M University','texas-am-university-system','university','university','Texas A&M University System','Prairie View','TX','US','https://www.pvamu.edu','pvamu.edu','listed',true,true),
  ('sam-houston-state-university','Sam Houston State University',null,'university','university',null,'Huntsville','TX','US','https://www.shsu.edu','shsu.edu','listed',true,true),
  ('tarleton-state-university','Tarleton State University','texas-am-university-system','university','university','Texas A&M University System','Stephenville','TX','US','https://www.tarleton.edu','tarleton.edu','listed',true,true),
  ('texas-am-international-university','Texas A&M International University','texas-am-university-system','university','university','Texas A&M University System','Laredo','TX','US','https://www.tamiu.edu','tamiu.edu','listed',true,true),
  ('texas-am-university','Texas A&M University','texas-am-university-system','university','university','Texas A&M University System','College Station','TX','US','https://www.tamu.edu','tamu.edu','listed',true,true),
  ('texas-am-university-central-texas','Texas A&M University-Central Texas','texas-am-university-system','university','university','Texas A&M University System','Killeen','TX','US','https://www.tamuct.edu','tamuct.edu','listed',true,true),
  ('texas-am-university-corpus-christi','Texas A&M University-Corpus Christi','texas-am-university-system','university','university','Texas A&M University System','Corpus Christi','TX','US','https://www.tamucc.edu','tamucc.edu','listed',true,true),
  ('texas-am-university-kingsville','Texas A&M University-Kingsville','texas-am-university-system','university','university','Texas A&M University System','Kingsville','TX','US','https://www.tamuk.edu','tamuk.edu','listed',true,true),
  ('texas-am-university-san-antonio','Texas A&M University-San Antonio','texas-am-university-system','university','university','Texas A&M University System','San Antonio','TX','US','https://www.tamusa.edu','tamusa.edu','listed',true,true),
  ('texas-state-university','Texas State University','texas-state-university-system','university','university','Texas State University System','San Marcos','TX','US','https://www.txst.edu','txst.edu','listed',true,true),
  ('texas-tech-university','Texas Tech University','texas-tech-university-system','university','university','Texas Tech University System','Lubbock','TX','US','https://www.ttu.edu','ttu.edu','listed',true,true),
  ('texas-tech-university-health-sciences-center','Texas Tech University Health Sciences Center','texas-tech-university-system','university','university','Texas Tech University System','Lubbock','TX','US','https://www.ttuhsc.edu','ttuhsc.edu','listed',true,true),
  ('texas-tech-university-health-sciences-center-el-paso','Texas Tech University Health Sciences Center El Paso','texas-tech-university-system','university','university','Texas Tech University System','El Paso','TX','US','https://www.elpaso.ttuhsc.edu','elpaso.ttuhsc.edu','listed',true,true),
  ('university-of-houston','University of Houston','university-of-houston-system','university','university','University of Houston System','Houston','TX','US','https://www.uh.edu','uh.edu','listed',true,true),
  ('university-of-north-texas','University of North Texas','university-of-north-texas-system','university','university','University of North Texas System','Denton','TX','US','https://www.unt.edu','unt.edu','listed',true,true),
  ('university-of-texas-at-arlington','The University of Texas at Arlington','university-of-texas-system','university','university','The University of Texas System','Arlington','TX','US','https://www.uta.edu','uta.edu','listed',true,true),
  ('university-of-texas-at-austin','The University of Texas at Austin','university-of-texas-system','university','university','The University of Texas System','Austin','TX','US','https://www.utexas.edu','utexas.edu','listed',true,true),
  ('university-of-texas-at-san-antonio','The University of Texas at San Antonio','university-of-texas-system','university','university','The University of Texas System','San Antonio','TX','US','https://www.utsa.edu','utsa.edu','listed',true,true),
  ('university-of-texas-rio-grande-valley','The University of Texas Rio Grande Valley','university-of-texas-system','university','university','The University of Texas System','Edinburg','TX','US','https://www.utrgv.edu','utrgv.edu','listed',true,true),
  ('west-texas-am-university','West Texas A&M University','texas-am-university-system','university','university','Texas A&M University System','Canyon','TX','US','https://www.wtamu.edu','wtamu.edu','listed',true,true)
on conflict (directory_key) do nothing;

insert into public.institution_directory_aliases (directory_key,alias_name) values
  ('angelo-state-university','ASU'),
  ('houston-community-college','HCC'),
  ('texas-am-university','Texas A&M'),
  ('texas-tech-university','TTU'),
  ('university-of-texas-at-austin','UT Austin'),
  ('university-of-texas-at-san-antonio','UTSA'),
  ('university-of-texas-rio-grande-valley','UTRGV')
on conflict (directory_key,normalized_alias) do nothing;

insert into public.integration_connections (
  connection_key,provider,display_name,category,pathway,activation_status,health_status,
  institution_controllable,activation_managed_by,connected_to,responsible_team,next_step
) values
  ('github-source','GitHub','GitHub source repository','Source and delivery','admin','active','healthy',false,'external_provider','{source,review,release-history}','Platform owner','Protect main and review every release.'),
  ('github-actions','GitHub Actions','GitHub build and security checks','Source and delivery','admin','active','healthy',false,'external_provider','{github-source,github-pages}','Platform owner','Monitor required checks and dependency updates.'),
  ('github-pages','GitHub Pages','Public EdNotebook web hosting','Hosting','shared','active','healthy',false,'code_deployment','{github-actions,ednotebook-web}','Platform owner','Confirm production-domain and deployment ownership.'),
  ('supabase-auth','Supabase','Supabase account service','Accounts and data','shared','active','healthy',false,'external_provider','{accounts,sessions,ednotebook-web}','Platform owner','Complete institution SSO and MFA review before production.'),
  ('supabase-database','Supabase','Supabase Postgres and row-level access','Accounts and data','admin','active','healthy',false,'external_provider','{institutions,courses,grades,audit}','Platform owner','Run tenant isolation and restore tests for every release.'),
  ('supabase-storage','Supabase','Supabase private storage','Files and documents','shared','setup','unknown',false,'code_deployment','{private-files,secure-upload-functions}','Platform owner','Deploy buckets, functions, scanner, and retention worker; then test.'),
  ('supabase-functions','Supabase','Supabase server functions','Server services','shared','setup','unknown',false,'code_deployment','{storage,lti,retention,link-preview}','Platform owner','Deploy reviewed functions and set secrets outside the browser.'),
  ('railway-worker','Railway','Railway document security worker','Files and documents','shared','setup','unknown',false,'code_deployment','{secure-upload-functions,document-conversion}','Platform owner','Deploy the container, configure the worker secret, and test cleanup.'),
  ('blackboard-csv','Blackboard','Blackboard manual grade CSV','Learning systems','professor','testing','healthy',true,'control_center','{ednotebook-gradebook,blackboard-grade-center}','Institution technology team','Complete non-production reconciliation and handling tests.'),
  ('blackboard-lti','Blackboard','Blackboard LTI 1.3 Advantage','Learning systems','shared','testing','unknown',true,'deployment_evidence','{blackboard,ednotebook-courses,rosters,grades}','Institution technology team','Provide Client ID and Deployment ID, then complete the LTI test plan.'),
  ('blackboard-rest','Blackboard','Blackboard REST API','Learning systems','admin','not_configured','unknown',true,'external_provider','{blackboard-admin-objects}','Institution technology team','Decide whether REST adds approved value beyond LTI and CSV.'),
  ('stripe','Stripe','Stripe billing and entitlement events','Billing','shared','setup','unknown',false,'external_provider','{billing,entitlements}','Platform owner','Complete finance review and live webhook reconciliation.'),
  ('youtube','YouTube','YouTube privacy-enhanced embeds','Media','shared','active','healthy',true,'control_center','{course-materials,youtube-nocookie}','Institution technology team','Review allowed media policy and captions.'),
  ('microsoft-word','Microsoft','Microsoft Word and EduSync','Documents','publisher','not_configured','unknown',true,'external_provider','{document-import,document-export}','Institution technology team','Register and approve the Microsoft add-in before testing.'),
  ('canva','Canva','Canva design exchange','Design','publisher','not_configured','unknown',true,'external_provider','{slide-import,slide-export}','Institution technology team','Complete developer-app and OAuth review.'),
  ('google-drive','Google','Google Drive document exchange','Documents','shared','not_configured','unknown',true,'external_provider','{document-import,document-export}','Institution technology team','Approve OAuth scopes and retention before connecting.'),
  ('cloudflare-r2','Cloudflare','Cloudflare R2 storage adapter','Files and documents','shared','not_configured','unknown',false,'code_deployment','{overflow-storage,publication-assets}','Platform owner','Deploy only if an approved storage need exists.'),
  ('ai-gateway','Institution-approved provider','Approved AI gateway','AI and automation','shared','not_configured','unknown',true,'external_provider','{course-assistance,human-review}','Institution technology team','Approve provider, contract, data rules, and server gateway.'),
  ('monitoring','Institution-approved provider','Production monitoring and alerting','Operations','admin','not_configured','unknown',false,'external_provider','{logs,alerts,incident-response}','Platform owner','Select an approved provider and document redaction rules.')
on conflict do nothing;

insert into public.integration_connection_capabilities (
  connection_id,capability_key,display_name,readiness_status,required_evidence
)
select c.id,v.capability_key,v.display_name,v.readiness_status,v.required_evidence
from public.integration_connections c
join (values
  ('blackboard-lti','oidc_launch','Instructor and learner launch','testing','{"Valid instructor launch","Valid learner launch","Replay rejection"}'::text[]),
  ('blackboard-lti','deep_linking','Content placement','testing','{"Content returned to Blackboard","Mapped resource launch"}'::text[]),
  ('blackboard-lti','nrps','Roster synchronization','testing','{"Approved NRPS scope","Scoped roster reconciliation"}'::text[]),
  ('blackboard-lti','ags','Grade passback','testing','{"Reconciled line item","Professor-confirmed grade","Duplicate retry"}'::text[]),
  ('blackboard-csv','grade_export','Manual grade export','testing','{"Student reconciliation","Column reconciliation","Blackboard re-import"}'::text[]),
  ('supabase-database','tenant_isolation','Institution tenant isolation','testing','{"Cross-institution denial test","Course membership test"}'::text[]),
  ('supabase-database','backup_restore','Backup restoration','testing','{"Encrypted backup","Restore result","Reconciliation counts"}'::text[]),
  ('supabase-storage','retention_delete','Retention and deletion','setup','{"Legal-hold exclusion","Eligible deletion","Audit result"}'::text[])
) as v(connection_key,capability_key,display_name,readiness_status,required_evidence)
  on c.connection_key=v.connection_key and c.institution_id is null
on conflict (connection_id,capability_key) do nothing;
