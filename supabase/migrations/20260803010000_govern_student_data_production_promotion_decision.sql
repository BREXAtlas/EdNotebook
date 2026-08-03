-- Final Phase 5 of 5: governed production-promotion decision.
--
-- This migration adds an append-only human decision record over the exact
-- Phase 4 preflight. It cannot deploy, link to, migrate, or enable the
-- production project. A HOLD applies only to production; bounded Beta and
-- authorized Pilot testing remain available in the existing staging system.

create table public.student_data_production_promotion_decision_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  version integer not null check (version > 0),
  decision text not null check (decision in ('hold','approved_for_manual_promotion')),
  preflight_version_id uuid not null references public.student_data_promotion_preflight_versions(id) on delete restrict,
  preflight_snapshot_sha256 text not null check (preflight_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  decision_snapshot jsonb not null check (jsonb_typeof(decision_snapshot)='object'),
  decision_snapshot_sha256 text not null check (decision_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{7,64}$'),
  target_environment text not null default 'production' check (target_environment='production'),
  target_project_ref_sha256 text not null check (
    target_project_ref_sha256='fc9aed1322166add36f6e7b6711367c715891bff8c3e9dabf03f0e80c816a9b0'
  ),
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 8 and 500),
  rollback_reference text not null check (char_length(trim(rollback_reference)) between 8 and 500),
  summary text not null check (char_length(trim(summary)) between 20 and 2000),
  reviewer_type text not null default 'human' check (reviewer_type='human'),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  valid_until timestamptz not null,
  production_student_intake_enabled boolean not null default false check (production_student_intake_enabled=false),
  production_action_executed boolean not null default false check (production_action_executed=false),
  automatic_lifecycle_execution_enabled boolean not null default false check (automatic_lifecycle_execution_enabled=false),
  staging_beta_testing_allowed boolean not null default true check (staging_beta_testing_allowed=true),
  staging_pilot_testing_allowed boolean not null default true check (staging_pilot_testing_allowed=true),
  supersedes_decision_id uuid references public.student_data_production_promotion_decision_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (institution_id,version),
  check (valid_until > recorded_at),
  check (decision<>'approved_for_manual_promotion'
    or coalesce((decision_snapshot->>'eligible_for_manual_promotion')::boolean,false) is true),
  check (decision_snapshot->>'target_environment'='production'),
  check (decision_snapshot->>'target_project_ref_sha256'=target_project_ref_sha256),
  check (coalesce((decision_snapshot->>'production_student_intake_enabled')::boolean,true) is false),
  check (coalesce((decision_snapshot->>'production_action_executed')::boolean,true) is false),
  check (coalesce((decision_snapshot->>'automatic_lifecycle_execution_enabled')::boolean,true) is false),
  check (coalesce((decision_snapshot->>'staging_beta_testing_allowed')::boolean,false) is true),
  check (coalesce((decision_snapshot->>'staging_pilot_testing_allowed')::boolean,false) is true),
  check (decision_snapshot->>'testing_data_scope'='beta_demo_or_authorized_pilot_data')
);

create index student_data_production_promotion_recorded_by_idx
  on public.student_data_production_promotion_decision_versions(recorded_by);
create index student_data_production_promotion_preflight_idx
  on public.student_data_production_promotion_decision_versions(preflight_version_id);
create index student_data_production_promotion_supersedes_idx
  on public.student_data_production_promotion_decision_versions(supersedes_decision_id);

alter table public.student_data_production_promotion_decision_versions enable row level security;
revoke all on table public.student_data_production_promotion_decision_versions from public,anon,authenticated;
grant select,insert on table public.student_data_production_promotion_decision_versions to service_role;
create policy student_data_production_promotion_versions_api_deny_all
on public.student_data_production_promotion_decision_versions
as restrictive for all to anon,authenticated
using (false) with check (false);

create trigger student_data_production_promotion_decision_versions_append_only
before update or delete on public.student_data_production_promotion_decision_versions
for each row execute function private.reject_student_data_governance_mutation();

create or replace function private.student_data_production_promotion_review(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_current_preflight jsonb;
  v_current_snapshot jsonb;
  v_latest_preflight public.student_data_promotion_preflight_versions%rowtype;
  v_preflight_recorded boolean := false;
  v_preflight_matches boolean := false;
  v_eligible boolean := false;
  v_snapshot jsonb;
  v_snapshot_sha256 text;
  v_valid_until timestamptz;
begin
  v_current_preflight := private.student_data_promotion_preflight(p_institution_id);
  v_current_snapshot := v_current_preflight->'snapshot';
  v_valid_until := (v_current_preflight->>'valid_until')::timestamptz;

  select * into v_latest_preflight
  from public.student_data_promotion_preflight_versions preflight
  where preflight.institution_id=p_institution_id
  order by preflight.version desc
  limit 1;

  v_preflight_recorded := found;
  if v_preflight_recorded then
    v_preflight_matches := v_latest_preflight.snapshot_sha256=v_current_preflight->>'snapshot_sha256'
      and v_latest_preflight.valid_until=v_valid_until
      and v_latest_preflight.valid_until>now();
  end if;

  v_eligible := v_preflight_matches
    and v_current_snapshot->>'decision'='ready_for_human_promotion_review'
    and coalesce((v_current_snapshot->>'ready_for_promotion_review')::boolean,false) is true
    and coalesce((v_current_snapshot->>'blocked_lifecycle_domain_count')::integer,-1)=0
    and coalesce((v_current_snapshot->>'passed_evidence_gate_count')::integer,-1)
      =coalesce((v_current_snapshot->>'required_evidence_gate_count')::integer,-2);

  v_snapshot := jsonb_build_object(
    'schema_version','1.0',
    'candidate_decision',case when v_eligible then 'eligible_for_human_decision' else 'hold' end,
    'eligible_for_manual_promotion',v_eligible,
    'preflight_recorded',v_preflight_recorded,
    'preflight_matches_current_evidence',v_preflight_matches,
    'preflight_version',case when v_preflight_recorded then v_latest_preflight.version else null end,
    'preflight_snapshot_sha256',v_current_preflight->>'snapshot_sha256',
    'preflight_decision',v_current_snapshot->>'decision',
    'lifecycle_domain_count',v_current_snapshot->'lifecycle_domain_count',
    'approved_lifecycle_domain_count',v_current_snapshot->'approved_lifecycle_domain_count',
    'blocked_lifecycle_domain_count',v_current_snapshot->'blocked_lifecycle_domain_count',
    'required_evidence_gate_count',v_current_snapshot->'required_evidence_gate_count',
    'passed_evidence_gate_count',v_current_snapshot->'passed_evidence_gate_count',
    'blocked_lifecycle_domains',coalesce(v_current_snapshot->'blocked_lifecycle_domains','[]'::jsonb),
    'missing_evidence_gates',coalesce(v_current_snapshot->'missing_evidence_gates','[]'::jsonb),
    'target_environment','production',
    'target_project_ref_sha256','fc9aed1322166add36f6e7b6711367c715891bff8c3e9dabf03f0e80c816a9b0',
    'staging_beta_testing_allowed',true,
    'staging_pilot_testing_allowed',true,
    'testing_data_scope','beta_demo_or_authorized_pilot_data',
    'production_student_intake_enabled',false,
    'production_action_executed',false,
    'automatic_lifecycle_execution_enabled',false,
    'manual_promotion_required',true,
    'rollback_required',true
  );
  v_snapshot_sha256 := encode(
    extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),
    'hex'
  );

  return jsonb_build_object(
    'snapshot',v_snapshot,
    'snapshot_sha256',v_snapshot_sha256,
    'valid_until',v_valid_until,
    'production_student_intake_enabled',false,
    'production_action_executed',false,
    'staging_beta_testing_allowed',true,
    'staging_pilot_testing_allowed',true
  );
end;
$$;

create or replace function public.get_student_data_production_promotion_review(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_current jsonb;
  v_latest public.student_data_production_promotion_decision_versions%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'view_audit',(select auth.uid()))
    or private.has_institution_capability(p_institution_id,'manage_retention',(select auth.uid()))
  ) then raise exception 'Student-data production-promotion review access denied'; end if;

  v_current := private.student_data_production_promotion_review(p_institution_id);
  select * into v_latest
  from public.student_data_production_promotion_decision_versions decision_record
  where decision_record.institution_id=p_institution_id
  order by decision_record.version desc
  limit 1;

  return jsonb_build_object(
    'current',v_current,
    'latest_record',case when found then to_jsonb(v_latest) else null end,
    'production_student_intake_enabled',false,
    'production_action_executed',false,
    'staging_beta_testing_allowed',true,
    'staging_pilot_testing_allowed',true
  );
end;
$$;

create or replace function public.record_student_data_production_promotion_decision(
  p_institution_id uuid,
  p_decision text,
  p_source_commit text,
  p_evidence_reference text,
  p_rollback_reference text,
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
  v_latest_preflight public.student_data_promotion_preflight_versions%rowtype;
  v_previous public.student_data_production_promotion_decision_versions%rowtype;
  v_record public.student_data_production_promotion_decision_versions%rowtype;
  v_version integer;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_institution_id<>'22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'This decision recorder is limited to the TOS synthetic staging institution';
  end if;
  if not private.is_platform_owner(v_actor) then
    raise exception 'Only the accountable platform owner may record the production-promotion decision';
  end if;
  if not p_attestation then raise exception 'Human owner promotion-decision attestation required'; end if;
  if p_decision not in ('hold','approved_for_manual_promotion') then
    raise exception 'Production-promotion decision is invalid';
  end if;
  if coalesce(trim(p_source_commit),'') !~ '^[0-9a-f]{7,64}$' then raise exception 'Source commit is invalid'; end if;
  if char_length(trim(coalesce(p_evidence_reference,''))) not between 8 and 500
     or char_length(trim(coalesce(p_rollback_reference,''))) not between 8 and 500
     or char_length(trim(coalesce(p_summary,''))) not between 20 and 2000 then
    raise exception 'Evidence, rollback, and decision summary references are required';
  end if;
  if lower(trim(coalesce(p_expected_snapshot_sha256,''))) !~ '^[0-9a-f]{64}$' then
    raise exception 'Expected promotion-review checksum is invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
    p_institution_id::text || ':student-data-production-promotion-decision'
  ));
  v_current := private.student_data_production_promotion_review(p_institution_id);
  if v_current->>'snapshot_sha256'<>lower(trim(p_expected_snapshot_sha256)) then
    raise exception 'Production-promotion evidence changed; refresh and review again';
  end if;
  v_snapshot := v_current->'snapshot';
  if coalesce((v_snapshot->>'production_student_intake_enabled')::boolean,true)
     or coalesce((v_snapshot->>'production_action_executed')::boolean,true)
     or coalesce((v_snapshot->>'automatic_lifecycle_execution_enabled')::boolean,true) then
    raise exception 'A decision record cannot activate production or lifecycle execution';
  end if;
  if coalesce((v_snapshot->>'staging_beta_testing_allowed')::boolean,false) is not true
     or coalesce((v_snapshot->>'staging_pilot_testing_allowed')::boolean,false) is not true
     or v_snapshot->>'testing_data_scope'<>'beta_demo_or_authorized_pilot_data' then
    raise exception 'A production HOLD must preserve bounded Beta and Pilot testing';
  end if;
  if p_decision='approved_for_manual_promotion'
     and coalesce((v_snapshot->>'eligible_for_manual_promotion')::boolean,false) is not true then
    raise exception 'Production cannot be approved while lifecycle or evidence blockers remain';
  end if;

  select * into strict v_latest_preflight
  from public.student_data_promotion_preflight_versions preflight
  where preflight.institution_id=p_institution_id
    and preflight.snapshot_sha256=v_snapshot->>'preflight_snapshot_sha256'
  order by preflight.version desc
  limit 1;

  select * into v_previous
  from public.student_data_production_promotion_decision_versions decision_record
  where decision_record.institution_id=p_institution_id
  order by decision_record.version desc
  limit 1
  for update;

  if found
     and v_previous.decision=p_decision
     and v_previous.decision_snapshot_sha256=v_current->>'snapshot_sha256'
     and v_previous.source_commit=lower(trim(p_source_commit)) then
    return jsonb_build_object('record',to_jsonb(v_previous),'created',false,'production_action_executed',false);
  end if;

  v_version := coalesce(v_previous.version,0)+1;
  insert into public.student_data_production_promotion_decision_versions(
    institution_id,version,decision,preflight_version_id,preflight_snapshot_sha256,
    decision_snapshot,decision_snapshot_sha256,source_commit,target_environment,
    target_project_ref_sha256,evidence_reference,rollback_reference,summary,
    recorded_by,recorded_at,valid_until,supersedes_decision_id
  ) values (
    p_institution_id,v_version,p_decision,v_latest_preflight.id,v_latest_preflight.snapshot_sha256,
    v_snapshot,v_current->>'snapshot_sha256',lower(trim(p_source_commit)),'production',
    'fc9aed1322166add36f6e7b6711367c715891bff8c3e9dabf03f0e80c816a9b0',
    trim(p_evidence_reference),trim(p_rollback_reference),trim(p_summary),
    v_actor,now(),(v_current->>'valid_until')::timestamptz,v_previous.id
  ) returning * into v_record;

  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values(v_actor,p_institution_id,'student_data.production_promotion_decision_recorded',
    'student_data_production_promotion_decision',v_record.id::text,
    jsonb_build_object(
      'version',v_record.version,
      'decision',v_record.decision,
      'preflight_snapshot_sha256',v_record.preflight_snapshot_sha256,
      'decision_snapshot_sha256',v_record.decision_snapshot_sha256,
      'source_commit',v_record.source_commit,
      'target_environment','production',
      'target_project_ref_sha256',v_record.target_project_ref_sha256,
      'staging_beta_testing_allowed',true,
      'staging_pilot_testing_allowed',true,
      'production_student_intake_enabled',false,
      'production_action_executed',false,
      'manual_promotion_required',true
    ),'');

  return jsonb_build_object(
    'record',to_jsonb(v_record),
    'created',true,
    'production_student_intake_enabled',false,
    'production_action_executed',false
  );
end;
$$;

revoke all on function private.student_data_production_promotion_review(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_student_data_production_promotion_review(uuid) from public,anon;
revoke all on function public.record_student_data_production_promotion_decision(uuid,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.get_student_data_production_promotion_review(uuid) to authenticated;
grant execute on function public.record_student_data_production_promotion_decision(uuid,text,text,text,text,text,text,boolean) to authenticated;

comment on table public.student_data_production_promotion_decision_versions is
  'Append-only human production-promotion decisions bound to a current Phase 4 preflight. Records never activate production; Beta and Pilot remain available in staging.';
comment on function public.get_student_data_production_promotion_review(uuid) is
  'Returns the authorized checksum-bound Phase 5 production-promotion candidate and latest immutable human decision.';
comment on function public.record_student_data_production_promotion_decision(uuid,text,text,text,text,text,text,boolean) is
  'Records a platform-owner HOLD or approval for a separate manual promotion. It cannot deploy or enable production.';
