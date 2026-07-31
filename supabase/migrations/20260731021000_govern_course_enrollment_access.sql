-- Governed published-course access, student enrollment notices, and durable
-- completion recognition. Existing course memberships remain authoritative.

alter table public.published_course_directory
  add column if not exists enrollment_policy text not null default 'approval_required'
    check (enrollment_policy in ('approval_required','open_self_enroll')),
  add column if not exists universal_assignment boolean not null default false,
  add column if not exists completion_badge_name text,
  add column if not exists completion_badge_description text;

update public.published_course_directory
set completion_badge_name = coalesce(
      nullif(trim(completion_badge_name),''),
      left('Completed · ' || title, 120)
    ),
    completion_badge_description = coalesce(
      nullif(trim(completion_badge_description),''),
      left('Recognizes completion of ' || title || ' in EdNotebook.', 300)
    );

alter table public.published_course_directory
  alter column completion_badge_name set not null,
  alter column completion_badge_description set not null;

alter table public.published_course_directory
  drop constraint if exists published_course_directory_universal_open_check;
alter table public.published_course_directory
  add constraint published_course_directory_universal_open_check
  check (not universal_assignment or enrollment_policy='open_self_enroll');

create table public.student_account_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  notification_type text not null
    check (notification_type in ('enrollment_approved','course_assigned','course_completed')),
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null default '' check (char_length(body) <= 600),
  route text not null default 'classes'
    check (route in ('classes','course','rewards')),
  dedupe_key text not null check (char_length(trim(dedupe_key)) between 2 and 240),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id,dedupe_key)
);

create table public.course_completion_badges (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  publication_id uuid not null references public.course_publications(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  badge_name text not null check (char_length(trim(badge_name)) between 2 and 120),
  badge_description text not null check (char_length(trim(badge_description)) between 10 and 300),
  earned_at timestamptz not null default now(),
  unique (course_id,student_id)
);

create index student_account_notifications_unread_idx
  on public.student_account_notifications (student_id,created_at desc)
  where read_at is null;
create index course_completion_badges_student_idx
  on public.course_completion_badges (student_id,earned_at desc);

alter table public.student_account_notifications enable row level security;
alter table public.course_completion_badges enable row level security;

revoke all on public.student_account_notifications from anon;
revoke all on public.course_completion_badges from anon;
revoke insert,update,delete on public.student_account_notifications from authenticated;
revoke insert,update,delete on public.course_completion_badges from authenticated;
grant select on public.student_account_notifications to authenticated;
grant select on public.course_completion_badges to authenticated;

create policy student_account_notifications_select
on public.student_account_notifications
for select
to authenticated
using (student_id=(select auth.uid()));

create policy course_completion_badges_select
on public.course_completion_badges
for select
to authenticated
using (
  student_id=(select auth.uid())
  or private.can_manage_course(course_id)
);

create or replace function private.create_student_course_notification(
  p_student_id uuid,
  p_course_id uuid,
  p_notification_type text,
  p_title text,
  p_body text,
  p_route text,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_account_notifications (
    student_id,course_id,notification_type,title,body,route,dedupe_key
  ) values (
    p_student_id,
    p_course_id,
    p_notification_type,
    left(trim(p_title),160),
    left(coalesce(p_body,''),600),
    p_route,
    left(trim(p_dedupe_key),240)
  )
  on conflict (student_id,dedupe_key) do nothing;
end;
$$;

create or replace function private.assign_universal_courses(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course record;
begin
  if not exists (
    select 1
    from public.profiles profile
    join public.student_education_paths path on path.user_id=profile.id
    where profile.id=p_student_id
      and profile.role='learner'
      and path.current_division in ('university','k12')
  ) then
    return;
  end if;

  for v_course in
    select
      directory.course_id,
      directory.professor_id,
      directory.course_code,
      directory.title
    from public.published_course_directory directory
    join public.courses course on course.id=directory.course_id
    join public.student_education_paths path on path.user_id=p_student_id
    where directory.is_listed
      and directory.enrollment_open
      and directory.universal_assignment
      and directory.enrollment_policy='open_self_enroll'
      and course.status='published'
      and course.education_division=path.current_division
      and (
        (
          course.institution_id is null
          and course.access_scope in ('public_free','independent')
        )
        or private.has_active_institution_affiliation(
          p_student_id,
          course.institution_id,
          'student'
        )
      )
  loop
    -- A signup/affiliation trigger may run without an end-user JWT. In that
    -- path, course membership is the authoritative assignment record. Create
    -- an approved request row only when the current actor is the student or a
    -- course manager so the existing enrollment-request guard remains intact.
    if (select auth.uid())=p_student_id
       or private.can_manage_course(v_course.course_id) then
      insert into public.student_enrollment_requests (
        course_id,student_id,status
      ) values (
        v_course.course_id,p_student_id,'pending'
      )
      on conflict (course_id,student_id) do nothing;

      update public.student_enrollment_requests
      set status='approved',
          approved_by=v_course.professor_id,
          decided_at=coalesce(decided_at,now())
      where course_id=v_course.course_id
        and student_id=p_student_id
        and status<>'approved';
    end if;

    insert into public.course_memberships (course_id,user_id,role)
    values (v_course.course_id,p_student_id,'learner')
    on conflict (course_id,user_id) do update set role='learner';

    perform private.create_student_course_notification(
      p_student_id,
      v_course.course_id,
      'course_assigned',
      'New course added · ' || v_course.course_code,
      v_course.title || ' is ready in your class library.',
      'course',
      'course-assigned:' || v_course.course_id::text
    );
  end loop;
end;
$$;

create or replace function public.request_or_join_published_course(p_course_id uuid)
returns table (
  request_id uuid,
  status text,
  enrollment_policy text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_directory public.published_course_directory%rowtype;
  v_course public.courses%rowtype;
  v_request public.student_enrollment_requests%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id=(select auth.uid()) and role='learner'
  ) then
    raise exception 'A student account is required';
  end if;

  select * into v_directory
  from public.published_course_directory
  where course_id=p_course_id
  for update;
  select * into v_course
  from public.courses
  where id=p_course_id;

  if v_directory.course_id is null
     or v_course.id is null
     or not v_directory.is_listed
     or not v_directory.enrollment_open
     or v_course.status<>'published' then
    raise exception 'This published course is not open for enrollment';
  end if;
  if not private.can_join_course((select auth.uid()),p_course_id) then
    raise exception 'Your approved institution does not match this course';
  end if;
  if v_course.institution_id is not null
     and not private.has_active_institution_affiliation(
       (select auth.uid()),v_course.institution_id,'student'
     ) then
    raise exception 'Your approved institution does not match this course';
  end if;

  insert into public.student_enrollment_requests (
    course_id,student_id,status
  ) values (
    p_course_id,(select auth.uid()),'pending'
  )
  on conflict (course_id,student_id) do nothing;

  if v_directory.enrollment_policy='open_self_enroll' then
    update public.student_enrollment_requests request
    set status='approved',
        approved_by=v_directory.professor_id,
        decided_at=coalesce(decided_at,now())
    where request.course_id=p_course_id
      and request.student_id=(select auth.uid())
      and request.status<>'approved';

    insert into public.course_memberships (course_id,user_id,role)
    values (p_course_id,(select auth.uid()),'learner')
    on conflict (course_id,user_id) do update set role='learner';

    perform private.create_student_course_notification(
      (select auth.uid()),
      p_course_id,
      'enrollment_approved',
      'Enrollment confirmed · ' || v_directory.course_code,
      v_directory.title || ' is ready in your class library.',
      'course',
      'enrollment-approved:' || p_course_id::text
    );
  else
    update public.student_enrollment_requests request
    set status='pending',approved_by=null,decided_at=null
    where request.course_id=p_course_id
      and request.student_id=(select auth.uid())
      and request.status='rejected';
  end if;

  select * into v_request
  from public.student_enrollment_requests
  where course_id=p_course_id
    and student_id=(select auth.uid());

  return query
  select v_request.id,v_request.status,v_directory.enrollment_policy;
end;
$$;

create or replace function public.approve_student_enrollment(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.student_enrollment_requests%rowtype;
  v_course public.courses%rowtype;
  v_directory public.published_course_directory%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_request
  from public.student_enrollment_requests
  where id=p_request_id
  for update;
  if not found or v_request.status<>'pending' or not private.can_manage_course(v_request.course_id) then
    raise exception 'Pending enrollment request not found or not manageable';
  end if;
  select * into v_course from public.courses where id=v_request.course_id;
  select * into v_directory from public.published_course_directory where course_id=v_request.course_id;
  if v_course.institution_id is not null
     and not private.has_active_institution_affiliation(
       v_request.student_id,v_course.institution_id,'student'
     ) then
    raise exception 'The learner does not have an active student affiliation for this institution';
  end if;

  update public.student_enrollment_requests
  set status='approved',approved_by=(select auth.uid()),decided_at=now()
  where id=p_request_id;

  if v_request.roster_entry_id is not null then
    update public.student_roster_entries
    set matched_user_id=v_request.student_id,match_status='approved',updated_at=now()
    where id=v_request.roster_entry_id;
  end if;

  insert into public.course_memberships (course_id,user_id,role)
  values (v_request.course_id,v_request.student_id,'learner')
  on conflict (course_id,user_id) do update set role='learner';

  perform private.create_student_course_notification(
    v_request.student_id,
    v_request.course_id,
    'enrollment_approved',
    'Enrollment approved · ' || coalesce(v_directory.course_code,'CLASS'),
    coalesce(v_directory.title,v_course.title) || ' is ready in your class library.',
    'course',
    'enrollment-approved:' || v_request.course_id::text
  );

  insert into public.audit_events (
    actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash
  ) values (
    (select auth.uid()),
    v_course.institution_id,
    v_course.id,
    'course.enrollment_approved',
    'profile',
    v_request.student_id::text,
    jsonb_build_object('institution_checked',true,'request_id',p_request_id),
    ''
  );
end;
$$;

create or replace function public.set_published_course_enrollment(
  p_course_id uuid,
  p_enrollment_policy text,
  p_universal_assignment boolean default false,
  p_badge_name text default null,
  p_badge_description text default null
)
returns public.published_course_directory
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_directory public.published_course_directory%rowtype;
  v_student record;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then
    raise exception 'Course access denied';
  end if;
  if p_enrollment_policy not in ('approval_required','open_self_enroll') then
    raise exception 'Choose professor approval or open enrollment';
  end if;
  if coalesce(p_universal_assignment,false)
     and p_enrollment_policy<>'open_self_enroll' then
    raise exception 'A universal course must use open enrollment';
  end if;

  update public.published_course_directory
  set enrollment_policy=p_enrollment_policy,
      universal_assignment=coalesce(p_universal_assignment,false),
      completion_badge_name=coalesce(
        nullif(trim(p_badge_name),''),
        completion_badge_name
      ),
      completion_badge_description=coalesce(
        nullif(trim(p_badge_description),''),
        completion_badge_description
      ),
      updated_at=now()
  where course_id=p_course_id
  returning * into v_directory;

  if not found then raise exception 'Published course listing not found'; end if;

  if p_enrollment_policy='open_self_enroll' then
    for v_student in
      select request.id,request.student_id
      from public.student_enrollment_requests request
      join public.courses course on course.id=request.course_id
      where request.course_id=p_course_id
        and request.status='pending'
        and (
          course.institution_id is null
          or private.has_active_institution_affiliation(
            request.student_id,course.institution_id,'student'
          )
        )
    loop
      update public.student_enrollment_requests
      set status='approved',approved_by=(select auth.uid()),decided_at=now()
      where id=v_student.id;
      insert into public.course_memberships (course_id,user_id,role)
      values (p_course_id,v_student.student_id,'learner')
      on conflict (course_id,user_id) do update set role='learner';
      perform private.create_student_course_notification(
        v_student.student_id,
        p_course_id,
        'enrollment_approved',
        'Enrollment approved · ' || v_directory.course_code,
        v_directory.title || ' is ready in your class library.',
        'course',
        'enrollment-approved:' || p_course_id::text
      );
    end loop;
  end if;

  if coalesce(p_universal_assignment,false) then
    for v_student in
      select path.user_id
      from public.student_education_paths path
      join public.profiles profile on profile.id=path.user_id and profile.role='learner'
      where path.current_division=v_directory.education_division
    loop
      perform private.assign_universal_courses(v_student.user_id);
    end loop;
  end if;

  return v_directory;
end;
$$;

create or replace function public.mark_student_account_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.student_account_notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id
    and student_id=(select auth.uid());
  if not found then raise exception 'Notification not found'; end if;
end;
$$;

create or replace function private.award_completed_course_badge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_directory public.published_course_directory%rowtype;
begin
  if new.status<>'completed'
     or (tg_op='UPDATE' and old.status='completed') then
    return new;
  end if;

  select * into v_directory
  from public.published_course_directory
  where course_id=new.course_id;
  if not found then return new; end if;

  insert into public.course_completion_badges (
    course_id,publication_id,student_id,badge_name,badge_description,earned_at
  ) values (
    new.course_id,
    new.publication_id,
    new.user_id,
    v_directory.completion_badge_name,
    v_directory.completion_badge_description,
    coalesce(new.completed_at,now())
  )
  on conflict (course_id,student_id) do nothing;

  perform private.create_student_course_notification(
    new.user_id,
    new.course_id,
    'course_completed',
    'Course completed · ' || v_directory.course_code,
    'You earned the ' || v_directory.completion_badge_name || ' badge.',
    'rewards',
    'course-completed:' || new.course_id::text
  );
  return new;
end;
$$;

create or replace function private.assign_universal_courses_from_affiliation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pathway='student' and new.status in ('active','independent') then
    perform private.assign_universal_courses(new.user_id);
  end if;
  return new;
end;
$$;

create or replace function private.assign_universal_courses_from_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assign_universal_courses(new.user_id);
  return new;
end;
$$;

drop trigger if exists course_completion_badge_award on public.course_progress;
create trigger course_completion_badge_award
after insert or update of status on public.course_progress
for each row execute function private.award_completed_course_badge();

drop trigger if exists universal_courses_affiliation_assignment
on public.institution_affiliations;
create trigger universal_courses_affiliation_assignment
after insert or update of status,institution_id,pathway
on public.institution_affiliations
for each row execute function private.assign_universal_courses_from_affiliation();

drop trigger if exists universal_courses_student_path_assignment
on public.student_education_paths;
create trigger universal_courses_student_path_assignment
after insert or update of current_division
on public.student_education_paths
for each row execute function private.assign_universal_courses_from_path();

revoke all on function private.create_student_course_notification(uuid,uuid,text,text,text,text,text) from public;
revoke all on function private.assign_universal_courses(uuid) from public;
revoke all on function private.award_completed_course_badge() from public;
revoke all on function private.assign_universal_courses_from_affiliation() from public;
revoke all on function private.assign_universal_courses_from_path() from public;

revoke all on function public.request_or_join_published_course(uuid) from public,anon;
revoke all on function public.approve_student_enrollment(uuid) from public,anon;
revoke all on function public.set_published_course_enrollment(uuid,text,boolean,text,text) from public,anon;
revoke all on function public.mark_student_account_notification_read(uuid) from public,anon;
grant execute on function public.request_or_join_published_course(uuid) to authenticated;
grant execute on function public.approve_student_enrollment(uuid) to authenticated;
grant execute on function public.set_published_course_enrollment(uuid,text,boolean,text,text) to authenticated;
grant execute on function public.mark_student_account_notification_read(uuid) to authenticated;

insert into public.institution_directory_entries (
  directory_key,canonical_name,parent_directory_key,entity_type,education_division,
  system_name,city,region_code,country_code,website_url,academic_domain,
  directory_status,is_selectable,is_public
) values
  ('texas-southern-university','Texas Southern University',null,'university','university',null,'Houston','TX','US','https://www.tsu.edu','tsu.edu','listed',true,true),
  ('baylor-university','Baylor University',null,'university','university',null,'Waco','TX','US','https://www.baylor.edu','baylor.edu','listed',true,true),
  ('rice-university','Rice University',null,'university','university',null,'Houston','TX','US','https://www.rice.edu','rice.edu','listed',true,true),
  ('southern-methodist-university','Southern Methodist University',null,'university','university',null,'Dallas','TX','US','https://www.smu.edu','smu.edu','listed',true,true),
  ('texas-christian-university','Texas Christian University',null,'university','university',null,'Fort Worth','TX','US','https://www.tcu.edu','tcu.edu','listed',true,true)
on conflict (directory_key) do update
set canonical_name=excluded.canonical_name,
    city=excluded.city,
    website_url=excluded.website_url,
    academic_domain=excluded.academic_domain,
    directory_status=excluded.directory_status,
    is_selectable=true,
    is_public=true,
    updated_at=now();

insert into public.institution_directory_aliases (directory_key,alias_name) values
  ('texas-southern-university','TSU'),
  ('baylor-university','Baylor'),
  ('southern-methodist-university','SMU'),
  ('texas-christian-university','TCU')
on conflict (directory_key,normalized_alias) do nothing;
