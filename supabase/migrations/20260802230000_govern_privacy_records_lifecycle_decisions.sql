-- Finalize the TOS synthetic-staging lifecycle decision baseline without
-- claiming institutional adoption, enabling production intake, or executing
-- any retention action. Every active domain receives an explicit approved or
-- blocked decision and the privacyRecordsApproval gate remains fail closed.

create or replace function private.enforce_student_data_lifecycle_policy_semantics()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='approved' and new.disposition='block' then
    raise exception 'An approved lifecycle policy cannot use the block disposition';
  end if;
  if new.status='blocked' and (new.disposition<>'block' or new.retention_days is not null) then
    raise exception 'A blocked lifecycle policy must use block with no retention period';
  end if;
  return new;
end;
$$;

drop trigger if exists student_data_lifecycle_policy_semantics on public.student_data_lifecycle_policy_versions;
create trigger student_data_lifecycle_policy_semantics
before insert on public.student_data_lifecycle_policy_versions
for each row execute function private.enforce_student_data_lifecycle_policy_semantics();

create or replace function public.record_tos_staging_lifecycle_decision_batch(
  p_institution_id uuid,
  p_manifest_text text,
  p_manifest_sha256 text,
  p_reviewer_name text,
  p_reviewer_authority text,
  p_evidence_reference text,
  p_summary text,
  p_attestation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_manifest jsonb;
  v_manifest_hash text;
  v_policy jsonb;
  v_previous public.student_data_lifecycle_policy_versions%rowtype;
  v_record public.student_data_lifecycle_policy_versions%rowtype;
  v_status text;
  v_disposition text;
  v_retention_days integer;
  v_review_due_at timestamptz;
  v_version integer;
  v_inserted integer := 0;
  v_reused integer := 0;
  v_approved integer := 0;
  v_blocked integer := 0;
  v_notes text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_institution_id<>'22222222-2222-4222-8222-222222222222'::uuid then
    raise exception 'This signed baseline is limited to the TOS synthetic staging institution';
  end if;
  if not (
    private.is_platform_owner(v_actor)
    or exists (
      select 1
      from public.institution_memberships membership
      where membership.institution_id=p_institution_id
        and membership.user_id=v_actor
        and membership.status='active'
        and membership.role in ('owner','admin','security','records')
    )
  ) then raise exception 'Active TOS staging oversight membership is required'; end if;
  if not p_attestation then raise exception 'Human lifecycle-decision attestation required'; end if;
  if char_length(trim(coalesce(p_reviewer_name,'')))<2
     or char_length(trim(coalesce(p_reviewer_authority,'')))<8
     or char_length(trim(coalesce(p_evidence_reference,''))) not between 8 and 400
     or char_length(trim(coalesce(p_summary,''))) not between 20 and 2000 then
    raise exception 'Reviewer identity, authority, evidence reference, and decision summary are required';
  end if;
  if char_length(coalesce(p_manifest_text,''))<1000 then raise exception 'The complete lifecycle manifest is required'; end if;

  v_manifest_hash := encode(extensions.digest(convert_to(p_manifest_text,'UTF8'),'sha256'),'hex');
  if lower(trim(coalesce(p_manifest_sha256,'')))<>'977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5'
     or v_manifest_hash<>lower(trim(p_manifest_sha256)) then
    raise exception 'Lifecycle manifest checksum does not match the governed decision set';
  end if;

  begin
    v_manifest := p_manifest_text::jsonb;
  exception when others then
    raise exception 'Lifecycle manifest is not valid JSON';
  end;
  if jsonb_typeof(v_manifest)<>'object'
     or v_manifest->>'scope'<>'tos_synthetic_staging_baseline'
     or v_manifest->>'decision_status'<>'all_domains_decided_privacy_records_hold'
     or v_manifest->>'institution_id'<>p_institution_id::text
     or v_manifest->>'staging_project_ref'<>'gfalgonektwdylsxsgzc'
     or v_manifest->>'protected_candidate_commit'<>'3076110661a30f970f0e3eec7e53413aa69e548b'
     or v_manifest->>'production_project_ref_unchanged'<>'didwxihufueqbpfnfdmm'
     or coalesce((v_manifest->>'required_domain_count')::integer,0)<>61
     or coalesce((v_manifest->>'approved_domain_count')::integer,0)<>33
     or coalesce((v_manifest->>'blocked_domain_count')::integer,0)<>28
     or v_manifest->>'privacy_records_gate'<>'hold'
     or v_manifest->>'asu_institutional_adoption'<>'parked_pending_authorized_review'
     or coalesce((v_manifest->>'production_student_intake_enabled')::boolean,true) is not false
     or coalesce((v_manifest->>'production_project_touched')::boolean,true) is not false
     or coalesce((v_manifest->>'automatic_lifecycle_execution_enabled')::boolean,true) is not false
     or coalesce((v_manifest->>'contains_student_data')::boolean,true) is not false then
    raise exception 'Lifecycle manifest metadata does not match the governed staging boundary';
  end if;
  if jsonb_typeof(v_manifest->'policies')<>'array'
     or jsonb_array_length(v_manifest->'policies')<>61 then
    raise exception 'Lifecycle manifest must contain exactly 61 decisions';
  end if;
  if (select count(distinct policy->>'domain_key') from jsonb_array_elements(v_manifest->'policies') policy)<>61 then
    raise exception 'Lifecycle manifest domain keys must be unique';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_manifest->'policies') policy
    left join public.student_data_lifecycle_domains domain
      on domain.domain_key=policy->>'domain_key' and domain.active
    where domain.domain_key is null
  ) or exists (
    select 1 from public.student_data_lifecycle_domains domain
    where domain.active and not exists (
      select 1 from jsonb_array_elements(v_manifest->'policies') policy
      where policy->>'domain_key'=domain.domain_key
    )
  ) then raise exception 'Lifecycle manifest does not exactly match the active domain registry'; end if;
  if (select count(*) from jsonb_array_elements(v_manifest->'policies') policy where policy->>'status'='approved')<>33
     or (select count(*) from jsonb_array_elements(v_manifest->'policies') policy where policy->>'status'='blocked')<>28 then
    raise exception 'Lifecycle manifest must contain exactly 33 approved and 28 blocked decisions';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_institution_id::text || ':tos-lifecycle-final'));

  for v_policy in select value from jsonb_array_elements(v_manifest->'policies')
  loop
    v_status := v_policy->>'status';
    v_disposition := v_policy->>'disposition';
    v_retention_days := case when v_policy->'retention_days'='null'::jsonb then null else (v_policy->>'retention_days')::integer end;
    v_review_due_at := (v_policy->>'review_due_at')::timestamptz;

    if v_status not in ('approved','blocked')
       or v_disposition not in ('delete','anonymize','retain','block')
       or (v_status='approved' and v_disposition='block')
       or (v_status='blocked' and (v_disposition<>'block' or v_retention_days is not null))
       or (v_disposition in ('delete','anonymize') and (v_retention_days is null or v_retention_days not between 0 and 36500))
       or (v_disposition='retain' and (v_retention_days is null or v_retention_days not between 1 and 36500))
       or char_length(trim(coalesce(v_policy->>'purpose','')))<20
       or char_length(trim(coalesce(v_policy->>'trigger','')))<20
       or char_length(trim(coalesce(v_policy->>'condition','')))<20
       or v_review_due_at<=now()
       or v_review_due_at>'2026-10-30T23:59:59Z'::timestamptz
       or coalesce((v_policy->>'automatic_execution_enabled')::boolean,true) is not false then
      raise exception 'Lifecycle decision for % violates the governed semantic contract',v_policy->>'domain_key';
    end if;

    v_notes := jsonb_build_object(
      'manifest_sha256',v_manifest_hash,
      'reviewer_name',trim(p_reviewer_name),
      'reviewer_authority',trim(p_reviewer_authority),
      'summary',trim(p_summary),
      'trigger',v_policy->>'trigger',
      'record_series',v_policy->>'record_series',
      'accountable_owner',v_policy->>'accountable_owner',
      'official_copy_role',v_policy->>'official_copy_role',
      'privacy_classification',v_policy->>'privacy_classification',
      'decision_basis',v_policy->>'decision_basis',
      'condition',v_policy->>'condition',
      'dependency',v_policy->>'dependency',
      'authority_reference',v_policy->>'authority_reference',
      'asu_institutional_adoption','parked',
      'automatic_execution_enabled',false
    )::text;
    if char_length(v_notes)>4000 then raise exception 'Lifecycle review notes exceed the governed limit'; end if;

    select * into v_previous
    from public.student_data_lifecycle_policy_versions
    where institution_id=p_institution_id and domain_key=v_policy->>'domain_key'
    order by version desc
    limit 1
    for update;

    if found
       and v_previous.status=v_status
       and v_previous.disposition=v_disposition
       and v_previous.retention_days is not distinct from v_retention_days
       and v_previous.review_due_at is not distinct from v_review_due_at
       and position(v_manifest_hash in v_previous.review_notes)>0 then
      v_reused := v_reused + 1;
    else
      v_version := coalesce(v_previous.version,0)+1;
      insert into public.student_data_lifecycle_policy_versions(
        institution_id,domain_key,version,disposition,retention_days,purpose,
        evidence_reference,review_notes,status,approved_by,approved_at,review_due_at,
        supersedes_policy_id
      ) values (
        p_institution_id,v_policy->>'domain_key',v_version,v_disposition,v_retention_days,
        trim(v_policy->>'purpose'),trim(p_evidence_reference),v_notes,v_status,v_actor,now(),
        v_review_due_at,v_previous.id
      ) returning * into v_record;

      insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
      values(v_actor,p_institution_id,'student_data.lifecycle_policy_recorded','student_data_lifecycle_policy',v_record.id::text,
        jsonb_build_object('domain_key',v_record.domain_key,'version',v_record.version,'disposition',v_record.disposition,
          'status',v_record.status,'manifest_sha256',v_manifest_hash,'automatic_execution_enabled',false), '');
      v_inserted := v_inserted + 1;
    end if;

    if v_status='approved' then v_approved := v_approved+1; else v_blocked := v_blocked+1; end if;
  end loop;

  return jsonb_build_object(
    'decision','hold',
    'recorded_domain_count',61,
    'approved_domain_count',v_approved,
    'blocked_domain_count',v_blocked,
    'inserted_domain_count',v_inserted,
    'reused_domain_count',v_reused,
    'manifest_sha256',v_manifest_hash,
    'automatic_lifecycle_execution_enabled',false,
    'production_student_intake_enabled',false,
    'production_project_touched',false
  );
end;
$$;

create or replace function private.enforce_privacy_records_approval_evidence()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_required integer;
  v_recorded integer;
  v_approved integer;
  v_blocked integer;
  v_expired integer;
  v_evidence_expiration_ceiling timestamptz;
begin
  if new.gate_key<>'privacyRecordsApproval' then return new; end if;
  if not exists (
    select 1 from public.institution_memberships membership
    where membership.institution_id=new.institution_id
      and membership.user_id=new.reviewed_by
      and membership.status='active'
      and membership.role in ('owner','admin','security','records')
  ) and not private.is_platform_owner(new.reviewed_by) then
    raise exception 'Active TOS privacy or records oversight is required';
  end if;
  if new.institution_id<>'22222222-2222-4222-8222-222222222222'::uuid
     or new.tested_commit<>'3076110661a30f970f0e3eec7e53413aa69e548b'
     or new.migration_version<>'20260802230000_govern_privacy_records_lifecycle_decisions'
     or new.region<>'us-east-1'
     or position('gfalgonektwdylsxsgzc' in lower(coalesce(new.environment_reference,'')))=0
     or new.expires_at is null
     or new.expires_at>'2026-10-30T23:59:59Z'::timestamptz then
    raise exception 'Privacy/records evidence does not bind the governed staging candidate';
  end if;
  if char_length(trim(coalesce(new.evidence_summary->>'reviewer_name','')))<2
     or char_length(trim(coalesce(new.evidence_summary->>'reviewer_title_unit_and_authority','')))<8
     or lower(coalesce(new.evidence_summary->>'decision',''))<>new.status
     or new.evidence_summary->>'manifest_sha256'<>'977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5'
     or new.evidence_summary->>'staging_project_ref'<>'gfalgonektwdylsxsgzc'
     or new.evidence_summary->>'environment_scope'<>'staging'
     or coalesce((new.evidence_summary->>'reviewer_authority_attested')::boolean,false) is not true
     or coalesce((new.evidence_summary->>'lifecycle_reconciliation_completed')::boolean,false) is not true
     or coalesce((new.evidence_summary->>'calendar_guardrails_accepted')::boolean,false) is not true
     or coalesce((new.evidence_summary->>'ferpa_access_dispute_audit_and_hold_overrides_accepted')::boolean,false) is not true
     or coalesce((new.evidence_summary->>'provider_residual_copies_reviewed')::boolean,false) is not true
     or coalesce((new.evidence_summary->>'research_and_irb_boundary_accepted')::boolean,false) is not true
     or coalesce((new.evidence_summary->>'asu_institutional_adoption_parked')::boolean,false) is not true
     or coalesce((new.evidence_summary->>'automatic_lifecycle_execution_enabled')::boolean,true) is not false
     or coalesce((new.evidence_summary->>'production_project_touched')::boolean,true) is not false
     or coalesce((new.evidence_summary->>'production_student_intake_enabled')::boolean,true) is not false
     or coalesce((new.evidence_summary->>'production_action_executed')::boolean,true) is not false then
    raise exception 'Privacy/records evidence metadata does not match the governed HOLD boundary';
  end if;

  with current_policies as (
    select distinct on (policy.domain_key) policy.*
    from public.student_data_lifecycle_policy_versions policy
    where policy.institution_id=new.institution_id
    order by policy.domain_key,policy.version desc
  )
  select
    count(*) filter (where domain.active),
    count(policy.id) filter (where domain.active),
    count(policy.id) filter (where domain.active and policy.status='approved' and (policy.review_due_at is null or policy.review_due_at>now())),
    count(policy.id) filter (where domain.active and policy.status='blocked' and (policy.review_due_at is null or policy.review_due_at>now())),
    count(policy.id) filter (where domain.active and policy.review_due_at is not null and policy.review_due_at<=now())
  into v_required,v_recorded,v_approved,v_blocked,v_expired
  from public.student_data_lifecycle_domains domain
  left join current_policies policy on policy.domain_key=domain.domain_key;

  if v_required<>61 or v_recorded<>61 or v_expired<>0 then
    raise exception 'Privacy/records evidence requires 61 current, unexpired lifecycle decisions';
  end if;
  if coalesce((new.evidence_summary->>'lifecycle_domain_count')::integer,0)<>v_required
     or coalesce((new.evidence_summary->>'recorded_lifecycle_domain_count')::integer,0)<>v_recorded
     or coalesce((new.evidence_summary->>'approved_lifecycle_domain_count')::integer,0)<>v_approved
     or coalesce((new.evidence_summary->>'blocked_lifecycle_domain_count')::integer,0)<>v_blocked then
    raise exception 'Privacy/records evidence counts do not match current lifecycle decisions';
  end if;
  if new.status='passed' then
    if v_approved<>61 or v_blocked<>0 then
      raise exception 'Privacy/records PASS requires all 61 lifecycle domains approved and none blocked';
    end if;
    if not exists (
      select 1 from public.institution_memberships membership
      where membership.institution_id=new.institution_id
        and membership.user_id=new.reviewed_by
        and membership.status='active'
        and membership.role in ('owner','records')
    ) or char_length(trim(coalesce(new.evidence_summary->>'independent_second_reviewer','')))<2 then
      raise exception 'Privacy/records PASS requires records authority and an independent second reviewer';
    end if;
  elsif new.status='hold' and (v_approved<>33 or v_blocked<>28) then
    raise exception 'This governed HOLD requires exactly 33 approved and 28 blocked lifecycle decisions';
  end if;

  with current_evidence as (
    select distinct on (evidence.gate_key) evidence.gate_key,evidence.status,evidence.expires_at
    from public.student_data_intake_evidence_versions evidence
    where evidence.institution_id=new.institution_id and evidence.gate_key<>'privacyRecordsApproval'
    order by evidence.gate_key,evidence.version desc
  )
  select min(evidence.expires_at) into v_evidence_expiration_ceiling
  from current_evidence evidence
  where evidence.status='passed' and evidence.expires_at is not null;
  if v_evidence_expiration_ceiling is not null and new.expires_at>v_evidence_expiration_ceiling then
    raise exception 'Privacy/records decision expiry exceeds the underlying evidence ceiling';
  end if;
  return new;
end;
$$;

drop trigger if exists privacy_records_approval_evidence_guard on public.student_data_intake_evidence_versions;
create trigger privacy_records_approval_evidence_guard
before insert on public.student_data_intake_evidence_versions
for each row execute function private.enforce_privacy_records_approval_evidence();

create or replace function private.student_data_intake_readiness(p_institution_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
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
  ), policy_summary as (
    select
      count(*) filter (where domain.active) as required_count,
      count(policy.id) filter (where domain.active) as recorded_count,
      count(policy.id) filter (where domain.active and policy.status='blocked' and (policy.review_due_at is null or policy.review_due_at>now())) as blocked_count,
      count(policy.id) filter (where domain.active and policy.review_due_at is not null and policy.review_due_at<=now()) as expired_count,
      count(policy.id) filter (
        where domain.active and policy.status='approved' and policy.reviewer_type='human'
          and policy.approved_at<=now() and (policy.review_due_at is null or policy.review_due_at>now())
      ) as approved_count,
      coalesce(jsonb_agg(domain.domain_key order by domain.domain_key) filter (where domain.active and policy.id is null),'[]'::jsonb) as unrecorded,
      coalesce(jsonb_agg(domain.domain_key order by domain.domain_key) filter (where domain.active and policy.status='blocked'),'[]'::jsonb) as blocked,
      coalesce(jsonb_agg(domain.domain_key order by domain.domain_key) filter (
        where domain.active and (
          policy.id is null or policy.status<>'approved' or policy.reviewer_type<>'human'
          or policy.approved_at>now() or (policy.review_due_at is not null and policy.review_due_at<=now())
        )
      ),'[]'::jsonb) as missing
    from public.student_data_lifecycle_domains domain
    left join current_policies policy on policy.domain_key=domain.domain_key
  ), evidence_summary as (
    select
      count(*) filter (where gate.active) as required_count,
      count(evidence.id) filter (
        where gate.active and evidence.status='passed' and evidence.reviewer_type='human'
          and evidence.reviewed_at<=now() and (evidence.expires_at is null or evidence.expires_at>now())
      ) as passed_count,
      coalesce(jsonb_agg(gate.gate_key order by gate.gate_key) filter (
        where gate.active and (
          evidence.id is null or evidence.status<>'passed' or evidence.reviewer_type<>'human'
          or evidence.reviewed_at>now() or (evidence.expires_at is not null and evidence.expires_at<=now())
        )
      ),'[]'::jsonb) as missing
    from public.student_data_intake_gate_definitions gate
    left join current_evidence evidence on evidence.gate_key=gate.gate_key
  )
  select jsonb_build_object(
    'decision',case when policy_summary.approved_count=policy_summary.required_count
                          and evidence_summary.passed_count=evidence_summary.required_count
                     then 'ready_for_human_promotion_review' else 'hold' end,
    'ready_for_promotion_review',policy_summary.approved_count=policy_summary.required_count
      and evidence_summary.passed_count=evidence_summary.required_count,
    'production_student_intake_enabled',false,
    'lifecycle_domain_count',policy_summary.required_count,
    'recorded_lifecycle_domain_count',policy_summary.recorded_count,
    'approved_lifecycle_domain_count',policy_summary.approved_count,
    'blocked_lifecycle_domain_count',policy_summary.blocked_count,
    'expired_lifecycle_domain_count',policy_summary.expired_count,
    'unrecorded_lifecycle_domains',policy_summary.unrecorded,
    'blocked_lifecycle_domains',policy_summary.blocked,
    'required_evidence_gate_count',evidence_summary.required_count,
    'passed_evidence_gate_count',evidence_summary.passed_count,
    'missing_lifecycle_domains',policy_summary.missing,
    'missing_evidence_gates',evidence_summary.missing,
    'policies',coalesce((select jsonb_agg(to_jsonb(policy) order by policy.domain_key) from current_policies policy),'[]'::jsonb),
    'evidence',coalesce((select jsonb_agg(to_jsonb(evidence) order by evidence.gate_key) from current_evidence evidence),'[]'::jsonb),
    'subject_requests',coalesce((
      select jsonb_agg(to_jsonb(request_record) order by request_record.requested_at desc)
      from (
        select * from public.student_data_subject_requests request_source
        where request_source.institution_id=p_institution_id
        order by request_source.requested_at desc limit 100
      ) request_record
    ),'[]'::jsonb)
  ) from policy_summary,evidence_summary;
$$;

revoke all on function private.enforce_student_data_lifecycle_policy_semantics() from public,anon,authenticated,service_role;
revoke all on function private.enforce_privacy_records_approval_evidence() from public,anon,authenticated,service_role;
revoke all on function private.student_data_intake_readiness(uuid) from public,anon,authenticated,service_role;
revoke all on function public.record_tos_staging_lifecycle_decision_batch(uuid,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.record_tos_staging_lifecycle_decision_batch(uuid,text,text,text,text,text,text,boolean) to authenticated;

comment on function public.record_tos_staging_lifecycle_decision_batch(uuid,text,text,text,text,text,text,boolean) is
  'Atomically records the checksum-bound TOS synthetic-staging 61-domain baseline as 33 approved and 28 blocked human decisions. It is idempotent and never enables lifecycle execution or production intake.';
comment on function private.enforce_privacy_records_approval_evidence() is
  'Fail-closed guard for privacyRecordsApproval. HOLD requires the exact 61/33/28 staging baseline; PASS requires 61 approved, zero blocked, records authority, and an independent second reviewer.';
