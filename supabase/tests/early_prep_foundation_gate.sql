-- Run only against a disposable Supabase database after every migration.
-- Proves the stable taxonomy and direct-write commerce boundary without real
-- student, district, payment, or provider data.

begin;
set local statement_timeout='45s';

do $$
begin
  if (select count(*) from public.education_subjects where education_division='k12' and active) <> 11 then
    raise exception 'Early Prep must expose exactly eleven active stable subjects';
  end if;
  if to_regprocedure('public.get_admin_control_center_by_division(uuid,text)') is null
    or to_regprocedure('public.admin_search_accounts_courses_by_division(text,uuid,text,text)') is null then
    raise exception 'Division-scoped control-center RPCs are required';
  end if;
end;
$$;

insert into auth.users(
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '33000000-0000-4000-8000-000000000001','authenticated','authenticated',
  'early-prep-teacher@safety.invalid','not-a-login',now(),'{}',
  '{"full_name":"Early Prep Teacher","requested_role":"professor","education_division":"k12","affiliation_choice":"other","institution_name":"Synthetic High School"}',
  now(),now()
);

do $$
begin
  begin
    insert into public.courses(owner_id,title,education_division,subject,subject_id,status)
    values('33000000-0000-4000-8000-000000000001','Invalid Early Prep Subject','k12','Unstable free text',null,'draft');
    raise exception 'Expected the Early Prep subject guard to reject a missing stable ID';
  exception when others then
    if sqlerrm='Expected the Early Prep subject guard to reject a missing stable ID' then raise; end if;
  end;

  begin
    insert into public.publisher_applications(applicant_id,organization_name,applicant_type,catalog_summary,rights_attestation,status,education_division)
    values('33000000-0000-4000-8000-000000000001','Synthetic Seller','professor','Synthetic only',true,'submitted','k12');
    raise exception 'Expected Early Prep seller onboarding to fail closed';
  exception when others then
    if sqlerrm='Expected Early Prep seller onboarding to fail closed' then raise; end if;
  end;
end;
$$;

insert into public.courses(owner_id,title,education_division,subject,subject_id,status)
values('33000000-0000-4000-8000-000000000001','Early Prep Digital Literacy','k12','ignored','computer-science-digital-literacy','draft');

do $$
begin
  if not exists (
    select 1 from public.courses
    where title='Early Prep Digital Literacy' and education_division='k12'
      and subject_id='computer-science-digital-literacy'
      and subject='Computer Science / Digital Literacy'
  ) then raise exception 'Stable course subject metadata was not enforced'; end if;
end;
$$;

rollback;
