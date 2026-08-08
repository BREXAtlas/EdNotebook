-- Run after all migrations on staging or another disposable database.
-- All synthetic records are rolled back. The gate proves that Early Prep
-- feedback and milestones are private and cannot cross into University or
-- publisher-owned surfaces.

begin;
set local statement_timeout='60s';

create temporary table _early_prep_dl_acceptance (
  assignment_id uuid,
  feedback_id uuid,
  university_course_count integer not null,
  university_badge_count integer not null,
  published_library_count integer not null
) on commit drop;

insert into _early_prep_dl_acceptance (
  university_course_count,university_badge_count,published_library_count
)
select
  (select count(*) from public.courses where education_division='university'),
  (select count(*) from public.course_completion_badges),
  (select count(*) from public.published_course_directory);

insert into auth.users(
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('8fd6c1a7-5b42-4e91-a7c8-000000000001','authenticated','authenticated','early-prep-dl-teacher@safety.invalid','not-a-login',now(),'{}','{"full_name":"Early Prep DL Teacher","requested_role":"professor","education_division":"k12","affiliation_choice":"other","institution_name":"Synthetic High School"}',now(),now()),
  ('8fd6c1a7-5b42-4e91-a7c8-000000000002','authenticated','authenticated','early-prep-dl-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Early Prep DL Student","requested_role":"learner","education_division":"k12"}',now(),now()),
  ('8fd6c1a7-5b42-4e91-a7c8-000000000003','authenticated','authenticated','university-dl-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"University DL Professor","requested_role":"professor","education_division":"university","affiliation_choice":"other","institution_name":"Synthetic University"}',now(),now()),
  ('8fd6c1a7-5b42-4e91-a7c8-000000000004','authenticated','authenticated','other-early-prep-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Other Early Prep Student","requested_role":"learner","education_division":"k12"}',now(),now());

update public.profiles set role='professor'
where id in ('8fd6c1a7-5b42-4e91-a7c8-000000000001','8fd6c1a7-5b42-4e91-a7c8-000000000003');

delete from public.student_education_paths
where user_id in ('8fd6c1a7-5b42-4e91-a7c8-000000000002','8fd6c1a7-5b42-4e91-a7c8-000000000004');
insert into public.student_education_paths(user_id,started_in,current_division)
values
  ('8fd6c1a7-5b42-4e91-a7c8-000000000002','k12','k12'),
  ('8fd6c1a7-5b42-4e91-a7c8-000000000004','k12','k12');

insert into public.courses(id,owner_id,title,course_code,status,education_division,subject,subject_id)
values
  ('8fd6c1a7-5b42-4e91-a7c8-000000000010','8fd6c1a7-5b42-4e91-a7c8-000000000001','Synthetic Early Prep Digital Literacy','EP-DL','published','k12','ignored','computer-science-digital-literacy'),
  ('8fd6c1a7-5b42-4e91-a7c8-000000000011','8fd6c1a7-5b42-4e91-a7c8-000000000003','Synthetic University Digital Literacy','UNI-DL','published','university','Digital Literacy',null);

insert into public.course_memberships(course_id,user_id,role)
values ('8fd6c1a7-5b42-4e91-a7c8-000000000010','8fd6c1a7-5b42-4e91-a7c8-000000000002','learner');

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-000000000001',true);

update _early_prep_dl_acceptance
set assignment_id=(public.create_digital_literacy_assignment(
  '8fd6c1a7-5b42-4e91-a7c8-000000000010',
  'Synthetic Digital Literacy feedback path',
  now()+interval '7 days',
  array['ep01','ep02']::text[],
  array['8fd6c1a7-5b42-4e91-a7c8-000000000002'::uuid],
  'Synthetic acceptance data only.'
)->>'assignment_id')::uuid;

update _early_prep_dl_acceptance acceptance
set feedback_id=(public.record_digital_literacy_teacher_feedback(
  acceptance.assignment_id,
  '8fd6c1a7-5b42-4e91-a7c8-000000000002',
  'ep01',
  'Synthetic private feedback sentinel 83f7. Revise the source check and try again.'
)->>'id')::uuid;

do $$
declare
  v_assignment_id uuid;
  v_feedback_id uuid;
begin
  select assignment_id,feedback_id into v_assignment_id,v_feedback_id
  from _early_prep_dl_acceptance;
  if v_assignment_id is null or v_feedback_id is null then
    raise exception 'Early Prep assignment and feedback IDs must be created';
  end if;
  if (select count(*) from private.digital_literacy_teacher_feedback where id=v_feedback_id)<>1 then
    raise exception 'Teacher feedback was not recorded exactly once';
  end if;
  if (select count(*) from public.student_account_notifications
      where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002'
        and notification_type='course_feedback'
        and dedupe_key='digital-literacy-feedback:'||v_assignment_id::text||':'||v_feedback_id::text)<>1 then
    raise exception 'Private feedback notification was not created exactly once';
  end if;
  if exists (
    select 1 from public.student_account_notifications
    where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002'
      and (title||' '||body) ilike '%sentinel 83f7%'
  ) then raise exception 'Feedback content leaked into a notification'; end if;
  if exists (
    select 1 from public.audit_events
    where target_id=v_feedback_id::text and details::text ilike '%sentinel 83f7%'
  ) then raise exception 'Feedback content leaked into audit details'; end if;
  if jsonb_array_length(public.get_digital_literacy_course_feedback('8fd6c1a7-5b42-4e91-a7c8-000000000010')->'feedback')<>1 then
    raise exception 'Early Prep teacher cannot read the class-scoped feedback record';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-000000000003',true);
do $$
declare v_assignment_id uuid;
begin
  select assignment_id into v_assignment_id from _early_prep_dl_acceptance;
  begin
    perform public.record_digital_literacy_teacher_feedback(
      v_assignment_id,'8fd6c1a7-5b42-4e91-a7c8-000000000002','ep01','Must fail'
    );
    raise exception 'University professor unexpectedly wrote Early Prep feedback';
  exception when others then
    if sqlerrm='University professor unexpectedly wrote Early Prep feedback' then raise; end if;
  end;
  begin
    perform public.get_digital_literacy_course_feedback('8fd6c1a7-5b42-4e91-a7c8-000000000011');
    raise exception 'University course unexpectedly exposed the Early Prep feedback RPC';
  exception when others then
    if sqlerrm='University course unexpectedly exposed the Early Prep feedback RPC' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-000000000004',true);
do $$
declare v_feedback_id uuid;
begin
  select feedback_id into v_feedback_id from _early_prep_dl_acceptance;
  begin
    perform public.acknowledge_digital_literacy_teacher_feedback(v_feedback_id,true);
    raise exception 'Another student unexpectedly acknowledged private feedback';
  exception when others then
    if sqlerrm='Another student unexpectedly acknowledged private feedback' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-000000000002',true);
do $$
declare v_feedback_id uuid;
begin
  select feedback_id into v_feedback_id from _early_prep_dl_acceptance;
  if jsonb_array_length(public.get_my_digital_literacy_feedback()->'feedback')<>1 then
    raise exception 'Student cannot read exactly their own feedback';
  end if;
  perform public.acknowledge_digital_literacy_teacher_feedback(v_feedback_id,true);
  if not exists (
    select 1 from private.digital_literacy_teacher_feedback
    where id=v_feedback_id and acknowledged_at is not null and helpful is true
  ) then raise exception 'Student acknowledgement and helpful response were not recorded'; end if;
end;
$$;

insert into private.digital_literacy_standard_progress(
  enrollment_id,student_id,release_id,unit_id,stars,evidence_source,completed_at,updated_at
)
select enrollment.id,enrollment.student_id,unit.release_id,unit.unit_id,3,
  'canonical_course_embed',now(),now()
from private.digital_literacy_standard_enrollments enrollment
join public.digital_literacy_catalog_units unit
  on unit.release_id=enrollment.current_release_id
where enrollment.student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002';

do $$
declare v_release_id text;
begin
  select current_release_id into v_release_id
  from private.digital_literacy_standard_enrollments
  where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002';
  if (select count(*) from private.digital_literacy_standard_badges
      where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002' and release_id=v_release_id)<>1 then
    raise exception 'The 40-unit Early Prep milestone was not issued exactly once';
  end if;
  if jsonb_array_length(public.get_my_digital_literacy_standard_badges()->'badges')<>1 then
    raise exception 'Student milestone RPC did not return exactly one private badge';
  end if;
  if (select count(*) from public.student_account_notifications
      where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002'
        and dedupe_key='digital-literacy-standard-badge:'||v_release_id)<>1 then
    raise exception 'The milestone notification was not issued exactly once';
  end if;
end;
$$;

update private.digital_literacy_standard_progress
set stars=stars
where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002';

do $$
declare
  v_release_id text;
  v_baseline _early_prep_dl_acceptance%rowtype;
begin
  select * into v_baseline from _early_prep_dl_acceptance;
  select current_release_id into v_release_id
  from private.digital_literacy_standard_enrollments
  where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002';
  if (select count(*) from private.digital_literacy_standard_badges
      where student_id='8fd6c1a7-5b42-4e91-a7c8-000000000002' and release_id=v_release_id)<>1 then
    raise exception 'The milestone trigger was not idempotent';
  end if;
  if (select count(*) from public.courses where education_division='university')<>v_baseline.university_course_count+1 then
    raise exception 'University course records changed outside the one synthetic fixture';
  end if;
  if (select count(*) from public.course_completion_badges)<>v_baseline.university_badge_count then
    raise exception 'Existing University completion badges were changed';
  end if;
  if (select count(*) from public.published_course_directory)<>v_baseline.published_library_count then
    raise exception 'Published course or publisher-facing library entries were changed';
  end if;
  if exists (
    select 1 from private.digital_literacy_teacher_feedback feedback
    join public.assignments assignment on assignment.id=feedback.assignment_id
    join public.courses course on course.id=assignment.course_id
    where course.education_division='university'
  ) then raise exception 'Early Prep feedback crossed into a University course'; end if;
  if has_table_privilege('authenticated','private.digital_literacy_teacher_feedback','SELECT')
    or has_table_privilege('authenticated','private.digital_literacy_standard_badges','SELECT') then
    raise exception 'Authenticated clients unexpectedly have direct access to private Digital Literacy records';
  end if;
end;
$$;

rollback;
