-- Run only against a disposable Supabase database after every migration.
-- Proves same-school enforcement, professor approval/open enrollment, durable
-- student notifications, universal assignment, and completion badges.

begin;
set local statement_timeout = '45s';

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('20000000-0000-4000-8000-000000000001','authenticated','authenticated','course-gate-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"Course Gate Professor","requested_role":"institution_applicant"}',now(),now()),
  ('20000000-0000-4000-8000-000000000002','authenticated','authenticated','course-gate-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Course Gate Student","requested_role":"institution_applicant"}',now(),now()),
  ('20000000-0000-4000-8000-000000000003','authenticated','authenticated','course-gate-other-school@safety.invalid','not-a-login',now(),'{}','{"full_name":"Other School Student","requested_role":"institution_applicant"}',now(),now());

update public.profiles
set role='professor'
where id='20000000-0000-4000-8000-000000000001';

delete from public.student_education_paths
where user_id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003'
);

insert into public.institutions (
  id,owner_id,name,slug,lifecycle_status,education_division
) values
  ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','Course Gate University','course-gate-university','active','university'),
  ('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','Other Gate University','other-gate-university','active','university');

insert into public.institution_affiliations (
  user_id,pathway,institution_id,relationship,status,source,is_primary,started_at
) values
  ('20000000-0000-4000-8000-000000000001','professor','20000000-0000-4000-8000-000000000010','faculty','active','platform_owner',true,now()),
  ('20000000-0000-4000-8000-000000000002','student','20000000-0000-4000-8000-000000000010','student','active','platform_owner',true,now()),
  ('20000000-0000-4000-8000-000000000003','student','20000000-0000-4000-8000-000000000011','student','active','platform_owner',true,now());

insert into public.student_education_paths (
  user_id,started_in,current_division
) values
  ('20000000-0000-4000-8000-000000000002','university','university'),
  ('20000000-0000-4000-8000-000000000003','university','university');

insert into public.courses (
  id,owner_id,institution_id,title,course_code,status,education_division,access_scope
) values (
  '20000000-0000-4000-8000-000000000020',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000010',
  'Digital Literacy Gate',
  'UNIV 1000',
  'published',
  'university',
  'institution'
);

insert into public.published_course_directory (
  course_id,institution_id,professor_id,institution_name,professor_display_name,
  course_code,title,enrollment_open,is_listed,published_at,education_division,
  enrollment_policy,universal_assignment,completion_badge_name,completion_badge_description
) values (
  '20000000-0000-4000-8000-000000000020',
  '20000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000001',
  'Course Gate University',
  'Course Gate Professor',
  'UNIV 1000',
  'Digital Literacy Gate',
  true,
  true,
  now(),
  'university',
  'approval_required',
  false,
  'Digital Literacy Complete',
  'Recognizes successful completion of the Digital Literacy Gate course.'
);

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
begin
  perform public.request_or_join_published_course('20000000-0000-4000-8000-000000000020');
  raise exception 'Expected another-school enrollment to be rejected';
exception
  when others then
    if sqlerrm not like '%approved institution does not match%' then raise; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select * from public.request_or_join_published_course('20000000-0000-4000-8000-000000000020');

do $$
begin
  if not exists (
    select 1 from public.student_enrollment_requests
    where course_id='20000000-0000-4000-8000-000000000020'
      and student_id='20000000-0000-4000-8000-000000000002'
      and status='pending'
  ) then
    raise exception 'Approval-required course did not create a pending request';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select course_id,enrollment_policy,universal_assignment
from public.set_published_course_enrollment(
  '20000000-0000-4000-8000-000000000020',
  'open_self_enroll',
  true,
  'Digital Literacy Complete',
  'Recognizes successful completion of the Digital Literacy Gate course.'
);

reset role;
do $$
begin
  if not exists (
    select 1 from public.course_memberships
    where course_id='20000000-0000-4000-8000-000000000020'
      and user_id='20000000-0000-4000-8000-000000000002'
      and role='learner'
  ) then
    raise exception 'Open enrollment did not create learner membership';
  end if;
  if not exists (
    select 1 from public.student_account_notifications
    where student_id='20000000-0000-4000-8000-000000000002'
      and notification_type='enrollment_approved'
  ) then
    raise exception 'Enrollment approval notification was not created';
  end if;
  if exists (
    select 1 from public.course_memberships
    where course_id='20000000-0000-4000-8000-000000000020'
      and user_id='20000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Universal assignment crossed an institution boundary';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','',true);
insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '20000000-0000-4000-8000-000000000004',
  'authenticated',
  'authenticated',
  'course-gate-new-student@safety.invalid',
  'not-a-login',
  now(),
  '{}',
  '{"full_name":"New Course Gate Student","requested_role":"institution_applicant","education_division":"university"}',
  now(),
  now()
);
insert into public.institution_affiliations (
  user_id,pathway,institution_id,relationship,status,source,is_primary,started_at
) values (
  '20000000-0000-4000-8000-000000000004',
  'student',
  '20000000-0000-4000-8000-000000000010',
  'student',
  'active',
  'platform_owner',
  true,
  now()
);

do $$
begin
  if not exists (
    select 1 from public.course_memberships
    where course_id='20000000-0000-4000-8000-000000000020'
      and user_id='20000000-0000-4000-8000-000000000004'
      and role='learner'
  ) then
    raise exception 'A new matching-school student did not receive the universal course';
  end if;
end;
$$;

insert into public.course_publications (
  id,course_id,created_by,current_version,status,grading_mode,draft_manifest,published_at
) values (
  '20000000-0000-4000-8000-000000000030',
  '20000000-0000-4000-8000-000000000020',
  '20000000-0000-4000-8000-000000000001',
  1,
  'published',
  'auto',
  '{"format":"EdNotebookCourse/1.0","course":{"title":"Digital Literacy Gate"},"paths":[{"id":"path-1","nodes":[{"id":"lesson-1","knowledgeChecks":[],"endQuiz":[]}]}]}'::jsonb,
  now()
);
insert into public.course_publication_versions (
  publication_id,version_number,manifest,change_summary,published_by
) values (
  '20000000-0000-4000-8000-000000000030',
  1,
  '{"format":"EdNotebookCourse/1.0","course":{"title":"Digital Literacy Gate"},"paths":[{"id":"path-1","nodes":[{"id":"lesson-1","knowledgeChecks":[],"endQuiz":[]}]}]}'::jsonb,
  'Course enrollment access gate',
  '20000000-0000-4000-8000-000000000001'
);

select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select status,completion_percent
from public.save_course_lesson_progress(
  '20000000-0000-4000-8000-000000000030',
  'path-1',
  'lesson-1',
  0,
  'complete',
  '{}'::jsonb,
  true
);

do $$
declare
  v_notification_id uuid;
begin
  if not exists (
    select 1 from public.course_completion_badges
    where course_id='20000000-0000-4000-8000-000000000020'
      and student_id='20000000-0000-4000-8000-000000000002'
      and badge_name='Digital Literacy Complete'
  ) then
    raise exception 'Course completion badge was not recorded';
  end if;
  select id into v_notification_id
  from public.student_account_notifications
  where student_id='20000000-0000-4000-8000-000000000002'
    and notification_type='course_completed';
  if v_notification_id is null then
    raise exception 'Course completion notification was not created';
  end if;
  perform public.mark_student_account_notification_read(v_notification_id);
  if not exists (
    select 1 from public.student_account_notifications
    where id=v_notification_id and read_at is not null
  ) then
    raise exception 'Opening a notification did not persist read state';
  end if;
end;
$$;

rollback;
