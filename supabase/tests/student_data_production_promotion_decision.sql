-- Run only against a disposable database after every repository migration.
-- Proves that Phase 5 records a human decision without activating production.

begin;
set local statement_timeout = '60s';

do $$
begin
  if has_table_privilege('authenticated','public.student_data_production_promotion_decision_versions','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Authenticated browser role must not access production-promotion decisions directly';
  end if;
  if has_function_privilege('anon','public.record_student_data_production_promotion_decision(uuid,text,text,text,text,text,text,boolean)','execute') then
    raise exception 'Anonymous users must not record a production-promotion decision';
  end if;
  if not has_function_privilege('authenticated','public.get_student_data_production_promotion_review(uuid)','execute') then
    raise exception 'Authorized reviewers must be able to load the governed Phase 5 review';
  end if;
end $$;

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '10000000-0000-4000-8000-000000000181','authenticated','authenticated',
  'promotion-owner@safety.invalid','not-a-login',now(),'{}',
  '{"full_name":"Promotion Owner","requested_role":"learner","affiliation_choice":"independent"}',now(),now()
);
update public.profiles set role='owner' where id='10000000-0000-4000-8000-000000000181';

insert into public.institutions (
  id,owner_id,name,slug,lifecycle_status,institution_type,region_code,
  institution_code,primary_lms,timezone_name,approved_at,approved_by
) values (
  '22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000181',
  'TOS Synthetic Staging','tos-synthetic-staging','active','university','TX',
  'TOS-STAGING','none','America/Chicago',now(),'10000000-0000-4000-8000-000000000181'
);
insert into public.institution_memberships(institution_id,user_id,role,status,permissions,joined_at)
values (
  '22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000181',
  'owner','active','{"view_control_center":true,"view_audit":true,"manage_retention":true}',now()
);

insert into public.student_data_lifecycle_policy_versions(
  institution_id,domain_key,version,disposition,retention_days,purpose,evidence_reference,
  review_notes,status,approved_by,approved_at,review_due_at
)
select
  '22222222-2222-4222-8222-222222222222',domain.domain_key,1,'retain',3653,
  'Synthetic disposable approval used only to rehearse the Phase 5 production-promotion gate.',
  'test:phase5-lifecycle-approved',
  'This rollback-only fixture proves the eligible path without authorizing a real institution or deployment.',
  'approved','10000000-0000-4000-8000-000000000181',now(),now()+interval '90 days'
from public.student_data_lifecycle_domains domain
where domain.active;

insert into public.student_data_intake_evidence_versions(
  institution_id,gate_key,version,status,evidence_reference,summary,tested_commit,
  migration_version,environment_reference,region,evidence_summary,reviewed_by,reviewed_at,expires_at
)
select
  '22222222-2222-4222-8222-222222222222',gate.gate_key,1,'passed',
  'test:phase5-evidence-passed',
  'Synthetic disposable evidence used only to rehearse the complete Phase 5 decision path.',
  '1111111111111111111111111111111111111111',
  '20260803010000_govern_student_data_production_promotion_decision',
  'local:disposable-database','local','{"synthetic":true,"production_action_executed":false}',
  '10000000-0000-4000-8000-000000000181',now(),now()+interval '90 days'
from public.student_data_intake_gate_definitions gate
where gate.active
  and gate.gate_key not in ('securityApproval','accessibilityApproval','privacyRecordsApproval');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000181',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare
  v_preflight jsonb;
  v_review jsonb;
  v_result jsonb;
begin
  v_preflight:=public.get_student_data_promotion_preflight('22222222-2222-4222-8222-222222222222');
  if v_preflight->'current'->'snapshot'->>'decision'<>'hold' then
    raise exception 'Missing human approval gates did not keep the synthetic preflight on HOLD: %',v_preflight;
  end if;
  perform public.record_student_data_promotion_preflight(
    '22222222-2222-4222-8222-222222222222',
    '1111111111111111111111111111111111111111',
    'test:phase5-recorded-preflight',
    'Human approval gates remain deliberately absent, so this rollback-only rehearsal records production HOLD.',
    v_preflight->'current'->>'snapshot_sha256',true
  );

  v_review:=public.get_student_data_production_promotion_review('22222222-2222-4222-8222-222222222222');
  if coalesce((v_review->'current'->'snapshot'->>'eligible_for_manual_promotion')::boolean,true) is not false
     or v_review->'current'->'snapshot'->>'candidate_decision'<>'hold' then
    raise exception 'Missing human approval gates did not keep Phase 5 on HOLD: %',v_review;
  end if;

  v_result:=public.record_student_data_production_promotion_decision(
    '22222222-2222-4222-8222-222222222222','hold',
    '2222222222222222222222222222222222222222',
    'test:phase5-owner-hold','docs:test-rollback-plan',
    'The owner records HOLD first; staging Beta and Pilot remain available and production remains disabled.',
    v_review->'current'->>'snapshot_sha256',true
  );
  if v_result->'record'->>'decision'<>'hold'
     or coalesce((v_result->>'production_action_executed')::boolean,true) is not false then
    raise exception 'The owner HOLD record was unsafe: %',v_result;
  end if;

  begin
    perform public.record_student_data_production_promotion_decision(
      '22222222-2222-4222-8222-222222222222','approved_for_manual_promotion',
      '2222222222222222222222222222222222222222',
      'test:phase5-owner-approval','docs:test-rollback-plan',
      'Approval must fail because the independent human approval gates remain missing.',
      v_review->'current'->>'snapshot_sha256',true
    );
    raise exception 'Production approval succeeded while human approval gates were missing';
  exception when others then
    if sqlerrm='Production approval succeeded while human approval gates were missing' then raise; end if;
    if position('cannot be approved' in sqlerrm)=0 then raise; end if;
  end;
end $$;

reset role;

do $$
begin
  if (select count(*) from public.student_data_production_promotion_decision_versions
      where institution_id='22222222-2222-4222-8222-222222222222')<>1 then
    raise exception 'The append-only HOLD was not preserved or a rejected approval was recorded';
  end if;
  if exists (
    select 1 from public.student_data_production_promotion_decision_versions
    where production_student_intake_enabled or production_action_executed
      or automatic_lifecycle_execution_enabled
      or not staging_beta_testing_allowed or not staging_pilot_testing_allowed
  ) then raise exception 'A Phase 5 decision changed runtime activation or staging testing'; end if;
  begin
    update public.student_data_production_promotion_decision_versions set summary='Mutation must fail';
    raise exception 'Append-only production-promotion history was mutable';
  exception when others then
    if sqlerrm='Append-only production-promotion history was mutable' then raise; end if;
    if position('append-only' in lower(sqlerrm))=0 then raise; end if;
  end;
end $$;

insert into public.student_data_lifecycle_policy_versions(
  institution_id,domain_key,version,disposition,retention_days,purpose,evidence_reference,
  review_notes,status,approved_by,approved_at,review_due_at,supersedes_policy_id
)
select
  policy.institution_id,policy.domain_key,2,'block',null,
  'Synthetic blocker proves a later evidence change invalidates production approval immediately.',
  'test:phase5-blocker-added',
  'The changed lifecycle decision must force a fresh preflight and a production HOLD.',
  'blocked','10000000-0000-4000-8000-000000000181',now(),now()+interval '90 days',policy.id
from public.student_data_lifecycle_policy_versions policy
where policy.institution_id='22222222-2222-4222-8222-222222222222'
order by policy.domain_key
limit 1;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000181',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare v_review jsonb;
begin
  v_review:=public.get_student_data_production_promotion_review('22222222-2222-4222-8222-222222222222');
  if coalesce((v_review->'current'->'snapshot'->>'eligible_for_manual_promotion')::boolean,true) is not false
     or v_review->'current'->'snapshot'->>'candidate_decision'<>'hold' then
    raise exception 'Changed lifecycle evidence did not return production to HOLD: %',v_review;
  end if;
  begin
    perform public.record_student_data_production_promotion_decision(
      '22222222-2222-4222-8222-222222222222','approved_for_manual_promotion',
      '3333333333333333333333333333333333333333',
      'test:phase5-stale-approval','docs:test-rollback-plan',
      'This stale approval must be rejected because a lifecycle blocker was added.',
      v_review->'current'->>'snapshot_sha256',true
    );
    raise exception 'Production approval succeeded after evidence became blocked';
  exception when others then
    if sqlerrm='Production approval succeeded after evidence became blocked' then raise; end if;
    if position('cannot be approved' in sqlerrm)=0 then raise; end if;
  end;
end $$;

rollback;
