-- Add a private, Early Prep-only teacher feedback loop and a private
-- completion milestone for the automatic Digital Literacy Class. These
-- objects do not alter University courses, course publications, publisher
-- listings, grades, or research records.

alter table public.student_account_notifications
  drop constraint if exists student_account_notifications_notification_type_check;
alter table public.student_account_notifications
  add constraint student_account_notifications_notification_type_check
  check (notification_type in (
    'enrollment_approved','course_assigned','course_completed','course_feedback',
    'marketplace_purchase','marketplace_rental','marketplace_refund',
    'marketplace_dispute','marketplace_access_ended'
  ));

create table private.digital_literacy_teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  student_id uuid not null,
  unit_id text not null,
  educator_id uuid not null references public.profiles(id) on delete restrict,
  feedback_text text not null check (char_length(btrim(feedback_text)) between 1 and 3000),
  acknowledged_at timestamptz,
  helpful boolean,
  created_at timestamptz not null default now(),
  foreign key (assignment_id, student_id)
    references public.digital_literacy_assignment_recipients(assignment_id, student_id) on delete cascade,
  foreign key (assignment_id, unit_id)
    references public.digital_literacy_assignment_units(assignment_id, unit_id) on delete cascade,
  check (acknowledged_at is not null or helpful is null)
);

create index digital_literacy_teacher_feedback_student_idx
  on private.digital_literacy_teacher_feedback(student_id, created_at desc);
create index digital_literacy_teacher_feedback_assignment_idx
  on private.digital_literacy_teacher_feedback(assignment_id, created_at desc);

create table private.digital_literacy_standard_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  release_id text not null references public.digital_literacy_catalog_releases(release_id) on delete restrict,
  badge_key text not null default 'digital-literacy-release-complete'
    check (badge_key='digital-literacy-release-complete'),
  title text not null default 'Digital Literacy Class Complete',
  description text not null default 'Completed all 40 units in the governed Digital Literacy Class release.',
  earned_at timestamptz not null default now(),
  unique (student_id, release_id)
);

create index digital_literacy_standard_badges_student_idx
  on private.digital_literacy_standard_badges(student_id, earned_at desc);

alter table private.digital_literacy_teacher_feedback enable row level security;
alter table private.digital_literacy_standard_badges enable row level security;
revoke all on private.digital_literacy_teacher_feedback from public, anon, authenticated;
revoke all on private.digital_literacy_standard_badges from public, anon, authenticated;

create policy digital_literacy_teacher_feedback_api_deny_all
on private.digital_literacy_teacher_feedback
for all to authenticated using (false) with check (false);

create policy digital_literacy_standard_badges_api_deny_all
on private.digital_literacy_standard_badges
for all to authenticated using (false) with check (false);

create or replace function public.record_digital_literacy_teacher_feedback(
  p_assignment_id uuid,
  p_student_id uuid,
  p_unit_id text,
  p_feedback_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_course_id uuid;
  v_feedback private.digital_literacy_teacher_feedback%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(coalesce(p_feedback_text,''))) not between 1 and 3000 then
    raise exception 'Feedback must contain between 1 and 3000 characters';
  end if;

  select assignment.course_id into v_course_id
  from public.assignments assignment
  join public.courses course on course.id=assignment.course_id
  join public.digital_literacy_assignment_recipients recipient
    on recipient.assignment_id=assignment.id and recipient.student_id=p_student_id
  join public.digital_literacy_assignment_units assignment_unit
    on assignment_unit.assignment_id=assignment.id and assignment_unit.unit_id=p_unit_id
  where assignment.id=p_assignment_id
    and assignment.settings->>'kind'='digital_literacy_course_units'
    and course.education_division='k12';

  if v_course_id is null or not private.can_manage_course(v_course_id) then
    raise exception 'Early Prep class management access required';
  end if;

  insert into private.digital_literacy_teacher_feedback (
    assignment_id,student_id,unit_id,educator_id,feedback_text
  ) values (
    p_assignment_id,p_student_id,p_unit_id,v_user_id,btrim(p_feedback_text)
  ) returning * into v_feedback;

  perform private.create_student_course_notification(
    p_student_id,
    v_course_id,
    'course_feedback',
    'Digital Literacy feedback ready',
    'Feedback is ready for '||upper(p_unit_id)||'. Open the assignment to review and acknowledge it.',
    'course',
    'digital-literacy-feedback:'||v_feedback.id::text
  );

  insert into public.audit_events (
    actor_id,course_id,assignment_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_course_id,p_assignment_id,'digital_literacy.feedback_recorded',
    'digital_literacy_teacher_feedback',v_feedback.id::text,
    jsonb_build_object('student_id',p_student_id,'unit_id',p_unit_id,'feedback_length',char_length(v_feedback.feedback_text)),''
  );

  return jsonb_build_object(
    'id',v_feedback.id,
    'assignment_id',v_feedback.assignment_id,
    'student_id',v_feedback.student_id,
    'unit_id',v_feedback.unit_id,
    'feedback_text',v_feedback.feedback_text,
    'acknowledged_at',v_feedback.acknowledged_at,
    'helpful',v_feedback.helpful,
    'created_at',v_feedback.created_at
  );
end;
$$;

create or replace function public.get_digital_literacy_course_feedback(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_course(p_course_id) or not exists (
    select 1 from public.courses course
    where course.id=p_course_id and course.education_division='k12'
  ) then raise exception 'Early Prep class management access required'; end if;

  return jsonb_build_object('feedback',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',feedback.id,
      'assignment_id',feedback.assignment_id,
      'student_id',feedback.student_id,
      'unit_id',feedback.unit_id,
      'feedback_text',feedback.feedback_text,
      'acknowledged_at',feedback.acknowledged_at,
      'helpful',feedback.helpful,
      'created_at',feedback.created_at
    ) order by feedback.created_at desc),'[]'::jsonb)
    from private.digital_literacy_teacher_feedback feedback
    join public.assignments assignment on assignment.id=feedback.assignment_id
    where assignment.course_id=p_course_id
  ));
end;
$$;

create or replace function public.get_my_digital_literacy_feedback()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('feedback',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',feedback.id,
      'assignment_id',feedback.assignment_id,
      'unit_id',feedback.unit_id,
      'feedback_text',feedback.feedback_text,
      'acknowledged_at',feedback.acknowledged_at,
      'helpful',feedback.helpful,
      'created_at',feedback.created_at
    ) order by feedback.created_at desc),'[]'::jsonb)
    from private.digital_literacy_teacher_feedback feedback
    join public.assignments assignment on assignment.id=feedback.assignment_id
    join public.courses course on course.id=assignment.course_id
    where feedback.student_id=v_user_id and course.education_division='k12'
  ));
end;
$$;

create or replace function public.acknowledge_digital_literacy_teacher_feedback(
  p_feedback_id uuid,
  p_helpful boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_feedback private.digital_literacy_teacher_feedback%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  update private.digital_literacy_teacher_feedback feedback
  set acknowledged_at=coalesce(feedback.acknowledged_at,now()),
      helpful=coalesce(p_helpful,feedback.helpful)
  where feedback.id=p_feedback_id and feedback.student_id=v_user_id
  returning * into v_feedback;
  if not found then raise exception 'Digital Literacy feedback is not available to this student'; end if;

  insert into public.audit_events (
    actor_id,assignment_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_feedback.assignment_id,'digital_literacy.feedback_acknowledged',
    'digital_literacy_teacher_feedback',v_feedback.id::text,
    jsonb_strip_nulls(jsonb_build_object('unit_id',v_feedback.unit_id,'helpful',p_helpful)),''
  );

  return jsonb_build_object(
    'id',v_feedback.id,
    'acknowledged_at',v_feedback.acknowledged_at,
    'helpful',v_feedback.helpful
  );
end;
$$;

create or replace function private.issue_early_prep_digital_literacy_badge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_badge_id uuid;
  v_unit_count integer;
begin
  if not exists (
    select 1 from public.student_education_paths path
    where path.user_id=new.student_id and path.current_division='k12'
  ) then return new; end if;

  select release.unit_count into v_unit_count
  from public.digital_literacy_catalog_releases release
  where release.release_id=new.release_id
    and release.course_key='brexatlas.digital-literacy-course';
  if v_unit_count is null or (
    select count(*) from private.digital_literacy_standard_progress progress
    where progress.student_id=new.student_id and progress.release_id=new.release_id
  )<>v_unit_count then return new; end if;

  insert into private.digital_literacy_standard_badges(student_id,release_id)
  values (new.student_id,new.release_id)
  on conflict (student_id,release_id) do nothing
  returning id into v_badge_id;
  if v_badge_id is null then return new; end if;

  perform private.create_student_course_notification(
    new.student_id,null,'course_completed','Digital Literacy Class milestone earned',
    'You completed all 40 units in this Digital Literacy Class release. Your private milestone is ready.',
    'rewards','digital-literacy-standard-badge:'||new.release_id
  );

  insert into public.audit_events (
    actor_id,event_type,target_type,target_id,details,event_hash
  ) values (
    new.student_id,'digital_literacy.standard_badge_issued',
    'digital_literacy_standard_badge',v_badge_id::text,
    jsonb_build_object('release_id',new.release_id,'unit_count',v_unit_count),''
  );
  return new;
end;
$$;

drop trigger if exists digital_literacy_progress_issue_early_prep_badge
on private.digital_literacy_standard_progress;
create trigger digital_literacy_progress_issue_early_prep_badge
after insert or update on private.digital_literacy_standard_progress
for each row execute function private.issue_early_prep_digital_literacy_badge();

create or replace function public.get_my_digital_literacy_standard_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('badges',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',badge.id,
      'release_id',badge.release_id,
      'badge_key',badge.badge_key,
      'title',badge.title,
      'description',badge.description,
      'earned_at',badge.earned_at
    ) order by badge.earned_at desc),'[]'::jsonb)
    from private.digital_literacy_standard_badges badge
    where badge.student_id=v_user_id
  ));
end;
$$;

revoke all on function public.record_digital_literacy_teacher_feedback(uuid,uuid,text,text) from public,anon;
revoke all on function public.get_digital_literacy_course_feedback(uuid) from public,anon;
revoke all on function public.get_my_digital_literacy_feedback() from public,anon;
revoke all on function public.acknowledge_digital_literacy_teacher_feedback(uuid,boolean) from public,anon;
revoke all on function public.get_my_digital_literacy_standard_badges() from public,anon;
revoke all on function private.issue_early_prep_digital_literacy_badge() from public,anon,authenticated;
grant execute on function public.record_digital_literacy_teacher_feedback(uuid,uuid,text,text) to authenticated;
grant execute on function public.get_digital_literacy_course_feedback(uuid) to authenticated;
grant execute on function public.get_my_digital_literacy_feedback() to authenticated;
grant execute on function public.acknowledge_digital_literacy_teacher_feedback(uuid,boolean) to authenticated;
grant execute on function public.get_my_digital_literacy_standard_badges() to authenticated;

comment on table private.digital_literacy_teacher_feedback is
  'Append-only Early Prep teacher feedback for assigned canonical Digital Literacy units. Read and acknowledgement access is RPC-scoped; message bodies never enter notifications or audit details.';
comment on table private.digital_literacy_standard_badges is
  'Private Early Prep milestone issued once per student and canonical release after all release units are complete. Separate from University course completion badges and publishing.';
