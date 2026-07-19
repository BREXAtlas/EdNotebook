-- One shared education ecosystem with explicit University / K-12 boundaries.
-- Educator accounts receive teaching access immediately. Manual review controls
-- only the public school-affiliation badge.

alter table public.institutions
  add column if not exists education_division text not null default 'university'
  check (education_division in ('university', 'k12'));

alter table public.courses
  add column if not exists education_division text not null default 'university'
  check (education_division in ('university', 'k12'));

alter table public.identity_onboarding_requests
  add column if not exists education_division text not null default 'university'
  check (education_division in ('university', 'k12', 'both'));

alter table public.published_course_directory
  add column if not exists education_division text not null default 'university'
  check (education_division in ('university', 'k12')),
  add column if not exists educator_verification_status text not null default 'unverified'
  check (educator_verification_status in ('unverified', 'pending', 'approved', 'rejected'));

alter table public.student_groups
  add column if not exists education_division text not null default 'university'
  check (education_division in ('university', 'k12'));

alter table public.professor_announcements
  add column if not exists education_division text not null default 'university'
  check (education_division in ('university', 'k12'));

alter table public.student_public_profiles
  add column if not exists education_division text not null default 'university'
  check (education_division in ('university', 'k12'));

alter table public.student_public_profiles drop constraint if exists student_public_profiles_pkey;
alter table public.student_public_profiles add primary key (user_id, education_division);

create table public.educator_verification_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  institution_name text not null check (char_length(trim(institution_name)) between 2 and 240),
  education_division text not null check (education_division in ('university', 'k12', 'both')),
  department text,
  teacher_identifier_last4 text check (teacher_identifier_last4 is null or char_length(teacher_identifier_last4) between 1 and 4),
  secure_file_id uuid references public.secure_file_objects(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_education_paths (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  started_in text not null default 'university' check (started_in in ('university', 'k12')),
  current_division text not null default 'university' check (current_division in ('university', 'k12')),
  transfer_learning_memory boolean not null default true,
  k12_completion_year integer check (k12_completion_year between 1900 and 2200),
  university_graduation_year integer check (university_graduation_year between 1900 and 2200),
  transitioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index educator_verification_status_idx
  on public.educator_verification_requests (status, education_division, submitted_at);
create index educator_verification_institution_idx
  on public.educator_verification_requests (institution_id);
create index educator_verification_secure_file_idx
  on public.educator_verification_requests (secure_file_id);
create index educator_verification_reviewed_by_idx
  on public.educator_verification_requests (reviewed_by);
create index published_course_directory_division_idx
  on public.published_course_directory (education_division, is_listed, institution_name);
create index student_groups_division_idx
  on public.student_groups (education_division, visibility);
create index professor_announcements_division_idx
  on public.professor_announcements (education_division, audience, published_at desc);

create or replace function private.set_educator_verification_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_manager() then
    new.user_id := (select auth.uid());
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_educator_verification_defaults() from public;

create trigger educator_verification_defaults
before insert or update on public.educator_verification_requests
for each row execute function private.set_educator_verification_defaults();

create trigger educator_verification_touch_updated_at
before update on public.educator_verification_requests
for each row execute function private.touch_updated_at();

create trigger student_education_paths_touch_updated_at
before update on public.student_education_paths
for each row execute function private.touch_updated_at();

create or replace function private.set_directory_verification_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select evr.status into v_status
  from public.educator_verification_requests evr
  where evr.user_id = new.professor_id
    and evr.education_division in (new.education_division, 'both')
    and lower(trim(evr.institution_name)) = lower(trim(new.institution_name));

  new.educator_verification_status := coalesce(v_status, 'unverified');
  return new;
end;
$$;

revoke all on function private.set_directory_verification_status() from public;

create trigger published_course_directory_verification_status
before insert or update of professor_id, institution_name, education_division
on public.published_course_directory
for each row execute function private.set_directory_verification_status();

create or replace function private.review_educator_verification(
  p_user_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.educator_verification_requests%rowtype;
begin
  if not private.is_platform_manager() then
    raise exception 'Only a platform manager can review an educator affiliation';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  update public.educator_verification_requests
  set status = p_decision,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_request;

  if not found then
    raise exception 'Educator verification request not found';
  end if;

  update public.published_course_directory
  set educator_verification_status = p_decision,
      updated_at = now()
  where professor_id = p_user_id
    and education_division in (
      case when v_request.education_division = 'both' then 'university' else v_request.education_division end,
      case when v_request.education_division = 'both' then 'k12' else v_request.education_division end
    )
    and lower(trim(institution_name)) = lower(trim(v_request.institution_name));
end;
$$;

revoke all on function private.review_educator_verification(uuid, text) from public;
revoke execute on function private.review_educator_verification(uuid, text) from anon;
grant execute on function private.review_educator_verification(uuid, text) to authenticated;

create function public.review_educator_verification(
  p_user_id uuid,
  p_decision text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.review_educator_verification(p_user_id, p_decision);
$$;

revoke all on function public.review_educator_verification(uuid, text) from public;
revoke execute on function public.review_educator_verification(uuid, text) from anon;
grant execute on function public.review_educator_verification(uuid, text) to authenticated;

create or replace function private.can_access_student_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_group_id is not null and exists (
    select 1
    from public.student_groups g
    where g.id = p_group_id
      and (
        g.created_by = (select auth.uid())
        or private.is_platform_manager()
        or (g.course_id is not null and private.can_manage_course(g.course_id))
        or (
          exists (
            select 1 from public.student_education_paths sep
            where sep.user_id = (select auth.uid())
              and sep.current_division = g.education_division
          )
          and (
            g.visibility = 'public'
            or (g.visibility = 'course' and private.can_access_course(g.course_id))
            or (
              g.visibility = 'institution'
              and exists (
                select 1 from public.institution_memberships im
                where im.institution_id = g.institution_id
                  and im.user_id = (select auth.uid())
              )
            )
            or exists (
              select 1 from public.student_group_memberships gm
              where gm.group_id = g.id and gm.user_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

revoke all on function private.can_access_student_group(uuid) from public;
grant execute on function private.can_access_student_group(uuid) to authenticated;

drop policy if exists student_profiles_public_select on public.student_public_profiles;
create policy student_profiles_public_select
on public.student_public_profiles for select to anon
using (education_division = 'university' and visibility = 'public');

drop policy if exists student_profiles_authenticated_select on public.student_public_profiles;
create policy student_profiles_authenticated_select
on public.student_public_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    exists (
      select 1 from public.student_education_paths sep
      where sep.user_id = (select auth.uid())
        and sep.current_division = student_public_profiles.education_division
    )
    and (
      visibility = 'public'
      or (visibility = 'class' and private.shares_course_with(user_id))
    )
  )
);

drop policy if exists student_profiles_insert on public.student_public_profiles;
create policy student_profiles_insert
on public.student_public_profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.student_education_paths sep
    where sep.user_id = (select auth.uid())
      and sep.current_division = student_public_profiles.education_division
  )
  and exists (
    select 1 from public.course_memberships cm where cm.user_id = (select auth.uid())
  )
);

drop policy if exists student_profiles_update on public.student_public_profiles;
create policy student_profiles_update
on public.student_public_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.student_education_paths sep
    where sep.user_id = (select auth.uid())
      and sep.current_division = student_public_profiles.education_division
  )
);

drop policy if exists student_groups_public_select on public.student_groups;
create policy student_groups_public_select
on public.student_groups for select to anon
using (education_division = 'university' and visibility = 'public');

drop policy if exists student_posts_public_select on public.student_posts;
create policy student_posts_public_select
on public.student_posts for select to anon
using (exists (
  select 1 from public.student_groups g
  where g.id = student_posts.group_id
    and g.education_division = 'university'
    and g.visibility = 'public'
));

alter table public.educator_verification_requests enable row level security;
alter table public.student_education_paths enable row level security;

create policy educator_verification_select
on public.educator_verification_requests for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_manager());

create policy educator_verification_insert
on public.educator_verification_requests for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

create policy educator_verification_update
on public.educator_verification_requests for update to authenticated
using (user_id = (select auth.uid()) or private.is_platform_manager())
with check (user_id = (select auth.uid()) or private.is_platform_manager());

create policy education_paths_select
on public.student_education_paths for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_manager());

create policy education_paths_insert
on public.student_education_paths for insert to authenticated
with check (user_id = (select auth.uid()));

create policy education_paths_update
on public.student_education_paths for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update on public.educator_verification_requests to authenticated;
grant select, insert, update on public.student_education_paths to authenticated;

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

-- Existing requested educators no longer wait for affiliation approval to teach.
update public.profiles p
set role = 'professor', updated_at = now()
from public.identity_onboarding_requests ior
where ior.user_id = p.id
  and ior.requested_role = 'professor'
  and p.role = 'learner';

insert into public.student_education_paths (user_id, started_in, current_division)
select p.id,
       case when ior.education_division = 'k12' then 'k12' else 'university' end,
       case when ior.education_division = 'k12' then 'k12' else 'university' end
from public.profiles p
left join public.identity_onboarding_requests ior on ior.user_id = p.id
where p.role = 'learner'
on conflict (user_id) do nothing;

-- New Data API tables require explicit privileges.
revoke all on public.educator_verification_requests from anon;
revoke all on public.student_education_paths from anon;
