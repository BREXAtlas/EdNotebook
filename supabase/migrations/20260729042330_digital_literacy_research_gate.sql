-- Fail-closed human-subjects research governance for course-scoped pilots.
-- Ordinary product and course feedback remain outside this schema. Nothing in
-- this migration activates a study or treats enrollment as participation.

create table public.research_pilot_projects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  project_key text not null check (project_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (institution_id, course_id, project_key)
);

create table public.research_pilot_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_pilot_projects(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  supersedes_version_id uuid references public.research_pilot_versions(id) on delete restrict,
  purpose_statement text not null check (char_length(btrim(purpose_statement)) between 20 and 4000),
  research_activities text[] not null,
  data_owner_user_id uuid not null references public.profiles(id) on delete restrict,
  data_owner_name text not null check (char_length(btrim(data_owner_name)) between 3 and 160),
  data_owner_title text not null check (char_length(btrim(data_owner_title)) between 2 and 160),
  data_owner_contact text not null check (
    char_length(btrim(data_owner_contact)) between 5 and 254
    and data_owner_contact ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  effective_at timestamptz not null,
  expires_at timestamptz not null,
  notice_config jsonb not null,
  consent_config jsonb not null,
  minimization_rules jsonb not null,
  retention_days integer not null check (retention_days between 1 and 3650),
  export_rules jsonb not null,
  deletion_rules jsonb not null,
  status text not null default 'draft'
    check (status in ('draft','under_review','approved','active','suspended','expired','superseded')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  activated_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  deactivated_by uuid references public.profiles(id) on delete restrict,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, version_number),
  unique (id, project_id),
  check (effective_at < expires_at),
  check (
    cardinality(research_activities) > 0
    and research_activities <@ array[
      'pre_post_assessment',
      'qualitative_interview',
      'open_ended_survey',
      'learning_effectiveness_analysis'
    ]::text[]
  ),
  check (jsonb_typeof(notice_config) = 'object'),
  check (jsonb_typeof(consent_config) = 'object'),
  check (jsonb_typeof(minimization_rules) = 'object'),
  check (jsonb_typeof(export_rules) = 'object'),
  check (jsonb_typeof(deletion_rules) = 'object'),
  check (
    (status = 'active' and activated_by is not null and activated_at is not null)
    or status <> 'active'
  )
);

create table public.research_pilot_instruments (
  id uuid primary key default gen_random_uuid(),
  pilot_version_id uuid not null references public.research_pilot_versions(id) on delete restrict,
  instrument_key text not null check (instrument_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  instrument_version text not null check (char_length(btrim(instrument_version)) between 1 and 40),
  instrument_kind text not null check (
    instrument_kind in (
      'pre_assessment',
      'post_assessment',
      'qualitative_interview',
      'open_ended_survey',
      'learning_effectiveness_analysis'
    )
  ),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  instrument_definition jsonb not null check (jsonb_typeof(instrument_definition) = 'object'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (pilot_version_id, instrument_key, instrument_version),
  unique (id, pilot_version_id)
);

create table public.research_pilot_approval_records (
  id uuid primary key default gen_random_uuid(),
  pilot_version_id uuid not null references public.research_pilot_versions(id) on delete restrict,
  decision text not null check (decision in ('approved','revoked')),
  determination_type text not null check (
    determination_type in ('exempt','expedited','full_board','not_human_subjects')
  ),
  official_body text not null check (char_length(btrim(official_body)) between 3 and 180),
  protocol_reference text not null check (char_length(btrim(protocol_reference)) between 3 and 120),
  determination_reference text not null check (char_length(btrim(determination_reference)) between 3 and 240),
  documentation_reference text not null check (char_length(btrim(documentation_reference)) between 3 and 500),
  decision_date date not null,
  effective_at timestamptz not null,
  expires_at timestamptz not null,
  consent_requirement text not null check (consent_requirement in ('required','waived_by_written_determination')),
  conditions text not null default '',
  supersedes_approval_id uuid references public.research_pilot_approval_records(id) on delete restrict,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  check (effective_at < expires_at)
);

create table public.research_participation_states (
  pilot_version_id uuid not null references public.research_pilot_versions(id) on delete restrict,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  participation_status text not null check (participation_status in ('consented','declined','withdrawn')),
  notice_version text not null check (char_length(btrim(notice_version)) between 1 and 80),
  consent_record_hash text check (consent_record_hash is null or consent_record_hash ~ '^[a-f0-9]{64}$'),
  choice_recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  export_status text not null default 'not_requested'
    check (export_status in ('not_requested','requested','in_review','completed','denied')),
  deletion_status text not null default 'not_requested'
    check (deletion_status in ('not_requested','requested','in_review','completed','denied')),
  updated_at timestamptz not null default now(),
  primary key (pilot_version_id, participant_id),
  check (
    (participation_status = 'consented' and consent_record_hash is not null and withdrawn_at is null)
    or (participation_status = 'withdrawn' and withdrawn_at is not null)
    or participation_status = 'declined'
  )
);

create table public.research_subject_requests (
  id uuid primary key default gen_random_uuid(),
  pilot_version_id uuid not null references public.research_pilot_versions(id) on delete restrict,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  request_type text not null check (request_type in ('withdrawal','export','deletion')),
  status text not null default 'requested' check (status in ('requested','in_review','completed','denied')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolution_note text not null default '',
  check (
    (status in ('requested','in_review') and resolved_at is null and resolved_by is null)
    or (status in ('completed','denied') and resolved_at is not null and resolved_by is not null)
  )
);

create table public.research_response_records (
  id uuid primary key default gen_random_uuid(),
  pilot_version_id uuid not null,
  instrument_id uuid not null,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  response_payload jsonb,
  response_hash text not null check (response_hash ~ '^[a-f0-9]{64}$'),
  submitted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  deleted_at timestamptz,
  unique (instrument_id, participant_id),
  foreign key (instrument_id, pilot_version_id)
    references public.research_pilot_instruments(id, pilot_version_id) on delete restrict,
  check (response_payload is null or jsonb_typeof(response_payload) = 'object'),
  check (deleted_at is null or response_payload is null)
);

create index research_pilot_projects_scope_idx
  on public.research_pilot_projects(institution_id, course_id, created_at desc);
create index research_pilot_projects_course_idx
  on public.research_pilot_projects(course_id);
create index research_pilot_projects_created_by_idx
  on public.research_pilot_projects(created_by);
create index research_pilot_versions_project_status_idx
  on public.research_pilot_versions(project_id, status, version_number desc);
create index research_pilot_versions_supersedes_idx
  on public.research_pilot_versions(supersedes_version_id)
  where supersedes_version_id is not null;
create index research_pilot_versions_data_owner_idx
  on public.research_pilot_versions(data_owner_user_id);
create index research_pilot_versions_created_by_idx
  on public.research_pilot_versions(created_by);
create index research_pilot_versions_activated_by_idx
  on public.research_pilot_versions(activated_by)
  where activated_by is not null;
create index research_pilot_versions_deactivated_by_idx
  on public.research_pilot_versions(deactivated_by)
  where deactivated_by is not null;
create index research_pilot_instruments_version_idx
  on public.research_pilot_instruments(pilot_version_id, instrument_kind);
create index research_pilot_instruments_created_by_idx
  on public.research_pilot_instruments(created_by);
create index research_pilot_approval_latest_idx
  on public.research_pilot_approval_records(pilot_version_id, recorded_at desc, id desc);
create index research_pilot_approval_supersedes_idx
  on public.research_pilot_approval_records(supersedes_approval_id)
  where supersedes_approval_id is not null;
create index research_pilot_approval_recorded_by_idx
  on public.research_pilot_approval_records(recorded_by);
create index research_participation_states_participant_idx
  on public.research_participation_states(participant_id, updated_at desc);
create index research_subject_requests_scope_idx
  on public.research_subject_requests(pilot_version_id, participant_id, requested_at desc);
create index research_subject_requests_participant_idx
  on public.research_subject_requests(participant_id, requested_at desc);
create index research_subject_requests_resolved_by_idx
  on public.research_subject_requests(resolved_by)
  where resolved_by is not null;
create unique index research_subject_requests_one_open_idx
  on public.research_subject_requests(pilot_version_id, participant_id, request_type)
  where status in ('requested','in_review');
create index research_response_records_version_idx
  on public.research_response_records(pilot_version_id, participant_id, submitted_at desc);
create index research_response_records_participant_idx
  on public.research_response_records(participant_id, submitted_at desc);

insert into public.feature_definitions (
  feature_key, display_name, pathway, category, description, help_text,
  control_type, value_type, default_value, allowed_values,
  allowed_scopes, institution_delegable, lockable, control_class,
  risk_level, build_status, disable_behavior, impact_explanation,
  data_classification, sort_order, active
) values (
  'research.human_subjects_collection',
  'Human-subjects research collection',
  'shared',
  'Governance',
  'Permits an institution- and course-scoped research pilot to collect only the approved instrument version after every independent research gate passes.',
  'This switch never grants approval by itself. A written institutional determination, current project version, explicit activation, participant choice, and database gate are still required.',
  'boolean',
  'boolean',
  'false'::jsonb,
  '[]'::jsonb,
  array['platform','institution','course']::text[],
  true,
  true,
  'ordinary',
  'critical',
  'pilot_testing',
  'block',
  'Turning this off immediately stops new research responses while leaving ordinary product feedback and course use available.',
  'restricted',
  205,
  true
)
on conflict (feature_key) do update set
  display_name = excluded.display_name,
  pathway = excluded.pathway,
  category = excluded.category,
  description = excluded.description,
  help_text = excluded.help_text,
  control_type = excluded.control_type,
  value_type = excluded.value_type,
  default_value = excluded.default_value,
  allowed_values = excluded.allowed_values,
  allowed_scopes = excluded.allowed_scopes,
  institution_delegable = excluded.institution_delegable,
  lockable = excluded.lockable,
  control_class = excluded.control_class,
  risk_level = excluded.risk_level,
  build_status = excluded.build_status,
  disable_behavior = excluded.disable_behavior,
  impact_explanation = excluded.impact_explanation,
  data_classification = excluded.data_classification,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

insert into public.feature_dependencies (
  feature_key, depends_on_feature_key, dependency_kind, explanation
) values
  (
    'research.human_subjects_collection',
    'shared.audit_history',
    'requires',
    'Every approval, activation, participation choice, response envelope, withdrawal, export request, and deletion request must remain auditable.'
  ),
  (
    'research.human_subjects_collection',
    'shared.retention',
    'requires',
    'A research version must define bounded retention and deletion rules before collection can activate.'
  )
on conflict (feature_key, depends_on_feature_key) do update set
  dependency_kind = excluded.dependency_kind,
  explanation = excluded.explanation;

create or replace function private.can_view_research_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.research_pilot_projects rp
    where rp.id = p_project_id
      and (
        private.is_platform_owner((select auth.uid()))
        or private.has_institution_capability(
          rp.institution_id,
          'view_audit',
          (select auth.uid())
        )
        or private.can_manage_course(rp.course_id)
      )
  );
$$;

create or replace function private.can_govern_research_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.research_pilot_projects rp
    where rp.id = p_project_id
      and (
        private.is_platform_owner((select auth.uid()))
        or (
          private.is_institution_manager(rp.institution_id, (select auth.uid()))
          and private.has_institution_capability(
            rp.institution_id,
            'manage_retention',
            (select auth.uid())
          )
        )
      )
  );
$$;

create or replace function private.can_view_research_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.research_pilot_versions rv
    where rv.id = p_version_id
      and private.can_view_research_project(rv.project_id)
  );
$$;

create or replace function private.is_research_participant(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.research_participation_states ps
    where ps.pilot_version_id = p_version_id
      and ps.participant_id = (select auth.uid())
  );
$$;

create or replace function private.research_contract_fields_are_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.project_id is distinct from new.project_id
    or old.version_number is distinct from new.version_number
    or old.supersedes_version_id is distinct from new.supersedes_version_id
    or old.purpose_statement is distinct from new.purpose_statement
    or old.research_activities is distinct from new.research_activities
    or old.data_owner_user_id is distinct from new.data_owner_user_id
    or old.data_owner_name is distinct from new.data_owner_name
    or old.data_owner_title is distinct from new.data_owner_title
    or old.data_owner_contact is distinct from new.data_owner_contact
    or old.effective_at is distinct from new.effective_at
    or old.expires_at is distinct from new.expires_at
    or old.notice_config is distinct from new.notice_config
    or old.consent_config is distinct from new.consent_config
    or old.minimization_rules is distinct from new.minimization_rules
    or old.retention_days is distinct from new.retention_days
    or old.export_rules is distinct from new.export_rules
    or old.deletion_rules is distinct from new.deletion_rules
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'Research contract fields are immutable; create a new project version';
  end if;
  return new;
end;
$$;

create or replace function private.research_append_only_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Research instruments and determinations are append-only; create a new version or decision record';
end;
$$;

create or replace function private.research_instrument_requires_draft_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.research_pilot_versions rv
    where rv.id = new.pilot_version_id
      and rv.status = 'draft'
  ) then
    raise exception 'Instrument changes require a new draft research project version';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_research_participation_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is distinct from new.participant_id then
      raise exception 'Only the participant can record a research participation choice';
    end if;
  elsif old.participation_status is distinct from new.participation_status
    or old.notice_version is distinct from new.notice_version
    or old.consent_record_hash is distinct from new.consent_record_hash
    or old.choice_recorded_at is distinct from new.choice_recorded_at
    or old.withdrawn_at is distinct from new.withdrawn_at then
    if (select auth.uid()) is distinct from new.participant_id then
      raise exception 'Only the participant can change a research participation choice';
    end if;
  end if;
  return new;
end;
$$;

create trigger research_pilot_versions_contract_immutable
before update on public.research_pilot_versions
for each row execute function private.research_contract_fields_are_immutable();

create trigger research_pilot_instruments_append_only
before update or delete on public.research_pilot_instruments
for each row execute function private.research_append_only_record();

create trigger research_pilot_instruments_draft_version
before insert on public.research_pilot_instruments
for each row execute function private.research_instrument_requires_draft_version();

create trigger research_pilot_approvals_append_only
before update or delete on public.research_pilot_approval_records
for each row execute function private.research_append_only_record();

create trigger research_participation_states_actor
before insert or update on public.research_participation_states
for each row execute function private.enforce_research_participation_actor();

create trigger research_participation_states_touch_updated_at
before update on public.research_participation_states
for each row execute function private.touch_updated_at();

create or replace function private.research_version_blockers(
  p_version_id uuid,
  p_require_activation boolean default true,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
  v_approval public.research_pilot_approval_records%rowtype;
  v_blockers jsonb := '[]'::jsonb;
  v_consent_mode text;
  v_feature_enabled boolean := false;
begin
  select * into v_version
  from public.research_pilot_versions
  where id = p_version_id;
  if not found then
    return jsonb_build_array('version_not_found');
  end if;

  select * into v_project
  from public.research_pilot_projects
  where id = v_version.project_id;

  select * into v_approval
  from public.research_pilot_approval_records
  where pilot_version_id = v_version.id
  order by recorded_at desc, id desc
  limit 1;

  if p_require_activation and v_version.status <> 'active' then
    v_blockers := v_blockers || '"explicit_activation_missing"'::jsonb;
  elsif not p_require_activation and v_version.status not in ('approved','active') then
    v_blockers := v_blockers || '"written_determination_not_recorded"'::jsonb;
  end if;

  if v_version.effective_at > p_at then
    v_blockers := v_blockers || '"project_not_yet_effective"'::jsonb;
  end if;
  if v_version.expires_at <= p_at then
    v_blockers := v_blockers || '"project_expired"'::jsonb;
  end if;

  if v_approval.id is null or v_approval.decision <> 'approved' then
    v_blockers := v_blockers || '"written_determination_missing_or_revoked"'::jsonb;
  else
    if v_approval.effective_at > p_at then
      v_blockers := v_blockers || '"determination_not_yet_effective"'::jsonb;
    end if;
    if v_approval.expires_at <= p_at then
      v_blockers := v_blockers || '"determination_expired"'::jsonb;
    end if;
    v_consent_mode := v_version.consent_config->>'mode';
    if v_consent_mode is distinct from v_approval.consent_requirement then
      v_blockers := v_blockers || '"consent_configuration_mismatch"'::jsonb;
    end if;
  end if;

  if coalesce(v_version.notice_config->>'version', '') = ''
    or coalesce(v_version.notice_config->>'participant_notice', '') = '' then
    v_blockers := v_blockers || '"participant_notice_incomplete"'::jsonb;
  end if;

  if coalesce(v_version.consent_config->>'mode', '') not in (
    'required',
    'waived_by_written_determination'
  ) then
    v_blockers := v_blockers || '"consent_configuration_incomplete"'::jsonb;
  end if;

  if coalesce(v_version.minimization_rules->>'collection_limit', '') = ''
    or coalesce(v_version.export_rules->>'mode', '') = ''
    or coalesce(v_version.deletion_rules->>'request_process', '') = '' then
    v_blockers := v_blockers || '"data_governance_rules_incomplete"'::jsonb;
  end if;

  if not exists (
    select 1
    from public.courses c
    left join public.course_memberships cm
      on cm.course_id = c.id
      and cm.user_id = v_version.data_owner_user_id
      and cm.role in ('owner','admin','professor')
    where c.id = v_project.course_id
      and (
        c.owner_id = v_version.data_owner_user_id
        or (
          cm.user_id is not null
          and private.course_membership_is_current(cm.course_id, cm.user_id, cm.role)
        )
      )
  ) then
    v_blockers := v_blockers || '"data_owner_not_current_for_course"'::jsonb;
  end if;

  if not exists (
    select 1
    from public.research_pilot_instruments i
    where i.pilot_version_id = v_version.id
  ) then
    v_blockers := v_blockers || '"instrument_version_missing"'::jsonb;
  end if;

  if 'pre_post_assessment' = any(v_version.research_activities)
    and (
      not exists (
        select 1 from public.research_pilot_instruments i
        where i.pilot_version_id = v_version.id and i.instrument_kind = 'pre_assessment'
      )
      or not exists (
        select 1 from public.research_pilot_instruments i
        where i.pilot_version_id = v_version.id and i.instrument_kind = 'post_assessment'
      )
    ) then
    v_blockers := v_blockers || '"paired_pre_post_instruments_required"'::jsonb;
  end if;

  if 'qualitative_interview' = any(v_version.research_activities)
    and not exists (
      select 1 from public.research_pilot_instruments i
      where i.pilot_version_id = v_version.id and i.instrument_kind = 'qualitative_interview'
    ) then
    v_blockers := v_blockers || '"qualitative_instrument_required"'::jsonb;
  end if;

  if 'open_ended_survey' = any(v_version.research_activities)
    and not exists (
      select 1 from public.research_pilot_instruments i
      where i.pilot_version_id = v_version.id and i.instrument_kind = 'open_ended_survey'
    ) then
    v_blockers := v_blockers || '"open_ended_instrument_required"'::jsonb;
  end if;

  select coalesce(
    (
      private.resolve_feature_control(
        'research.human_subjects_collection',
        'student',
        v_project.institution_id,
        v_project.course_id,
        null,
        p_at
      )->>'value'
    )::boolean,
    false
  ) into v_feature_enabled;

  if not v_feature_enabled then
    v_blockers := v_blockers || '"course_research_feature_disabled"'::jsonb;
  end if;

  return v_blockers;
end;
$$;

create or replace function private.research_collection_is_allowed(
  p_version_id uuid,
  p_participant_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_participant_id is not null
    and private.research_version_blockers(p_version_id, true, p_at) = '[]'::jsonb
    and exists (
      select 1
      from public.research_pilot_versions rv
      join public.research_pilot_projects rp on rp.id = rv.project_id
      join public.course_memberships cm
        on cm.course_id = rp.course_id
        and cm.user_id = p_participant_id
        and cm.role = 'learner'
      join public.research_participation_states ps
        on ps.pilot_version_id = rv.id
        and ps.participant_id = p_participant_id
      where rv.id = p_version_id
        and ps.participation_status = 'consented'
        and ps.withdrawn_at is null
        and ps.deletion_status not in ('requested','in_review')
        and private.course_membership_is_current(cm.course_id, cm.user_id, cm.role)
    );
$$;

create or replace function private.enforce_research_response_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_definition jsonb;
begin
  if new.participant_id is null
    or not private.research_collection_is_allowed(
      new.pilot_version_id,
      new.participant_id,
      coalesce(new.submitted_at, now())
    ) then
    raise exception 'Research response collection is not active for this participant and version';
  end if;

  select instrument_definition into v_definition
  from public.research_pilot_instruments
  where id = new.instrument_id
    and pilot_version_id = new.pilot_version_id;

  if v_definition is null
    or jsonb_typeof(v_definition->'allowed_response_fields') <> 'array'
    or jsonb_array_length(v_definition->'allowed_response_fields') = 0 then
    raise exception 'The approved instrument does not declare allowed response fields';
  end if;

  if new.response_payload is null
    or jsonb_typeof(new.response_payload) <> 'object'
    or octet_length(new.response_payload::text) > 65536 then
    raise exception 'Research response payload must be a bounded JSON object';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(new.response_payload) as response_field(field_name)
    where not (v_definition->'allowed_response_fields' ? response_field.field_name)
      or response_field.field_name ~* '(^|_)(email|name|student_id|account_id|phone|address)($|_)'
  ) then
    raise exception 'Research response includes a field outside the approved minimized instrument';
  end if;

  if exists (
    select 1
    from jsonb_each(new.response_payload) as response_value(field_name, field_value)
    where jsonb_typeof(response_value.field_value) = 'object'
      or (
        jsonb_typeof(response_value.field_value) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(response_value.field_value) as array_value(value)
          where jsonb_typeof(array_value.value) in ('object', 'array')
        )
      )
  ) then
    raise exception 'Research response values must use the approved flat minimized shape';
  end if;

  return new;
end;
$$;

create trigger research_response_records_gate
before insert on public.research_response_records
for each row execute function private.enforce_research_response_gate();

alter table public.research_pilot_projects enable row level security;
alter table public.research_pilot_versions enable row level security;
alter table public.research_pilot_instruments enable row level security;
alter table public.research_pilot_approval_records enable row level security;
alter table public.research_participation_states enable row level security;
alter table public.research_subject_requests enable row level security;
alter table public.research_response_records enable row level security;

revoke all on
  public.research_pilot_projects,
  public.research_pilot_versions,
  public.research_pilot_instruments,
  public.research_pilot_approval_records,
  public.research_participation_states,
  public.research_subject_requests,
  public.research_response_records
from public, anon, authenticated;

grant select on
  public.research_pilot_projects,
  public.research_pilot_versions,
  public.research_pilot_instruments,
  public.research_pilot_approval_records,
  public.research_participation_states,
  public.research_subject_requests
to authenticated;

create policy research_pilot_projects_select
on public.research_pilot_projects for select to authenticated
using (private.can_view_research_project(id));

create policy research_pilot_versions_select
on public.research_pilot_versions for select to authenticated
using (
  private.can_view_research_version(id)
  or private.is_research_participant(id)
);

create policy research_pilot_instruments_select
on public.research_pilot_instruments for select to authenticated
using (
  private.can_view_research_version(pilot_version_id)
  or private.is_research_participant(pilot_version_id)
);

create policy research_pilot_approvals_select
on public.research_pilot_approval_records for select to authenticated
using (private.can_view_research_version(pilot_version_id));

create policy research_participation_states_select
on public.research_participation_states for select to authenticated
using (
  participant_id = (select auth.uid())
  or private.can_view_research_version(pilot_version_id)
);

create policy research_subject_requests_select
on public.research_subject_requests for select to authenticated
using (
  participant_id = (select auth.uid())
  or private.can_view_research_version(pilot_version_id)
);

create policy research_response_records_select
on public.research_response_records for select to authenticated
using (
  participant_id = (select auth.uid())
  or private.can_view_research_version(pilot_version_id)
);

create or replace function public.get_research_pilot_gate_status(
  p_institution_id uuid default null,
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
  v_projects jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_institution_id is null and not private.is_platform_owner(v_user_id) then
    raise exception 'Choose an authorized institution research scope';
  end if;

  select coalesce(jsonb_agg(project_status order by project_status->>'title'), '[]'::jsonb)
  into v_projects
  from (
    select jsonb_build_object(
      'project_id', rp.id,
      'project_key', rp.project_key,
      'title', rp.title,
      'institution_id', rp.institution_id,
      'course_id', rp.course_id,
      'course_title', c.title,
      'version_id', rv.id,
      'version_number', rv.version_number,
      'purpose_statement', rv.purpose_statement,
      'research_activities', rv.research_activities,
      'data_owner', jsonb_build_object(
        'name', rv.data_owner_name,
        'title', rv.data_owner_title,
        'contact', rv.data_owner_contact
      ),
      'effective_at', rv.effective_at,
      'expires_at', rv.expires_at,
      'status', rv.status,
      'activated_at', rv.activated_at,
      'blockers', private.research_version_blockers(rv.id, true, now()),
      'latest_determination', (
        select jsonb_build_object(
          'decision', ar.decision,
          'determination_type', ar.determination_type,
          'official_body', ar.official_body,
          'protocol_reference', ar.protocol_reference,
          'decision_date', ar.decision_date,
          'effective_at', ar.effective_at,
          'expires_at', ar.expires_at
        )
        from public.research_pilot_approval_records ar
        where ar.pilot_version_id = rv.id
        order by ar.recorded_at desc, ar.id desc
        limit 1
      ),
      'instruments', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'instrument_key', i.instrument_key,
          'instrument_version', i.instrument_version,
          'instrument_kind', i.instrument_kind,
          'title', i.title,
          'content_hash', i.content_hash
        ) order by i.instrument_kind, i.instrument_key), '[]'::jsonb)
        from public.research_pilot_instruments i
        where i.pilot_version_id = rv.id
      )
    ) as project_status
    from public.research_pilot_projects rp
    join public.courses c on c.id = rp.course_id
    left join lateral (
      select version_row.*
      from public.research_pilot_versions version_row
      where version_row.project_id = rp.id
      order by version_row.version_number desc
      limit 1
    ) rv on true
    where (p_institution_id is null or rp.institution_id = p_institution_id)
      and (p_course_id is null or rp.course_id = p_course_id)
      and private.can_view_research_project(rp.id)
  ) visible_projects;

  return jsonb_build_object(
    'mode', 'research',
    'default_status', 'not_activated',
    'ordinary_feedback_unchanged', true,
    'projects', v_projects
  );
end;
$$;

create or replace function public.create_research_pilot_version(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_project public.research_pilot_projects%rowtype;
  v_version public.research_pilot_versions%rowtype;
  v_instrument jsonb;
  v_instrument_count integer := 0;
  v_project_id uuid := nullif(p_input->>'project_id', '')::uuid;
  v_institution_id uuid := nullif(p_input->>'institution_id', '')::uuid;
  v_course_id uuid := nullif(p_input->>'course_id', '')::uuid;
  v_data_owner_id uuid := nullif(p_input->>'data_owner_user_id', '')::uuid;
  v_prior_version_id uuid;
  v_version_number integer;
  v_activities text[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'Research project version input must be an object';
  end if;

  if v_project_id is null then
    if v_institution_id is null or v_course_id is null then
      raise exception 'Institution and course scope are required';
    end if;
    if not private.can_manage_course(v_course_id) then
      raise exception 'Course management access required';
    end if;
    if not exists (
      select 1 from public.courses c
      where c.id = v_course_id and c.institution_id = v_institution_id
    ) then
      raise exception 'Course does not belong to the selected institution';
    end if;
    if coalesce(p_input->>'project_key', '') !~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
      or char_length(btrim(coalesce(p_input->>'title', ''))) < 3 then
      raise exception 'A stable project key and title are required';
    end if;
    insert into public.research_pilot_projects (
      institution_id, course_id, project_key, title, created_by
    ) values (
      v_institution_id,
      v_course_id,
      p_input->>'project_key',
      btrim(p_input->>'title'),
      v_user_id
    )
    returning * into v_project;
    v_version_number := 1;
    v_prior_version_id := null;
  else
    select * into v_project
    from public.research_pilot_projects
    where id = v_project_id
    for update;
    if not found or not private.can_manage_course(v_project.course_id) then
      raise exception 'Research project version access denied';
    end if;
    select rv.id, rv.version_number + 1
    into v_prior_version_id, v_version_number
    from public.research_pilot_versions rv
    where rv.project_id = v_project.id
    order by rv.version_number desc
    limit 1;
    v_version_number := coalesce(v_version_number, 1);
  end if;

  if char_length(btrim(coalesce(p_input->>'purpose_statement', ''))) < 20 then
    raise exception 'A specific research purpose is required';
  end if;
  if jsonb_typeof(p_input->'research_activities') <> 'array' then
    raise exception 'Research activities must be an array';
  end if;
  select coalesce(array_agg(activity), '{}'::text[])
  into v_activities
  from jsonb_array_elements_text(p_input->'research_activities') activity;
  if cardinality(v_activities) = 0
    or not v_activities <@ array[
      'pre_post_assessment',
      'qualitative_interview',
      'open_ended_survey',
      'learning_effectiveness_analysis'
    ]::text[] then
    raise exception 'Research activities are missing or unsupported';
  end if;
  if v_data_owner_id is null
    or char_length(btrim(coalesce(p_input->>'data_owner_name', ''))) < 3
    or char_length(btrim(coalesce(p_input->>'data_owner_title', ''))) < 2
    or coalesce(p_input->>'data_owner_contact', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A named data owner and contact are required';
  end if;
  if jsonb_typeof(p_input->'notice_config') <> 'object'
    or jsonb_typeof(p_input->'consent_config') <> 'object'
    or jsonb_typeof(p_input->'minimization_rules') <> 'object'
    or jsonb_typeof(p_input->'export_rules') <> 'object'
    or jsonb_typeof(p_input->'deletion_rules') <> 'object' then
    raise exception 'Notice, consent, minimization, export, and deletion rules are required';
  end if;
  if jsonb_typeof(p_input->'instruments') <> 'array'
    or jsonb_array_length(p_input->'instruments') = 0 then
    raise exception 'At least one versioned instrument is required';
  end if;

  insert into public.research_pilot_versions (
    project_id, version_number, supersedes_version_id,
    purpose_statement, research_activities,
    data_owner_user_id, data_owner_name, data_owner_title, data_owner_contact,
    effective_at, expires_at, notice_config, consent_config,
    minimization_rules, retention_days, export_rules, deletion_rules,
    status, created_by
  ) values (
    v_project.id,
    v_version_number,
    v_prior_version_id,
    btrim(p_input->>'purpose_statement'),
    v_activities,
    v_data_owner_id,
    btrim(p_input->>'data_owner_name'),
    btrim(p_input->>'data_owner_title'),
    lower(btrim(p_input->>'data_owner_contact')),
    (p_input->>'effective_at')::timestamptz,
    (p_input->>'expires_at')::timestamptz,
    p_input->'notice_config',
    p_input->'consent_config',
    p_input->'minimization_rules',
    (p_input->>'retention_days')::integer,
    p_input->'export_rules',
    p_input->'deletion_rules',
    'draft',
    v_user_id
  )
  returning * into v_version;

  for v_instrument in
    select value from jsonb_array_elements(p_input->'instruments')
  loop
    if coalesce(v_instrument->>'instrument_key', '') !~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
      or coalesce(v_instrument->>'instrument_kind', '') not in (
        'pre_assessment',
        'post_assessment',
        'qualitative_interview',
        'open_ended_survey',
        'learning_effectiveness_analysis'
      )
      or char_length(btrim(coalesce(v_instrument->>'instrument_version', ''))) < 1
      or char_length(btrim(coalesce(v_instrument->>'title', ''))) < 3
      or jsonb_typeof(v_instrument->'instrument_definition') <> 'object'
      or jsonb_typeof(v_instrument->'instrument_definition'->'allowed_response_fields') <> 'array'
      or jsonb_array_length(v_instrument->'instrument_definition'->'allowed_response_fields') = 0 then
      raise exception 'Each instrument requires a key, version, kind, title, and allowed response fields';
    end if;

    insert into public.research_pilot_instruments (
      pilot_version_id, instrument_key, instrument_version, instrument_kind,
      title, instrument_definition, content_hash, created_by
    ) values (
      v_version.id,
      v_instrument->>'instrument_key',
      btrim(v_instrument->>'instrument_version'),
      v_instrument->>'instrument_kind',
      btrim(v_instrument->>'title'),
      v_instrument->'instrument_definition',
      encode(
        extensions.digest((v_instrument->'instrument_definition')::text, 'sha256'),
        'hex'
      ),
      v_user_id
    );
    v_instrument_count := v_instrument_count + 1;
  end loop;

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id,
    details, event_hash
  ) values (
    v_user_id,
    v_project.institution_id,
    v_project.course_id,
    'research.project_version_created',
    'research_pilot_version',
    v_version.id::text,
    jsonb_build_object(
      'project_id', v_project.id,
      'version_number', v_version.version_number,
      'instrument_count', v_instrument_count,
      'status', v_version.status
    ),
    ''
  );

  return jsonb_build_object(
    'project_id', v_project.id,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'status', v_version.status,
    'activated', false
  );
end;
$$;

create or replace function public.record_research_pilot_determination(
  p_version_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
  v_record public.research_pilot_approval_records%rowtype;
  v_previous_id uuid;
  v_decision text := coalesce(p_input->>'decision', '');
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  select * into v_version
  from public.research_pilot_versions
  where id = p_version_id
  for update;
  if not found then
    raise exception 'Research project version not found';
  end if;
  select * into v_project
  from public.research_pilot_projects
  where id = v_version.project_id;
  if not private.can_govern_research_project(v_project.id) then
    raise exception 'Institution research governance access required';
  end if;
  if v_decision not in ('approved','revoked') then
    raise exception 'Determination decision must be approved or revoked';
  end if;
  if coalesce(p_input->>'determination_type', '') not in (
    'exempt',
    'expedited',
    'full_board',
    'not_human_subjects'
  )
    or char_length(btrim(coalesce(p_input->>'official_body', ''))) < 3
    or lower(btrim(coalesce(p_input->>'protocol_reference', ''))) in ('', 'tbd', 'pending', 'example', 'demo')
    or lower(btrim(coalesce(p_input->>'determination_reference', ''))) in ('', 'tbd', 'pending', 'example', 'demo')
    or lower(btrim(coalesce(p_input->>'documentation_reference', ''))) in ('', 'tbd', 'pending', 'example', 'demo')
    or coalesce(p_input->>'consent_requirement', '') not in (
      'required',
      'waived_by_written_determination'
    ) then
    raise exception 'Complete written determination details are required';
  end if;

  select id into v_previous_id
  from public.research_pilot_approval_records
  where pilot_version_id = p_version_id
  order by recorded_at desc, id desc
  limit 1;

  insert into public.research_pilot_approval_records (
    pilot_version_id, decision, determination_type, official_body,
    protocol_reference, determination_reference, documentation_reference,
    decision_date, effective_at, expires_at, consent_requirement,
    conditions, supersedes_approval_id, recorded_by
  ) values (
    p_version_id,
    v_decision,
    p_input->>'determination_type',
    btrim(p_input->>'official_body'),
    btrim(p_input->>'protocol_reference'),
    btrim(p_input->>'determination_reference'),
    btrim(p_input->>'documentation_reference'),
    (p_input->>'decision_date')::date,
    (p_input->>'effective_at')::timestamptz,
    (p_input->>'expires_at')::timestamptz,
    p_input->>'consent_requirement',
    left(coalesce(p_input->>'conditions', ''), 4000),
    v_previous_id,
    v_user_id
  )
  returning * into v_record;

  update public.research_pilot_versions
  set status = case
      when v_decision = 'approved' then 'approved'
      else 'suspended'
    end,
    deactivated_by = case when v_decision = 'revoked' then v_user_id else deactivated_by end,
    deactivated_at = case when v_decision = 'revoked' then now() else deactivated_at end
  where id = p_version_id;

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id,
    details, event_hash
  ) values (
    v_user_id,
    v_project.institution_id,
    v_project.course_id,
    case
      when v_decision = 'approved' then 'research.determination_recorded'
      else 'research.determination_revoked'
    end,
    'research_pilot_approval_record',
    v_record.id::text,
    jsonb_build_object(
      'version_id', p_version_id,
      'decision', v_record.decision,
      'determination_type', v_record.determination_type,
      'official_body', v_record.official_body,
      'protocol_reference', v_record.protocol_reference,
      'effective_at', v_record.effective_at,
      'expires_at', v_record.expires_at
    ),
    ''
  );

  return jsonb_build_object(
    'record_id', v_record.id,
    'version_id', p_version_id,
    'decision', v_record.decision,
    'activated', false
  );
end;
$$;

create or replace function public.activate_research_pilot_version(
  p_version_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
  v_blockers jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_confirmation is distinct from 'ACTIVATE RESEARCH PILOT' then
    raise exception 'Explicit activation confirmation is required';
  end if;

  select * into v_version
  from public.research_pilot_versions
  where id = p_version_id
  for update;
  if not found then
    raise exception 'Research project version not found';
  end if;
  select * into v_project
  from public.research_pilot_projects
  where id = v_version.project_id;
  if not private.can_govern_research_project(v_project.id) then
    raise exception 'Institution research governance access required';
  end if;

  v_blockers := private.research_version_blockers(p_version_id, false, now());
  if v_blockers <> '[]'::jsonb then
    raise exception 'Research pilot activation is blocked: %', v_blockers::text;
  end if;

  update public.research_pilot_versions
  set status = 'superseded',
      deactivated_by = v_user_id,
      deactivated_at = now()
  where project_id = v_project.id
    and id <> p_version_id
    and status = 'active';

  update public.research_pilot_versions
  set status = 'active',
      activated_by = v_user_id,
      activated_at = now(),
      deactivated_by = null,
      deactivated_at = null
  where id = p_version_id
  returning * into v_version;

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id,
    details, event_hash
  ) values (
    v_user_id,
    v_project.institution_id,
    v_project.course_id,
    'research.pilot_activated',
    'research_pilot_version',
    v_version.id::text,
    jsonb_build_object(
      'project_id', v_project.id,
      'version_number', v_version.version_number,
      'activated_at', v_version.activated_at
    ),
    ''
  );

  return jsonb_build_object(
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'status', v_version.status,
    'activated_at', v_version.activated_at
  );
end;
$$;

create or replace function public.record_research_participation_choice(
  p_version_id uuid,
  p_choice text,
  p_notice_version text,
  p_consent_record_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
  v_state public.research_participation_states%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_choice not in ('consented','declined','withdrawn') then
    raise exception 'Participation choice is invalid';
  end if;
  select * into v_version
  from public.research_pilot_versions
  where id = p_version_id;
  if not found or v_version.status <> 'active'
    or v_version.effective_at > now()
    or v_version.expires_at <= now() then
    raise exception 'Research participation is not open for this version';
  end if;
  select * into v_project
  from public.research_pilot_projects
  where id = v_version.project_id;
  if not exists (
    select 1
    from public.course_memberships cm
    where cm.course_id = v_project.course_id
      and cm.user_id = v_user_id
      and cm.role = 'learner'
      and private.course_membership_is_current(cm.course_id, cm.user_id, cm.role)
  ) then
    raise exception 'Current learner course membership is required';
  end if;
  if p_notice_version is distinct from v_version.notice_config->>'version' then
    raise exception 'The current participant notice must be acknowledged';
  end if;
  if p_choice = 'consented'
    and coalesce(p_consent_record_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'A consent or notice-acknowledgment record hash is required';
  end if;
  if p_choice = 'withdrawn' and not exists (
    select 1
    from public.research_participation_states ps
    where ps.pilot_version_id = p_version_id
      and ps.participant_id = v_user_id
      and ps.participation_status = 'consented'
  ) then
    raise exception 'There is no active participation choice to withdraw';
  end if;

  insert into public.research_participation_states (
    pilot_version_id, participant_id, participation_status, notice_version,
    consent_record_hash, choice_recorded_at, withdrawn_at
  ) values (
    p_version_id,
    v_user_id,
    p_choice,
    p_notice_version,
    case when p_choice = 'consented' then p_consent_record_hash else null end,
    now(),
    case when p_choice = 'withdrawn' then now() else null end
  )
  on conflict (pilot_version_id, participant_id) do update set
    participation_status = excluded.participation_status,
    notice_version = excluded.notice_version,
    consent_record_hash = excluded.consent_record_hash,
    choice_recorded_at = excluded.choice_recorded_at,
    withdrawn_at = excluded.withdrawn_at
  returning * into v_state;

  if p_choice = 'withdrawn' then
    update public.research_response_records
    set withdrawn_at = coalesce(withdrawn_at, now())
    where pilot_version_id = p_version_id
      and participant_id = v_user_id;
  end if;

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id,
    details, event_hash
  ) values (
    v_user_id,
    v_project.institution_id,
    v_project.course_id,
    'research.participation_choice_recorded',
    'research_participation_state',
    p_version_id::text || ':' || v_user_id::text,
    jsonb_build_object(
      'version_id', p_version_id,
      'participation_status', v_state.participation_status,
      'notice_version', v_state.notice_version
    ),
    ''
  );

  return jsonb_build_object(
    'version_id', p_version_id,
    'participation_status', v_state.participation_status,
    'withdrawn_at', v_state.withdrawn_at,
    'export_status', v_state.export_status,
    'deletion_status', v_state.deletion_status
  );
end;
$$;

create or replace function public.submit_research_response(
  p_instrument_id uuid,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_instrument public.research_pilot_instruments%rowtype;
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
  v_response public.research_response_records%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  select * into v_instrument
  from public.research_pilot_instruments
  where id = p_instrument_id;
  if not found then
    raise exception 'Approved research instrument not found';
  end if;
  if not private.research_collection_is_allowed(
    v_instrument.pilot_version_id,
    v_user_id,
    now()
  ) then
    raise exception 'Research response collection is not active for this participant and version';
  end if;
  select * into v_version
  from public.research_pilot_versions
  where id = v_instrument.pilot_version_id;
  select * into v_project
  from public.research_pilot_projects
  where id = v_version.project_id;

  insert into public.research_response_records (
    pilot_version_id, instrument_id, participant_id,
    response_payload, response_hash
  ) values (
    v_instrument.pilot_version_id,
    v_instrument.id,
    v_user_id,
    p_response,
    encode(extensions.digest(p_response::text, 'sha256'), 'hex')
  )
  returning * into v_response;

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id,
    details, event_hash
  ) values (
    v_user_id,
    v_project.institution_id,
    v_project.course_id,
    'research.response_recorded',
    'research_response_record',
    v_response.id::text,
    jsonb_build_object(
      'version_id', v_response.pilot_version_id,
      'instrument_id', v_response.instrument_id
    ),
    ''
  );

  return jsonb_build_object(
    'response_id', v_response.id,
    'instrument_id', v_response.instrument_id,
    'submitted_at', v_response.submitted_at
  );
end;
$$;

create or replace function public.request_research_subject_action(
  p_version_id uuid,
  p_request_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
  v_request public.research_subject_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_request_type not in ('withdrawal','export','deletion') then
    raise exception 'Research subject request type is invalid';
  end if;
  select * into v_version
  from public.research_pilot_versions
  where id = p_version_id;
  if not found then
    raise exception 'Research project version not found';
  end if;
  select * into v_project
  from public.research_pilot_projects
  where id = v_version.project_id;
  if not exists (
    select 1
    from public.course_memberships cm
    where cm.course_id = v_project.course_id
      and cm.user_id = v_user_id
      and cm.role = 'learner'
      and private.course_membership_is_current(cm.course_id, cm.user_id, cm.role)
  ) then
    raise exception 'Current learner course membership is required';
  end if;

  insert into public.research_subject_requests (
    pilot_version_id, participant_id, request_type
  ) values (
    p_version_id, v_user_id, p_request_type
  )
  returning * into v_request;

  if p_request_type = 'withdrawal' then
    update public.research_participation_states
    set participation_status = 'withdrawn',
        consent_record_hash = null,
        withdrawn_at = now()
    where pilot_version_id = p_version_id
      and participant_id = v_user_id;
    update public.research_response_records
    set withdrawn_at = coalesce(withdrawn_at, now())
    where pilot_version_id = p_version_id
      and participant_id = v_user_id;
  elsif p_request_type = 'export' then
    update public.research_participation_states
    set export_status = 'requested'
    where pilot_version_id = p_version_id
      and participant_id = v_user_id;
  else
    update public.research_participation_states
    set deletion_status = 'requested'
    where pilot_version_id = p_version_id
      and participant_id = v_user_id;
  end if;

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id,
    details, event_hash
  ) values (
    v_user_id,
    v_project.institution_id,
    v_project.course_id,
    'research.subject_request_created',
    'research_subject_request',
    v_request.id::text,
    jsonb_build_object(
      'version_id', p_version_id,
      'request_type', p_request_type,
      'status', v_request.status
    ),
    ''
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'request_type', v_request.request_type,
    'status', v_request.status,
    'requested_at', v_request.requested_at
  );
end;
$$;

create or replace function public.resolve_research_subject_request(
  p_request_id uuid,
  p_status text,
  p_resolution_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request public.research_subject_requests%rowtype;
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_status not in ('completed','denied')
    or char_length(btrim(coalesce(p_resolution_note, ''))) < 8 then
    raise exception 'A completed or denied decision and resolution note are required';
  end if;
  select * into v_request
  from public.research_subject_requests
  where id = p_request_id
  for update;
  if not found or v_request.status not in ('requested','in_review') then
    raise exception 'Open research subject request not found';
  end if;
  select * into v_version
  from public.research_pilot_versions
  where id = v_request.pilot_version_id;
  select * into v_project
  from public.research_pilot_projects
  where id = v_version.project_id;
  if not private.can_govern_research_project(v_project.id) then
    raise exception 'Institution research governance access required';
  end if;

  update public.research_subject_requests
  set status = p_status,
      resolved_at = now(),
      resolved_by = v_user_id,
      resolution_note = left(btrim(p_resolution_note), 2000)
  where id = p_request_id
  returning * into v_request;

  if v_request.request_type = 'export' then
    update public.research_participation_states
    set export_status = p_status
    where pilot_version_id = v_request.pilot_version_id
      and participant_id = v_request.participant_id;
  elsif v_request.request_type = 'deletion' then
    update public.research_participation_states
    set deletion_status = p_status
    where pilot_version_id = v_request.pilot_version_id
      and participant_id = v_request.participant_id;
    if p_status = 'completed' then
      update public.research_response_records
      set response_payload = null,
          response_hash = encode(
            extensions.digest(id::text || ':deleted:' || now()::text, 'sha256'),
            'hex'
          ),
          deleted_at = now()
      where pilot_version_id = v_request.pilot_version_id
        and participant_id = v_request.participant_id;
    end if;
  end if;

  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id,
    details, event_hash
  ) values (
    v_user_id,
    v_project.institution_id,
    v_project.course_id,
    'research.subject_request_resolved',
    'research_subject_request',
    v_request.id::text,
    jsonb_build_object(
      'version_id', v_request.pilot_version_id,
      'request_type', v_request.request_type,
      'status', v_request.status
    ),
    ''
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'request_type', v_request.request_type,
    'status', v_request.status,
    'resolved_at', v_request.resolved_at
  );
end;
$$;

create or replace function public.get_my_research_participation_status(
  p_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_state public.research_participation_states%rowtype;
  v_requests jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  select * into v_state
  from public.research_participation_states
  where pilot_version_id = p_version_id
    and participant_id = v_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'request_id', r.id,
    'request_type', r.request_type,
    'status', r.status,
    'requested_at', r.requested_at,
    'resolved_at', r.resolved_at,
    'resolution_note', case when r.status in ('completed','denied') then r.resolution_note else '' end
  ) order by r.requested_at desc), '[]'::jsonb)
  into v_requests
  from public.research_subject_requests r
  where r.pilot_version_id = p_version_id
    and r.participant_id = v_user_id;

  return jsonb_build_object(
    'version_id', p_version_id,
    'participation_status', coalesce(v_state.participation_status, 'not_enrolled'),
    'choice_recorded_at', v_state.choice_recorded_at,
    'withdrawn_at', v_state.withdrawn_at,
    'export_status', coalesce(v_state.export_status, 'not_requested'),
    'deletion_status', coalesce(v_state.deletion_status, 'not_requested'),
    'requests', v_requests
  );
end;
$$;

revoke all on function private.can_view_research_project(uuid) from public;
revoke all on function private.can_govern_research_project(uuid) from public;
revoke all on function private.can_view_research_version(uuid) from public;
revoke all on function private.is_research_participant(uuid) from public;
revoke all on function private.research_contract_fields_are_immutable() from public;
revoke all on function private.research_append_only_record() from public;
revoke all on function private.research_instrument_requires_draft_version() from public;
revoke all on function private.enforce_research_participation_actor() from public;
revoke all on function private.research_version_blockers(uuid,boolean,timestamptz) from public;
revoke all on function private.research_collection_is_allowed(uuid,uuid,timestamptz) from public;
revoke all on function private.enforce_research_response_gate() from public;

grant execute on function private.can_view_research_project(uuid) to authenticated;
grant execute on function private.can_view_research_version(uuid) to authenticated;
grant execute on function private.is_research_participant(uuid) to authenticated;

revoke all on function public.get_research_pilot_gate_status(uuid,uuid) from public, anon;
revoke all on function public.create_research_pilot_version(jsonb) from public, anon;
revoke all on function public.record_research_pilot_determination(uuid,jsonb) from public, anon;
revoke all on function public.activate_research_pilot_version(uuid,text) from public, anon;
revoke all on function public.record_research_participation_choice(uuid,text,text,text) from public, anon;
revoke all on function public.submit_research_response(uuid,jsonb) from public, anon;
revoke all on function public.request_research_subject_action(uuid,text) from public, anon;
revoke all on function public.resolve_research_subject_request(uuid,text,text) from public, anon;
revoke all on function public.get_my_research_participation_status(uuid) from public, anon;

grant execute on function public.get_research_pilot_gate_status(uuid,uuid) to authenticated;
grant execute on function public.create_research_pilot_version(jsonb) to authenticated;
grant execute on function public.record_research_pilot_determination(uuid,jsonb) to authenticated;
grant execute on function public.activate_research_pilot_version(uuid,text) to authenticated;
grant execute on function public.record_research_participation_choice(uuid,text,text,text) to authenticated;
grant execute on function public.submit_research_response(uuid,jsonb) to authenticated;
grant execute on function public.request_research_subject_action(uuid,text) to authenticated;
grant execute on function public.resolve_research_subject_request(uuid,text,text) to authenticated;
grant execute on function public.get_my_research_participation_status(uuid) to authenticated;
