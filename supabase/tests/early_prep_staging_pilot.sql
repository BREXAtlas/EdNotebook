-- Rollback-safe Early Prep staging-pilot rehearsal.
-- Uses synthetic identifiers only and proves institution/platform scoping,
-- provider-neutral import evidence, no-op grade reconciliation, and fail-closed
-- commerce behavior without changing persistent data.

begin;
set local statement_timeout='45s';

insert into auth.users(
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  (
    '34000000-0000-4000-8000-000000000001','authenticated','authenticated',
    'teacher@early-prep-pilot.invalid','not-a-login',now(),'{}',
    '{"full_name":"Synthetic Early Prep Teacher","requested_role":"professor","education_division":"k12","affiliation_choice":"other","institution_name":"Early Prep Synthetic District"}',
    now(),now()
  ),
  (
    '34000000-0000-4000-8000-000000000002','authenticated','authenticated',
    'outsider@early-prep-pilot.invalid','not-a-login',now(),'{}',
    '{"full_name":"Synthetic Unaffiliated Reviewer"}',
    now(),now()
  );

update public.profiles set role='professor' where id='34000000-0000-4000-8000-000000000001';

insert into public.institutions(
  id,owner_id,name,slug,institution_type,education_division,lifecycle_status,
  enrollment_selectable,institution_code,region_code,settings
) values (
  '34000000-0000-4000-8000-000000000010',
  '34000000-0000-4000-8000-000000000001',
  'Early Prep Synthetic District',
  'early-prep-synthetic-district-pilot',
  'school_district','k12','active',false,'SYN-DISTRICT-001','TX',
  '{"synthetic":true,"pilot":"early-prep-staging"}'::jsonb
);

insert into public.institution_memberships(
  institution_id,user_id,role,status,permissions,joined_at
) values (
  '34000000-0000-4000-8000-000000000010',
  '34000000-0000-4000-8000-000000000001',
  'owner','active',
  '{"view_control_center":true,"view_accounts":true,"view_integrations":true,"test_integrations":true}'::jsonb,
  now()
);

insert into public.institution_affiliations(
  id,user_id,pathway,institution_id,relationship,status,source,is_primary,
  started_at,verified_by,verified_at
) values (
  '34000000-0000-4000-8000-000000000011',
  '34000000-0000-4000-8000-000000000001',
  'professor','34000000-0000-4000-8000-000000000010',
  'faculty','active','institution_admin',true,now(),
  '34000000-0000-4000-8000-000000000001',now()
);

insert into public.courses(
  id,owner_id,institution_id,title,course_code,section_code,teaching_window,
  education_division,subject_id,subject,status,access_scope,settings
) values (
  '34000000-0000-4000-8000-000000000020',
  '34000000-0000-4000-8000-000000000001',
  '34000000-0000-4000-8000-000000000010',
  'Synthetic Algebra I Pilot','ALG I','04','2026-27',
  'k12','mathematics','ignored','draft','institution',
  '{"synthetic":true,"source":"powerschool-oneroster-preview"}'::jsonb
);

insert into public.learning_system_crosswalks(
  institution_id,education_division,provider,record_type,
  ednotebook_record_id,external_record_id,source_system,metadata
) values
  ('34000000-0000-4000-8000-000000000010','k12','powerschool','organization','34000000-0000-4000-8000-000000000010','SYN-DISTRICT-001','synthetic_csv','{"synthetic":true}'),
  ('34000000-0000-4000-8000-000000000010','k12','powerschool','class','34000000-0000-4000-8000-000000000020','SYN-SECTION-04','synthetic_csv','{"synthetic":true}'),
  ('34000000-0000-4000-8000-000000000010','k12','powerschool','person','34000000-0000-4000-8000-000000000001','SYN-TEACHER-01','synthetic_csv','{"synthetic":true}');

insert into public.learning_system_exchange_runs(
  id,institution_id,course_id,education_division,provider,direction,resource_type,
  preview_hash,idempotency_key,review_status,preview_summary,reviewed_by,
  reviewed_at,applied_at,reconciled_at,created_by
) values
  (
    '34000000-0000-4000-8000-000000000030',
    '34000000-0000-4000-8000-000000000010',
    '34000000-0000-4000-8000-000000000020',
    'k12','powerschool','import','oneroster_1_2_bundle',
    'fnv1a-synthetic-import','early-prep-synthetic-import-2026-08','reconciled',
    '{"synthetic":true,"real_student_data":false,"resources":{"orgs":1,"academicSessions":1,"courses":1,"classes":1,"users":2,"enrollments":2,"lineItems":1,"results":1}}',
    '34000000-0000-4000-8000-000000000001',now(),now(),now(),
    '34000000-0000-4000-8000-000000000001'
  ),
  (
    '34000000-0000-4000-8000-000000000031',
    '34000000-0000-4000-8000-000000000010',
    '34000000-0000-4000-8000-000000000020',
    'k12','powerschool','export','grade_results_noop',
    'fnv1a-synthetic-noop','early-prep-synthetic-noop-2026-08','reconciled',
    '{"synthetic":true,"real_student_data":false,"reviewed_rows":1,"changed_rows":0,"expected_write_count":0,"actual_write_count":0,"provider_receipt":null}',
    '34000000-0000-4000-8000-000000000001',now(),null,now(),
    '34000000-0000-4000-8000-000000000001'
  );

do $$
begin
  if (select count(*) from public.learning_system_crosswalks where institution_id='34000000-0000-4000-8000-000000000010') <> 3 then
    raise exception 'Synthetic PowerSchool crosswalk preview is incomplete';
  end if;
  if (select count(*) from public.learning_system_exchange_runs where institution_id='34000000-0000-4000-8000-000000000010' and review_status='reconciled') <> 2 then
    raise exception 'Synthetic import and no-op export must both reconcile';
  end if;
  if exists (
    select 1 from public.learning_system_exchange_runs
    where institution_id='34000000-0000-4000-8000-000000000010'
      and preview_summary ?| array['password','secret','token','credential','service_role']
  ) then raise exception 'Exchange evidence cannot store provider credentials'; end if;
  if not exists (
    select 1 from public.learning_system_exchange_runs
    where id='34000000-0000-4000-8000-000000000031'
      and (preview_summary->>'expected_write_count')::integer=0
      and (preview_summary->>'actual_write_count')::integer=0
      and applied_at is null and reconciled_at is not null
  ) then raise exception 'The reviewed no-op export must reconcile without a provider write'; end if;

  begin
    insert into public.learning_system_exchange_runs(
      institution_id,course_id,provider,direction,resource_type,preview_hash,
      idempotency_key,preview_summary,created_by
    ) values (
      '34000000-0000-4000-8000-000000000010',
      '34000000-0000-4000-8000-000000000020',
      'powerschool','export','grade_results_noop','duplicate',
      'early-prep-synthetic-noop-2026-08','{"synthetic":true}',
      '34000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected duplicate idempotency evidence to fail';
  exception when unique_violation then null;
  end;

  begin
    update public.courses set education_division='university'
    where id='34000000-0000-4000-8000-000000000020';
    raise exception 'Expected the Early Prep course division bypass to fail';
  exception when others then
    if sqlerrm='Expected the Early Prep course division bypass to fail' then raise; end if;
  end;

  begin
    insert into public.publisher_applications(
      applicant_id,organization_name,applicant_type,catalog_summary,
      rights_attestation,status,education_division
    ) values (
      '34000000-0000-4000-8000-000000000001','Synthetic Early Prep Seller',
      'professor','Synthetic pilot only',true,'submitted','k12'
    );
    raise exception 'Expected direct Early Prep seller onboarding to fail';
  exception when others then
    if sqlerrm='Expected direct Early Prep seller onboarding to fail' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','34000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare v_k12 jsonb; v_university jsonb;
begin
  v_k12:=public.get_admin_control_center_by_division('34000000-0000-4000-8000-000000000010','k12');
  v_university:=public.get_admin_control_center_by_division('34000000-0000-4000-8000-000000000010','university');
  if v_k12->>'education_division'<>'k12'
    or jsonb_array_length(v_k12->'institutions')<>1
    or (v_k12->'statistics'->>'courses')::integer<>1 then
    raise exception 'Institution-scoped Early Prep Control Center did not return the synthetic boundary';
  end if;
  if jsonb_array_length(v_university->'institutions')<>0
    or (v_university->'statistics'->>'courses')::integer<>0 then
    raise exception 'Institution-scoped University view leaked Early Prep records';
  end if;
  if (select count(*) from public.learning_system_exchange_runs)<>2 then
    raise exception 'Institution integration reviewer cannot see its two synthetic evidence rows';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','34000000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.learning_system_exchange_runs)<>0 then
    raise exception 'Unaffiliated users cannot read synthetic district exchange evidence';
  end if;
  begin
    insert into public.learning_system_exchange_runs(
      institution_id,provider,direction,resource_type,preview_hash,idempotency_key,
      preview_summary,created_by
    ) values (
      '34000000-0000-4000-8000-000000000010','powerschool','import','users',
      'unauthorized','unauthorized','{}','34000000-0000-4000-8000-000000000002'
    );
    raise exception 'Expected browser exchange-run writes to remain closed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.profiles set role='owner' where id='34000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','34000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare v_k12_search jsonb; v_university_search jsonb;
begin
  v_k12_search:=public.admin_search_accounts_courses_by_division('Synthetic Algebra',null,null,'k12');
  v_university_search:=public.admin_search_accounts_courses_by_division('Synthetic Algebra',null,null,'university');
  if jsonb_array_length(v_k12_search->'courses')<>1 then
    raise exception 'Platform Early Prep search did not return the synthetic class';
  end if;
  if jsonb_array_length(v_university_search->'courses')<>0 then
    raise exception 'Platform University search leaked the synthetic Early Prep class';
  end if;
end;
$$;

reset role;
rollback;
