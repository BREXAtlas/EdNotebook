-- Run after all migrations on staging or another disposable database.
-- Synthetic fixtures are rolled back. This proves that the free Early Prep
-- Financial Literacy class cannot cross into University or publisher records.

begin;
set local statement_timeout='60s';

create temporary table _early_prep_fl_acceptance (
  university_course_count integer not null,
  university_badge_count integer not null,
  published_library_count integer not null,
  marketplace_order_count integer not null
) on commit drop;

insert into _early_prep_fl_acceptance
select
  (select count(*) from public.courses where education_division='university'),
  (select count(*) from public.course_completion_badges),
  (select count(*) from public.published_course_directory),
  (select count(*) from public.marketplace_orders);

insert into auth.users(
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('8fd6c1a7-5b42-4e91-a7c8-100000000001','authenticated','authenticated','early-prep-fl-teacher@safety.invalid','not-a-login',now(),'{}','{"full_name":"Early Prep FL Teacher","requested_role":"professor","education_division":"k12","affiliation_choice":"other","institution_name":"Synthetic High School"}',now(),now()),
  ('8fd6c1a7-5b42-4e91-a7c8-100000000002','authenticated','authenticated','early-prep-fl-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Early Prep FL Student","requested_role":"learner","education_division":"k12"}',now(),now()),
  ('8fd6c1a7-5b42-4e91-a7c8-100000000003','authenticated','authenticated','university-fl-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"University FL Professor","requested_role":"professor","education_division":"university","affiliation_choice":"other","institution_name":"Synthetic University"}',now(),now()),
  ('8fd6c1a7-5b42-4e91-a7c8-100000000004','authenticated','authenticated','university-fl-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"University FL Student","requested_role":"learner","education_division":"university"}',now(),now());

update public.profiles set role='professor'
where id in ('8fd6c1a7-5b42-4e91-a7c8-100000000001','8fd6c1a7-5b42-4e91-a7c8-100000000003');

delete from public.student_education_paths
where user_id in ('8fd6c1a7-5b42-4e91-a7c8-100000000002','8fd6c1a7-5b42-4e91-a7c8-100000000004');
insert into public.student_education_paths(user_id,started_in,current_division)
values
  ('8fd6c1a7-5b42-4e91-a7c8-100000000002','k12','k12'),
  ('8fd6c1a7-5b42-4e91-a7c8-100000000004','university','university');

insert into public.courses(id,owner_id,title,course_code,status,education_division,subject,subject_id)
values
  ('8fd6c1a7-5b42-4e91-a7c8-100000000010','8fd6c1a7-5b42-4e91-a7c8-100000000001','Synthetic Early Prep Personal Finance','EP-FL','published','k12','ignored','financial-literacy-personal-finance'),
  ('8fd6c1a7-5b42-4e91-a7c8-100000000011','8fd6c1a7-5b42-4e91-a7c8-100000000003','Synthetic University Finance','UNI-FL','published','university','Finance',null);

insert into public.course_memberships(course_id,user_id,role)
values ('8fd6c1a7-5b42-4e91-a7c8-100000000010','8fd6c1a7-5b42-4e91-a7c8-100000000002','learner');

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-100000000001',true);
do $$
declare v_progress jsonb;
begin
  v_progress:=public.get_financial_literacy_teacher_progress('8fd6c1a7-5b42-4e91-a7c8-100000000010');
  if jsonb_array_length(v_progress->'learners')<>1 then
    raise exception 'Early Prep teacher cannot see exactly the enrolled class learner';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-100000000003',true);
do $$
begin
  begin
    perform public.get_financial_literacy_teacher_progress('8fd6c1a7-5b42-4e91-a7c8-100000000011');
    raise exception 'University professor unexpectedly opened Early Prep Financial Literacy progress';
  exception when others then
    if sqlerrm='University professor unexpectedly opened Early Prep Financial Literacy progress' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-100000000004',true);
do $$
begin
  if public.get_my_financial_literacy_course()->'course'<>'null'::jsonb then
    raise exception 'University student unexpectedly received the Early Prep standard class';
  end if;
  begin
    perform public.record_my_financial_literacy_completion('ep01','2026.08.08.1');
    raise exception 'University student unexpectedly recorded Early Prep completion';
  exception when others then
    if sqlerrm='University student unexpectedly recorded Early Prep completion' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','8fd6c1a7-5b42-4e91-a7c8-100000000002',true);
do $$
declare v_course jsonb;
begin
  v_course:=public.get_my_financial_literacy_course();
  if jsonb_array_length(v_course->'course'->'units')<>40 then
    raise exception 'Early Prep student did not receive all 40 canonical units';
  end if;
  perform public.record_my_financial_literacy_completion('ep01','2026.08.08.1');
  if (public.get_my_financial_literacy_course()->'course'->>'completed_units')::integer<>1 then
    raise exception 'Learner-confirmed completion was not recorded exactly once';
  end if;
end;
$$;

insert into private.financial_literacy_standard_progress(
  enrollment_id,student_id,release_id,unit_id,evidence_source,completed_at,updated_at
)
select enrollment.id,enrollment.student_id,unit.release_id,unit.unit_id,
  'learner_confirmed_canonical_course',now(),now()
from private.financial_literacy_standard_enrollments enrollment
join public.financial_literacy_catalog_units unit on unit.release_id=enrollment.current_release_id
where enrollment.student_id='8fd6c1a7-5b42-4e91-a7c8-100000000002'
on conflict (student_id,release_id,unit_id) do update set updated_at=excluded.updated_at;

do $$
declare v_baseline _early_prep_fl_acceptance%rowtype;
begin
  select * into v_baseline from _early_prep_fl_acceptance;
  if (select count(*) from private.financial_literacy_standard_badges
      where student_id='8fd6c1a7-5b42-4e91-a7c8-100000000002')<>2 then
    raise exception 'Foundations and full-course milestones were not issued exactly once';
  end if;
  if (select count(*) from public.courses where education_division='university')<>v_baseline.university_course_count+1 then
    raise exception 'University course records changed outside the one synthetic fixture';
  end if;
  if (select count(*) from public.course_completion_badges)<>v_baseline.university_badge_count then
    raise exception 'University completion badges changed';
  end if;
  if (select count(*) from public.published_course_directory)<>v_baseline.published_library_count then
    raise exception 'Publisher-facing library entries changed';
  end if;
  if (select count(*) from public.marketplace_orders)<>v_baseline.marketplace_order_count then
    raise exception 'Marketplace orders changed';
  end if;
  if has_table_privilege('authenticated','private.financial_literacy_standard_progress','SELECT')
    or has_table_privilege('authenticated','private.financial_literacy_standard_badges','SELECT') then
    raise exception 'Authenticated clients unexpectedly have direct private progress access';
  end if;
end;
$$;

rollback;
