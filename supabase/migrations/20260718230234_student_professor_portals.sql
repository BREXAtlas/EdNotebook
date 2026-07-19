-- Student/professor portal data contract.
-- Public discovery is intentionally separated from protected course content.
-- Requested roles are onboarding claims only; authorization continues to use
-- profiles.role, memberships, and reviewed onboarding records.

create table public.identity_onboarding_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_role text not null check (requested_role in ('learner', 'professor')),
  institution_name text not null,
  department text,
  identifier_hash text,
  identifier_last4 text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (requested_role = 'learner' and identifier_hash is not null and identifier_last4 is not null)
    or requested_role = 'professor'
  )
);

create table public.published_course_directory (
  course_id uuid primary key references public.courses(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  institution_name text not null,
  professor_display_name text not null,
  course_code text not null,
  title text not null,
  subject text,
  term text,
  schedule text,
  summary text,
  enrollment_open boolean not null default true,
  is_listed boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_roster_entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete cascade,
  identifier_hash text not null,
  identifier_last4 text not null,
  display_name text,
  major text,
  planned_course_codes text[] not null default '{}',
  matched_user_id uuid references public.profiles(id) on delete set null,
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched', 'requested', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, identifier_hash)
);

create table public.student_enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  roster_entry_id uuid references public.student_roster_entries(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (course_id, student_id)
);

create table public.grade_categories (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  weight_percent numeric(5,2) not null check (weight_percent >= 0 and weight_percent <= 100),
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, name)
);

create table public.grade_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  category_id uuid references public.grade_categories(id) on delete set null,
  title text not null,
  max_points numeric(10,2) not null default 100 check (max_points > 0),
  publish_state text not null default 'draft'
    check (publish_state in ('draft', 'published')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_grades (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  grade_item_id uuid not null references public.grade_items(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(10,2),
  status text not null default 'pending'
    check (status in ('pending', 'missing', 'finalized')),
  feedback text,
  published_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade_item_id, student_id)
);

create table public.grade_share_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete cascade,
  label text not null default 'Report card link',
  token_hash text not null unique,
  scope_course_ids uuid[] not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (cardinality(scope_course_ids) > 0)
);

create table public.student_public_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  school_name text,
  graduation_year integer check (graduation_year between 1900 and 2200),
  bio text,
  youtube_url text,
  social_links jsonb not null default '{}'::jsonb,
  theme_key text not null default 'classic',
  visibility text not null default 'class'
    check (visibility in ('private', 'class', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_groups (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'course'
    check (visibility in ('public', 'institution', 'course', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (visibility = 'course' and course_id is not null)
    or (visibility = 'institution' and institution_id is not null)
    or visibility in ('public', 'private')
  )
);

create table public.student_group_memberships (
  group_id uuid not null references public.student_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.student_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.student_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  post_type text not null default 'update'
    check (post_type in ('update', 'progress', 'reward', 'tip', 'highlight')),
  body text not null check (char_length(body) between 1 and 5000),
  shared_grade_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professor_announcements (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  audience text not null default 'course'
    check (audience in ('public', 'institution', 'course')),
  title text not null,
  body text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (audience = 'course' and course_id is not null)
    or (audience = 'institution' and institution_id is not null)
    or audience = 'public'
  )
);

create index identity_onboarding_status_idx on public.identity_onboarding_requests (verification_status, requested_role);
create index published_course_directory_school_idx on public.published_course_directory (institution_name, is_listed);
create index published_course_directory_professor_idx on public.published_course_directory (professor_id);
create index student_roster_entries_hash_idx on public.student_roster_entries (identifier_hash);
create index student_roster_entries_matched_user_idx on public.student_roster_entries (matched_user_id);
create index student_enrollment_requests_student_idx on public.student_enrollment_requests (student_id, status);
create index grade_categories_course_idx on public.grade_categories (course_id, sort_order);
create index grade_items_course_idx on public.grade_items (course_id, publish_state);
create index grade_items_assignment_idx on public.grade_items (assignment_id);
create index student_grades_student_idx on public.student_grades (student_id, course_id);
create index student_grades_course_idx on public.student_grades (course_id, status);
create index grade_share_links_viewer_idx on public.grade_share_links (viewer_id, expires_at);
create index student_groups_course_idx on public.student_groups (course_id);
create index student_groups_institution_idx on public.student_groups (institution_id);
create index student_group_memberships_user_idx on public.student_group_memberships (user_id);
create index student_posts_group_idx on public.student_posts (group_id, created_at desc);
create index professor_announcements_course_idx on public.professor_announcements (course_id, published_at desc);
create index professor_announcements_institution_idx on public.professor_announcements (institution_id, published_at desc);

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
        g.visibility = 'public'
        or g.created_by = (select auth.uid())
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
        or private.is_platform_manager()
      )
  );
$$;

create or replace function private.can_manage_student_group(p_group_id uuid)
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
        or (g.course_id is not null and private.can_manage_course(g.course_id))
        or exists (
          select 1 from public.student_group_memberships gm
          where gm.group_id = g.id
            and gm.user_id = (select auth.uid())
            and gm.role in ('owner', 'moderator')
        )
        or private.is_platform_manager()
      )
  );
$$;

create or replace function private.shares_course_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_other_user_id is not null and exists (
    select 1
    from public.course_memberships mine
    join public.course_memberships theirs on theirs.course_id = mine.course_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_other_user_id
  );
$$;

revoke all on function private.can_access_student_group(uuid) from public;
revoke all on function private.can_manage_student_group(uuid) from public;
revoke all on function private.shares_course_with(uuid) from public;
grant execute on function private.can_access_student_group(uuid) to authenticated;
grant execute on function private.can_manage_student_group(uuid) to authenticated;
grant execute on function private.shares_course_with(uuid) to authenticated;

create or replace function private.set_enrollment_request_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id is distinct from (select auth.uid())
     and not private.can_manage_course(new.course_id) then
    raise exception 'Enrollment requests must belong to the signed-in student';
  end if;

  if not private.can_manage_course(new.course_id) then
    new.status := 'pending';
    new.approved_by := null;
    new.decided_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.set_enrollment_request_defaults() from public;

create trigger student_enrollment_requests_defaults
before insert on public.student_enrollment_requests
for each row execute function private.set_enrollment_request_defaults();

create or replace function public.review_identity_onboarding(
  p_user_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_role text;
begin
  if not private.is_platform_manager() then
    raise exception 'Only a platform manager can review an onboarding request';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  update public.identity_onboarding_requests
  set verification_status = p_decision,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      updated_at = now()
  where user_id = p_user_id
  returning requested_role into v_requested_role;

  if not found then
    raise exception 'Onboarding request not found';
  end if;

  if p_decision = 'approved' and v_requested_role = 'professor' then
    update public.profiles set role = 'professor', updated_at = now() where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.review_identity_onboarding(uuid, text) from public;
grant execute on function public.review_identity_onboarding(uuid, text) to authenticated;

create or replace function public.approve_student_enrollment(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.student_enrollment_requests%rowtype;
begin
  select * into v_request
  from public.student_enrollment_requests
  where id = p_request_id
  for update;

  if not found or not private.can_manage_course(v_request.course_id) then
    raise exception 'Enrollment request not found or not manageable';
  end if;

  update public.student_enrollment_requests
  set status = 'approved', approved_by = (select auth.uid()), decided_at = now()
  where id = p_request_id;

  update public.student_roster_entries
  set matched_user_id = v_request.student_id,
      match_status = 'approved',
      updated_at = now()
  where id = v_request.roster_entry_id;

  insert into public.course_memberships (course_id, user_id, role)
  values (v_request.course_id, v_request.student_id, 'learner')
  on conflict (course_id, user_id) do update set role = 'learner';
end;
$$;

revoke all on function public.approve_student_enrollment(uuid) from public;
grant execute on function public.approve_student_enrollment(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_role text;
  v_institution_name text;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );

  v_requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'learner');
  v_institution_name := nullif(trim(new.raw_user_meta_data ->> 'institution_name'), '');

  if v_requested_role in ('learner', 'professor') and v_institution_name is not null then
    insert into public.identity_onboarding_requests (
      user_id,
      requested_role,
      institution_name,
      department,
      identifier_hash,
      identifier_last4
    ) values (
      new.id,
      v_requested_role,
      v_institution_name,
      nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
      nullif(new.raw_user_meta_data ->> 'institution_identifier_hash', ''),
      nullif(new.raw_user_meta_data ->> 'institution_identifier_last4', '')
    );
  end if;
  return new;
end;
$$;

alter table public.identity_onboarding_requests enable row level security;
alter table public.published_course_directory enable row level security;
alter table public.student_roster_entries enable row level security;
alter table public.student_enrollment_requests enable row level security;
alter table public.grade_categories enable row level security;
alter table public.grade_items enable row level security;
alter table public.student_grades enable row level security;
alter table public.grade_share_links enable row level security;
alter table public.student_public_profiles enable row level security;
alter table public.student_groups enable row level security;
alter table public.student_group_memberships enable row level security;
alter table public.student_posts enable row level security;
alter table public.professor_announcements enable row level security;

create policy identity_requests_select
on public.identity_onboarding_requests for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_manager());

create policy identity_requests_insert
on public.identity_onboarding_requests for insert to authenticated
with check (user_id = (select auth.uid()) and verification_status = 'pending');

create policy identity_requests_manage
on public.identity_onboarding_requests for update to authenticated
using (private.is_platform_manager()) with check (private.is_platform_manager());

create policy directory_public_select
on public.published_course_directory for select to anon
using (is_listed);

create policy directory_authenticated_select
on public.published_course_directory for select to authenticated
using (is_listed or private.can_manage_course(course_id));

create policy directory_manage_insert
on public.published_course_directory for insert to authenticated
with check (private.can_manage_course(course_id));

create policy directory_manage_update
on public.published_course_directory for update to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy directory_manage_delete
on public.published_course_directory for delete to authenticated
using (private.can_manage_course(course_id));

create policy roster_select
on public.student_roster_entries for select to authenticated
using (private.can_manage_course(course_id) or matched_user_id = (select auth.uid()));

create policy roster_insert
on public.student_roster_entries for insert to authenticated
with check (added_by = (select auth.uid()) and private.can_manage_course(course_id));

create policy roster_update
on public.student_roster_entries for update to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy roster_delete
on public.student_roster_entries for delete to authenticated
using (private.can_manage_course(course_id));

create policy enrollment_select
on public.student_enrollment_requests for select to authenticated
using (student_id = (select auth.uid()) or private.can_manage_course(course_id));

create policy enrollment_insert
on public.student_enrollment_requests for insert to authenticated
with check (student_id = (select auth.uid()) or private.can_manage_course(course_id));

create policy enrollment_manage_update
on public.student_enrollment_requests for update to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy grade_categories_select
on public.grade_categories for select to authenticated
using (private.can_manage_course(course_id) or (is_published and private.can_access_course(course_id)));

create policy grade_categories_manage
on public.grade_categories for all to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy grade_items_select
on public.grade_items for select to authenticated
using (private.can_manage_course(course_id) or (publish_state = 'published' and private.can_access_course(course_id)));

create policy grade_items_manage
on public.grade_items for all to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy student_grades_select
on public.student_grades for select to authenticated
using (
  student_id = (select auth.uid())
  or private.can_manage_course(course_id)
  or exists (
    select 1 from public.grade_share_links gsl
    where gsl.student_id = student_grades.student_id
      and gsl.viewer_id = (select auth.uid())
      and student_grades.course_id = any(gsl.scope_course_ids)
      and gsl.revoked_at is null
      and gsl.expires_at > now()
  )
);

create policy student_grades_manage
on public.student_grades for all to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));

create policy grade_share_links_select
on public.grade_share_links for select to authenticated
using (student_id = (select auth.uid()) or viewer_id = (select auth.uid()));

create policy grade_share_links_insert
on public.grade_share_links for insert to authenticated
with check (student_id = (select auth.uid()));

create policy grade_share_links_update
on public.grade_share_links for update to authenticated
using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

create policy grade_share_links_delete
on public.grade_share_links for delete to authenticated
using (student_id = (select auth.uid()));

create policy student_profiles_public_select
on public.student_public_profiles for select to anon
using (visibility = 'public');

create policy student_profiles_authenticated_select
on public.student_public_profiles for select to authenticated
using (
  visibility = 'public'
  or user_id = (select auth.uid())
  or (visibility = 'class' and private.shares_course_with(user_id))
);

create policy student_profiles_insert
on public.student_public_profiles for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.course_memberships cm where cm.user_id = (select auth.uid())
));

create policy student_profiles_update
on public.student_public_profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy student_profiles_delete
on public.student_public_profiles for delete to authenticated
using (user_id = (select auth.uid()));

create policy student_groups_public_select
on public.student_groups for select to anon
using (visibility = 'public');

create policy student_groups_authenticated_select
on public.student_groups for select to authenticated
using (private.can_access_student_group(id));

create policy student_groups_insert
on public.student_groups for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (course_id is null or private.can_access_course(course_id))
  and (
    institution_id is null
    or exists (
      select 1 from public.institution_memberships im
      where im.institution_id = student_groups.institution_id and im.user_id = (select auth.uid())
    )
  )
);

create policy student_groups_update
on public.student_groups for update to authenticated
using (private.can_manage_student_group(id)) with check (private.can_manage_student_group(id));

create policy student_groups_delete
on public.student_groups for delete to authenticated
using (private.can_manage_student_group(id));

create policy group_memberships_select
on public.student_group_memberships for select to authenticated
using (user_id = (select auth.uid()) or private.can_manage_student_group(group_id));

create policy group_memberships_insert
on public.student_group_memberships for insert to authenticated
with check (
  private.can_manage_student_group(group_id)
  or (user_id = (select auth.uid()) and role = 'member' and private.can_access_student_group(group_id))
);

create policy group_memberships_update
on public.student_group_memberships for update to authenticated
using (private.can_manage_student_group(group_id)) with check (private.can_manage_student_group(group_id));

create policy group_memberships_delete
on public.student_group_memberships for delete to authenticated
using (user_id = (select auth.uid()) or private.can_manage_student_group(group_id));

create policy student_posts_public_select
on public.student_posts for select to anon
using (exists (
  select 1 from public.student_groups g where g.id = student_posts.group_id and g.visibility = 'public'
));

create policy student_posts_authenticated_select
on public.student_posts for select to authenticated
using (private.can_access_student_group(group_id));

create policy student_posts_insert
on public.student_posts for insert to authenticated
with check (author_id = (select auth.uid()) and private.can_access_student_group(group_id));

create policy student_posts_update
on public.student_posts for update to authenticated
using (author_id = (select auth.uid()) or private.can_manage_student_group(group_id))
with check (author_id = (select auth.uid()) or private.can_manage_student_group(group_id));

create policy student_posts_delete
on public.student_posts for delete to authenticated
using (author_id = (select auth.uid()) or private.can_manage_student_group(group_id));

create policy announcements_public_select
on public.professor_announcements for select to anon
using (is_published and audience = 'public');

create policy announcements_authenticated_select
on public.professor_announcements for select to authenticated
using (
  professor_id = (select auth.uid())
  or (is_published and audience = 'public')
  or (is_published and audience = 'course' and private.can_access_course(course_id))
  or (
    is_published and audience = 'institution'
    and exists (
      select 1 from public.institution_memberships im
      where im.institution_id = professor_announcements.institution_id
        and im.user_id = (select auth.uid())
    )
  )
  or private.is_platform_manager()
);

create policy announcements_insert
on public.professor_announcements for insert to authenticated
with check (
  professor_id = (select auth.uid())
  and (
    (course_id is not null and private.can_manage_course(course_id))
    or (institution_id is not null and private.is_institution_manager(institution_id, (select auth.uid())))
    or (audience = 'public' and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('professor', 'admin', 'owner')
    ))
    or private.is_platform_manager()
  )
);

create policy announcements_update
on public.professor_announcements for update to authenticated
using (
  professor_id = (select auth.uid())
  and (
    (course_id is not null and private.can_manage_course(course_id))
    or (institution_id is not null and private.is_institution_manager(institution_id, (select auth.uid())))
    or (audience = 'public' and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('professor', 'admin', 'owner')
    ))
    or private.is_platform_manager()
  )
)
with check (
  professor_id = (select auth.uid())
  and (
    (course_id is not null and private.can_manage_course(course_id))
    or (institution_id is not null and private.is_institution_manager(institution_id, (select auth.uid())))
    or (audience = 'public' and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('professor', 'admin', 'owner')
    ))
    or private.is_platform_manager()
  )
);

create policy announcements_delete
on public.professor_announcements for delete to authenticated
using (professor_id = (select auth.uid()) or private.is_platform_manager());

grant select on public.published_course_directory to anon;
grant select on public.student_public_profiles to anon;
grant select on public.student_groups to anon;
grant select on public.student_posts to anon;
grant select on public.professor_announcements to anon;

grant select, insert, update on public.identity_onboarding_requests to authenticated;
grant select, insert, update, delete on public.published_course_directory to authenticated;
grant select, insert, update, delete on public.student_roster_entries to authenticated;
grant select, insert, update on public.student_enrollment_requests to authenticated;
grant select, insert, update, delete on public.grade_categories to authenticated;
grant select, insert, update, delete on public.grade_items to authenticated;
grant select, insert, update, delete on public.student_grades to authenticated;
grant select, insert, update, delete on public.grade_share_links to authenticated;
grant select, insert, update, delete on public.student_public_profiles to authenticated;
grant select, insert, update, delete on public.student_groups to authenticated;
grant select, insert, update, delete on public.student_group_memberships to authenticated;
grant select, insert, update, delete on public.student_posts to authenticated;
grant select, insert, update, delete on public.professor_announcements to authenticated;

create trigger identity_onboarding_requests_touch_updated_at
before update on public.identity_onboarding_requests
for each row execute function private.touch_updated_at();
create trigger published_course_directory_touch_updated_at
before update on public.published_course_directory
for each row execute function private.touch_updated_at();
create trigger student_roster_entries_touch_updated_at
before update on public.student_roster_entries
for each row execute function private.touch_updated_at();
create trigger grade_categories_touch_updated_at
before update on public.grade_categories
for each row execute function private.touch_updated_at();
create trigger grade_items_touch_updated_at
before update on public.grade_items
for each row execute function private.touch_updated_at();
create trigger student_grades_touch_updated_at
before update on public.student_grades
for each row execute function private.touch_updated_at();
create trigger student_public_profiles_touch_updated_at
before update on public.student_public_profiles
for each row execute function private.touch_updated_at();
create trigger student_groups_touch_updated_at
before update on public.student_groups
for each row execute function private.touch_updated_at();
create trigger student_posts_touch_updated_at
before update on public.student_posts
for each row execute function private.touch_updated_at();
create trigger professor_announcements_touch_updated_at
before update on public.professor_announcements
for each row execute function private.touch_updated_at();
