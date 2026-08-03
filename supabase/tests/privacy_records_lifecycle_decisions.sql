\set ON_ERROR_STOP on
\set manifest_base64 `base64 -w0 public/governance/tos-staging-lifecycle-final-decisions.json`

begin;
set local statement_timeout = '60s';

do $$
begin
  if has_function_privilege('anon','public.record_tos_staging_lifecycle_decision_batch(uuid,text,text,text,text,text,text,boolean)','execute') then
    raise exception 'Anonymous role must not execute the lifecycle decision batch';
  end if;
  if not has_function_privilege('authenticated','public.record_tos_staging_lifecycle_decision_batch(uuid,text,text,text,text,text,text,boolean)','execute') then
    raise exception 'Authenticated reviewers must be able to reach the governed batch RPC';
  end if;
end $$;

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '10000000-0000-4000-8000-000000000161','authenticated','authenticated',
  'privacy-records-owner@safety.invalid','not-a-login',now(),'{}',
  '{"full_name":"Privacy Records Owner","requested_role":"learner","affiliation_choice":"independent"}',now(),now()
);
update public.profiles set role='owner' where id='10000000-0000-4000-8000-000000000161';

insert into public.institutions (
  id,owner_id,name,slug,lifecycle_status,institution_type,region_code,
  institution_code,primary_lms,timezone_name,approved_at,approved_by
) values (
  '22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000161',
  'TOS Synthetic Staging','tos-synthetic-staging','active','university','TX',
  'TOS-STAGING','none','America/Chicago',now(),'10000000-0000-4000-8000-000000000161'
);
insert into public.institution_memberships(institution_id,user_id,role,status,permissions,joined_at)
values (
  '22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000161',
  'owner','active','{"view_control_center":true,"view_audit":true,"manage_retention":true}',now()
);

create temp table privacy_records_manifest_fixture(manifest_text text not null) on commit drop;
insert into privacy_records_manifest_fixture(manifest_text)
values(convert_from(decode(:'manifest_base64','base64'),'utf8'));
grant select on privacy_records_manifest_fixture to authenticated;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000161',true);
set local role authenticated;

do $$
begin
  begin
    perform public.record_tos_staging_lifecycle_decision_batch(
      '22222222-2222-4222-8222-222222222222',
      (select manifest_text from privacy_records_manifest_fixture),
      repeat('0',64),'Privacy Records Owner','TOS Platform Owner and Records Reviewer',
      'test:privacy-records-lifecycle','Testing the complete synthetic staging lifecycle decision batch.',true
    );
    raise exception 'Wrong manifest checksum was accepted';
  exception when others then
    if sqlerrm='Wrong manifest checksum was accepted' then raise; end if;
    if position('checksum' in lower(sqlerrm))=0 then raise; end if;
  end;
end $$;

select public.record_tos_staging_lifecycle_decision_batch(
  '22222222-2222-4222-8222-222222222222',
  (select manifest_text from privacy_records_manifest_fixture),
  '977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5',
  'Privacy Records Owner','TOS Platform Owner and Records Reviewer',
  'test:privacy-records-lifecycle','Recorded all 61 decisions while preserving 28 explicit blocks and production HOLD.',true
);

do $$
declare
  v_readiness jsonb;
begin
  v_readiness:=public.get_student_data_intake_readiness('22222222-2222-4222-8222-222222222222');
  if (v_readiness->>'recorded_lifecycle_domain_count')::integer<>61
     or (v_readiness->>'approved_lifecycle_domain_count')::integer<>33
     or (v_readiness->>'blocked_lifecycle_domain_count')::integer<>28
     or (v_readiness->>'expired_lifecycle_domain_count')::integer<>0
     or (v_readiness->>'production_student_intake_enabled')::boolean is not false
     or v_readiness->>'decision'<>'hold' then
    raise exception 'Readiness did not preserve the exact 61/33/28 HOLD boundary: %',v_readiness;
  end if;
end $$;

-- The same signed decision set is idempotent and creates no second versions.
select public.record_tos_staging_lifecycle_decision_batch(
  '22222222-2222-4222-8222-222222222222',
  (select manifest_text from privacy_records_manifest_fixture),
  '977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5',
  'Privacy Records Owner','TOS Platform Owner and Records Reviewer',
  'test:privacy-records-lifecycle','Recorded all 61 decisions while preserving 28 explicit blocks and production HOLD.',true
);

reset role;
do $$
begin
  if (select count(*) from public.student_data_lifecycle_policy_versions
      where institution_id='22222222-2222-4222-8222-222222222222')<>61 then
    raise exception 'Idempotent replay created duplicate lifecycle versions';
  end if;
  if exists (
    select 1 from public.student_data_lifecycle_policy_versions
    where institution_id='22222222-2222-4222-8222-222222222222'
      and ((status='approved' and disposition='block')
        or (status='blocked' and (disposition<>'block' or retention_days is not null)))
  ) then raise exception 'A lifecycle row violated approved/blocked semantics'; end if;
end $$;
set local role authenticated;

do $$
begin
  begin
    perform public.record_student_data_intake_evidence(
      '22222222-2222-4222-8222-222222222222','privacyRecordsApproval','passed',
      'test:privacy-records-pass','PASS must fail while 28 lifecycle domains remain blocked.',
      '3076110661a30f970f0e3eec7e53413aa69e548b','20260802230000_govern_privacy_records_lifecycle_decisions',
      'supabase:gfalgonektwdylsxsgzc;github:BREXAtlas/EdNotebook;branch:staging','us-east-1',
      '{"decision":"passed","reviewer_name":"Privacy Records Owner","reviewer_title_unit_and_authority":"TOS Platform Owner and Records Reviewer","reviewer_authority_attested":true,"manifest_sha256":"977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5","lifecycle_domain_count":61,"recorded_lifecycle_domain_count":61,"approved_lifecycle_domain_count":33,"blocked_lifecycle_domain_count":28,"lifecycle_reconciliation_completed":true,"calendar_guardrails_accepted":true,"ferpa_access_dispute_audit_and_hold_overrides_accepted":true,"provider_residual_copies_reviewed":true,"research_and_irb_boundary_accepted":true,"asu_institutional_adoption_parked":true,"automatic_lifecycle_execution_enabled":false,"staging_project_ref":"gfalgonektwdylsxsgzc","environment_scope":"staging","production_project_touched":false,"production_student_intake_enabled":false,"production_action_executed":false,"independent_second_reviewer":"Second Reviewer"}'::jsonb,
      '2026-10-30T23:59:59Z',true
    );
    raise exception 'Privacy/records PASS was accepted with blocked domains';
  exception when others then
    if sqlerrm='Privacy/records PASS was accepted with blocked domains' then raise; end if;
    if position('PASS requires all 61' in sqlerrm)=0 then raise; end if;
  end;
end $$;

select public.record_student_data_intake_evidence(
  '22222222-2222-4222-8222-222222222222','privacyRecordsApproval','hold',
  'test:privacy-records-hold','All domains are decided; institutional adoption remains pending and production stays disabled.',
  '3076110661a30f970f0e3eec7e53413aa69e548b','20260802230000_govern_privacy_records_lifecycle_decisions',
  'supabase:gfalgonektwdylsxsgzc;github:BREXAtlas/EdNotebook;branch:staging','us-east-1',
  '{"decision":"hold","reviewer_name":"Privacy Records Owner","reviewer_title_unit_and_authority":"TOS Platform Owner and Records Reviewer","reviewer_authority_attested":true,"manifest_sha256":"977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5","lifecycle_domain_count":61,"recorded_lifecycle_domain_count":61,"approved_lifecycle_domain_count":33,"blocked_lifecycle_domain_count":28,"lifecycle_reconciliation_completed":true,"calendar_guardrails_accepted":true,"ferpa_access_dispute_audit_and_hold_overrides_accepted":true,"provider_residual_copies_reviewed":true,"research_and_irb_boundary_accepted":true,"asu_institutional_adoption_parked":true,"automatic_lifecycle_execution_enabled":false,"staging_project_ref":"gfalgonektwdylsxsgzc","environment_scope":"staging","synthetic_only":true,"production_project_touched":false,"production_student_intake_enabled":false,"production_action_executed":false}'::jsonb,
  '2026-10-30T23:59:59Z',true
);

reset role;
do $$
begin
  if not exists (
    select 1 from public.student_data_intake_evidence_versions
    where institution_id='22222222-2222-4222-8222-222222222222'
      and gate_key='privacyRecordsApproval' and status='hold'
  ) then raise exception 'Governed privacy/records HOLD was not recorded'; end if;
end $$;
rollback;
