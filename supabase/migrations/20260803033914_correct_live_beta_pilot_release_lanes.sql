-- Correct the deployment-surface and operating-lane model.
--
-- The existing /staging site remains the permanent upgrade sandbox. Beta and
-- Pilot are operating lanes of the normal live EdNotebook service; they are
-- not alternate sites, databases, or URLs. This migration adds an append-only
-- global live-lane record and stamps audit events with both concepts.

alter table public.audit_events
  drop constraint if exists audit_events_data_lane_check,
  drop constraint if exists audit_events_environment_scope_check;

alter table public.audit_events
  add constraint audit_events_data_lane_check
    check (data_lane in ('sandbox','beta','pilot','production')),
  add constraint audit_events_environment_scope_check
    check (environment_scope in ('staging','production','staging_sandbox','live_service','unclassified'));

create table public.live_service_operating_lane_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null check (version > 0),
  operating_lane text not null check (operating_lane in ('beta','pilot')),
  previous_operating_lane text check (previous_operating_lane in ('beta','pilot')),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{7,64}$'),
  purpose text not null check (char_length(trim(purpose)) between 20 and 2000),
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 8 and 500),
  carried_account_ids uuid[] not null default '{}',
  carried_course_ids uuid[] not null default '{}',
  carried_account_count integer not null check (carried_account_count >= 0),
  carried_course_count integer not null check (carried_course_count >= 0),
  carry_set_sha256 text not null check (carry_set_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  supersedes_lane_id uuid references public.live_service_operating_lane_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (version),
  check (carried_account_count=cardinality(carried_account_ids)),
  check (carried_course_count=cardinality(carried_course_ids))
);

create index live_service_operating_lane_recorded_by_idx
  on public.live_service_operating_lane_versions(recorded_by);
create index live_service_operating_lane_supersedes_idx
  on public.live_service_operating_lane_versions(supersedes_lane_id);

alter table public.live_service_operating_lane_versions enable row level security;
revoke all on table public.live_service_operating_lane_versions from public,anon,authenticated;
grant select,insert on table public.live_service_operating_lane_versions to service_role;
create policy live_service_operating_lane_versions_api_deny_all
on public.live_service_operating_lane_versions
as restrictive for all to anon,authenticated
using (false) with check (false);

create trigger live_service_operating_lane_versions_append_only
before update or delete on public.live_service_operating_lane_versions
for each row execute function private.reject_student_data_governance_mutation();

create or replace function private.current_live_service_operating_lane()
returns text
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select lane.operating_lane
    from public.live_service_operating_lane_versions lane
    order by lane.version desc
    limit 1
  ),'beta');
$$;

create or replace function private.current_request_deployment_surface()
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_issuer text := lower(coalesce((select auth.jwt()->>'iss'),''));
begin
  if position('gfalgonektwdylsxsgzc' in v_issuer)>0
     or position('127.0.0.1:54321' in v_issuer)>0
     or position('localhost:54321' in v_issuer)>0 then
    return 'staging_sandbox';
  end if;
  if position('didwxihufueqbpfnfdmm' in v_issuer)>0 then
    return 'live_service';
  end if;
  return 'unclassified';
end;
$$;

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
  ),private.current_live_service_operating_lane());
$$;

create or replace function private.stamp_student_data_audit_lane()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_lane text;
  v_surface text;
begin
  if new.institution_id is null then return new; end if;

  v_surface := private.current_request_deployment_surface();
  if v_surface='staging_sandbox' then
    v_lane := 'sandbox';
  elsif v_surface='live_service' then
    v_lane := private.resolve_student_data_environment_lane(new.institution_id,new.course_id,new.actor_id);
  else
    v_lane := null;
  end if;

  new.data_lane := v_lane;
  new.environment_scope := v_surface;
  new.details := (coalesce(new.details,'{}'::jsonb) - 'data_lane' - 'environment_scope' - 'deployment_surface')
    || jsonb_build_object(
      'data_lane',coalesce(v_lane,'unclassified'),
      'environment_scope',v_surface,
      'deployment_surface',v_surface
    );
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
  v_surface text;
  v_institution_id uuid;
  v_course_id uuid;
  v_lane text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  v_surface := private.current_request_deployment_surface();

  if v_surface='staging_sandbox' then
    return jsonb_build_object(
      'data_lane','sandbox',
      'environment_scope','staging_sandbox',
      'deployment_surface','staging_sandbox',
      'course_id',null,
      'production_label_visible',false
    );
  end if;

  if p_course_id is not null then
    select course.id,course.institution_id into v_course_id,v_institution_id
    from public.courses course
    where course.id=p_course_id
      and (
        course.owner_id=v_actor
        or exists (
          select 1 from public.course_memberships membership
          where membership.course_id=course.id and membership.user_id=v_actor
        )
        or private.is_platform_owner(v_actor)
      );
  end if;

  if v_institution_id is null then
    select membership.institution_id into v_institution_id
    from public.institution_memberships membership
    where membership.user_id=v_actor and membership.status='active'
    order by membership.last_active_at desc nulls last,membership.joined_at desc nulls last,membership.created_at desc
    limit 1;
  end if;

  if v_surface='live_service' and v_institution_id is not null then
    v_lane := private.resolve_student_data_environment_lane(v_institution_id,v_course_id,v_actor);
  elsif v_surface='live_service' then
    v_lane := private.current_live_service_operating_lane();
  else
    v_lane := 'unclassified';
  end if;

  return jsonb_build_object(
    'data_lane',v_lane,
    'environment_scope',v_surface,
    'deployment_surface',v_surface,
    'institution_id',v_institution_id,
    'course_id',v_course_id,
    'production_label_visible',false
  );
end;
$$;

create or replace function public.get_live_service_operating_lane()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_lane public.live_service_operating_lane_versions%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_lane
  from public.live_service_operating_lane_versions source
  order by source.version desc
  limit 1;
  return jsonb_build_object(
    'deployment_surface','live_service',
    'operating_lane',coalesce(v_lane.operating_lane,'beta'),
    'version',coalesce(v_lane.version,0),
    'recorded_at',v_lane.recorded_at,
    'source_commit',v_lane.source_commit,
    'production_label_visible',false
  );
end;
$$;

create or replace function public.record_live_service_operating_lane(
  p_operating_lane text,
  p_source_commit text,
  p_purpose text,
  p_evidence_reference text,
  p_attestation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_previous public.live_service_operating_lane_versions%rowtype;
  v_record public.live_service_operating_lane_versions%rowtype;
  v_account_ids uuid[] := '{}';
  v_course_ids uuid[] := '{}';
  v_carry_set_sha256 text;
  v_version integer;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not private.is_platform_owner(v_actor) then
    raise exception 'Only the accountable platform owner may change the live operating lane';
  end if;
  if not p_attestation then raise exception 'Human live-lane attestation required'; end if;
  if p_operating_lane not in ('beta','pilot') then
    raise exception 'The live lane may be Beta or Pilot; unlabeled Production requires the protected production-promotion workflow';
  end if;
  if lower(trim(coalesce(p_source_commit,''))) !~ '^[0-9a-f]{7,64}$' then
    raise exception 'Source commit is invalid';
  end if;
  if char_length(trim(coalesce(p_purpose,''))) not between 20 and 2000
     or char_length(trim(coalesce(p_evidence_reference,''))) not between 8 and 500 then
    raise exception 'Live-lane purpose and evidence reference are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('ednotebook:live-service-operating-lane'));
  select * into v_previous
  from public.live_service_operating_lane_versions lane
  order by lane.version desc
  limit 1
  for update;

  select coalesce(array_agg(profile.id order by profile.id),'{}'::uuid[])
  into v_account_ids
  from public.profiles profile;
  select coalesce(array_agg(course.id order by course.id),'{}'::uuid[])
  into v_course_ids
  from public.courses course;
  v_carry_set_sha256 := encode(extensions.digest(convert_to(
    jsonb_build_object('account_ids',v_account_ids,'course_ids',v_course_ids)::text,
    'UTF8'
  ),'sha256'),'hex');

  if v_previous.id is not null
     and v_previous.operating_lane=p_operating_lane
     and v_previous.source_commit=lower(trim(p_source_commit))
     and v_previous.carry_set_sha256=v_carry_set_sha256 then
    return jsonb_build_object('record',to_jsonb(v_previous)-'carried_account_ids'-'carried_course_ids','created',false);
  end if;

  v_version := coalesce(v_previous.version,0)+1;
  insert into public.live_service_operating_lane_versions(
    version,operating_lane,previous_operating_lane,source_commit,purpose,evidence_reference,
    carried_account_ids,carried_course_ids,carried_account_count,carried_course_count,
    carry_set_sha256,recorded_by,recorded_at,supersedes_lane_id
  ) values (
    v_version,p_operating_lane,v_previous.operating_lane,lower(trim(p_source_commit)),trim(p_purpose),
    trim(p_evidence_reference),v_account_ids,v_course_ids,cardinality(v_account_ids),
    cardinality(v_course_ids),v_carry_set_sha256,v_actor,now(),v_previous.id
  ) returning * into v_record;

  insert into public.audit_events(
    actor_id,event_type,target_type,target_id,details,event_hash,data_lane,environment_scope
  ) values (
    v_actor,'student_data.live_operating_lane_recorded','live_service_operating_lane',v_record.id::text,
    jsonb_build_object(
      'deployment_surface','live_service',
      'operating_lane',v_record.operating_lane,
      'previous_operating_lane',v_record.previous_operating_lane,
      'version',v_record.version,
      'source_commit',v_record.source_commit,
      'carried_account_count',v_record.carried_account_count,
      'carried_course_count',v_record.carried_course_count,
      'carry_set_sha256',v_record.carry_set_sha256,
      'new_site_created',false,
      'new_database_created',false,
      'new_url_created',false,
      'production_action_executed',false
    ),'',v_record.operating_lane,'live_service'
  );

  return jsonb_build_object('record',to_jsonb(v_record)-'carried_account_ids'-'carried_course_ids','created',true);
end;
$$;

revoke all on function private.current_live_service_operating_lane() from public,anon,authenticated,service_role;
revoke all on function private.current_request_deployment_surface() from public,anon,authenticated,service_role;
revoke all on function public.get_live_service_operating_lane() from public,anon,authenticated;
revoke all on function public.record_live_service_operating_lane(text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.get_live_service_operating_lane() to authenticated;
grant execute on function public.record_live_service_operating_lane(text,text,text,text,boolean) to authenticated;

comment on table public.live_service_operating_lane_versions is
  'Append-only Beta/Pilot versions for the normal live EdNotebook service. A version carries the same accounts and courses forward; it never creates a site, URL, database, or copy.';
comment on function public.get_live_service_operating_lane() is
  'Returns the authenticated live-service operating lane label only. The permanent /staging upgrade sandbox does not call this function; the deployment manifest supplies the pre-authentication label.';
comment on function public.record_live_service_operating_lane(text,text,text,text,boolean) is
  'Records a platform-owner-attested Beta or Pilot transition on the same live service and hashes the exact carried account/course set. Production remains separately protected.';
comment on column public.audit_events.environment_scope is
  'Deployment surface: staging_sandbox or live_service. Legacy staging/production values remain valid for immutable history.';
comment on column public.audit_events.data_lane is
  'Operating lane: sandbox, beta, pilot, or production. Beta/Pilot apply to the live service, not the /staging upgrade sandbox.';
