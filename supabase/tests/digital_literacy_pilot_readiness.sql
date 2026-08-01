begin;

select plan(42);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pilot-professor@example.test', '{"full_name":"Pilot Professor","requested_role":"professor"}', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pilot-student@example.test', '{"full_name":"Pilot Student","requested_role":"learner"}', now(), now());

update public.profiles set role = 'professor' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.courses (id, owner_id, title, course_code, status)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Digital Literacy Pilot', 'DL-PILOT', 'published');

insert into public.course_memberships (course_id, user_id, role)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'learner');

select is(
  (select count(*)::integer from public.digital_literacy_catalog_units where release_id = '2026.08.01.1'),
  40,
  'canonical release contains all 40 units'
);

select is(
  (select count(*)::integer from public.digital_literacy_catalog_units where release_id = '2026.08.01.1' and path = 'foundations'),
  20,
  'canonical release contains 20 Foundations episodes'
);

select is(
  (select count(*)::integer from public.digital_literacy_catalog_units where release_id = '2026.08.01.1' and path = 'ai-quest'),
  20,
  'canonical release contains 20 AI Quest units'
);

select has_function('public', 'get_digital_literacy_catalog', 'catalog RPC exists');
select has_function('public', 'create_digital_literacy_assignment', 'professor assignment RPC exists');
select has_function('public', 'get_digital_literacy_professor_workspace', 'professor evidence RPC exists');
select has_function('public', 'get_my_digital_literacy_assignments', 'student assignment RPC exists');
select has_function('public', 'sync_digital_literacy_assignment_progress', 'completion sync RPC exists');
select has_function('public', 'get_my_standard_digital_literacy_course', 'automatic student course RPC exists');
select has_function('public', 'get_digital_literacy_professor_standard_progress', 'professor standard-progress RPC exists');
select has_trigger('public', 'student_education_paths', 'student_path_assign_standard_digital_literacy', 'student pathway trigger assigns the standard course');
select has_function('public', 'get_my_active_digital_literacy_research', 'participant research-status RPC exists');
select has_function('public', 'export_digital_literacy_research_dataset', 'governed research export RPC exists');
select has_function('public', 'get_digital_literacy_research_launch_readiness', 'professor launch-readiness RPC exists');
select ok(
  not has_function_privilege('anon', 'public.get_digital_literacy_research_launch_readiness(uuid)', 'execute'),
  'anonymous users cannot execute the launch-readiness RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.get_digital_literacy_research_launch_readiness(uuid)', 'execute'),
  'authenticated users can reach the course-authorized launch-readiness RPC'
);

select is(
  (select count(*)::integer from private.digital_literacy_standard_enrollments where student_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'student pathway receives exactly one automatic standard enrollment'
);

select is(
  (select count(*)::integer from private.digital_literacy_standard_enrollments where student_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'professor access does not create a duplicate learner enrollment'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select is(
  jsonb_array_length(public.get_digital_literacy_catalog()->'units'),
  40,
  'authenticated catalog RPC returns all canonical units'
);

select lives_ok(
  $$select public.create_digital_literacy_assignment(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Digital Literacy first path',
    now() + interval '7 days',
    array['ep01','ep02']::text[],
    null,
    'Complete both canonical chapters.'
  )$$,
  'professor can assign selected canonical units to current learners'
);

select is(
  (select count(*)::integer from public.assignments where course_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and settings->>'kind' = 'digital_literacy_course_units'),
  1,
  'one ordinary published assignment is created'
);

select is(
  (select count(*)::integer from public.digital_literacy_assignment_units),
  2,
  'only the two selected canonical units are assigned'
);

select is(
  (select count(*)::integer from public.digital_literacy_assignment_recipients where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'student receives an explicit assignment-recipient record'
);

select is(
  (select count(*)::integer from public.student_account_notifications where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and notification_type = 'course_assigned'),
  1,
  'assignment uses the shared student notification route'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

select throws_ok(
  $$select public.get_digital_literacy_research_launch_readiness('cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  'P0001',
  'Course management access required',
  'a learner cannot inspect the professor research launch-readiness view'
);

select is(
  jsonb_array_length(public.get_my_digital_literacy_assignments(null)->'assignments'),
  1,
  'student sees the same assignment'
);

select is(
  jsonb_array_length(public.get_my_standard_digital_literacy_course()->'assignment'->'units'),
  40,
  'student automatically receives the complete active canonical course'
);

select lives_ok(
  $$select public.sync_digital_literacy_assignment_progress(
    'foundations', array['ep01']::text[], '{"ep01":3}'::jsonb,
    '2026.08.01.1', 'canonical_course_embed'
  )$$,
  'student can synchronize completed assigned content from the canonical embed'
);

select is(
  (select count(*)::integer from public.digital_literacy_assignment_progress where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'only the completed assigned unit becomes evidence'
);

select is(
  (select count(*)::integer from private.digital_literacy_standard_progress where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'first completion writes one student-owned release-versioned progress row'
);

select is(
  (select status from public.digital_literacy_assignment_recipients where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'in_progress',
  'shared recipient evidence becomes in progress'
);

select lives_ok(
  $$select public.sync_digital_literacy_assignment_progress(
    'foundations', array['ep01','ep02']::text[], '{"ep01":3,"ep02":2}'::jsonb,
    '2026.08.01.1', 'canonical_course_embed'
  )$$,
  'student can finish the assigned canonical path'
);

select is(
  (select count(*)::integer from public.digital_literacy_assignment_progress where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'both assigned units have completion evidence'
);

select is(
  (select count(*)::integer from private.digital_literacy_standard_progress where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'second completion extends the same student-owned release record without duplication'
);

select is(
  (select status from public.digital_literacy_assignment_recipients where student_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'completed',
  'the same assignment is completed for professor and student views'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select is(
  (public.get_digital_literacy_professor_standard_progress('cccccccc-cccc-4ccc-8ccc-cccccccccccc')->'learners'->0->>'completed_units')::integer,
  2,
  'current professor sees the enrolled student standard progress'
);

select is(
  public.get_digital_literacy_research_launch_readiness('cccccccc-cccc-4ccc-8ccc-cccccccccccc')->>'launch_state',
  'research_not_configured',
  'pilot readiness stays fail closed when no research version is configured'
);

select is(
  (public.get_digital_literacy_research_launch_readiness('cccccccc-cccc-4ccc-8ccc-cccccccccccc')->>'research_collection_active')::boolean,
  false,
  'the readiness view does not activate research collection'
);

select is(
  (public.get_digital_literacy_research_launch_readiness('cccccccc-cccc-4ccc-8ccc-cccccccccccc')->>'ordinary_coursework_open')::boolean,
  true,
  'ordinary Digital Literacy course work remains open while research is off'
);

select is(
  public.get_digital_literacy_research_launch_readiness('cccccccc-cccc-4ccc-8ccc-cccccccccccc')->'canonical_course'->>'status',
  'pass',
  'the launch view verifies the active canonical 40-unit release'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

select is(
  jsonb_array_length(public.get_my_active_digital_literacy_research('cccccccc-cccc-4ccc-8ccc-cccccccccccc')->'projects'),
  0,
  'ordinary assigned course work does not activate research collection'
);

select is(
  (
    select count(*)::integer
      from public.research_pilot_versions version
     where version.status = 'active'
       and private.research_version_blockers(version.id, true, now()) <> '[]'::jsonb
  ),
  0,
  'no active research version has unresolved blockers'
);

select * from finish();

rollback;
