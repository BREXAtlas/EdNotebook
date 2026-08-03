-- Final Phase 4 of 5: consolidated student-data promotion preflight.
--
-- This migration records a compact, append-only snapshot of the current
-- lifecycle and evidence state. HOLD applies only to production promotion:
-- bounded staging beta and authorized pilot testing remain allowed. This unit
-- cannot approve a missing gate, activate production intake, execute a
-- lifecycle action, or touch the production Supabase project.

create table public.student_data_environment_lane_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  scope_type text not null check (scope_type in ('institution','course','account')),
  scope_id uuid not null,
  version integer not null check (version > 0),
  data_lane text not null check (data_lane in ('beta','pilot')),
  previous_data_lane text check (previous_data_lane in ('beta','pilot')),
  status text not null check (status in ('active','retired')),
  purpose text not null check (char_length(trim(purpose)) between 20 and 2000),
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 8 and 500),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  carried_account_ids uuid[] not null default '{}',
  carried_course_ids uuid[] not null default '{}',
  carried_account_count integer not null default 0 check (carried_account_count >= 0),
  carried_course_count integer not null default 0 check (carried_course_count >= 0),
  carry_set_sha256 text not null check (carry_set_sha256 ~ '^[0-9a-f]{64}$'),
  supersedes_lane_id uuid references public.student_data_environment_lane_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (institution_id,scope_type,scope_id,version),
  check (scope_type<>'institution' or scope_id=institution_id)
);

create index student_data_environment_lane_assigned_by_idx
  on public.student_data_environment_lane_versions(assigned_by);
create index student_data_environment_lane_supersedes_idx
  on public.student_data_environment_lane_versions(supersedes_lane_id);
create index student_data_environment_lane_scope_idx
  on public.student_data_environment_lane_versions(institution_id,scope_type,scope_id,version desc);

alter table public.student_data_environment_lane_versions enable row level security;
revoke all on table public.student_data_environment_lane_versions from public,anon,authenticated;
grant select,insert on table public.student_data_environment_lane_versions to service_role;
create policy student_data_environment_lane_versions_api_deny_all
on public.student_data_environment_lane_versions
as restrictive for all to anon,authenticated
using (false) with check (false);

create trigger student_data_environment_lane_versions_append_only
before update or delete on public.student_data_environment_lane_versions
for each row execute function private.reject_student_data_governance_mutation();

alter table public.audit_events
  add column data_lane text check (data_lane in ('beta','pilot','production')),
  add column environment_scope text check (environment_scope in ('staging','production'));

create index audit_events_institution_data_lane_occurred_idx
  on public.audit_events(institution_id,data_lane,occurred_at desc)
  where data_lane is not null;

create or replace function private.resolve_student_data_environment_lane(
  p_institution_id uuid,
  p_course_id uuid default null,
  p_account_id uuid default null
)
returns text
language sql
stable
security definer
set search_path=''
as $$
  with latest as (
    select distinct on (lane.scope_type,lane.scope_id) lane.*
    from public.student_data_environment_lane_versions lane
    where lane.institution_id=p_institution_id
    order by lane.scope_type,lane.scope_id,lane.version desc
  )
  select coalesce((
    select lane.data_lane
    from latest lane
    where lane.status='active'
      and (
        (lane.scope_type='course' and lane.scope_id=p_course_id)
        or (lane.scope_type='account' and lane.scope_id=p_account_id)
        or (lane.scope_type='institution' and lane.scope_id=p_institution_id)
      )
    order by case lane.scope_type when 'course' then 1 when 'account' then 2 else 3 end
    limit 1
  ),'beta');
$$;

create or replace function private.stamp_student_data_audit_lane()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_lane text;
begin
  if new.institution_id is null then return new; end if;
  v_lane := private.resolve_student_data_environment_lane(new.institution_id,new.course_id,new.actor_id);
  new.data_lane := v_lane;
  new.environment_scope := 'staging';
  new.details := (coalesce(new.details,'{}'::jsonb) - 'data_lane' - 'environment_scope')
    || jsonb_build_object('data_lane',v_lane,'environment_scope','staging');
  return new;
end;
$$;

create or replace function public.get_my_student_data_environment_lane(p_course_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_institution_id uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_course_id uuid;
  v_lane text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_course_id is not null and exists (
    select 1
    from public.courses course
    where course.id=p_course_id
      and course.institution_id=v_institution_id
      and (
        course.owner_id=v_actor
        or exists (
          select 1 from public.course_memberships membership
          where membership.course_id=course.id and membership.user_id=v_actor
        )
        or private.is_platform_owner(v_actor)
      )
  ) then v_course_id := p_course_id; end if;

  v_lane := private.resolve_student_data_environment_lane(v_institution_id,v_course_id,v_actor);
  return jsonb_build_object(
    'data_lane',v_lane,
    'environment_scope','staging',
    'course_id',v_course_id,
    'production_label_visible',false
  );
end;
$$;

drop trigger if exists audit_events_student_data_lane on public.audit_events;
create trigger audit_events_student_data_lane
before insert on public.audit_events
for each row execute function private.stamp_student_data_audit_lane();

create or replace function public.get_student_data_environment_lanes(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'view_audit',(select auth.uid()))
    or private.has_institution_capability(p_institution_id,'manage_retention',(select auth.uid()))
  ) then raise exception 'Student-data environment-lane access denied'; end if;

  return jsonb_build_object(
    'environment_scope','staging',
    'default_data_lane','beta',
    'assignable_data_lanes',jsonb_build_array('beta','pilot'),
    'production_lane_assignable',false,
    'legacy_unclassified_audit_count',(
      select count(*) from public.audit_events event
      where event.institution_id=p_institution_id and event.data_lane is null
    ),
    'audit_counts',coalesce((
      select jsonb_object_agg(counts.data_lane,counts.event_count)
      from (
        select event.data_lane,count(*) as event_count
        from public.audit_events event
        where event.institution_id=p_institution_id and event.data_lane is not null
        group by event.data_lane
      ) counts
    ),'{}'::jsonb),
    'assignments',coalesce((
      select jsonb_agg(to_jsonb(lane) order by lane.scope_type,lane.scope_id)
      from (
        select distinct on (source.scope_type,source.scope_id) source.*
        from public.student_data_environment_lane_versions source
        where source.institution_id=p_institution_id
        order by source.scope_type,source.scope_id,source.version desc
      ) lane
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.record_student_data_environment_lane(
  p_institution_id uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_data_lane text,
  p_status text,
  p_purpose text,
  p_evidence_reference text,
  p_attestation boolean default false
)
returns public.student_data_environment_lane_versions
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_previous public.student_data_environment_lane_versions%rowtype;
  v_record public.student_data_environment_lane_versions%rowtype;
  v_version integer;
  v_carried_account_ids uuid[] := '{}';
  v_carried_course_ids uuid[] := '{}';
  v_carry_set_sha256 text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_institution_id<>'22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'Environment-lane assignment is limited to the TOS staging institution';
  end if;
  if not (
    private.is_platform_owner(v_actor)
    or private.has_institution_capability(p_institution_id,'manage_retention',v_actor)
  ) then raise exception 'Student-data environment-lane assignment denied'; end if;
  if not p_attestation then raise exception 'Human environment-lane attestation required'; end if;
  if p_scope_type not in ('institution','course','account') then raise exception 'Environment-lane scope is invalid'; end if;
  if p_data_lane not in ('beta','pilot') then raise exception 'Production lane cannot be assigned in staging'; end if;
  if p_status not in ('active','retired') then raise exception 'Environment-lane status is invalid'; end if;
  if char_length(trim(coalesce(p_purpose,''))) not between 20 and 2000
     or char_length(trim(coalesce(p_evidence_reference,''))) not between 8 and 500 then
    raise exception 'Environment-lane purpose and evidence reference are required';
  end if;
  if p_scope_type='institution' and p_scope_id<>p_institution_id then
    raise exception 'Institution lane scope must use the institution ID';
  elsif p_scope_type='course' and not exists (
    select 1 from public.courses course where course.id=p_scope_id and course.institution_id=p_institution_id
  ) then raise exception 'Course lane scope does not belong to the institution';
  elsif p_scope_type='account' and not exists (
    select 1 from public.institution_memberships membership
    where membership.institution_id=p_institution_id and membership.user_id=p_scope_id
  ) then raise exception 'Account lane scope does not belong to the institution';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
    p_institution_id::text || ':' || p_scope_type || ':' || p_scope_id::text || ':data-lane'
  ));
  select * into v_previous
  from public.student_data_environment_lane_versions lane
  where lane.institution_id=p_institution_id and lane.scope_type=p_scope_type and lane.scope_id=p_scope_id
  order by lane.version desc
  limit 1
  for update;
  v_version := coalesce(v_previous.version,0)+1;

  if p_scope_type='institution' then
    select coalesce(array_agg(distinct membership.user_id order by membership.user_id),'{}'::uuid[])
    into v_carried_account_ids
    from public.institution_memberships membership
    where membership.institution_id=p_institution_id;
    select coalesce(array_agg(course.id order by course.id),'{}'::uuid[])
    into v_carried_course_ids
    from public.courses course
    where course.institution_id=p_institution_id;
  elsif p_scope_type='account' then
    v_carried_account_ids := array[p_scope_id];
  elsif p_scope_type='course' then
    select coalesce(array_agg(carried.user_id order by carried.user_id),'{}'::uuid[])
    into v_carried_account_ids
    from (
      select course.owner_id as user_id
      from public.courses course
      where course.id=p_scope_id and course.institution_id=p_institution_id
      union
      select membership.user_id
      from public.course_memberships membership
      where membership.course_id=p_scope_id
    ) carried;
    v_carried_course_ids := array[p_scope_id];
  end if;
  v_carry_set_sha256 := encode(extensions.digest(convert_to(
    jsonb_build_object('account_ids',v_carried_account_ids,'course_ids',v_carried_course_ids)::text,
    'UTF8'
  ),'sha256'),'hex');

  insert into public.student_data_environment_lane_versions(
    institution_id,scope_type,scope_id,version,data_lane,previous_data_lane,status,purpose,
    evidence_reference,assigned_by,assigned_at,carried_account_ids,carried_course_ids,
    carried_account_count,carried_course_count,carry_set_sha256,supersedes_lane_id
  ) values (
    p_institution_id,p_scope_type,p_scope_id,v_version,p_data_lane,v_previous.data_lane,p_status,trim(p_purpose),
    trim(p_evidence_reference),v_actor,now(),v_carried_account_ids,v_carried_course_ids,
    cardinality(v_carried_account_ids),cardinality(v_carried_course_ids),v_carry_set_sha256,v_previous.id
  ) returning * into v_record;

  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values(v_actor,p_institution_id,case when p_scope_type='course' then p_scope_id else null end,
    'student_data.environment_lane_recorded','student_data_environment_lane',v_record.id::text,
    jsonb_build_object('scope_type',p_scope_type,'scope_id',p_scope_id,'assigned_data_lane',p_data_lane,
      'previous_data_lane',v_previous.data_lane,'status',p_status,'version',v_version,
      'carried_account_count',cardinality(v_carried_account_ids),
      'carried_course_count',cardinality(v_carried_course_ids),
      'carry_set_sha256',v_carry_set_sha256,'production_action_executed',false),'');
  return v_record;
end;
$$;

create or replace function public.get_student_data_lane_audit(
  p_institution_id uuid,
  p_data_lane text,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_data_lane not in ('beta','pilot','production') then raise exception 'Audit data lane is invalid'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'view_audit',(select auth.uid()))
    or private.has_institution_capability(p_institution_id,'manage_retention',(select auth.uid()))
  ) then raise exception 'Student-data lane audit access denied'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',event.id,
      'occurred_at',event.occurred_at,
      'actor_id',event.actor_id,
      'course_id',event.course_id,
      'event_type',event.event_type,
      'target_type',event.target_type,
      'target_id',event.target_id,
      'data_lane',event.data_lane,
      'environment_scope',event.environment_scope,
      'details',event.details
    ) order by event.occurred_at desc,event.id desc)
    from (
      select * from public.audit_events source
      where source.institution_id=p_institution_id and source.data_lane=p_data_lane
      order by source.occurred_at desc,source.id desc
      limit least(greatest(coalesce(p_limit,100),1),250)
    ) event
  ),'[]'::jsonb);
end;
$$;

create table public.student_data_promotion_preflight_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  version integer not null check (version > 0),
  decision text not null check (decision in ('hold','ready_for_human_promotion_review')),
  readiness_snapshot jsonb not null check (jsonb_typeof(readiness_snapshot)='object'),
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{7,64}$'),
  migration_version text not null,
  environment_reference text not null,
  region text not null,
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 8 and 500),
  summary text not null check (char_length(trim(summary)) between 20 and 2000),
  reviewer_type text not null default 'human' check (reviewer_type='human'),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  valid_until timestamptz not null,
  supersedes_preflight_id uuid references public.student_data_promotion_preflight_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (institution_id,version),
  check (valid_until > recorded_at),
  check (coalesce((readiness_snapshot->>'production_student_intake_enabled')::boolean,true) is false),
  check (coalesce((readiness_snapshot->>'production_action_executed')::boolean,true) is false),
  check (coalesce((readiness_snapshot->>'automatic_lifecycle_execution_enabled')::boolean,true) is false),
  check (coalesce((readiness_snapshot->>'staging_beta_testing_allowed')::boolean,false) is true),
  check (coalesce((readiness_snapshot->>'staging_pilot_testing_allowed')::boolean,false) is true),
  check (readiness_snapshot->>'testing_data_scope'='beta_demo_or_authorized_pilot_data')
);

create index student_data_promotion_preflight_recorded_by_idx
  on public.student_data_promotion_preflight_versions(recorded_by);
create index student_data_promotion_preflight_supersedes_idx
  on public.student_data_promotion_preflight_versions(supersedes_preflight_id);

alter table public.student_data_promotion_preflight_versions enable row level security;
revoke all on table public.student_data_promotion_preflight_versions from public,anon,authenticated;
grant select,insert on table public.student_data_promotion_preflight_versions to service_role;
create policy student_data_promotion_preflight_versions_api_deny_all
on public.student_data_promotion_preflight_versions
as restrictive for all to anon,authenticated
using (false) with check (false);

create trigger student_data_promotion_preflight_versions_append_only
before update or delete on public.student_data_promotion_preflight_versions
for each row execute function private.reject_student_data_governance_mutation();

create or replace function private.student_data_promotion_preflight(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_readiness jsonb;
  v_snapshot jsonb;
  v_snapshot_sha256 text;
  v_valid_until timestamptz;
begin
  v_readiness := private.student_data_intake_readiness(p_institution_id);

  with current_policies as (
    select distinct on (policy.domain_key) policy.*
    from public.student_data_lifecycle_policy_versions policy
    where policy.institution_id=p_institution_id
    order by policy.domain_key,policy.version desc
  ), current_evidence as (
    select distinct on (evidence.gate_key) evidence.*
    from public.student_data_intake_evidence_versions evidence
    where evidence.institution_id=p_institution_id
    order by evidence.gate_key,evidence.version desc
  )
  select least(
    (select min(policy.review_due_at) from current_policies policy where policy.review_due_at is not null),
    (select min(evidence.expires_at) from current_evidence evidence where evidence.expires_at is not null)
  ) into v_valid_until;

  if v_valid_until is null or v_valid_until<=now() then
    raise exception 'A current evidence and policy validity ceiling is required';
  end if;

  with current_policies as (
    select distinct on (policy.domain_key) policy.*
    from public.student_data_lifecycle_policy_versions policy
    where policy.institution_id=p_institution_id
    order by policy.domain_key,policy.version desc
  ), current_evidence as (
    select distinct on (evidence.gate_key) evidence.*
    from public.student_data_intake_evidence_versions evidence
    where evidence.institution_id=p_institution_id
    order by evidence.gate_key,evidence.version desc
  )
  select jsonb_build_object(
    'schema_version','1.0',
    'decision',v_readiness->>'decision',
    'ready_for_promotion_review',coalesce((v_readiness->>'ready_for_promotion_review')::boolean,false),
    'hold_scope','production_promotion_only',
    'staging_beta_testing_allowed',true,
    'staging_pilot_testing_allowed',true,
    'testing_data_scope','beta_demo_or_authorized_pilot_data',
    'default_data_lane','beta',
    'production_data_lane_assignable',false,
    'production_student_intake_enabled',false,
    'production_action_executed',false,
    'automatic_lifecycle_execution_enabled',false,
    'lifecycle_domain_count',coalesce((v_readiness->>'lifecycle_domain_count')::integer,0),
    'recorded_lifecycle_domain_count',coalesce((v_readiness->>'recorded_lifecycle_domain_count')::integer,0),
    'approved_lifecycle_domain_count',coalesce((v_readiness->>'approved_lifecycle_domain_count')::integer,0),
    'blocked_lifecycle_domain_count',coalesce((v_readiness->>'blocked_lifecycle_domain_count')::integer,0),
    'expired_lifecycle_domain_count',coalesce((v_readiness->>'expired_lifecycle_domain_count')::integer,0),
    'required_evidence_gate_count',coalesce((v_readiness->>'required_evidence_gate_count')::integer,0),
    'passed_evidence_gate_count',coalesce((v_readiness->>'passed_evidence_gate_count')::integer,0),
    'unrecorded_lifecycle_domains',coalesce(v_readiness->'unrecorded_lifecycle_domains','[]'::jsonb),
    'blocked_lifecycle_domains',coalesce(v_readiness->'blocked_lifecycle_domains','[]'::jsonb),
    'missing_lifecycle_domains',coalesce(v_readiness->'missing_lifecycle_domains','[]'::jsonb),
    'missing_evidence_gates',coalesce(v_readiness->'missing_evidence_gates','[]'::jsonb),
    'policy_versions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'domain_key',policy.domain_key,
        'version',policy.version,
        'status',policy.status,
        'disposition',policy.disposition,
        'review_due_at',policy.review_due_at
      ) order by policy.domain_key)
      from current_policies policy
    ),'[]'::jsonb),
    'evidence_versions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'gate_key',evidence.gate_key,
        'version',evidence.version,
        'status',evidence.status,
        'expires_at',evidence.expires_at
      ) order by evidence.gate_key)
      from current_evidence evidence
    ),'[]'::jsonb),
    'environment_lane_assignments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'scope_type',lane.scope_type,
        'scope_id',lane.scope_id,
        'version',lane.version,
        'data_lane',lane.data_lane,
        'previous_data_lane',lane.previous_data_lane,
        'status',lane.status,
        'carried_account_count',lane.carried_account_count,
        'carried_course_count',lane.carried_course_count,
        'carry_set_sha256',lane.carry_set_sha256
      ) order by lane.scope_type,lane.scope_id)
      from (
        select distinct on (source.scope_type,source.scope_id) source.*
        from public.student_data_environment_lane_versions source
        where source.institution_id=p_institution_id
        order by source.scope_type,source.scope_id,source.version desc
      ) lane
    ),'[]'::jsonb)
  ) into v_snapshot;

  if v_snapshot->>'decision' not in ('hold','ready_for_human_promotion_review') then
    raise exception 'Promotion-preflight decision is invalid';
  end if;
  if coalesce((v_snapshot->>'ready_for_promotion_review')::boolean,false)
     <> (v_snapshot->>'decision'='ready_for_human_promotion_review') then
    raise exception 'Promotion-preflight readiness state is inconsistent';
  end if;

  v_snapshot_sha256 := encode(
    extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),
    'hex'
  );

  return jsonb_build_object(
    'snapshot',v_snapshot,
    'snapshot_sha256',v_snapshot_sha256,
    'valid_until',v_valid_until,
    'staging_beta_testing_allowed',true,
    'staging_pilot_testing_allowed',true,
    'production_student_intake_enabled',false,
    'production_action_executed',false
  );
end;
$$;

create or replace function public.get_student_data_promotion_preflight(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_current jsonb;
  v_latest public.student_data_promotion_preflight_versions%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'view_audit',(select auth.uid()))
    or private.has_institution_capability(p_institution_id,'manage_retention',(select auth.uid()))
  ) then raise exception 'Student-data promotion preflight access denied'; end if;

  v_current := private.student_data_promotion_preflight(p_institution_id);
  select * into v_latest
  from public.student_data_promotion_preflight_versions preflight
  where preflight.institution_id=p_institution_id
  order by preflight.version desc
  limit 1;

  return jsonb_build_object(
    'current',v_current,
    'latest_record',case when found then to_jsonb(v_latest) else null end,
    'staging_beta_testing_allowed',true,
    'staging_pilot_testing_allowed',true,
    'production_student_intake_enabled',false,
    'production_action_executed',false
  );
end;
$$;

create or replace function public.record_student_data_promotion_preflight(
  p_institution_id uuid,
  p_source_commit text,
  p_evidence_reference text,
  p_summary text,
  p_expected_snapshot_sha256 text,
  p_attestation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_current jsonb;
  v_snapshot jsonb;
  v_previous public.student_data_promotion_preflight_versions%rowtype;
  v_record public.student_data_promotion_preflight_versions%rowtype;
  v_version integer;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_institution_id<>'22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'This preflight recorder is limited to the TOS synthetic staging institution';
  end if;
  if not (
    private.is_platform_owner(v_actor)
    or private.has_institution_capability(p_institution_id,'manage_retention',v_actor)
  ) then raise exception 'Student-data promotion preflight recording denied'; end if;
  if not p_attestation then raise exception 'Human promotion-preflight attestation required'; end if;
  if coalesce(trim(p_source_commit),'') !~ '^[0-9a-f]{7,64}$' then raise exception 'Source commit is invalid'; end if;
  if char_length(trim(coalesce(p_evidence_reference,''))) not between 8 and 500
     or char_length(trim(coalesce(p_summary,''))) not between 20 and 2000 then
    raise exception 'Evidence reference and preflight summary are required';
  end if;
  if lower(trim(coalesce(p_expected_snapshot_sha256,''))) !~ '^[0-9a-f]{64}$' then
    raise exception 'Expected preflight checksum is invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_institution_id::text || ':student-data-promotion-preflight'));
  v_current := private.student_data_promotion_preflight(p_institution_id);
  if v_current->>'snapshot_sha256'<>lower(trim(p_expected_snapshot_sha256)) then
    raise exception 'Promotion-preflight evidence changed; refresh and review again';
  end if;
  v_snapshot := v_current->'snapshot';

  if coalesce((v_snapshot->>'production_student_intake_enabled')::boolean,true)
     or coalesce((v_snapshot->>'production_action_executed')::boolean,true)
     or coalesce((v_snapshot->>'automatic_lifecycle_execution_enabled')::boolean,true) then
    raise exception 'Promotion preflight cannot activate production or lifecycle execution';
  end if;
  if coalesce((v_snapshot->>'staging_beta_testing_allowed')::boolean,false) is not true
     or coalesce((v_snapshot->>'staging_pilot_testing_allowed')::boolean,false) is not true
     or v_snapshot->>'testing_data_scope'<>'beta_demo_or_authorized_pilot_data' then
    raise exception 'Promotion HOLD must not disable bounded staging beta or pilot testing';
  end if;

  select * into v_previous
  from public.student_data_promotion_preflight_versions preflight
  where preflight.institution_id=p_institution_id
  order by preflight.version desc
  limit 1
  for update;

  if found
     and v_previous.snapshot_sha256=v_current->>'snapshot_sha256'
     and v_previous.source_commit=lower(trim(p_source_commit)) then
    return jsonb_build_object('record',to_jsonb(v_previous),'created',false,'production_action_executed',false);
  end if;

  v_version := coalesce(v_previous.version,0)+1;
  insert into public.student_data_promotion_preflight_versions(
    institution_id,version,decision,readiness_snapshot,snapshot_sha256,source_commit,
    migration_version,environment_reference,region,evidence_reference,summary,
    recorded_by,recorded_at,valid_until,supersedes_preflight_id
  ) values (
    p_institution_id,v_version,v_snapshot->>'decision',v_snapshot,v_current->>'snapshot_sha256',
    lower(trim(p_source_commit)),'20260802233000_govern_student_data_promotion_preflight',
    'supabase:gfalgonektwdylsxsgzc;github:BREXAtlas/EdNotebook;branch:staging',
    'us-east-1',trim(p_evidence_reference),trim(p_summary),v_actor,now(),
    (v_current->>'valid_until')::timestamptz,v_previous.id
  ) returning * into v_record;

  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values(v_actor,p_institution_id,'student_data.promotion_preflight_recorded','student_data_promotion_preflight',v_record.id::text,
    jsonb_build_object(
      'version',v_record.version,
      'decision',v_record.decision,
      'snapshot_sha256',v_record.snapshot_sha256,
      'source_commit',v_record.source_commit,
      'approved_lifecycle_domain_count',v_snapshot->'approved_lifecycle_domain_count',
      'blocked_lifecycle_domain_count',v_snapshot->'blocked_lifecycle_domain_count',
      'passed_evidence_gate_count',v_snapshot->'passed_evidence_gate_count',
      'required_evidence_gate_count',v_snapshot->'required_evidence_gate_count',
      'staging_beta_testing_allowed',true,
      'staging_pilot_testing_allowed',true,
      'testing_data_scope','beta_demo_or_authorized_pilot_data',
      'production_student_intake_enabled',false,
      'production_action_executed',false
    ),'');

  return jsonb_build_object('record',to_jsonb(v_record),'created',true,'production_action_executed',false);
end;
$$;

revoke all on function private.student_data_promotion_preflight(uuid) from public,anon,authenticated,service_role;
revoke all on function private.resolve_student_data_environment_lane(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.stamp_student_data_audit_lane() from public,anon,authenticated,service_role;
revoke all on function public.get_my_student_data_environment_lane(uuid) from public,anon;
revoke all on function public.get_student_data_environment_lanes(uuid) from public,anon;
revoke all on function public.record_student_data_environment_lane(uuid,text,uuid,text,text,text,text,boolean) from public,anon;
revoke all on function public.get_student_data_lane_audit(uuid,text,integer) from public,anon;
revoke all on function public.get_student_data_promotion_preflight(uuid) from public,anon;
revoke all on function public.record_student_data_promotion_preflight(uuid,text,text,text,text,boolean) from public,anon;
grant execute on function public.get_my_student_data_environment_lane(uuid) to authenticated;
grant execute on function public.get_student_data_environment_lanes(uuid) to authenticated;
grant execute on function public.record_student_data_environment_lane(uuid,text,uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.get_student_data_lane_audit(uuid,text,integer) to authenticated;
grant execute on function public.get_student_data_promotion_preflight(uuid) to authenticated;
grant execute on function public.record_student_data_promotion_preflight(uuid,text,text,text,text,boolean) to authenticated;

comment on table public.student_data_promotion_preflight_versions is
  'Append-only, metadata-only snapshots of the current student-data promotion preflight. HOLD blocks production promotion only; bounded beta demonstrations and authorized pilot testing remain allowed.';
comment on function public.get_student_data_promotion_preflight(uuid) is
  'Authorized compact promotion preflight plus latest immutable snapshot; it never activates production.';
comment on function public.record_student_data_promotion_preflight(uuid,text,text,text,text,boolean) is
  'Records a checksum-bound human-attested staging preflight snapshot. HOLD and ready-for-review are evidence labels only, never production activation.';
comment on table public.student_data_environment_lane_versions is
  'Append-only beta and pilot lane assignments in the existing staging database. Production remains a separately promoted environment and is not assignable here.';
comment on function public.get_my_student_data_environment_lane(uuid) is
  'Returns the authenticated page lane from governed institution, account, and accessible-course assignments. URL parameters cannot select a lane.';
