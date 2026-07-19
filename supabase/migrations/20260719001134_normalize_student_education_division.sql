-- Prevent manipulated learner metadata from selecting the educator-only "both" value.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_role text;
  v_institution_name text;
  v_education_division text;
begin
  v_requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'learner');
  v_institution_name := nullif(trim(new.raw_user_meta_data ->> 'institution_name'), '');
  v_education_division := coalesce(nullif(new.raw_user_meta_data ->> 'education_division', ''), 'university');

  if v_requested_role not in ('learner', 'professor') then
    v_requested_role := 'learner';
  end if;
  if v_education_division not in ('university', 'k12', 'both') then
    v_education_division := 'university';
  end if;
  if v_requested_role = 'learner' and v_education_division = 'both' then
    v_education_division := 'university';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when v_requested_role = 'professor' then 'professor' else 'learner' end
  );

  if v_institution_name is not null then
    insert into public.identity_onboarding_requests (
      user_id, requested_role, institution_name, department,
      identifier_hash, identifier_last4, education_division
    ) values (
      new.id, v_requested_role, v_institution_name,
      nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
      nullif(new.raw_user_meta_data ->> 'institution_identifier_hash', ''),
      nullif(new.raw_user_meta_data ->> 'institution_identifier_last4', ''),
      v_education_division
    );
  end if;

  if v_requested_role = 'learner' then
    insert into public.student_education_paths (user_id, started_in, current_division)
    values (new.id, v_education_division, v_education_division)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
