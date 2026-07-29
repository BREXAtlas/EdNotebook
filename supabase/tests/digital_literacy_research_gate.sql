-- Run only on a disposable Supabase database after every repository migration.
-- All people, approvals, responses, and status changes are synthetic and are
-- rolled back. No fixture represents a real ASU project or determination.

begin;
set local statement_timeout = '60s';

do $$ begin raise notice 'START Digital Literacy research-governance gate'; end $$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '91000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'research-professor@synthetic.invalid',
    'not-a-login',
    now(),
    '{}',
    '{"full_name":"Synthetic Research Professor","requested_role":"learner","affiliation_choice":"independent"}',
    now(),
    now()
  ),
  (
    '91000000-0000-4000-8000-000000000011',
    'authenticated',
    'authenticated',
    'research-student@synthetic.invalid',
    'not-a-login',
    now(),
    '{}',
    '{"full_name":"Synthetic Research Student","requested_role":"learner","affiliation_choice":"independent"}',
    now(),
    now()
  ),
  (
    '91000000-0000-4000-8000-000000000012',
    'authenticated',
    'authenticated',
    'other-institution-student@synthetic.invalid',
    'not-a-login',
    now(),
    '{}',
    '{"full_name":"Other Institution Student","requested_role":"learner","affiliation_choice":"independent"}',
    now(),
    now()
  );

update public.profiles
set role = 'professor'
where id = '91000000-0000-4000-8000-000000000001';

insert into public.institutions (
  id, owner_id, name, slug, lifecycle_status, institution_type, region_code,
  institution_code, primary_lms, timezone_name, approved_at
) values
  (
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'Synthetic Angelo State Research Fixture',
    'synthetic-asu-research-fixture',
    'active',
    'university',
    'TX',
    'SYNTH-IRB',
    'blackboard',
    'America/Chicago',
    now()
  );

delete from public.institution_affiliations
where user_id in (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000011',
  '91000000-0000-4000-8000-000000000012'
);

insert into public.institution_affiliations (
  id, user_id, pathway, institution_id, relationship, status, source,
  verification_method, is_primary, started_at
) values
  (
    '93000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'professor',
    '92000000-0000-4000-8000-000000000001',
    'faculty',
    'active',
    'platform_owner',
    'synthetic-test-fixture',
    true,
    now()
  ),
  (
    '93000000-0000-4000-8000-000000000011',
    '91000000-0000-4000-8000-000000000011',
    'student',
    '92000000-0000-4000-8000-000000000001',
    'student',
    'active',
    'platform_owner',
    'synthetic-test-fixture',
    true,
    now()
  );

insert into public.institution_memberships (
  institution_id, user_id, role, status, permissions, joined_at
) values
  (
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'owner',
    'active',
    '{"view_control_center":true,"view_audit":true,"control_features":true,"manage_retention":true}',
    now()
  ),
  (
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000011',
    'learner',
    'active',
    '{}',
    now()
  );

insert into public.courses (
  id, owner_id, institution_id, title, course_code, status, access_scope,
  education_division
) values (
  '94000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'Synthetic Digital Literacy Pilot',
  'DLIT-SYNTH-101',
  'published',
  'institution',
  'university'
);

insert into public.course_memberships (course_id, user_id, role)
values (
  '94000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000011',
  'learner'
);

do $privileges$
begin
  if has_table_privilege('authenticated', 'public.research_response_records', 'INSERT') then
    raise exception 'authenticated must not have direct research response INSERT';
  end if;
  if has_function_privilege('anon', 'public.submit_research_response(uuid,jsonb)', 'EXECUTE') then
    raise exception 'anon must not execute research response RPC';
  end if;
  raise notice 'PASS research response table and RPC privileges fail closed';
end;
$privileges$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_research_pilot_version(
  jsonb_build_object(
    'institution_id', '92000000-0000-4000-8000-000000000001',
    'course_id', '94000000-0000-4000-8000-000000000001',
    'project_key', 'digital-literacy-synthetic-ci',
    'title', 'Synthetic Digital Literacy research gate',
    'purpose_statement', 'Synthetic-only test of a bounded Digital Literacy pre/post and qualitative research workflow.',
    'research_activities', jsonb_build_array('pre_post_assessment', 'qualitative_interview'),
    'data_owner_user_id', '91000000-0000-4000-8000-000000000001',
    'data_owner_name', 'Synthetic Research Professor',
    'data_owner_title', 'Synthetic pilot data owner',
    'data_owner_contact', 'research-professor@synthetic.invalid',
    'effective_at', (now() - interval '1 day')::text,
    'expires_at', (now() + interval '30 days')::text,
    'notice_config', jsonb_build_object(
      'version', 'synthetic-notice-v1',
      'participant_notice', 'Synthetic test notice. This is not a real study.'
    ),
    'consent_config', jsonb_build_object('mode', 'required'),
    'minimization_rules', jsonb_build_object('collection_limit', 'Approved response fields only'),
    'retention_days', 30,
    'export_rules', jsonb_build_object('mode', 'disabled'),
    'deletion_rules', jsonb_build_object('request_process', 'Audited participant request'),
    'instruments', jsonb_build_array(
      jsonb_build_object(
        'instrument_key', 'digital-literacy-pre',
        'instrument_version', 'synthetic-v1',
        'instrument_kind', 'pre_assessment',
        'title', 'Synthetic pre-assessment',
        'instrument_definition', jsonb_build_object('allowed_response_fields', jsonb_build_array('score'))
      ),
      jsonb_build_object(
        'instrument_key', 'digital-literacy-post',
        'instrument_version', 'synthetic-v1',
        'instrument_kind', 'post_assessment',
        'title', 'Synthetic post-assessment',
        'instrument_definition', jsonb_build_object('allowed_response_fields', jsonb_build_array('score', 'reflection'))
      ),
      jsonb_build_object(
        'instrument_key', 'digital-literacy-interview',
        'instrument_version', 'synthetic-v1',
        'instrument_kind', 'qualitative_interview',
        'title', 'Synthetic qualitative interview',
        'instrument_definition', jsonb_build_object('allowed_response_fields', jsonb_build_array('reflection'))
      )
    )
  )
);

do $unapproved$
declare
  v_version_id uuid;
  v_blocked boolean := false;
begin
  select rv.id into v_version_id
  from public.research_pilot_versions rv
  join public.research_pilot_projects rp on rp.id = rv.project_id
  where rp.project_key = 'digital-literacy-synthetic-ci';
  begin
    perform public.activate_research_pilot_version(v_version_id, 'ACTIVATE RESEARCH PILOT');
  exception when others then
    v_blocked := position('blocked' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'Activation without a written determination must fail';
  end if;
  raise notice 'PASS activation fails before a written determination';
end;
$unapproved$;

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000012', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $cross_tenant_create$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.create_research_pilot_version(
      jsonb_build_object(
        'institution_id', '92000000-0000-4000-8000-000000000001',
        'course_id', '94000000-0000-4000-8000-000000000001',
        'project_key', 'cross-tenant-attempt',
        'title', 'Cross tenant attempt'
      )
    );
  exception when others then
    v_blocked := position('course management access required' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'Unrelated account must not create a research version';
  end if;
  if (select count(*) from public.research_pilot_projects) <> 0 then
    raise exception 'Unrelated account must not read another institution research project';
  end if;
  raise notice 'PASS unrelated account cannot create or view cross-tenant research records';
end;
$cross_tenant_create$;

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.record_research_pilot_determination(
  (
    select rv.id
    from public.research_pilot_versions rv
    join public.research_pilot_projects rp on rp.id = rv.project_id
    where rp.project_key = 'digital-literacy-synthetic-ci'
  ),
  jsonb_build_object(
    'decision', 'approved',
    'determination_type', 'exempt',
    'official_body', 'Synthetic ASU test fixture — not an approval',
    'protocol_reference', 'CI-SYNTHETIC-001-NOT-APPROVAL',
    'determination_reference', 'CI synthetic determination fixture',
    'documentation_reference', 'synthetic://not-a-real-determination',
    'decision_date', current_date::text,
    'effective_at', (now() - interval '1 day')::text,
    'expires_at', (now() + interval '30 days')::text,
    'consent_requirement', 'required',
    'conditions', 'Synthetic CI fixture only'
  )
);

do $feature_off$
declare
  v_version_id uuid;
  v_blocked boolean := false;
begin
  select rv.id into v_version_id
  from public.research_pilot_versions rv
  join public.research_pilot_projects rp on rp.id = rv.project_id
  where rp.project_key = 'digital-literacy-synthetic-ci';
  begin
    perform public.activate_research_pilot_version(v_version_id, 'ACTIVATE RESEARCH PILOT');
  exception when others then
    v_blocked := position('course_research_feature_disabled' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'Activation while the course research feature is off must fail';
  end if;
  raise notice 'PASS written determination cannot bypass the independent feature gate';
end;
$feature_off$;

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

insert into public.feature_policies (
  feature_key, scope_type, institution_id, course_id, control_value,
  control_status, reason, warning_acknowledgements, created_by
) values (
  'research.human_subjects_collection',
  'course',
  '92000000-0000-4000-8000-000000000001',
  '94000000-0000-4000-8000-000000000001',
  'true'::jsonb,
  'active',
  'Synthetic database gate exercise only',
  array['synthetic_test_only'],
  '91000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.activate_research_pilot_version(
  (
    select rv.id
    from public.research_pilot_versions rv
    join public.research_pilot_projects rp on rp.id = rv.project_id
    where rp.project_key = 'digital-literacy-synthetic-ci'
  ),
  'ACTIVATE RESEARCH PILOT'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

do $instrument_version_lock$
declare
  v_version_id uuid;
  v_blocked boolean := false;
begin
  select rv.id into v_version_id
  from public.research_pilot_versions rv
  join public.research_pilot_projects rp on rp.id = rv.project_id
  where rp.project_key = 'digital-literacy-synthetic-ci';
  begin
    insert into public.research_pilot_instruments (
      pilot_version_id, instrument_key, instrument_version, instrument_kind,
      title, instrument_definition, content_hash, created_by
    ) values (
      v_version_id,
      'late-instrument-change',
      'synthetic-v2',
      'open_ended_survey',
      'Late instrument change',
      '{"allowed_response_fields":["reflection"]}'::jsonb,
      repeat('b', 64),
      '91000000-0000-4000-8000-000000000001'
    );
  exception when others then
    v_blocked := position('new draft research project version' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'An active version must not accept a changed instrument';
  end if;
  raise notice 'PASS instrument changes require a new research contract version';
end;
$instrument_version_lock$;

do $participation_actor_lock$
declare
  v_version_id uuid;
  v_blocked boolean := false;
begin
  select rv.id into v_version_id
  from public.research_pilot_versions rv
  join public.research_pilot_projects rp on rp.id = rv.project_id
  where rp.project_key = 'digital-literacy-synthetic-ci';
  begin
    insert into public.research_participation_states (
      pilot_version_id, participant_id, participation_status, notice_version,
      consent_record_hash
    ) values (
      v_version_id,
      '91000000-0000-4000-8000-000000000011',
      'consented',
      'synthetic-notice-v1',
      repeat('c', 64)
    );
  exception when others then
    v_blocked := position('only the participant can record' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'A professor or privileged direct write must not invent research participation';
  end if;
  raise notice 'PASS participation can be recorded only by the participant';
end;
$participation_actor_lock$;

select set_config(
  'research_fixture.version_id',
  (
    select rv.id::text
    from public.research_pilot_versions rv
    join public.research_pilot_projects rp on rp.id = rv.project_id
    where rp.project_key = 'digital-literacy-synthetic-ci'
  ),
  true
);
select set_config(
  'research_fixture.pre_instrument_id',
  (
    select id::text
    from public.research_pilot_instruments
    where instrument_key = 'digital-literacy-pre'
  ),
  true
);
select set_config(
  'research_fixture.post_instrument_id',
  (
    select id::text
    from public.research_pilot_instruments
    where instrument_key = 'digital-literacy-post'
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $no_choice$
declare
  v_instrument_id uuid;
  v_blocked boolean := false;
  v_error text := '';
begin
  v_instrument_id := current_setting('research_fixture.pre_instrument_id')::uuid;
  begin
    perform public.submit_research_response(v_instrument_id, '{"score":7}'::jsonb);
  exception when others then
    v_error := sqlerrm;
    v_blocked := position('not active for this participant' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'Enrollment without explicit participation must not allow a response (actual: %)', v_error;
  end if;
  raise notice 'PASS enrollment and account terms do not imply research participation';
end;
$no_choice$;

select public.record_research_participation_choice(
  current_setting('research_fixture.version_id')::uuid,
  'consented',
  'synthetic-notice-v1',
  repeat('a', 64)
);

select public.submit_research_response(
  current_setting('research_fixture.pre_instrument_id')::uuid,
  '{"score":7}'::jsonb
);

do $minimization$
declare
  v_instrument_id uuid;
  v_blocked boolean := false;
  v_nested_blocked boolean := false;
begin
  v_instrument_id := current_setting('research_fixture.post_instrument_id')::uuid;
  begin
    perform public.submit_research_response(
      v_instrument_id,
      '{"score":9,"student_email":"blocked@synthetic.invalid"}'::jsonb
    );
  exception when others then
    v_blocked := position('outside the approved minimized instrument' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'An unapproved direct identifier field must be rejected';
  end if;
  begin
    perform public.submit_research_response(
      v_instrument_id,
      '{"score":9,"reflection":{"email":"nested@synthetic.invalid"}}'::jsonb
    );
  exception when others then
    v_nested_blocked := position('approved flat minimized shape' in lower(sqlerrm)) > 0;
  end;
  if not v_nested_blocked then
    raise exception 'Nested response objects must not bypass direct identifier minimization';
  end if;
  raise notice 'PASS instrument field allowlist and minimization reject direct identifiers';
end;
$minimization$;

select public.request_research_subject_action(
  current_setting('research_fixture.version_id')::uuid,
  'withdrawal'
);

do $withdrawal$
declare
  v_instrument_id uuid;
  v_blocked boolean := false;
begin
  v_instrument_id := current_setting('research_fixture.post_instrument_id')::uuid;
  begin
    perform public.submit_research_response(v_instrument_id, '{"score":9}'::jsonb);
  exception when others then
    v_blocked := position('not active for this participant' in lower(sqlerrm)) > 0;
  end;
  if not v_blocked then
    raise exception 'Withdrawal must immediately stop later responses';
  end if;
  raise notice 'PASS withdrawal immediately stops collection';
end;
$withdrawal$;

select public.request_research_subject_action(
  current_setting('research_fixture.version_id')::uuid,
  'deletion'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.resolve_research_subject_request(
  (
    select id
    from public.research_subject_requests
    where request_type = 'deletion'
  ),
  'completed',
  'Synthetic CI deletion request completed'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;

do $final$
begin
  if exists (
    select 1
    from public.research_response_records
    where response_payload is not null
  ) then
    raise exception 'Completed deletion must remove the research response payload';
  end if;
  if not exists (
    select 1
    from public.research_participation_states
    where participant_id = '91000000-0000-4000-8000-000000000011'
      and participation_status = 'withdrawn'
      and deletion_status = 'completed'
  ) then
    raise exception 'Withdrawal and deletion status must stay visible and auditable';
  end if;
  if not exists (
    select 1
    from public.audit_events
    where event_type = 'research.subject_request_resolved'
  ) then
    raise exception 'Research subject request resolution must be audited';
  end if;
  raise notice 'PASS withdrawal, deletion, and audit state remain visible';
  raise notice 'PASS all Digital Literacy research-governance database gates';
end;
$final$;

rollback;
