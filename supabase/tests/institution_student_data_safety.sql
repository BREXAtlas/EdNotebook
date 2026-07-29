-- Run only on a disposable Supabase preview branch after all repository
-- migrations. Every fixture is transaction-scoped and rolled back.
-- Gates: restore, cross-institution access, Blackboard reconciliation, and
-- deletion/retention/legal-hold behavior.

begin;
set local statement_timeout = '60s';

do $$ begin raise notice 'START student-data safety gate'; end $$;

-- Stable test-only identifiers make failures reproducible.
insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('10000000-0000-4000-8000-000000000091','authenticated','authenticated','owner@safety.invalid','not-a-login',now(),'{}','{"full_name":"Platform Owner","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000092','authenticated','authenticated','legacy-admin@safety.invalid','not-a-login',now(),'{}','{"full_name":"Legacy Admin","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000093','authenticated','authenticated','operator@safety.invalid','not-a-login',now(),'{}','{"full_name":"Delegated Operator","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000094','authenticated','authenticated','auditor@safety.invalid','not-a-login',now(),'{}','{"full_name":"Delegated Auditor","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000095','authenticated','authenticated','support@safety.invalid','not-a-login',now(),'{}','{"full_name":"Delegated Support","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','prof-a@safety.invalid','not-a-login',now(),'{}','{"full_name":"Professor A","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','prof-b@safety.invalid','not-a-login',now(),'{}','{"full_name":"Professor B","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000011','authenticated','authenticated','student-a@safety.invalid','not-a-login',now(),'{}','{"full_name":"Student A","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000013','authenticated','authenticated','student-a-peer@safety.invalid','not-a-login',now(),'{}','{"full_name":"Student A Peer","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000012','authenticated','authenticated','student-b@safety.invalid','not-a-login',now(),'{}','{"full_name":"Student B","requested_role":"learner","affiliation_choice":"independent"}',now(),now());

update public.profiles set role='professor'
where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
update public.profiles set role='owner' where id='10000000-0000-4000-8000-000000000091';
update public.profiles set role='admin' where id='10000000-0000-4000-8000-000000000092';

insert into public.platform_admin_authorizations(
  user_id,access_level,capabilities,status,granted_by
) values
  ('10000000-0000-4000-8000-000000000093','operator','{"view_control_center":true,"view_accounts":true,"view_feature_controls":true,"view_integrations":true,"test_integrations":true,"view_audit":true}','active','10000000-0000-4000-8000-000000000091'),
  ('10000000-0000-4000-8000-000000000094','auditor','{"view_control_center":true,"view_feature_controls":true,"view_integrations":true,"view_audit":true,"view_reports":true}','active','10000000-0000-4000-8000-000000000091'),
  ('10000000-0000-4000-8000-000000000095','support','{"view_control_center":true,"view_accounts":true}','active','10000000-0000-4000-8000-000000000091');

insert into public.institutions (
  id,owner_id,name,slug,lifecycle_status,institution_type,region_code,
  institution_code,primary_lms,timezone_name,approved_at,approved_by
) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Safety Institution A','safety-institution-a','active','university','TX','SAFE-A','blackboard','America/Chicago',now(),null),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Safety Institution B','safety-institution-b','active','university','TX','SAFE-B','blackboard','America/Chicago',now(),null);

insert into public.institution_directory_entries (
  directory_key,canonical_name,institution_id,entity_type,education_division,
  city,region_code,country_code,directory_status,is_selectable,is_public
) values
  ('safety-institution-a','Safety Institution A','20000000-0000-4000-8000-000000000001','university','university','Safety City A','TX','US','verified',true,true),
  ('safety-institution-b','Safety Institution B','20000000-0000-4000-8000-000000000002','university','university','Safety City B','TX','US','verified',true,true);

delete from public.institution_affiliations
where user_id in (
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000012',
  '10000000-0000-4000-8000-000000000013'
);

insert into public.institution_affiliations (
  id,user_id,pathway,institution_id,relationship,status,source,verification_method,is_primary,started_at
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','professor','20000000-0000-4000-8000-000000000001','faculty','active','platform_owner','test-fixture',true,now()),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','professor','20000000-0000-4000-8000-000000000002','faculty','active','platform_owner','test-fixture',true,now()),
  ('30000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000011','student','20000000-0000-4000-8000-000000000001','student','active','platform_owner','test-fixture',true,now()),
  ('30000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000013','student','20000000-0000-4000-8000-000000000001','student','active','platform_owner','test-fixture',true,now()),
  ('30000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000012','student','20000000-0000-4000-8000-000000000002','student','active','platform_owner','test-fixture',true,now());

insert into public.institution_memberships (
  institution_id,user_id,role,status,permissions,joined_at
) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner','active','{"view_control_center":true,"view_accounts":true,"control_features":true}',now()),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','owner','active','{"view_control_center":true,"view_accounts":true,"control_features":true}',now()),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000092','admin','active','{"view_control_center":true,"manage_team":true}',now()),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000095','security','active','{}',now()),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','learner','active','{}',now()),
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000013','learner','active','{}',now()),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012','learner','active','{}',now())
on conflict (institution_id,user_id) do update set role=excluded.role,status=excluded.status,permissions=excluded.permissions;

insert into public.integration_connections(
  id,connection_key,institution_id,provider,display_name,category,pathway,
  activation_status,health_status,institution_controllable,activation_managed_by
) values (
  '90000000-0000-4000-8000-000000000001','safety-institution-connection',
  '20000000-0000-4000-8000-000000000001','Safety Provider','Safety institution connection',
  'Test fixture','admin','testing','unknown',true,'control_center'
);
insert into public.integration_connection_capabilities(
  connection_id,capability_key,display_name,readiness_status
) values ('90000000-0000-4000-8000-000000000001','scope_test','Institution scope test','testing');

insert into public.courses (
  id,owner_id,institution_id,title,course_code,status,access_scope,education_division
) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Safety Course A','SAFE-A-101','published','institution','university'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Safety Course B','SAFE-B-101','published','institution','university');

insert into public.course_memberships (course_id,user_id,role) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','learner'),
  ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000013','learner'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012','learner');

insert into public.assignments(id,course_id,professor_id,title,status) values
  ('45000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Safety submission A','published'),
  ('45000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Safety submission B','published');

insert into public.secure_file_objects(
  id,owner_id,institution_id,course_id,assignment_id,purpose,original_name,safe_name,
  expected_size_bytes,actual_size_bytes,quarantine_path,destination_bucket,destination_path,
  upload_status,security_status,archive_status,availability_status,upload_expires_at
) values
  ('80000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','submission','student-a-submission.txt','student-a-submission.txt',20,20,'safety/student-a-submission-q','ed-submissions','safety/student-a-submission','uploaded','clean','not_archive','released',now()+interval '1 day'),
  ('80000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000002','submission','student-b-submission.txt','student-b-submission.txt',20,20,'safety/student-b-submission-q','ed-submissions','safety/student-b-submission','uploaded','clean','not_archive','released',now()+interval '1 day');

insert into public.file_previews(id,secure_file_id,kind,bucket_id,storage_path,mime_type,size_bytes)
values('82000000-0000-4000-8000-000000000007','80000000-0000-4000-8000-000000000007','text','ed-previews','safety/student-a-submission-preview','text/plain',20);
insert into public.upload_quota_reservations(id,secure_file_id,user_id,reserved_bytes,status,expires_at)
values('83000000-0000-4000-8000-000000000007','80000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000011',20,'committed',now()+interval '1 day');

insert into public.assignment_drafts(id,assignment_id,student_id,content)
values('46000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','{"fixture":true}'::jsonb);

insert into public.learning_resources(
  id,owner_id,course_id,assignment_id,resource_type,title,placement,storage_mode,visibility,secure_file_id
) values(
  '47000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011',
  '40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001',
  'file','Student A private resource','private-vault','device','private','80000000-0000-4000-8000-000000000007'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.learning_messages(id,course_id,assignment_id,sender_id,recipient_id,body,attachment_resource_id)
values('47500000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','Disposable student restore message','47000000-0000-4000-8000-000000000001');
reset role;

insert into public.entitlement_definitions(entitlement_key,display_name,description,value_type)
values('safety_restore_entitlement','Safety restore entitlement','Disposable restore fixture','boolean');
insert into public.user_entitlements(id,user_id,entitlement_key,source,entitlement_value)
values('47600000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','safety_restore_entitlement','manual','true'::jsonb);

insert into public.grade_share_links(id,student_id,viewer_id,label,token_hash,scope_course_ids,expires_at)
values('65000000-0000-4000-8000-000000000000','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000013','Restore fixture share','restore-fixture-share-token',array['40000000-0000-4000-8000-000000000001'::uuid],now()+interval '1 day');

insert into public.student_public_profiles(user_id,display_name,visibility) values
  ('10000000-0000-4000-8000-000000000011','Student A','class'),
  ('10000000-0000-4000-8000-000000000013','Student A Peer','class');
insert into public.student_groups(id,institution_id,course_id,created_by,name,visibility) values
  ('48000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','Safety group A','course'),
  ('48000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012','Safety group B','course');
insert into public.student_group_memberships(group_id,user_id,role) values
  ('48000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','owner'),
  ('48000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000013','member'),
  ('48000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012','owner');
insert into public.student_posts(id,group_id,author_id,body)
values('49000000-0000-4000-8000-000000000001','48000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','Disposable safety post');

insert into public.grade_items (id,course_id,title,max_points,publish_state) values
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Safety Assignment A',100,'published'),
  ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Safety Assignment B',50,'published'),
  ('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','Safety Assignment A2',20,'published');

insert into public.student_grades (
  id,course_id,grade_item_id,student_id,score,status,published_at,finalized_at
) values
  ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011',88.5,'finalized',now(),now()),
  ('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012',41,'finalized',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.publish_course_package(
  '40000000-0000-4000-8000-000000000001',
  '{"format":"EdNotebookCourse/1.0","course":{"title":"Runtime safety package"},"paths":[{"id":"path-a","nodes":[{"id":"lesson-a","knowledgeChecks":[{"id":"question-a","correctAnswer":"yes"}],"endQuiz":[]}]}],"grading":{"title":"Runtime safety completion","maxPoints":100}}'::jsonb,
  'full_course','ednotebook-default','auto','Disposable grade-integrity fixture'
);
reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

do $$
declare v_signature text;
begin
  if has_table_privilege('authenticated','public.course_lesson_progress','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.course_progress','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.student_grades','INSERT,UPDATE,DELETE') then
    raise exception 'ACL TEST FAILED: browser roles retain direct progress or grade mutation privileges';
  end if;
  foreach v_signature in array array[
    'public.get_course_progress_overview(uuid)',
    'public.grade_course_progress(uuid,uuid,numeric,text)',
    'public.publish_course_package(uuid,jsonb,text,text,text,text)',
    'public.save_course_lesson_progress(uuid,text,text,integer,text,jsonb,boolean)',
    'public.save_course_package_draft(uuid,jsonb,text,text,text)',
    'public.set_course_publication_state(uuid,text)'
  ] loop
    if has_function_privilege('anon',v_signature,'EXECUTE') then
      raise exception 'ACL TEST FAILED: anon can execute %',v_signature;
    end if;
    if not has_function_privilege('authenticated',v_signature,'EXECUTE') then
      raise exception 'ACL TEST FAILED: authenticated cannot execute authorized RPC %',v_signature;
    end if;
  end loop;
  raise notice 'PASS progress-table and security-definer routine ACL test';
end $$;

-- GATE 1: versioned student-data inventory, representative logical restore, and reconciliation.
-- Parent file, resource, and group rows stay intact because a partial delete would
-- cascade into shared or separately retained records. Provider backup and object
-- restore remain separate operational release gates.
create or replace function pg_temp.capture_student_restore_rows(p_student uuid)
returns table(domain text, rows jsonb)
language sql
stable
set search_path = ''
as $capture$
  select 'profile',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.profiles where id=p_student) t),'[]'::jsonb)
  union all select 'identityOnboardingRequests',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.identity_onboarding_requests where user_id=p_student) t),'[]'::jsonb)
  union all select 'institutionAccessApplications',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.institution_access_applications where applicant_id=p_student) t),'[]'::jsonb)
  union all select 'institutionAffiliations',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.institution_affiliations where user_id=p_student) t),'[]'::jsonb)
  union all select 'institutionMemberships',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.institution_memberships where user_id=p_student) t),'[]'::jsonb)
  union all select 'institutionTransferRequests',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.institution_transfer_requests where user_id=p_student) t),'[]'::jsonb)
  union all select 'courseMemberships',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.course_memberships where user_id=p_student) t),'[]'::jsonb)
  union all select 'studentEnrollmentRequests',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_enrollment_requests where student_id=p_student) t),'[]'::jsonb)
  union all select 'studentRosterEntries',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_roster_entries where matched_user_id=p_student) t),'[]'::jsonb)
  union all select 'assignmentDrafts',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.assignment_drafts where student_id=p_student) t),'[]'::jsonb)
  union all select 'assignmentFormSubmissions',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.assignment_form_submissions where student_id=p_student) t),'[]'::jsonb)
  union all select 'courseLessonProgress',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.course_lesson_progress where user_id=p_student) t),'[]'::jsonb)
  union all select 'courseProgress',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.course_progress where user_id=p_student) t),'[]'::jsonb)
  union all select 'studentGrades',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_grades where student_id=p_student) t),'[]'::jsonb)
  union all select 'gradeShareLinks',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.grade_share_links where student_id=p_student or viewer_id=p_student) t),'[]'::jsonb)
  union all select 'learningMessages',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.learning_messages where sender_id=p_student or recipient_id=p_student) t),'[]'::jsonb)
  union all select 'learningResources',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.learning_resources where owner_id=p_student) t),'[]'::jsonb)
  union all select 'studentLearningRecords',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_learning_records where student_id=p_student) t),'[]'::jsonb)
  union all select 'studentPublicProfile',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_public_profiles where user_id=p_student) t),'[]'::jsonb)
  union all select 'studentGroups',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_groups where created_by=p_student) t),'[]'::jsonb)
  union all select 'studentGroupMemberships',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_group_memberships where user_id=p_student) t),'[]'::jsonb)
  union all select 'studentPosts',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_posts where author_id=p_student) t),'[]'::jsonb)
  union all select 'readingAnnotations',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.reading_annotations where user_id=p_student) t),'[]'::jsonb)
  union all select 'studentEducationPath',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.student_education_paths where user_id=p_student) t),'[]'::jsonb)
  union all select 'educatorVerificationRequests',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.educator_verification_requests where user_id=p_student) t),'[]'::jsonb)
  union all select 'secureFiles',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.secure_file_objects where owner_id=p_student) t),'[]'::jsonb)
  union all select 'filePreviews',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select p.* from public.file_previews p join public.secure_file_objects f on f.id=p.secure_file_id where f.owner_id=p_student) t),'[]'::jsonb)
  union all select 'processingJobs',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select j.* from public.processing_jobs j join public.secure_file_objects f on f.id=j.secure_file_id where f.owner_id=p_student) t),'[]'::jsonb)
  union all select 'linkPreviews',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select p.* from public.link_previews p where p.id in(select r.link_preview_id from public.learning_resources r where r.owner_id=p_student and r.link_preview_id is not null)) t),'[]'::jsonb)
  union all select 'uploadQuotaReservations',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select r.* from public.upload_quota_reservations r where r.user_id=p_student or r.secure_file_id in(select f.id from public.secure_file_objects f where f.owner_id=p_student)) t),'[]'::jsonb)
  union all select 'fileDeletionRequests',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select r.* from public.file_deletion_requests r where r.requested_by=p_student or r.secure_file_id in(select f.id from public.secure_file_objects f where f.owner_id=p_student)) t),'[]'::jsonb)
  union all select 'legalHoldFiles',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select h.* from public.legal_hold_files h join public.secure_file_objects f on f.id=h.secure_file_id where f.owner_id=p_student) t),'[]'::jsonb)
  union all select 'publicationEntitlements',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.publication_entitlements where user_id=p_student) t),'[]'::jsonb)
  union all select 'billingCustomers',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.billing_customers where user_id=p_student) t),'[]'::jsonb)
  union all select 'billingSubscriptions',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.billing_subscriptions where user_id=p_student) t),'[]'::jsonb)
  union all select 'userEntitlements',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.user_entitlements where user_id=p_student) t),'[]'::jsonb)
  union all select 'blackboardIdentityMappings',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.blackboard_identity_mappings where ednotebook_user_id=p_student) t),'[]'::jsonb)
  union all select 'blackboardGradeExportSnapshots',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.blackboard_grade_exports where mapping_snapshot::text like ('%'||p_student::text||'%') or export_summary::text like ('%'||p_student::text||'%')) t),'[]'::jsonb)
  union all select 'learningSystemIdentifiers',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.learning_system_identifiers where ednotebook_user_id=p_student) t),'[]'::jsonb)
  union all select 'ltiUserMappings',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.lti_user_mappings where ednotebook_user_id=p_student) t),'[]'::jsonb)
  union all select 'ltiContextMemberships',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select m.* from public.lti_context_memberships m where m.user_mapping_id in(select u.id from public.lti_user_mappings u where u.ednotebook_user_id=p_student)) t),'[]'::jsonb)
  union all select 'ltiLaunchSessions',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select s.* from public.lti_launch_sessions s where s.user_mapping_id in(select u.id from public.lti_user_mappings u where u.ednotebook_user_id=p_student)) t),'[]'::jsonb)
  union all select 'ltiGradeSyncEvents',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select e.* from public.lti_grade_sync_events e where e.user_mapping_id in(select u.id from public.lti_user_mappings u where u.ednotebook_user_id=p_student) or e.student_grade_id in(select g.id from public.student_grades g where g.student_id=p_student)) t),'[]'::jsonb)
  union all select 'userFeaturePolicies',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.feature_policies where user_id=p_student) t),'[]'::jsonb)
  union all select 'auditEvents',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from (select * from public.audit_events where actor_id=p_student or secure_file_id in(select f.id from public.secure_file_objects f where f.owner_id=p_student) or target_id=p_student::text or details::text like ('%'||p_student::text||'%')) t),'[]'::jsonb);
$capture$;

create temporary table safety_expected_restore_domains(domain text primary key);
insert into safety_expected_restore_domains(domain) values
  ('profile'),('identityOnboardingRequests'),('institutionAccessApplications'),('institutionAffiliations'),('institutionMemberships'),('institutionTransferRequests'),('courseMemberships'),('studentEnrollmentRequests'),('studentRosterEntries'),('assignmentDrafts'),('assignmentFormSubmissions'),('courseLessonProgress'),('courseProgress'),('studentGrades'),('gradeShareLinks'),('learningMessages'),('learningResources'),('studentLearningRecords'),('studentPublicProfile'),('studentGroups'),('studentGroupMemberships'),('studentPosts'),('readingAnnotations'),('studentEducationPath'),('educatorVerificationRequests'),('secureFiles'),('filePreviews'),('processingJobs'),('linkPreviews'),('uploadQuotaReservations'),('fileDeletionRequests'),('legalHoldFiles'),('publicationEntitlements'),('billingCustomers'),('billingSubscriptions'),('userEntitlements'),('blackboardIdentityMappings'),('blackboardGradeExportSnapshots'),('learningSystemIdentifiers'),('ltiUserMappings'),('ltiContextMemberships'),('ltiLaunchSessions'),('ltiGradeSyncEvents'),('userFeaturePolicies'),('auditEvents');

insert into public.student_learning_records(
  student_id,record_id,root_id,version,record_kind,course_code,course_title,
  lesson_id,lesson_title,title,filename,content,created_at
) values (
  '10000000-0000-4000-8000-000000000011','safety-learning-note-v1','safety-learning-note',1,'note',
  'SAFE-101','Synthetic safety course','source-check','Check a source','Safety learning note',
  '2026-07-29_safe-101_note_safety-learning-note_v01.md',
  '{"title":"Safety learning note","body":"Synthetic restore evidence only."}'::jsonb,
  '2026-07-29T04:00:00Z'
);

create temporary table safety_restore_inventory_before as
select '2.2'::text contract_version,domain,true captured,
       jsonb_array_length(rows)::bigint row_count,rows,
       encode(extensions.digest(rows::text,'sha256'),'hex') digest
from pg_temp.capture_student_restore_rows('10000000-0000-4000-8000-000000000011');

do $$
begin
  if exists(
    select 1 from safety_expected_restore_domains e
    full join safety_restore_inventory_before b using(domain)
    where e.domain is null or b.domain is null or not b.captured
  ) or (select count(*) from safety_restore_inventory_before)<>45 then
    raise exception 'RESTORE TEST FAILED: canonical student-data inventory is incomplete';
  end if;
  raise notice 'PASS canonical 45-domain capture inventory is complete';
end $$;

create temporary table safety_incomplete_restore_inventory as
select * from safety_restore_inventory_before where domain<>'ltiGradeSyncEvents';

do $$
begin
  if not exists(
    select 1 from safety_expected_restore_domains e
    where not exists(select 1 from safety_incomplete_restore_inventory i where i.domain=e.domain and i.captured)
  ) then
    raise exception 'RESTORE TEST FAILED: omitted-domain simulation did not block reconciliation';
  end if;
  raise notice 'PASS omitted restore domain is detected and blocks reconciliation';
end $$;

-- Back up only subject rows whose removal cannot cascade into untracked parent
-- or shared data. The full inventory still reconciles unchanged parent records.
create temporary table safety_backup_institution_membership as
  select * from public.institution_memberships where user_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_course_membership as
  select * from public.course_memberships where user_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_public_profile as
  select * from public.student_public_profiles where user_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_assignment_drafts as
  select * from public.assignment_drafts where student_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_messages as
  select * from public.learning_messages where sender_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_student_learning_records as
  select * from public.student_learning_records where student_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_entitlements as
  select * from public.user_entitlements where user_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_grade_shares as
  select * from public.grade_share_links where student_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_previews as
  select p.* from public.file_previews p join public.secure_file_objects f on f.id=p.secure_file_id
  where f.owner_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_quota as
  select * from public.upload_quota_reservations where user_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_group_memberships as
  select * from public.student_group_memberships where user_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_posts as
  select * from public.student_posts where author_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_lesson_progress as
  select * from public.course_lesson_progress where user_id='10000000-0000-4000-8000-000000000011';
create temporary table safety_backup_course_progress as
  select * from public.course_progress where user_id='10000000-0000-4000-8000-000000000011';

delete from public.student_posts where id in(select id from safety_backup_posts);
delete from public.student_group_memberships
where user_id='10000000-0000-4000-8000-000000000011'
  and group_id in(select group_id from safety_backup_group_memberships);
delete from public.learning_messages where id in(select id from safety_backup_messages);
delete from public.student_learning_records where id in(select id from safety_backup_student_learning_records);
delete from public.grade_share_links where id in(select id from safety_backup_grade_shares);
delete from public.assignment_drafts where id in(select id from safety_backup_assignment_drafts);
delete from public.file_previews where id in(select id from safety_backup_previews);
delete from public.upload_quota_reservations where id in(select id from safety_backup_quota);
delete from public.course_progress where id in(select id from safety_backup_course_progress);
delete from public.course_lesson_progress where id in(select id from safety_backup_lesson_progress);
delete from public.user_entitlements where id in(select id from safety_backup_entitlements);
delete from public.student_public_profiles where user_id='10000000-0000-4000-8000-000000000011';
delete from public.course_memberships where user_id='10000000-0000-4000-8000-000000000011';
delete from public.institution_memberships where user_id='10000000-0000-4000-8000-000000000011';

create temporary table safety_restore_inventory_damaged as
select '2.2'::text contract_version,domain,true captured,
       jsonb_array_length(rows)::bigint row_count,rows,
       encode(extensions.digest(rows::text,'sha256'),'hex') digest
from pg_temp.capture_student_restore_rows('10000000-0000-4000-8000-000000000011');

do $$
begin
  if not exists(
    select 1 from safety_restore_inventory_before b
    join safety_restore_inventory_damaged d using(domain)
    where b.row_count is distinct from d.row_count or b.rows is distinct from d.rows
      or b.digest is distinct from d.digest
  ) then
    raise exception 'RESTORE TEST FAILED: damaged student bundle was not detected';
  end if;
  raise notice 'PASS damaged student bundle is detected before restore';
end $$;

insert into public.institution_memberships select * from safety_backup_institution_membership;
insert into public.course_memberships select * from safety_backup_course_membership;
insert into public.student_public_profiles select * from safety_backup_public_profile;
insert into public.user_entitlements select * from safety_backup_entitlements;
insert into public.file_previews select * from safety_backup_previews;
insert into public.upload_quota_reservations select * from safety_backup_quota;
insert into public.assignment_drafts select * from safety_backup_assignment_drafts;
insert into public.student_learning_records select * from safety_backup_student_learning_records;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.learning_messages select * from safety_backup_messages;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;
insert into public.grade_share_links select * from safety_backup_grade_shares;
insert into public.student_group_memberships select * from safety_backup_group_memberships;
insert into public.student_posts select * from safety_backup_posts;
insert into public.course_lesson_progress select * from safety_backup_lesson_progress;
insert into public.course_progress select * from safety_backup_course_progress;

create temporary table safety_restore_inventory_after as
select '2.2'::text contract_version,domain,true captured,
       jsonb_array_length(rows)::bigint row_count,rows,
       encode(extensions.digest(rows::text,'sha256'),'hex') digest
from pg_temp.capture_student_restore_rows('10000000-0000-4000-8000-000000000011');

do $$
begin
  if exists(
    select 1 from safety_restore_inventory_before b
    full join safety_restore_inventory_after a using(domain)
    where b.domain is null or a.domain is null or not b.captured or not a.captured
      or b.contract_version is distinct from a.contract_version
      or b.row_count is distinct from a.row_count or b.rows is distinct from a.rows
      or b.digest is distinct from a.digest
  ) then
    raise exception 'RESTORE TEST FAILED: restored student bundle did not reconcile';
  end if;
  raise notice 'PASS representative logical restore reconciles within the canonical 45-domain inventory';
end $$;

-- GATE 2: cross-institution RLS denial for student, professor, and admin data.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_direct_message_denied boolean:=false; v_cross_course_recipient_denied boolean:=false;
begin
  if (select auth.uid()) is distinct from '10000000-0000-4000-8000-000000000011'::uuid then raise exception 'AUTH TEST FAILED: auth.uid did not resolve the student JWT subject'; end if;
  if (select count(*) from public.student_grades where student_id='10000000-0000-4000-8000-000000000011') <> 1 then raise exception 'ACCESS TEST FAILED: student could not read their same-institution grade'; end if;
  if (select count(*) from public.courses where id='40000000-0000-4000-8000-000000000001') <> 1 then raise exception 'ACCESS TEST FAILED: student could not read their same-institution course'; end if;
  if (select count(*) from public.student_grades where student_id='10000000-0000-4000-8000-000000000012') <> 0 then raise exception 'ACCESS TEST FAILED: student saw another institution grade'; end if;
  if (select count(*) from public.courses where id='40000000-0000-4000-8000-000000000002') <> 0 then raise exception 'ACCESS TEST FAILED: student saw another institution course'; end if;
  if (select count(*) from public.institution_affiliations where user_id='10000000-0000-4000-8000-000000000012') <> 0 then raise exception 'ACCESS TEST FAILED: student saw another institution affiliation'; end if;
  if (select count(*) from public.profiles where id='10000000-0000-4000-8000-000000000012') <> 0 then raise exception 'ACCESS TEST FAILED: student saw another student profile'; end if;
  begin
    insert into public.learning_messages(course_id,sender_id,recipient_id,body)
    values(null,(select auth.uid()),'10000000-0000-4000-8000-000000000012','Cross-tenant course-less message must fail');
  exception when insufficient_privilege then v_direct_message_denied:=true; end;
  begin
    insert into public.learning_messages(course_id,sender_id,recipient_id,body)
    values('40000000-0000-4000-8000-000000000001',(select auth.uid()),'10000000-0000-4000-8000-000000000012','Cross-tenant course recipient must fail');
  exception when insufficient_privilege then v_cross_course_recipient_denied:=true; end;
  if not (v_direct_message_denied and v_cross_course_recipient_denied) then
    raise exception 'ACCESS TEST FAILED: student sent a course-less or course-scoped message across institutions';
  end if;
  raise notice 'PASS auth.uid, same-tenant, and student cross-institution access-control test';
end $$;
do $$
declare
  v_message public.learning_messages;
  v_sensitive_payload_denied boolean:=false;
begin
  select * into v_message
  from public.send_course_message(
    '40000000-0000-4000-8000-000000000001',
    'How do I trace a claim to the earliest source?',
    'question',
    null,
    null
  );
  if v_message.sender_id is distinct from (select auth.uid())
     or v_message.sender_label<>'Student A'
     or v_message.recipient_id is not null
     or v_message.message_kind<>'question' then
    raise exception 'COMMUNICATION TEST FAILED: server-derived course question identity or audience is wrong';
  end if;
  begin
    perform public.send_course_message(
      '40000000-0000-4000-8000-000000000001',
      'grade: 99',
      'question',
      null,
      null
    );
  exception when raise_exception then v_sensitive_payload_denied:=true; end;
  if not v_sensitive_payload_denied then
    raise exception 'COMMUNICATION TEST FAILED: grade details entered the message payload';
  end if;
  insert into public.course_communication_preferences(
    course_id,user_id,notify_announcements,notify_replies
  ) values (
    '40000000-0000-4000-8000-000000000001',(select auth.uid()),true,true
  );
  raise notice 'PASS student course-question identity, payload minimization, and notification preference gate';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare
  v_question_id uuid;
  v_announcement public.professor_announcements;
  v_cross_course_publish_denied boolean:=false;
begin
  select id into v_question_id
  from public.learning_messages
  where course_id='40000000-0000-4000-8000-000000000001'
    and body='How do I trace a claim to the earliest source?';
  if v_question_id is null then
    raise exception 'COMMUNICATION TEST FAILED: professor could not see the current learner question';
  end if;
  select * into v_announcement
  from public.publish_course_announcement(
    '40000000-0000-4000-8000-000000000001',
    'Digital literacy source check',
    'The source-check practice is ready for the current course.'
  );
  if v_announcement.professor_id is distinct from (select auth.uid())
     or v_announcement.audience<>'course'
     or not v_announcement.is_published
     or v_announcement.education_division<>'university' then
    raise exception 'COMMUNICATION TEST FAILED: course announcement identity, audience, or division is wrong';
  end if;
  perform public.send_course_message(
    '40000000-0000-4000-8000-000000000001',
    'Start with the claim, follow each citation, and compare publication dates.',
    'reply',
    v_question_id,
    null
  );
  begin
    perform public.publish_course_announcement(
      '40000000-0000-4000-8000-000000000002',
      'Wrong course',
      'This cross-institution publish must fail.'
    );
  exception when insufficient_privilege or raise_exception then
    v_cross_course_publish_denied:=true;
  end;
  if not v_cross_course_publish_denied then
    raise exception 'COMMUNICATION TEST FAILED: professor published into another institution course';
  end if;
  raise notice 'PASS professor announcement and course-reply authorization gate';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare
  v_reply_ids uuid[];
  v_announcement_ids uuid[];
begin
  if (select count(*) from public.learning_messages
      where course_id='40000000-0000-4000-8000-000000000001'
        and recipient_id is null
        and message_kind in ('question','reply'))<>2 then
    raise exception 'COMMUNICATION TEST FAILED: student and professor do not see the same course thread';
  end if;
  if (select count(*) from public.professor_announcements
      where course_id='40000000-0000-4000-8000-000000000001'
        and audience='course' and is_published)<>1 then
    raise exception 'COMMUNICATION TEST FAILED: enrolled student could not see the course announcement';
  end if;
  select array_agg(id) into v_reply_ids
  from public.learning_messages
  where course_id='40000000-0000-4000-8000-000000000001'
    and recipient_id is null and sender_id<>(select auth.uid());
  select array_agg(id) into v_announcement_ids
  from public.professor_announcements
  where course_id='40000000-0000-4000-8000-000000000001'
    and audience='course' and is_published;
  perform public.mark_course_communication_read(
    '40000000-0000-4000-8000-000000000001',
    coalesce(v_reply_ids,'{}'::uuid[]),
    coalesce(v_announcement_ids,'{}'::uuid[])
  );
  if (select count(*) from public.course_communication_reads
      where user_id=(select auth.uid())
        and course_id='40000000-0000-4000-8000-000000000001')<>2 then
    raise exception 'COMMUNICATION TEST FAILED: per-user read state did not reconcile';
  end if;
  raise notice 'PASS enrolled student announcement, shared thread, and read-state sync gate';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000012',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_cross_course_send_denied boolean:=false;
begin
  if (select count(*) from public.learning_messages
      where course_id='40000000-0000-4000-8000-000000000001')<>0
     or (select count(*) from public.professor_announcements
         where course_id='40000000-0000-4000-8000-000000000001')<>0
     or (select count(*) from public.course_communication_reads
         where course_id='40000000-0000-4000-8000-000000000001')<>0 then
    raise exception 'COMMUNICATION TEST FAILED: another institution read course communication state';
  end if;
  begin
    perform public.send_course_message(
      '40000000-0000-4000-8000-000000000001',
      'This cross-institution question must fail.',
      'question',
      null,
      null
    );
  exception when insufficient_privilege or raise_exception then
    v_cross_course_send_denied:=true;
  end;
  if not v_cross_course_send_denied then
    raise exception 'COMMUNICATION TEST FAILED: another institution wrote to the course room';
  end if;
  raise notice 'PASS cross-institution communication, receipt, and write denial';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare
  v_lesson_write_denied boolean:=false;
  v_course_write_denied boolean:=false;
  v_fake_rpc_denied boolean:=false;
  v_publication_id uuid;
begin
  select id into v_publication_id from public.course_publications
  where course_id='40000000-0000-4000-8000-000000000001';
  begin
    insert into public.course_lesson_progress(
      publication_id,course_id,user_id,version_number,path_id,lesson_id,status,auto_score,completed_at
    ) values(v_publication_id,'40000000-0000-4000-8000-000000000001',(select auth.uid()),1,'forged','forged','completed',100,now());
  exception when insufficient_privilege or raise_exception then v_lesson_write_denied:=true; end;
  begin
    insert into public.course_progress(
      publication_id,course_id,user_id,version_number,status,completed_lessons,total_lessons,
      completion_percent,auto_score,final_score,grade_status
    ) values(v_publication_id,'40000000-0000-4000-8000-000000000001',(select auth.uid()),1,'completed',1,1,100,100,100,'auto_graded');
  exception when insufficient_privilege or raise_exception then v_course_write_denied:=true; end;
  begin
    perform public.save_course_lesson_progress(v_publication_id,'forged','forged',0,'complete','{}'::jsonb,true);
  exception when raise_exception then v_fake_rpc_denied:=true; end;
  if not (v_lesson_write_denied and v_course_write_denied and v_fake_rpc_denied) then
    raise exception 'GRADE INTEGRITY TEST FAILED: learner forged runtime progress or an unmanifested lesson';
  end if;
  if exists(select 1 from public.student_grades sg join public.course_publications cp on cp.grade_item_id=sg.grade_item_id where cp.id=v_publication_id and sg.student_id=(select auth.uid())) then
    raise exception 'GRADE INTEGRITY TEST FAILED: rejected progress created an exportable grade';
  end if;
  raise notice 'PASS direct progress-write and forged runtime-grade denial';
end $$;
select public.request_institution_transfer(jsonb_build_object(
  'pathway','student',
  'to_directory_key','safety-institution-b',
  'reason','Disposable transfer-boundary test'
));
do $$ begin
  if not exists (
    select 1 from public.institution_affiliations
    where user_id='10000000-0000-4000-8000-000000000011'
      and institution_id='20000000-0000-4000-8000-000000000001'
      and status='active'
  ) then raise exception 'ACCESS TEST FAILED: a pending transfer removed current institution access'; end if;
  if (select count(*) from public.courses where id='40000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'ACCESS TEST FAILED: a pending transfer hid the current institution course';
  end if;
  raise notice 'PASS pending transfer preserves current access';
end $$;
do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.course_memberships (course_id,user_id,role)
    values ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011','learner');
  exception when insufficient_privilege or raise_exception then
    v_denied := true;
  end;
  if not v_denied then raise exception 'ACCESS TEST FAILED: student joined another institution course'; end if;
  raise notice 'PASS cross-institution enrollment write denial';
end $$;
do $$
declare
  v_draft_denied boolean:=false;
  v_resource_denied boolean:=false;
  v_post_denied boolean:=false;
  v_group_denied boolean:=false;
begin
  begin
    update public.assignment_drafts set assignment_id='45000000-0000-4000-8000-000000000002'
    where id='46000000-0000-4000-8000-000000000001';
  exception when raise_exception or insufficient_privilege then v_draft_denied:=true; end;
  begin
    update public.learning_resources set
      course_id='40000000-0000-4000-8000-000000000002',
      assignment_id='45000000-0000-4000-8000-000000000002',
      secure_file_id='80000000-0000-4000-8000-000000000008'
    where id='47000000-0000-4000-8000-000000000001';
  exception when raise_exception or insufficient_privilege then v_resource_denied:=true; end;
  begin
    update public.student_posts set group_id='48000000-0000-4000-8000-000000000002'
    where id='49000000-0000-4000-8000-000000000001';
  exception when raise_exception or insufficient_privilege then v_post_denied:=true; end;
  begin
    update public.student_groups set
      institution_id='20000000-0000-4000-8000-000000000002',
      course_id='40000000-0000-4000-8000-000000000002'
    where id='48000000-0000-4000-8000-000000000001';
  exception when raise_exception or insufficient_privilege then v_group_denied:=true; end;
  if not (v_draft_denied and v_resource_denied and v_post_denied and v_group_denied) then
    raise exception 'ACCESS TEST FAILED: a student moved draft, resource, post, or group data into another scope';
  end if;
  raise notice 'PASS immutable student draft, resource, post, and group scope tests';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000013',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  if private.can_access_secure_file('80000000-0000-4000-8000-000000000007',(select auth.uid())) then
    raise exception 'ACCESS TEST FAILED: same-course peer received submission download authorization';
  end if;
  if (select count(*) from public.secure_file_objects where id='80000000-0000-4000-8000-000000000007')<>0 then
    raise exception 'ACCESS TEST FAILED: same-course peer read another learner submission';
  end if;
  if (select count(*) from public.file_previews where secure_file_id='80000000-0000-4000-8000-000000000007')<>0 then
    raise exception 'ACCESS TEST FAILED: same-course peer read another learner submission preview';
  end if;
  raise notice 'PASS same-course peer submission object, preview, and download-helper denial';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_updated integer;
        v_search_denied boolean := false;
        v_membership_write_denied boolean := false;
        v_hold_write_denied boolean := false;
        v_retention_write_denied boolean := false;
        v_direct_grade_write_denied boolean := false;
        v_cross_grade_denied boolean := false;
        v_mismatched_item_denied boolean := false;
        v_cross_membership_denied boolean := false;
        v_cross_roster_denied boolean := false;
        v_cross_enrollment_denied boolean := false;
begin
  if (select auth.uid()) is distinct from '10000000-0000-4000-8000-000000000001'::uuid then raise exception 'AUTH TEST FAILED: auth.uid did not resolve the professor JWT subject'; end if;
  if (select count(*) from public.student_grades where student_id='10000000-0000-4000-8000-000000000011') <> 1 then raise exception 'ACCESS TEST FAILED: professor could not read a managed same-institution grade'; end if;
  if (select count(*) from public.student_grades where student_id='10000000-0000-4000-8000-000000000012') <> 0 then raise exception 'ACCESS TEST FAILED: professor saw another institution grade'; end if;
  if (select count(*) from public.institution_memberships where institution_id='20000000-0000-4000-8000-000000000002') <> 0 then raise exception 'ACCESS TEST FAILED: institution admin saw another institution membership'; end if;
  begin
    update public.student_grades set score=0 where id='60000000-0000-4000-8000-000000000001';
    get diagnostics v_updated = row_count;
  exception when insufficient_privilege then
    v_direct_grade_write_denied := true;
    v_updated := 0;
  end;
  if v_updated <> 0 then raise exception 'ACCESS TEST FAILED: professor changed another institution grade'; end if;
  begin
    perform public.admin_search_accounts_courses('', '20000000-0000-4000-8000-000000000002', null);
  exception when raise_exception then
    if sqlerrm = 'Institution account-search access required' then
      v_search_denied := true;
    else
      raise;
    end if;
  end;
  if not v_search_denied then raise exception 'ACCESS TEST FAILED: institution admin searched another institution'; end if;

  begin
    update public.institution_memberships set permissions='{"view_control_center":true,"manage_team":true,"view_audit":true}'::jsonb
    where institution_id='20000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000092';
  exception when insufficient_privilege then v_membership_write_denied:=true; end;
  begin
    insert into public.legal_holds(institution_id,name,reason,created_by)
    values('20000000-0000-4000-8000-000000000001','Direct hold must fail','Direct mutation test','10000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_hold_write_denied:=true; end;
  begin
    insert into public.retention_policies(institution_id,name,retention_days,created_by)
    values('20000000-0000-4000-8000-000000000001','Direct retention must fail',365,'10000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_retention_write_denied:=true; end;
  if not (v_membership_write_denied and v_hold_write_denied and v_retention_write_denied) then
    raise exception 'ACCESS TEST FAILED: direct institution membership, hold, or retention mutation was allowed';
  end if;

  begin
    insert into public.student_grades(id,course_id,grade_item_id,student_id,score,status,published_at,finalized_at)
    values('60000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000011',19,'finalized',now(),now());
  exception when insufficient_privilege then v_direct_grade_write_denied:=true; end;
  begin
    insert into public.student_grades(course_id,grade_item_id,student_id,score,status)
    values('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000012',10,'finalized');
  exception when raise_exception or insufficient_privilege then v_cross_grade_denied:=true; end;
  begin
    insert into public.student_grades(course_id,grade_item_id,student_id,score,status)
    values('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011',10,'finalized');
  exception when raise_exception or insufficient_privilege then v_mismatched_item_denied:=true; end;
  begin
    insert into public.course_memberships(course_id,user_id,role)
    values('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000012','learner');
  exception when raise_exception or insufficient_privilege then v_cross_membership_denied:=true; end;
  begin
    insert into public.student_roster_entries(course_id,added_by,identifier_hash,identifier_last4,matched_user_id,match_status)
    values('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','cross-tenant-roster','0012','10000000-0000-4000-8000-000000000012','approved');
  exception when raise_exception or insufficient_privilege then v_cross_roster_denied:=true; end;
  begin
    insert into public.student_enrollment_requests(course_id,student_id,status)
    values('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000012','pending');
  exception when raise_exception or insufficient_privilege then v_cross_enrollment_denied:=true; end;
  if not (v_direct_grade_write_denied and v_cross_grade_denied and v_mismatched_item_denied and v_cross_membership_denied and v_cross_roster_denied and v_cross_enrollment_denied) then
    raise exception 'ACCESS TEST FAILED: a cross-tenant grade, membership, roster, or enrollment reference was allowed';
  end if;
  raise notice 'PASS professor/admin same-tenant, direct-write, and cross-tenant invariant tests';
end $$;
reset role;

-- Delegated platform assignments are capability-specific; a legacy profile
-- role named admin is not a platform owner or implicit global manager.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000092',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_platform_denied boolean:=false; v_self_denied boolean:=false; v_superset_denied boolean:=false;
begin
  if (select auth.uid()) is distinct from '10000000-0000-4000-8000-000000000092'::uuid then raise exception 'AUTH TEST FAILED: auth.uid did not resolve the legacy-admin JWT subject'; end if;
  if private.is_platform_manager() then raise exception 'ACCESS TEST FAILED: legacy profile admin retained global platform-manager access'; end if;
  begin perform public.get_admin_control_center(null); exception when raise_exception then v_platform_denied:=true; end;
  begin
    perform public.set_institution_team_member(
      '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000092','admin',
      '{"view_control_center":true,"manage_team":true,"view_audit":true}'::jsonb,'active'
    );
  exception when raise_exception then v_self_denied:=true; end;
  begin
    perform public.set_institution_team_member(
      '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000095','security',
      '{"view_audit":true}'::jsonb,'active'
    );
  exception when raise_exception then v_superset_denied:=true; end;
  if not (v_platform_denied and v_self_denied and v_superset_denied) then
    raise exception 'ACCESS TEST FAILED: legacy admin, self-escalation, or permission-superset guard failed';
  end if;
  raise notice 'PASS legacy profile admin denial and institution-team anti-escalation tests';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000093',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_center jsonb; v_scoped_test_denied boolean:=false; v_connection_id uuid;
begin
  if not private.has_platform_capability('test_integrations',(select auth.uid())) then raise exception 'CAPABILITY TEST FAILED: operator lacks assigned integration-test capability'; end if;
  if private.has_platform_capability('view_reports',(select auth.uid())) then raise exception 'CAPABILITY TEST FAILED: operator received unassigned report capability'; end if;
  v_center:=public.get_admin_control_center(null);
  if jsonb_array_length(v_center->'reports')<>0 or jsonb_array_length(v_center->'platform_authorizations')<>0 or jsonb_array_length(v_center->'applications')<>0 then
    raise exception 'CAPABILITY TEST FAILED: operator received owner/report-only control-center data';
  end if;
  select id into v_connection_id from public.integration_connections where connection_key='supabase-database' and institution_id is null;
  perform public.record_integration_test(v_connection_id,'tenant_isolation','passed','Disposable delegated integration-test evidence','{"fixture":true}'::jsonb);
  begin
    perform public.record_integration_test('90000000-0000-4000-8000-000000000001','scope_test','passed','Must remain institution scoped','{"fixture":true}'::jsonb);
  exception when raise_exception then v_scoped_test_denied:=true; end;
  if not v_scoped_test_denied then raise exception 'CAPABILITY TEST FAILED: platform operator tested an institution-scoped connection without institution authority'; end if;
  raise notice 'PASS delegated operator capability and connection-scope tests';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000094',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_search_denied boolean:=false; v_center jsonb;
begin
  if not private.has_platform_capability('view_reports',(select auth.uid())) or private.has_platform_capability('view_accounts',(select auth.uid())) or private.has_platform_capability('test_integrations',(select auth.uid())) then
    raise exception 'CAPABILITY TEST FAILED: auditor capability matrix is incorrect';
  end if;
  v_center:=public.get_admin_control_center(null);
  if (v_center->'access'->>'can_view_reports')::boolean is not true then raise exception 'CAPABILITY TEST FAILED: auditor report view was not exposed'; end if;
  begin perform public.admin_search_accounts_courses('',null,null); exception when raise_exception then v_search_denied:=true; end;
  if not v_search_denied then raise exception 'CAPABILITY TEST FAILED: auditor searched accounts without view_accounts'; end if;
  raise notice 'PASS delegated auditor capability test';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000095',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_center jsonb; v_search jsonb;
begin
  v_center:=public.get_admin_control_center(null);
  if jsonb_array_length(v_center->'features')<>0 or jsonb_array_length(v_center->'connections')<>0
    or jsonb_array_length(v_center->'changes')<>0 or jsonb_array_length(v_center->'reports')<>0
    or jsonb_array_length(v_center->'platform_authorizations')<>0 then
    raise exception 'CAPABILITY TEST FAILED: support received data outside control-center/account capabilities';
  end if;
  if (v_center->'statistics'->>'accounts')::integer<1 then raise exception 'CAPABILITY TEST FAILED: support account summary is missing'; end if;
  v_search:=public.admin_search_accounts_courses('student-a',null,null);
  if jsonb_array_length(v_search->'accounts')<1 then raise exception 'CAPABILITY TEST FAILED: support could not use assigned account search'; end if;
  raise notice 'PASS delegated support data-minimization test';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000091',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_center jsonb; v_search jsonb;
begin
  v_center:=public.get_admin_control_center(null);
  if (v_center->'access'->>'current_user_id')::uuid is distinct from (select auth.uid()) then raise exception 'OWNER TEST FAILED: control center omitted current_user_id'; end if;
  if jsonb_array_length(v_center->'platform_authorizations')<>3 then raise exception 'OWNER TEST FAILED: delegated authorization inventory is incomplete'; end if;
  if exists(select 1 from jsonb_array_elements(v_center->'platform_authorizations') a where nullif(a->>'full_name','') is null or nullif(a->>'email','') is null or a->'capabilities' is null or a->>'updated_at' is null) then
    raise exception 'OWNER TEST FAILED: authorization inventory omitted UI concurrency or account fields';
  end if;
  v_search:=public.admin_search_accounts_courses('platform owner',null,null);
  if not exists(select 1 from jsonb_array_elements(v_search->'accounts') a where (a->>'platform_owner')::boolean) then raise exception 'OWNER TEST FAILED: account search omitted platform_owner marker'; end if;
  raise notice 'PASS platform-owner authorization inventory test';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_cross_share_denied boolean:=false;
begin
  insert into public.grade_share_links(id,student_id,viewer_id,label,token_hash,scope_course_ids,expires_at)
  values('65000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000092',
    'Same-institution safety share','same-institution-safety-token',array['40000000-0000-4000-8000-000000000001'::uuid],now()+interval '1 day');
  begin
    insert into public.grade_share_links(student_id,viewer_id,label,token_hash,scope_course_ids,expires_at)
    values('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000012','Cross-institution must fail','cross-institution-safety-token',
      array['40000000-0000-4000-8000-000000000001'::uuid],now()+interval '1 day');
  exception when raise_exception or insufficient_privilege then v_cross_share_denied:=true; end;
  if not v_cross_share_denied then raise exception 'ACCESS TEST FAILED: institutional grade share crossed tenant boundary'; end if;
  raise notice 'PASS grade-share tenant write boundary';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000092',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  if (select count(*) from public.student_grades where student_id='10000000-0000-4000-8000-000000000011' and course_id='40000000-0000-4000-8000-000000000001')<1 then
    raise exception 'ACCESS TEST FAILED: same-institution active grade share was not readable';
  end if;
  raise notice 'PASS same-institution grade-share read';
end $$;
reset role;

-- Legitimate runtime completion is server-scored. A later instructor grade is
-- authoritative and a learner replay must not overwrite the finalized record.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.save_course_lesson_progress(
  (select id from public.course_publications where course_id='40000000-0000-4000-8000-000000000001'),
  'path-a','lesson-a',0,'complete','{"knowledgeAnswers":{"question-a":"yes"}}'::jsonb,true
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.grade_course_progress(
  (select id from public.course_publications where course_id='40000000-0000-4000-8000-000000000001'),
  '10000000-0000-4000-8000-000000000011',73,'Instructor safety grade'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.save_course_lesson_progress(
  (select id from public.course_publications where course_id='40000000-0000-4000-8000-000000000001'),
  'path-a','lesson-a',0,'complete','{"knowledgeAnswers":{"question-a":"yes"}}'::jsonb,true
);
do $$ begin
  if not exists(
    select 1 from public.student_grades sg
    join public.course_publications cp on cp.grade_item_id=sg.grade_item_id
    where cp.course_id='40000000-0000-4000-8000-000000000001'
      and sg.student_id=(select auth.uid()) and sg.score=73 and sg.status='finalized'
  ) then raise exception 'GRADE INTEGRITY TEST FAILED: learner replay replaced the instructor-finalized grade'; end if;
  raise notice 'PASS instructor-finalized grade survives learner progress replay';
end $$;
reset role;

-- GATE 3: Blackboard identity, column, score, and maximum-point reconciliation.
insert into public.blackboard_identity_mappings (
  id,institution_id,course_id,ednotebook_user_id,blackboard_row_key,
  blackboard_username,blackboard_student_id,blackboard_sis_user_id,blackboard_email,
  blackboard_display_name,external_identifiers,match_method,confidence,confirmed_by
) values (
  '70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000011','bb-row-student-a','student.a','ASU-1001','SIS-1001','student-a@safety.invalid',
  'Student A','{"institution_user_id":"ASU-1001","oneroster_sourced_id":"SIS-1001"}','manual-confirmed','manual','10000000-0000-4000-8000-000000000001'
);

insert into public.blackboard_grade_column_mappings (
  id,institution_id,course_id,blackboard_column_key,blackboard_column_name,
  blackboard_points_possible,external_line_item_id,canonical_line_item,
  ednotebook_grade_item_id,mapping_type,scaling_mode,confirmed_by
) values (
  '71000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  'bb-column-safety-a','Safety Assignment A',100,'bb-line-item-a',
  '{"title":"Safety Assignment A","maximum_points":100}',
  '50000000-0000-4000-8000-000000000001','grade_item','raw','10000000-0000-4000-8000-000000000001'
);

create temporary table safety_blackboard_export as
select bim.blackboard_username,bim.blackboard_student_id,bim.blackboard_sis_user_id,
       bgcm.blackboard_column_key,bgcm.external_line_item_id,
       sg.score,gi.max_points,sg.status
from public.blackboard_identity_mappings bim
join public.student_grades sg on sg.student_id=bim.ednotebook_user_id and sg.course_id=bim.course_id
join public.grade_items gi on gi.id=sg.grade_item_id
join public.blackboard_grade_column_mappings bgcm on bgcm.course_id=sg.course_id and bgcm.ednotebook_grade_item_id=sg.grade_item_id
where bim.course_id='40000000-0000-4000-8000-000000000001';

do $$ begin
  if (select count(*) from safety_blackboard_export) <> 1 then raise exception 'EXPORT TEST FAILED: expected one reconciled Blackboard row'; end if;
  if not exists (
    select 1 from safety_blackboard_export
    where blackboard_username='student.a' and blackboard_student_id='ASU-1001'
      and blackboard_sis_user_id='SIS-1001' and blackboard_column_key='bb-column-safety-a'
      and external_line_item_id='bb-line-item-a' and score=88.5 and max_points=100 and status='finalized'
  ) then raise exception 'EXPORT TEST FAILED: Blackboard identifiers or grade values did not reconcile'; end if;
  raise notice 'PASS Blackboard export and reconciliation test';
end $$;

create temporary table safety_blackboard_rpc_payload as
select
  jsonb_build_object(
    'students',jsonb_build_array(jsonb_build_object(
      'row_key','bb-row-student-a','learner_id','10000000-0000-4000-8000-000000000011','match_method','manual-confirmed'
    )),
    'columns',jsonb_build_array(jsonb_build_object(
      'blackboard_column_key','bb-column-safety-a','blackboard_column_name','Safety Assignment A',
      'blackboard_points_possible',100,'external_line_item_id','bb-line-item-a',
      'ednotebook_grade_item_id','50000000-0000-4000-8000-000000000001',
      'mapping_type','grade_item','scaling_mode','raw'
    ))
  ) mapping_snapshot,
  jsonb_build_array(jsonb_build_object(
    'blackboard_row_key','bb-row-student-a','blackboard_column_key','bb-column-safety-a',
    'student_id','10000000-0000-4000-8000-000000000011','source_kind','grade_item',
    'grade_item_id','50000000-0000-4000-8000-000000000001','source_score',sg.score,
    'source_updated_at',sg.updated_at,'exported_score',sg.score
  )) grade_snapshot
from public.student_grades sg where sg.id='60000000-0000-4000-8000-000000000001';
grant select on safety_blackboard_rpc_payload to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
create temporary table safety_confirmed_blackboard_export as
select (public.confirm_blackboard_grade_export(
  '40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,
  'verified.csv','Blackboard CSV UTF-8',1,1,0,1,1,0,mapping_snapshot,grade_snapshot
)).* from safety_blackboard_rpc_payload;
do $$
declare
  v_mapping jsonb;
  v_grades jsonb;
  v_swapped_denied boolean:=false;
  v_score_denied boolean:=false;
  v_null_denied boolean:=false;
  v_duplicate_denied boolean:=false;
  v_scaling_denied boolean:=false;
  v_hash_denied boolean:=false;
  v_column_denied boolean:=false;
  v_timestamp_denied boolean:=false;
begin
  select mapping_snapshot,grade_snapshot into v_mapping,v_grades from safety_blackboard_rpc_payload;
  if not exists(select 1 from safety_confirmed_blackboard_export where status='generated' and output_file_hash=repeat('a',64) and output_byte_length=123) then
    raise exception 'EXPORT TEST FAILED: hardened Blackboard confirmation did not persist output evidence';
  end if;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,'swapped.csv','Blackboard CSV',1,1,0,1,1,0,v_mapping,
    jsonb_set(v_grades,'{0,blackboard_row_key}','"wrong-row"'::jsonb)); exception when raise_exception then v_swapped_denied:=true; end;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,'column.csv','Blackboard CSV',1,1,0,1,1,0,v_mapping,
    jsonb_set(v_grades,'{0,blackboard_column_key}','"wrong-column"'::jsonb)); exception when raise_exception then v_column_denied:=true; end;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,'stale.csv','Blackboard CSV',1,1,0,1,1,0,v_mapping,
    jsonb_set(v_grades,'{0,source_updated_at}',to_jsonb('2000-01-01T00:00:00Z'::text))); exception when raise_exception then v_timestamp_denied:=true; end;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,'score.csv','Blackboard CSV',1,1,0,1,1,0,v_mapping,
    jsonb_set(v_grades,'{0,source_score}','89'::jsonb)); exception when raise_exception then v_score_denied:=true; end;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,'null.csv','Blackboard CSV',1,1,0,1,1,0,v_mapping,
    jsonb_set(v_grades,'{0,source_score}','null'::jsonb)); exception when raise_exception then v_null_denied:=true; end;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,'duplicate.csv','Blackboard CSV',1,1,0,1,2,0,v_mapping,v_grades||v_grades); exception when raise_exception then v_duplicate_denied:=true; end;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),repeat('a',64),123,'scaling.csv','Blackboard CSV',1,1,0,1,1,0,
    jsonb_set(v_mapping,'{columns,0,scaling_mode}','"percentage"'::jsonb),v_grades); exception when raise_exception then v_scaling_denied:=true; end;
  begin perform public.confirm_blackboard_grade_export('40000000-0000-4000-8000-000000000001','source.csv',repeat('b',64),'not-a-hash',123,'hash.csv','Blackboard CSV',1,1,0,1,1,0,v_mapping,v_grades); exception when raise_exception then v_hash_denied:=true; end;
  if not (v_swapped_denied and v_column_denied and v_timestamp_denied and v_score_denied and v_null_denied and v_duplicate_denied and v_scaling_denied and v_hash_denied) then
    raise exception 'EXPORT TEST FAILED: hardened confirmation accepted swapped, stale, null, duplicate, scaling, or output-hash tampering';
  end if;
  raise notice 'PASS hardened Blackboard confirmation and tamper-rejection test';
end $$;
reset role;

-- Completing the reviewed transfer preserves historic records but immediately
-- fences stale course memberships from the former institution.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000091',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.review_institution_transfer(
  (select id from public.institution_transfer_requests where user_id='10000000-0000-4000-8000-000000000011' and status='pending'),
  'approved','Disposable completed-transfer isolation test'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_stale_message_denied boolean:=false;
begin
  if private.can_access_course('40000000-0000-4000-8000-000000000001') then raise exception 'ACCESS TEST FAILED: stale course membership survived completed institution transfer'; end if;
  if (select count(*) from public.courses where id='40000000-0000-4000-8000-000000000001')<>0 then raise exception 'ACCESS TEST FAILED: transferred student still read the former institution course'; end if;
  if not exists(select 1 from public.course_memberships where course_id='40000000-0000-4000-8000-000000000001' and user_id=(select auth.uid())) then
    raise exception 'TRANSFER TEST FAILED: historic membership was unexpectedly destroyed instead of access-fenced';
  end if;
  if private.shares_course_with('10000000-0000-4000-8000-000000000013') then raise exception 'TRANSFER TEST FAILED: old class-profile sharing survived transfer'; end if;
  if private.can_access_student_group('48000000-0000-4000-8000-000000000001')
     or private.can_manage_student_group('48000000-0000-4000-8000-000000000001') then
    raise exception 'TRANSFER TEST FAILED: old group access or control survived transfer';
  end if;
  if (select count(*) from public.student_groups where id='48000000-0000-4000-8000-000000000001')<>0
     or (select count(*) from public.student_posts where group_id='48000000-0000-4000-8000-000000000001')<>0
     or (select count(*) from public.student_public_profiles where user_id='10000000-0000-4000-8000-000000000013')<>0 then
    raise exception 'TRANSFER TEST FAILED: old group, post, or class profile remained readable';
  end if;
  if (select count(*) from public.learning_messages where id='47500000-0000-4000-8000-000000000001')<>0 then
    raise exception 'TRANSFER TEST FAILED: old course message remained readable after transfer';
  end if;
  begin
    insert into public.learning_messages(course_id,sender_id,recipient_id,body)
    values('40000000-0000-4000-8000-000000000001',(select auth.uid()),'10000000-0000-4000-8000-000000000013','Former-course message must fail');
  exception when insufficient_privilege then v_stale_message_denied:=true; end;
  if not v_stale_message_denied then raise exception 'TRANSFER TEST FAILED: transferred student sent a message into the former course'; end if;
  raise notice 'PASS completed-transfer course, class-profile, group, post, and management access fence';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000013',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  if private.shares_course_with('10000000-0000-4000-8000-000000000011')
     or (select count(*) from public.student_public_profiles where user_id='10000000-0000-4000-8000-000000000011')<>0 then
    raise exception 'TRANSFER TEST FAILED: former classmate retained transferred student class-profile access';
  end if;
  raise notice 'PASS former-classmate class-profile denial after completed transfer';
end $$;
reset role;

-- GATE 4: eligible deletion, deferred retention, and legal-hold blocking.
insert into public.secure_file_objects (
  id,owner_id,institution_id,purpose,original_name,safe_name,expected_size_bytes,actual_size_bytes,
  quarantine_path,destination_bucket,destination_path,upload_status,security_status,archive_status,
  availability_status,retention_until,upload_expires_at
) values
  ('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','eligible.txt','eligible.txt',10,10,'safety/eligible-q','ed-private','safety/eligible','uploaded','clean','not_archive','released',now()-interval '1 day',now()+interval '1 day'),
  ('80000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','retained.txt','retained.txt',10,10,'safety/retained-q','ed-private','safety/retained','uploaded','clean','not_archive','released',now()+interval '30 days',now()+interval '1 day'),
  ('80000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','held.txt','held.txt',10,10,'safety/held-q','ed-private','safety/held','uploaded','clean','not_archive','released',now()-interval '1 day',now()+interval '1 day'),
  ('80000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','claim.txt','claim.txt',10,10,'safety/claim-q','ed-private','safety/claim','uploaded','clean','not_archive','released',now()-interval '1 day',now()+interval '1 day'),
  ('80000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','held-expired-upload.txt','held-expired-upload.txt',10,null,'safety/held-expired-q','ed-private','safety/held-expired','reserved','pending','pending','quarantined',null,now()-interval '1 hour'),
  ('80000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000002','private','institution-b.txt','institution-b.txt',10,10,'safety/institution-b-q','ed-private','safety/institution-b','uploaded','clean','not_archive','released',now()-interval '1 day',now()+interval '1 day'),
  ('80000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','expired-upload.txt','expired-upload.txt',10,null,'safety/expired-q','ed-private','safety/expired','reserved','pending','pending','quarantined',null,now()-interval '1 hour'),
  ('80000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','normal-completion.txt','normal-completion.txt',10,10,'safety/normal-q','ed-private','safety/normal','uploaded','clean','not_archive','released',now()-interval '1 day',now()+interval '1 day'),
  ('80000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','private','late-retention.txt','late-retention.txt',10,10,'safety/late-retention-q','ed-private','safety/late-retention','uploaded','clean','not_archive','released',now()-interval '1 day',now()+interval '1 day');

insert into public.upload_quota_reservations(id,secure_file_id,user_id,reserved_bytes,status,expires_at) values
  ('83000000-0000-4000-8000-000000000004','80000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000011',10,'committed',now()+interval '1 day'),
  ('83000000-0000-4000-8000-000000000009','80000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000011',10,'reserved',now()-interval '1 hour'),
  ('83000000-0000-4000-8000-000000000010','80000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011',10,'committed',now()+interval '1 day');

insert into public.legal_holds (id,course_id,name,reason,created_by)
values ('81000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Safety legal hold','Disposable preview test','10000000-0000-4000-8000-000000000001');
insert into public.legal_hold_files (legal_hold_id,secure_file_id,added_by)
values
  ('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000092',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare v_delete_denied boolean:=false;
begin
  if (select count(*) from public.secure_file_objects where id='80000000-0000-4000-8000-000000000006')<>0 then raise exception 'ACCESS TEST FAILED: legacy profile admin read another institution secure file'; end if;
  if private.can_manage_secure_file('80000000-0000-4000-8000-000000000006',(select auth.uid())) then raise exception 'ACCESS TEST FAILED: legacy profile admin managed another institution secure file'; end if;
  begin perform public.request_secure_file_deletion('80000000-0000-4000-8000-000000000006','must be denied'); exception when raise_exception or insufficient_privilege then v_delete_denied:=true; end;
  if not v_delete_denied then raise exception 'ACCESS TEST FAILED: legacy profile admin requested another institution file deletion'; end if;
  raise notice 'PASS legacy profile-admin secure-file read/manage/delete denial';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
select * from public.request_secure_file_deletion('80000000-0000-4000-8000-000000000001','safety eligible');
select * from public.request_secure_file_deletion('80000000-0000-4000-8000-000000000001','safety eligible repeated');
select * from public.request_secure_file_deletion('80000000-0000-4000-8000-000000000002','safety retained');
select * from public.request_secure_file_deletion('80000000-0000-4000-8000-000000000003','safety held');
select * from public.request_secure_file_deletion('80000000-0000-4000-8000-000000000004','safety claim fencing');
select * from public.request_secure_file_deletion('80000000-0000-4000-8000-000000000010','safety normal completion');
select * from public.request_secure_file_deletion('80000000-0000-4000-8000-000000000011','safety late retention');
reset role;

do $$ begin
  if not exists (select 1 from public.file_deletion_requests where secure_file_id='80000000-0000-4000-8000-000000000001' and status='eligible') then raise exception 'DELETION TEST FAILED: expired file was not eligible'; end if;
  if not exists (select 1 from public.file_deletion_requests where secure_file_id='80000000-0000-4000-8000-000000000002' and status='deferred_retention' and eligible_at>now()) then raise exception 'RETENTION TEST FAILED: retained file was not deferred'; end if;
  if not exists (select 1 from public.file_deletion_requests where secure_file_id='80000000-0000-4000-8000-000000000003' and status='blocked_legal_hold') then raise exception 'LEGAL HOLD TEST FAILED: held file was not blocked'; end if;
  if (select availability_status from public.secure_file_objects where id='80000000-0000-4000-8000-000000000001') <> 'pending_delete' then raise exception 'DELETION TEST FAILED: eligible file was not quarantined for deletion'; end if;
  if exists (select 1 from public.secure_file_objects where id in ('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000003') and availability_status<>'released') then raise exception 'RETENTION TEST FAILED: retained or held file state changed'; end if;
  if (select count(*) from public.file_deletion_requests where secure_file_id='80000000-0000-4000-8000-000000000001' and status in ('pending','eligible','deferred_retention','blocked_legal_hold','processing','failed'))<>1 then
    raise exception 'DELETION TEST FAILED: repeated request did not reuse exactly one active request';
  end if;
  raise notice 'PASS deletion, retention, and legal-hold test';
  raise notice 'PASS deletion request idempotency, retention, and legal-hold classification test';
end $$;

do $$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.claim_file_deletion_requests(text,integer,interval)',
    'public.claim_file_deletion_request(uuid,text,interval)',
    'public.renew_file_deletion_claim(uuid,uuid,text)',
    'public.finish_file_deletion_claim(uuid,uuid,text,text,timestamptz,text,boolean)',
    'public.claim_expired_uploads(text,integer,interval)',
    'public.renew_expired_upload_claim(uuid,uuid,text)',
    'public.finish_expired_upload_claim(uuid,uuid,text,boolean,text)'
  ] loop
    if has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('authenticated',v_signature,'EXECUTE')
       or not has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception 'DELETION ACL TEST FAILED: worker RPC privilege is unsafe for %',v_signature;
    end if;
  end loop;
  raise notice 'PASS deletion-worker RPC service-role boundary test';
end $$;

set local role service_role;

do $$
declare v_request_id uuid; v_claim record;
begin
  select id into v_request_id from public.file_deletion_requests
  where secure_file_id='80000000-0000-4000-8000-000000000010' and status='eligible';
  select * into v_claim from public.claim_file_deletion_request(v_request_id,'normal-delete-worker',interval '10 minutes');
  perform public.finish_file_deletion_claim(v_request_id,v_claim.claim_token,'normal-delete-worker','completed',null,null,true);
  if not exists(select 1 from public.file_deletion_requests where id=v_request_id and status='completed' and completion_outcome='normal')
     or (select availability_status from public.secure_file_objects where id='80000000-0000-4000-8000-000000000010')<>'deleted'
     or (select status from public.upload_quota_reservations where secure_file_id='80000000-0000-4000-8000-000000000010')<>'released'
     or not exists(select 1 from public.audit_events where secure_file_id='80000000-0000-4000-8000-000000000010' and event_type='retention.delete_completed') then
    raise exception 'DELETION TEST FAILED: normal completion was not atomic across request, metadata, quota, and audit';
  end if;
  raise notice 'PASS normal deletion completion, quota release, and audit test';
end $$;

-- Claim fencing, lease expiry, retry/backoff, partial deletion, late legal
-- holds, and quota release are exercised through the same RPCs as workers.
do $$
declare
  v_request_id uuid;
  v_claim_a record; v_claim_b record; v_claim_c record; v_claim_d record;
  v_stale_renew_denied boolean:=false; v_stale_finish_denied boolean:=false;
  v_wrong_token_denied boolean:=false; v_wrong_worker_denied boolean:=false;
begin
  select id into v_request_id from public.file_deletion_requests
  where secure_file_id='80000000-0000-4000-8000-000000000004' and status='eligible';
  select * into v_claim_a from public.claim_file_deletion_request(v_request_id,'delete-worker-a',interval '10 minutes');
  if v_claim_a.claim_token is null then raise exception 'DELETION TEST FAILED: eligible request was not claimed'; end if;
  if exists(select 1 from public.claim_file_deletion_request(v_request_id,'delete-worker-overlap',interval '10 minutes')) then
    raise exception 'DELETION TEST FAILED: overlapping worker claimed an active lease';
  end if;
  perform public.renew_file_deletion_claim(v_request_id,v_claim_a.claim_token,'delete-worker-a');
  update public.file_deletion_requests set claim_expires_at=now()-interval '1 second' where id=v_request_id;
  select * into v_claim_b from public.claim_file_deletion_request(v_request_id,'delete-worker-b',interval '10 minutes');
  if v_claim_b.claim_token is null or v_claim_b.claim_token=v_claim_a.claim_token then
    raise exception 'DELETION TEST FAILED: expired lease was not fenced with a new token';
  end if;
  begin perform public.renew_file_deletion_claim(v_request_id,gen_random_uuid(),'delete-worker-b');
  exception when raise_exception then v_wrong_token_denied:=true; end;
  begin perform public.renew_file_deletion_claim(v_request_id,v_claim_b.claim_token,'delete-worker-wrong');
  exception when raise_exception then v_wrong_worker_denied:=true; end;
  begin perform public.renew_file_deletion_claim(v_request_id,v_claim_a.claim_token,'delete-worker-a');
  exception when raise_exception then v_stale_renew_denied:=true; end;
  begin perform public.finish_file_deletion_claim(v_request_id,v_claim_a.claim_token,'delete-worker-a','failed',null,'stale worker',false);
  exception when raise_exception then v_stale_finish_denied:=true; end;
  if not (v_wrong_token_denied and v_wrong_worker_denied and v_stale_renew_denied and v_stale_finish_denied) then
    raise exception 'DELETION TEST FAILED: token, worker, or stale-lease fencing was bypassed';
  end if;
  perform public.finish_file_deletion_claim(v_request_id,v_claim_b.claim_token,'delete-worker-b','failed',null,'transient storage failure',false);
  if not exists(select 1 from public.file_deletion_requests where id=v_request_id and status='failed' and failure_count=1 and next_attempt_at>now()) then
    raise exception 'DELETION TEST FAILED: ordinary failure did not persist retry backoff';
  end if;
  update public.file_deletion_requests set next_attempt_at=now()-interval '1 second' where id=v_request_id;
  select * into v_claim_c from public.claim_file_deletion_request(v_request_id,'delete-worker-c',interval '10 minutes');
  perform public.finish_file_deletion_claim(v_request_id,v_claim_c.claim_token,'delete-worker-c','failed',null,'destination removed before quarantine cleanup',true);
  if not exists(select 1 from public.file_deletion_requests where id=v_request_id and status='failed' and completion_outcome='partial_deletion')
     or (select availability_status from public.secure_file_objects where id='80000000-0000-4000-8000-000000000004')<>'blocked' then
    raise exception 'DELETION TEST FAILED: partial deletion was not truthfully blocked and recorded';
  end if;
  update public.file_deletion_requests set next_attempt_at=now()-interval '1 second' where id=v_request_id;
  select * into v_claim_d from public.claim_file_deletion_request(v_request_id,'delete-worker-d',interval '10 minutes');
  if (v_claim_d.file_data->>'deletion_completion_outcome') is distinct from 'partial_deletion' then
    raise exception 'DELETION TEST FAILED: recovery worker did not receive the partial-deletion marker';
  end if;
  insert into public.legal_holds(id,institution_id,name,reason,created_by)
  values('81000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Late safety hold','Race after Storage removal began','10000000-0000-4000-8000-000000000001');
  insert into public.legal_hold_files(legal_hold_id,secure_file_id,added_by)
  values('81000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001');
  perform public.finish_file_deletion_claim(v_request_id,v_claim_d.claim_token,'delete-worker-d','completed',null,null,true);
  if not exists(select 1 from public.file_deletion_requests where id=v_request_id and status='completed' and completion_outcome='late_governance_conflict')
     or (select availability_status from public.secure_file_objects where id='80000000-0000-4000-8000-000000000004')<>'deleted'
     or (select status from public.upload_quota_reservations where secure_file_id='80000000-0000-4000-8000-000000000004')<>'released'
     or not exists(select 1 from public.audit_events where secure_file_id='80000000-0000-4000-8000-000000000004' and event_type='delete.completed_with_late_governance_conflict') then
    raise exception 'DELETION TEST FAILED: verified partial recovery did not atomically complete, release quota, and audit the late hold';
  end if;
  raise notice 'PASS deletion claim overlap, fencing, backoff, partial recovery, late-hold, quota, and audit test';
end $$;

update public.legal_holds
set active=false,released_at=now(),updated_at=now()
where id='81000000-0000-4000-8000-000000000002';

do $$
declare v_request_id uuid; v_claim record; v_renew_denied boolean:=false;
begin
  select id into v_request_id from public.file_deletion_requests
  where secure_file_id='80000000-0000-4000-8000-000000000001' and status='eligible';
  select * into v_claim from public.claim_file_deletion_request(v_request_id,'retention-race-worker',interval '10 minutes');
  update public.secure_file_objects set retention_until=now()+interval '14 days' where id='80000000-0000-4000-8000-000000000001';
  begin perform public.renew_file_deletion_claim(v_request_id,v_claim.claim_token,'retention-race-worker');
  exception when raise_exception then v_renew_denied:=true; end;
  if not v_renew_denied then raise exception 'RETENTION TEST FAILED: claim renewed after retention was extended'; end if;
  perform public.finish_file_deletion_claim(v_request_id,v_claim.claim_token,'retention-race-worker','deferred_retention',now()+interval '14 days',null,false);
  if not exists(select 1 from public.file_deletion_requests where id=v_request_id and status='deferred_retention' and eligible_at>now())
     or (select availability_status from public.secure_file_objects where id='80000000-0000-4000-8000-000000000001')<>'released' then
    raise exception 'RETENTION TEST FAILED: mid-claim retention extension was not safely deferred';
  end if;
  raise notice 'PASS mid-claim retention-extension deferral test';
end $$;

do $$
declare v_request_id uuid; v_claim record;
begin
  select id into v_request_id from public.file_deletion_requests
  where secure_file_id='80000000-0000-4000-8000-000000000011' and status='eligible';
  select * into v_claim from public.claim_file_deletion_request(v_request_id,'late-retention-worker',interval '10 minutes');
  update public.secure_file_objects set retention_until=now()+interval '14 days'
  where id='80000000-0000-4000-8000-000000000011';
  perform public.finish_file_deletion_claim(v_request_id,v_claim.claim_token,'late-retention-worker','completed',null,null,true);
  if not exists(select 1 from public.file_deletion_requests where id=v_request_id and status='completed' and completion_outcome='late_governance_conflict')
     or (select availability_status from public.secure_file_objects where id='80000000-0000-4000-8000-000000000011')<>'deleted'
     or not exists(select 1 from public.audit_events where secure_file_id='80000000-0000-4000-8000-000000000011' and event_type='delete.completed_with_late_governance_conflict') then
    raise exception 'RETENTION TEST FAILED: late retention after removal began was not recorded as a governance conflict';
  end if;
  raise notice 'PASS late-retention-after-removal conflict and audit test';
end $$;

do $$
declare
  v_expired_a record; v_expired_b record; v_expired_c record;
  v_stale_renew_denied boolean:=false; v_stale_finish_denied boolean:=false;
begin
  select * into v_expired_a from public.claim_expired_uploads('expiry-worker-a',25,interval '10 minutes')
  where secure_file_id='80000000-0000-4000-8000-000000000009';
  if v_expired_a.claim_token is null then raise exception 'EXPIRATION TEST FAILED: eligible expired upload was not claimed'; end if;
  if exists(select 1 from public.claim_expired_uploads('expiry-worker-overlap',25,interval '10 minutes') where secure_file_id='80000000-0000-4000-8000-000000000009') then
    raise exception 'EXPIRATION TEST FAILED: overlapping worker claimed the same upload';
  end if;
  if (select expiration_claim_token from public.secure_file_objects where id='80000000-0000-4000-8000-000000000005') is not null then
    raise exception 'LEGAL HOLD TEST FAILED: held expired upload was claimed';
  end if;
  update public.secure_file_objects set expiration_claim_expires_at=now()-interval '1 second' where id='80000000-0000-4000-8000-000000000009';
  select * into v_expired_b from public.claim_expired_uploads('expiry-worker-b',25,interval '10 minutes')
  where secure_file_id='80000000-0000-4000-8000-000000000009';
  begin perform public.renew_expired_upload_claim('80000000-0000-4000-8000-000000000009',v_expired_a.claim_token,'expiry-worker-a');
  exception when raise_exception then v_stale_renew_denied:=true; end;
  begin perform public.finish_expired_upload_claim('80000000-0000-4000-8000-000000000009',v_expired_a.claim_token,'expiry-worker-a',false,'stale worker');
  exception when raise_exception then v_stale_finish_denied:=true; end;
  if not (v_stale_renew_denied and v_stale_finish_denied) then raise exception 'EXPIRATION TEST FAILED: stale expired-upload worker was not fenced'; end if;
  perform public.finish_expired_upload_claim('80000000-0000-4000-8000-000000000009',v_expired_b.claim_token,'expiry-worker-b',false,'transient cleanup failure');
  if not exists(select 1 from public.secure_file_objects where id='80000000-0000-4000-8000-000000000009' and expiration_failure_count=1 and expiration_next_attempt_at>now()) then
    raise exception 'EXPIRATION TEST FAILED: retry failure and backoff were not persisted';
  end if;
  update public.secure_file_objects set expiration_next_attempt_at=now()-interval '1 second' where id='80000000-0000-4000-8000-000000000009';
  select * into v_expired_c from public.claim_expired_uploads('expiry-worker-c',25,interval '10 minutes')
  where secure_file_id='80000000-0000-4000-8000-000000000009';
  insert into public.legal_holds(id,institution_id,name,reason,created_by)
  values('81000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',
    'Late expired-upload safety hold','Race after expired-upload Storage removal began','10000000-0000-4000-8000-000000000001');
  perform public.finish_expired_upload_claim('80000000-0000-4000-8000-000000000009',v_expired_c.claim_token,'expiry-worker-c',true,null);
  if not exists(select 1 from public.secure_file_objects where id='80000000-0000-4000-8000-000000000009' and upload_status='expired' and availability_status='deleted' and expiration_completion_outcome='late_governance_conflict')
     or (select status from public.upload_quota_reservations where secure_file_id='80000000-0000-4000-8000-000000000009')<>'expired' then
    raise exception 'EXPIRATION TEST FAILED: successful cleanup did not truthfully complete and release quota after a late hold';
  end if;
  raise notice 'PASS expired-upload hold exclusion, overlap, fencing, backoff, late-hold, and quota test';
end $$;

update public.legal_holds
set active=false,released_at=now(),updated_at=now()
where id='81000000-0000-4000-8000-000000000003';

do $$ begin
  update public.legal_holds set active=false,released_at=now() where id='81000000-0000-4000-8000-000000000001';
  if not exists(
    select 1 from public.claim_file_deletion_request(
      (select id from public.file_deletion_requests where secure_file_id='80000000-0000-4000-8000-000000000003'),
      'released-hold-worker',interval '10 minutes'
    )
  ) then raise exception 'LEGAL HOLD TEST FAILED: request did not become claimable after hold release'; end if;
  raise notice 'PASS legal-hold release re-evaluation test';
  raise notice 'PASS repository rehearsal; operational student-data gates remain HOLD';
end $$;

reset role;

rollback;
