-- Run only against a disposable database after every repository migration.
-- Proves that /staging stays a sandbox while live Beta/Pilot transitions carry
-- the same accounts and courses forward without copying them.

begin;
set local statement_timeout = '60s';

do $$
begin
  if has_table_privilege('authenticated','public.student_data_environment_lane_versions','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Authenticated browser role must not access protected lane versions directly';
  end if;
  if has_function_privilege('anon','public.record_student_data_environment_lane(uuid,text,uuid,text,text,text,text,boolean)','execute') then
    raise exception 'Anonymous role must not assign a data lane';
  end if;
  if not has_function_privilege('authenticated','public.get_my_student_data_environment_lane(uuid)','execute') then
    raise exception 'Authenticated pages must be able to resolve their governed label';
  end if;
  if has_function_privilege('anon','public.get_live_service_operating_lane()','execute') then
    raise exception 'Anonymous callers must use the deployment label and must not cross the database SECURITY DEFINER boundary';
  end if;
  if not has_function_privilege('authenticated','public.get_live_service_operating_lane()','execute') then
    raise exception 'Authenticated live pages must be able to resolve the governed lane label';
  end if;
  if has_function_privilege('anon','public.record_live_service_operating_lane(text,text,text,text,boolean)','execute') then
    raise exception 'Anonymous callers must not change the live operating lane';
  end if;
  if has_table_privilege('authenticated','public.live_service_operating_lane_versions','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Authenticated browser role must not access protected live-lane versions directly';
  end if;
end $$;

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('10000000-0000-4000-8000-000000000171','authenticated','authenticated','lane-owner@safety.invalid','not-a-login',now(),'{}','{"full_name":"Lane Owner","requested_role":"learner","affiliation_choice":"independent"}',now(),now()),
  ('10000000-0000-4000-8000-000000000172','authenticated','authenticated','lane-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"Lane Professor","requested_role":"professor","affiliation_choice":"university"}',now(),now()),
  ('10000000-0000-4000-8000-000000000173','authenticated','authenticated','lane-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Lane Student","requested_role":"student","affiliation_choice":"university"}',now(),now());

update public.profiles set role='owner' where id='10000000-0000-4000-8000-000000000171';
update public.profiles set role='professor' where id='10000000-0000-4000-8000-000000000172';

insert into public.institutions (
  id,owner_id,name,slug,lifecycle_status,institution_type,region_code,
  institution_code,primary_lms,timezone_name,approved_at,approved_by
) values (
  '22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000171',
  'TOS Synthetic Staging','tos-synthetic-staging','active','university','TX',
  'TOS-STAGING','none','America/Chicago',now(),'10000000-0000-4000-8000-000000000171'
);

insert into public.institution_memberships(institution_id,user_id,role,status,permissions,joined_at)
values
  ('22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000171','owner','active','{"view_control_center":true,"view_audit":true,"manage_retention":true}',now()),
  ('22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000172','professor','active','{}',now()),
  ('22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000173','learner','active','{}',now());

update public.institution_affiliations
set institution_id='22222222-2222-4222-8222-222222222222',
    relationship='faculty',status='active',source='platform_owner',
    verification_method='test-fixture',is_primary=true,started_at=now()
where user_id='10000000-0000-4000-8000-000000000172'
  and pathway='professor';

update public.institution_affiliations
set institution_id='22222222-2222-4222-8222-222222222222',
    relationship='student',status='active',source='platform_owner',
    verification_method='test-fixture',is_primary=true,started_at=now()
where user_id='10000000-0000-4000-8000-000000000173'
  and pathway='student';

do $$
begin
  if not exists (
    select 1 from public.institution_affiliations
    where user_id='10000000-0000-4000-8000-000000000172'
      and pathway='professor'
      and institution_id='22222222-2222-4222-8222-222222222222'
      and relationship='faculty' and status='active'
  ) then raise exception 'Professor fixture affiliation was not scoped to staging'; end if;
  if not exists (
    select 1 from public.institution_affiliations
    where user_id='10000000-0000-4000-8000-000000000173'
      and pathway='student'
      and institution_id='22222222-2222-4222-8222-222222222222'
      and relationship='student' and status='active'
  ) then raise exception 'Student fixture affiliation was not scoped to staging'; end if;
end $$;

insert into public.courses(id,owner_id,institution_id,title,course_code,status,access_scope,education_division)
values (
  '40000000-0000-4000-8000-000000000171','10000000-0000-4000-8000-000000000172',
  '22222222-2222-4222-8222-222222222222','Lane Carry-over Course','LANE-101','published','institution','university'
);
insert into public.course_memberships(course_id,user_id,role)
values ('40000000-0000-4000-8000-000000000171','10000000-0000-4000-8000-000000000173','learner');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000171',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.iss','http://127.0.0.1:54321/auth/v1',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000171","role":"authenticated","iss":"http://127.0.0.1:54321/auth/v1"}',true);
set local role authenticated;

select public.record_live_service_operating_lane(
  'beta','1111111111111111111111111111111111111111',
  'Authorized administrative, investor, and librarian testing on the normal live service.',
  'test:live-beta-baseline',true
);
select public.record_live_service_operating_lane(
  'pilot','2222222222222222222222222222222222222222',
  'Authorized Digital Literacy pilot using the same live accounts, courses, and work.',
  'test:live-pilot-transition',true
);

select public.record_student_data_environment_lane(
  '22222222-2222-4222-8222-222222222222','institution','22222222-2222-4222-8222-222222222222',
  'beta','active','Authorized administrative and librarian walkthrough accounts in the existing staging system.',
  'test:lane-beta-baseline',true
);
select public.record_student_data_environment_lane(
  '22222222-2222-4222-8222-222222222222','institution','22222222-2222-4222-8222-222222222222',
  'pilot','active','Authorized Digital Literacy pilot cohort using the same staging accounts, courses, and work.',
  'test:lane-pilot-transition',true
);

do $$
begin
  begin
    perform public.record_student_data_environment_lane(
      '22222222-2222-4222-8222-222222222222','institution','22222222-2222-4222-8222-222222222222',
      'production','active','Production must remain a separately reviewed and promoted environment.',
      'test:production-must-fail',true
    );
    raise exception 'Production lane was assignable from staging';
  exception when others then
    if sqlerrm='Production lane was assignable from staging' then raise; end if;
    if position('Production lane cannot be assigned' in sqlerrm)=0 then raise; end if;
  end;
end $$;

reset role;

do $$
declare
  v_beta public.student_data_environment_lane_versions%rowtype;
  v_pilot public.student_data_environment_lane_versions%rowtype;
  v_live_beta public.live_service_operating_lane_versions%rowtype;
  v_live_pilot public.live_service_operating_lane_versions%rowtype;
begin
  select * into strict v_beta
  from public.student_data_environment_lane_versions
  where institution_id='22222222-2222-4222-8222-222222222222' and version=1;
  select * into strict v_pilot
  from public.student_data_environment_lane_versions
  where institution_id='22222222-2222-4222-8222-222222222222' and version=2;

  if v_beta.data_lane<>'beta' or v_pilot.data_lane<>'pilot' or v_pilot.previous_data_lane<>'beta' then
    raise exception 'Beta to Pilot transition history was not preserved';
  end if;
  if v_beta.carried_account_ids<>v_pilot.carried_account_ids
     or v_beta.carried_course_ids<>v_pilot.carried_course_ids
     or v_pilot.carried_account_count<>3 or v_pilot.carried_course_count<>1
     or v_pilot.carry_set_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'The exact carried account/course set was not recorded';
  end if;
  if (select count(*) from public.institution_memberships where institution_id='22222222-2222-4222-8222-222222222222')<>3
     or (select count(*) from public.courses where institution_id='22222222-2222-4222-8222-222222222222')<>1 then
    raise exception 'A lane transition mutated or duplicated existing records';
  end if;
  select * into strict v_live_beta from public.live_service_operating_lane_versions where version=1;
  select * into strict v_live_pilot from public.live_service_operating_lane_versions where version=2;
  if v_live_beta.operating_lane<>'beta'
     or v_live_pilot.operating_lane<>'pilot'
     or v_live_pilot.previous_operating_lane<>'beta'
     or v_live_beta.carried_account_ids<>v_live_pilot.carried_account_ids
     or v_live_beta.carried_course_ids<>v_live_pilot.carried_course_ids
     or v_live_pilot.carried_account_count<>3
     or v_live_pilot.carried_course_count<>1
     or v_live_pilot.carry_set_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'The live Beta-to-Pilot transition did not preserve the exact carry set';
  end if;
  if not exists (
    select 1 from public.audit_events
    where event_type='student_data.live_operating_lane_recorded'
      and data_lane='pilot' and environment_scope='live_service'
      and details->>'new_site_created'='false'
      and details->>'new_database_created'='false'
      and details->>'new_url_created'='false'
  ) then raise exception 'The global live Pilot transition audit record is missing'; end if;
  if not exists (
    select 1 from public.audit_events
    where institution_id='22222222-2222-4222-8222-222222222222'
      and event_type='student_data.environment_lane_recorded'
      and data_lane='sandbox' and environment_scope='staging_sandbox'
  ) then raise exception 'Staging activity was not kept in the sandbox audit lane'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000173',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.iss','http://127.0.0.1:54321/auth/v1',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000173","role":"authenticated","iss":"http://127.0.0.1:54321/auth/v1"}',true);
set local role authenticated;
do $$
declare v_label jsonb;
begin
  v_label:=public.get_my_student_data_environment_lane('40000000-0000-4000-8000-000000000171');
  if v_label->>'data_lane'<>'sandbox'
     or v_label->>'environment_scope'<>'staging_sandbox'
     or (v_label->>'production_label_visible')::boolean is not false then
    raise exception 'The staging student page did not remain in the Sandbox lane: %',v_label;
  end if;
end $$;

rollback;
