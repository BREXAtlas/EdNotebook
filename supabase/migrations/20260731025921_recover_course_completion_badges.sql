create or replace function private.award_completed_course_badge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_directory public.published_course_directory%rowtype;
begin
  if new.status<>'completed' then
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

revoke all on function private.award_completed_course_badge()
from public,anon,authenticated;

insert into public.course_completion_badges (
  course_id,
  publication_id,
  student_id,
  badge_name,
  badge_description,
  earned_at
)
select
  progress.course_id,
  progress.publication_id,
  progress.user_id,
  directory.completion_badge_name,
  directory.completion_badge_description,
  coalesce(progress.completed_at,progress.updated_at,now())
from public.course_progress progress
join public.published_course_directory directory
  on directory.course_id=progress.course_id
where progress.status='completed'
on conflict (course_id,student_id) do nothing;

insert into public.student_account_notifications (
  student_id,
  course_id,
  notification_type,
  title,
  body,
  route,
  dedupe_key,
  created_at
)
select
  progress.user_id,
  progress.course_id,
  'course_completed',
  left('Course completed · ' || directory.course_code,160),
  left(
    'You earned the ' || directory.completion_badge_name || ' badge.',
    600
  ),
  'rewards',
  left('course-completed:' || progress.course_id::text,240),
  coalesce(progress.completed_at,progress.updated_at,now())
from public.course_progress progress
join public.published_course_directory directory
  on directory.course_id=progress.course_id
where progress.status='completed'
on conflict (student_id,dedupe_key) do nothing;
