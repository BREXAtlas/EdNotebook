-- Forward-only release hardening for directory identity, grade publication,
-- account audit state, educator evidence, and social author integrity.
--
-- This migration assumes the baseline/core objects referenced by the preceding
-- migrations already exist. It is safe to apply after 20260719185200 and uses
-- replace/drop-if-exists guards so projects that received the earlier fixes can
-- converge on the same final definitions.

-- A small private predicate keeps inactive/test accounts out of discovery
-- policies without requiring anon callers to read the profiles table directly.
create or replace function private.is_discoverable_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.account_audit_status not in ('inactive_review', 'test_account')
  );
$$;

revoke all on function private.is_discoverable_account(uuid) from public, anon, authenticated;
grant execute on function private.is_discoverable_account(uuid) to anon, authenticated;

-- Directory identity and verification state are server-derived. A normal
-- course manager may create their own listing and edit its content, but cannot
-- switch an existing listing to another professor or write an approval badge.
create or replace function private.secure_published_course_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_platform_manager boolean := false;
  v_display_name text;
  v_verification_status text;
begin
  if v_actor_id is not null then
    v_is_platform_manager := private.is_platform_manager();
  end if;

  if v_actor_id is not null and not v_is_platform_manager then
    if not private.can_manage_course(new.course_id) then
      raise exception 'Only a course manager can publish this class';
    end if;

    if tg_op = 'INSERT' then
      new.professor_id := v_actor_id;
    else
      new.professor_id := old.professor_id;
      new.course_id := old.course_id;
    end if;
  end if;

  if new.professor_id is null then
    raise exception 'A directory professor is required';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Educator')
    into v_display_name
  from public.profiles p
  where p.id = new.professor_id;

  if not found then
    raise exception 'The directory professor profile was not found';
  end if;

  select evr.status
    into v_verification_status
  from public.educator_verification_requests evr
  where evr.user_id = new.professor_id
    and evr.education_division in (new.education_division, 'both')
    and lower(trim(evr.institution_name)) = lower(trim(new.institution_name))
  limit 1;

  new.professor_display_name := v_display_name;
  new.educator_verification_status := coalesce(v_verification_status, 'unverified');
  return new;
end;
$$;

revoke all on function private.secure_published_course_directory() from public, anon, authenticated;

drop trigger if exists published_course_directory_verification_status
on public.published_course_directory;
drop trigger if exists published_course_directory_server_identity
on public.published_course_directory;
create trigger published_course_directory_server_identity
before insert or update on public.published_course_directory
for each row execute function private.secure_published_course_directory();

-- Remove the table-level UPDATE grant so protected identity/status columns
-- cannot be included in a Data API update. The trigger still derives them.
revoke update on table public.published_course_directory from authenticated;
grant update (
  institution_id,
  institution_name,
  course_code,
  title,
  subject,
  term,
  schedule,
  summary,
  enrollment_open,
  is_listed,
  published_at,
  education_division
) on table public.published_course_directory to authenticated;

-- Verification evidence always belongs to the requester. A pending request may
-- reference its just-uploaded quarantined/scanning file, but approval is blocked
-- until the security worker has released a clean file.
create or replace function private.validate_educator_verification_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_security_status text;
  v_availability_status text;
begin
  if new.secure_file_id is null then
    if new.status = 'approved' then
      raise exception 'Approved educator verification requires released, security-checked evidence';
    end if;
    return new;
  end if;

  select sfo.security_status, sfo.availability_status
    into v_security_status, v_availability_status
  from public.secure_file_objects sfo
  where sfo.id = new.secure_file_id
    and sfo.owner_id = new.user_id;

  if not found then
    raise exception 'Verification evidence must belong to the educator requesting review';
  end if;

  if new.status = 'approved'
     and (v_security_status <> 'clean' or v_availability_status <> 'released') then
    raise exception 'Verification evidence must be released and security-checked before approval';
  end if;

  if new.status = 'pending'
     and not (
       (v_security_status = 'clean' and v_availability_status = 'released')
       or (
         v_security_status in ('quarantined', 'scanning')
         and v_availability_status = 'quarantined'
       )
     ) then
    raise exception 'Pending verification evidence must still be scanning or already released as clean';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_educator_verification_file() from public, anon, authenticated;

drop trigger if exists educator_verification_secure_file_guard
on public.educator_verification_requests;
create trigger educator_verification_secure_file_guard
before insert or update of user_id, secure_file_id, status
on public.educator_verification_requests
for each row execute function private.validate_educator_verification_file();

-- Grade rows must point to an item in the same course. NOT VALID preserves
-- upgrade safety for existing projects while enforcing the invariant for all
-- new/changed rows; owners can validate it after auditing historical data.
create unique index if not exists grade_items_id_course_unique_idx
  on public.grade_items (id, course_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_grades'::regclass
      and conname = 'student_grades_item_course_fk'
  ) then
    alter table public.student_grades
      add constraint student_grades_item_course_fk
      foreign key (grade_item_id, course_id)
      references public.grade_items (id, course_id)
      on delete cascade
      not valid;
  end if;
end;
$$;

create or replace function private.is_published_grade_item(
  p_grade_item_id uuid,
  p_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.grade_items gi
    where gi.id = p_grade_item_id
      and gi.course_id = p_course_id
      and gi.publish_state = 'published'
  );
$$;

revoke all on function private.is_published_grade_item(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_published_grade_item(uuid, uuid) to authenticated;

create or replace function private.enforce_student_grade_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_state text;
begin
  select gi.publish_state
    into v_item_state
  from public.grade_items gi
  where gi.id = new.grade_item_id
    and gi.course_id = new.course_id;

  if not found then
    raise exception 'The grade item does not belong to this course';
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.course_memberships cm
      where cm.course_id = new.course_id
        and cm.user_id = new.student_id
        and cm.role = 'learner'
    ) then
      raise exception 'The learner is not enrolled in this course';
    end if;
  elsif new.student_id is distinct from old.student_id
     or new.course_id is distinct from old.course_id then
    if not exists (
      select 1
      from public.course_memberships cm
      where cm.course_id = new.course_id
        and cm.user_id = new.student_id
        and cm.role = 'learner'
    ) then
      raise exception 'The learner is not enrolled in this course';
    end if;
  end if;

  if new.published_at is not null and v_item_state <> 'published' then
    raise exception 'Publish the grade item before publishing a learner grade';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_student_grade_integrity() from public, anon, authenticated;

drop trigger if exists student_grades_integrity_guard on public.student_grades;
create trigger student_grades_integrity_guard
before insert or update on public.student_grades
for each row execute function private.enforce_student_grade_integrity();

drop policy if exists student_grades_select on public.student_grades;
create policy student_grades_select
on public.student_grades for select to authenticated
using (
  private.can_manage_course(course_id)
  or (
    published_at is not null
    and private.is_published_grade_item(grade_item_id, course_id)
    and (
      student_id = (select auth.uid())
      or exists (
        select 1
        from public.grade_share_links gsl
        where gsl.student_id = student_grades.student_id
          and gsl.viewer_id = (select auth.uid())
          and student_grades.course_id = any(gsl.scope_course_ids)
          and gsl.revoked_at is null
          and gsl.expires_at > now()
      )
    )
  )
);

-- Client-reported activity is allowlisted and can update activity timestamps,
-- but it never changes an owner's inactive/test audit decision.
create or replace function private.record_account_activity(p_event text default 'session_open')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_event not in (
    'session_open',
    'sign_in',
    'student_page_saved',
    'course_created',
    'settings_saved'
  ) then
    raise exception 'Unsupported account activity event';
  end if;

  update public.profiles
  set last_active_at = now(),
      meaningful_activity_at = case
        when p_event in ('session_open', 'sign_in') then meaningful_activity_at
        else coalesce(meaningful_activity_at, now())
      end
  where id = v_user_id;
end;
$$;

revoke all on function private.record_account_activity(text) from public, anon, authenticated;
grant execute on function private.record_account_activity(text) to authenticated;

create or replace function public.record_account_activity(p_event text default 'session_open')
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_account_activity(p_event);
$$;

revoke all on function public.record_account_activity(text) from public, anon;
grant execute on function public.record_account_activity(text) to authenticated;

-- Keep audit fields server-controlled even when an earlier baseline granted a
-- user broad UPDATE access to their own profile. Calls made inside a privileged
-- private routine retain the routine owner's current_user and are allowed.
create or replace function private.protect_profile_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not private.is_platform_manager() then
    new.account_number := old.account_number;
    new.meaningful_activity_at := old.meaningful_activity_at;
    new.last_active_at := old.last_active_at;
    new.account_audit_status := old.account_audit_status;
    new.inactive_flagged_at := old.inactive_flagged_at;
    new.audit_reviewed_at := old.audit_reviewed_at;
    new.audit_reviewed_by := old.audit_reviewed_by;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_profile_audit_fields() from public, anon, authenticated;

drop trigger if exists profiles_protect_account_audit_fields on public.profiles;
create trigger profiles_protect_account_audit_fields
before update of account_number, meaningful_activity_at, last_active_at,
  account_audit_status, inactive_flagged_at, audit_reviewed_at, audit_reviewed_by
on public.profiles
for each row execute function private.protect_profile_audit_fields();

-- Inactive/test accounts remain stored and owner-reviewable, but are hidden
-- from public and ordinary authenticated discovery surfaces.
drop policy if exists student_profiles_public_select on public.student_public_profiles;
create policy student_profiles_public_select
on public.student_public_profiles for select to anon
using (
  education_division = 'university'
  and visibility = 'public'
  and private.is_discoverable_account(user_id)
);

drop policy if exists student_profiles_authenticated_select on public.student_public_profiles;
create policy student_profiles_authenticated_select
on public.student_public_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_platform_manager()
  or (
    private.is_discoverable_account(user_id)
    and exists (
      select 1
      from public.student_education_paths sep
      where sep.user_id = (select auth.uid())
        and sep.current_division = student_public_profiles.education_division
    )
    and (
      visibility = 'public'
      or (visibility = 'class' and private.shares_course_with(user_id))
    )
  )
);

drop policy if exists directory_public_select on public.published_course_directory;
create policy directory_public_select
on public.published_course_directory for select to anon
using (is_listed and private.is_discoverable_account(professor_id));

drop policy if exists directory_authenticated_select on public.published_course_directory;
create policy directory_authenticated_select
on public.published_course_directory for select to authenticated
using (
  private.is_platform_manager()
  or private.can_manage_course(course_id)
  or (is_listed and private.is_discoverable_account(professor_id))
);

drop policy if exists student_groups_public_select on public.student_groups;
create policy student_groups_public_select
on public.student_groups for select to anon
using (
  education_division = 'university'
  and visibility = 'public'
  and private.is_discoverable_account(created_by)
);

drop policy if exists student_groups_authenticated_select on public.student_groups;
create policy student_groups_authenticated_select
on public.student_groups for select to authenticated
using (
  private.can_access_student_group(id)
  and (
    created_by = (select auth.uid())
    or private.is_platform_manager()
    or private.can_manage_student_group(id)
    or (course_id is not null and private.can_manage_course(course_id))
    or private.is_discoverable_account(created_by)
  )
);

drop policy if exists student_posts_public_select on public.student_posts;
create policy student_posts_public_select
on public.student_posts for select to anon
using (
  private.is_discoverable_account(author_id)
  and exists (
    select 1
    from public.student_groups g
    where g.id = student_posts.group_id
      and g.education_division = 'university'
      and g.visibility = 'public'
      and private.is_discoverable_account(g.created_by)
  )
);

drop policy if exists student_posts_authenticated_select on public.student_posts;
create policy student_posts_authenticated_select
on public.student_posts for select to authenticated
using (
  private.can_access_student_group(group_id)
  and (
    author_id = (select auth.uid())
    or private.is_platform_manager()
    or private.can_manage_student_group(group_id)
    or (
      private.is_discoverable_account(author_id)
      and exists (
        select 1
        from public.student_groups g
        where g.id = student_posts.group_id
          and private.is_discoverable_account(g.created_by)
      )
    )
  )
);

-- Post identity is immutable. Authors may move/edit only into groups they can
-- access; moderators may edit only inside groups they manage.
create or replace function private.preserve_student_post_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.author_id is distinct from old.author_id then
    raise exception 'A post author cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function private.preserve_student_post_author() from public, anon, authenticated;

drop trigger if exists student_posts_preserve_author on public.student_posts;
create trigger student_posts_preserve_author
before update on public.student_posts
for each row execute function private.preserve_student_post_author();

drop policy if exists student_posts_update on public.student_posts;
create policy student_posts_update
on public.student_posts for update to authenticated
using (
  author_id = (select auth.uid())
  or private.can_manage_student_group(group_id)
)
with check (
  (
    author_id = (select auth.uid())
    and private.can_access_student_group(group_id)
  )
  or private.can_manage_student_group(group_id)
);

drop policy if exists announcements_public_select on public.professor_announcements;
create policy announcements_public_select
on public.professor_announcements for select to anon
using (
  is_published
  and audience = 'public'
  and private.is_discoverable_account(professor_id)
);

drop policy if exists announcements_authenticated_select on public.professor_announcements;
create policy announcements_authenticated_select
on public.professor_announcements for select to authenticated
using (
  professor_id = (select auth.uid())
  or private.is_platform_manager()
  or (
    private.is_discoverable_account(professor_id)
    and (
      (is_published and audience = 'public')
      or (is_published and audience = 'course' and private.can_access_course(course_id))
      or (
        is_published and audience = 'institution'
        and exists (
          select 1
          from public.institution_memberships im
          where im.institution_id = professor_announcements.institution_id
            and im.user_id = (select auth.uid())
        )
      )
    )
  )
);

comment on function private.is_discoverable_account(uuid) is
  'Returns whether an account may appear in ordinary discovery; owner/admin audit access remains separate.';
comment on constraint student_grades_item_course_fk on public.student_grades is
  'Enforces same-course grade items for new/changed rows; validate after auditing historical rows.';
