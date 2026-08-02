-- Govern the accountable securityApproval decision without enabling production.
-- PASS, HOLD, and FAIL remain append-only human decisions. A platform-owner
-- identity alone is intentionally insufficient for this independent gate.

create or replace function public.record_student_data_intake_evidence(
  p_institution_id uuid,
  p_gate_key text,
  p_status text,
  p_evidence_reference text,
  p_summary text,
  p_tested_commit text default null,
  p_migration_version text default null,
  p_environment_reference text default null,
  p_region text default null,
  p_evidence_summary jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null,
  p_attestation boolean default false
)
returns public.student_data_intake_evidence_versions
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid;
  v_previous public.student_data_intake_evidence_versions%rowtype;
  v_record public.student_data_intake_evidence_versions%rowtype;
  v_version integer;
  v_evidence_expiration_ceiling timestamptz;
  v_staging_project_ref text;
begin
  v_actor := (select auth.uid());
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_platform_owner(v_actor)
    or private.has_institution_capability(p_institution_id,'view_audit',v_actor)
    or private.has_institution_capability(p_institution_id,'manage_retention',v_actor)
  ) then raise exception 'Student-data evidence review denied'; end if;
  if p_status not in ('passed','failed','hold') then raise exception 'Evidence status is invalid'; end if;
  if p_status='passed' and not p_attestation then raise exception 'Human evidence attestation required'; end if;
  if char_length(trim(coalesce(p_evidence_reference,'')))<8 or char_length(trim(coalesce(p_summary,'')))<20 then
    raise exception 'Evidence reference and summary are required';
  end if;
  if p_tested_commit is not null and p_tested_commit !~ '^[0-9a-f]{7,64}$' then raise exception 'Tested commit is invalid'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'Evidence expiry must be in the future'; end if;
  if jsonb_typeof(coalesce(p_evidence_summary,'{}'::jsonb))<>'object' then raise exception 'Evidence summary must be an object'; end if;

  if p_gate_key='securityApproval' then
    if not exists (
      select 1
      from public.institution_memberships membership
      where membership.institution_id=p_institution_id
        and membership.user_id=v_actor
        and membership.status='active'
        and membership.role='security'
    ) then
      raise exception 'An active institution security reviewer membership is required';
    end if;
    if not p_attestation then raise exception 'Accountable security reviewer attestation required'; end if;
    if p_tested_commit is null
       or char_length(trim(coalesce(p_migration_version,'')))<8
       or char_length(trim(coalesce(p_environment_reference,'')))<8
       or char_length(trim(coalesce(p_region,'')))<2
       or p_expires_at is null then
      raise exception 'Security decision candidate binding and expiration are required';
    end if;
    if char_length(trim(coalesce(p_evidence_summary->>'reviewer_name','')))<2
       or char_length(trim(coalesce(p_evidence_summary->>'reviewer_title_and_security_authority','')))<8
       or char_length(trim(coalesce(p_evidence_summary->>'technical_evidence_packet','')))<8 then
      raise exception 'Accountable reviewer identity, authority, and evidence packet are required';
    end if;
    if lower(coalesce(p_evidence_summary->>'decision',''))<>p_status
       or p_evidence_summary->>'candidate_merge_commit'<>p_tested_commit
       or p_evidence_summary->>'hosted_migration'<>p_migration_version
       or p_evidence_summary->>'environment_scope'<>'staging'
       or coalesce((p_evidence_summary->>'reviewer_authority_attested')::boolean,false) is not true
       or coalesce((p_evidence_summary->>'production_project_touched')::boolean,true) is not false
       or coalesce((p_evidence_summary->>'production_student_intake_enabled')::boolean,true) is not false
       or coalesce((p_evidence_summary->>'production_action_executed')::boolean,true) is not false then
      raise exception 'Security decision metadata does not match the governed staging boundary';
    end if;
    v_staging_project_ref := trim(coalesce(p_evidence_summary->>'staging_project_ref',''));
    if char_length(v_staging_project_ref)<8
       or position(lower(v_staging_project_ref) in lower(p_environment_reference))=0 then
      raise exception 'Security decision staging project binding is invalid';
    end if;
    if p_status='passed' and (
      coalesce((p_evidence_summary->>'independent_review_completed')::boolean,false) is not true
      or coalesce((p_evidence_summary->>'residual_risks_accepted')::boolean,false) is not true
      or coalesce((p_evidence_summary->>'incident_boundary_accepted')::boolean,false) is not true
    ) then
      raise exception 'PASS requires independent review and explicit residual-risk and incident-boundary acceptance';
    end if;

    with current_evidence as (
      select distinct on (evidence.gate_key)
        evidence.gate_key,evidence.status,evidence.expires_at
      from public.student_data_intake_evidence_versions evidence
      where evidence.institution_id=p_institution_id
        and evidence.gate_key<>'securityApproval'
      order by evidence.gate_key,evidence.version desc
    )
    select min(current_evidence.expires_at)
    into v_evidence_expiration_ceiling
    from current_evidence
    where current_evidence.status='passed'
      and current_evidence.expires_at is not null;

    if v_evidence_expiration_ceiling is not null
       and p_expires_at>v_evidence_expiration_ceiling then
      raise exception 'Security decision expiry exceeds the underlying evidence ceiling';
    end if;
  end if;

  select * into v_previous
  from public.student_data_intake_evidence_versions
  where institution_id=p_institution_id and gate_key=p_gate_key
  order by version desc
  limit 1
  for update;
  if not exists(select 1 from public.student_data_intake_gate_definitions where gate_key=p_gate_key and active) then
    raise exception 'Intake evidence gate is not active';
  end if;
  v_version:=coalesce(v_previous.version,0)+1;

  insert into public.student_data_intake_evidence_versions(
    institution_id,gate_key,version,status,evidence_reference,summary,tested_commit,
    migration_version,environment_reference,region,evidence_summary,reviewed_by,
    reviewed_at,expires_at,supersedes_evidence_id
  ) values (
    p_institution_id,p_gate_key,v_version,p_status,trim(p_evidence_reference),trim(p_summary),
    nullif(trim(coalesce(p_tested_commit,'')),''),nullif(trim(coalesce(p_migration_version,'')),''),
    nullif(trim(coalesce(p_environment_reference,'')),''),nullif(trim(coalesce(p_region,'')),''),
    coalesce(p_evidence_summary,'{}'::jsonb),v_actor,now(),p_expires_at,v_previous.id
  ) returning * into v_record;

  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values(v_actor,p_institution_id,'student_data.intake_evidence_recorded','student_data_intake_evidence',v_record.id::text,
    jsonb_build_object('gate_key',p_gate_key,'version',v_version,'status',p_status,'tested_commit',v_record.tested_commit), '');
  return v_record;
end;
$$;

revoke all on function public.record_student_data_intake_evidence(uuid,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean) from public,anon;
grant execute on function public.record_student_data_intake_evidence(uuid,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean) to authenticated;

comment on function public.record_student_data_intake_evidence(uuid,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean) is
  'Appends governed intake evidence. securityApproval additionally requires an active institution security reviewer, exact staging metadata, explicit human acceptance, and an expiration bounded by underlying evidence. It never enables production intake.';
