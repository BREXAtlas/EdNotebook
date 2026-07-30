-- Academic writing documents and professor feedback.
-- Student-created documents remain append-only learning records. Assignment
-- feedback is course-scoped, anchored to a submitted document, and invisible
-- to the student until the professor publishes the review.

alter table public.student_learning_records
  drop constraint if exists student_learning_records_record_kind_check;

alter table public.student_learning_records
  add constraint student_learning_records_record_kind_check
  check (record_kind in ('note', 'source', 'feedback', 'document'));

alter table public.assignment_form_submissions
  add column if not exists review_state text not null default 'not_reviewed'
    check (review_state in ('not_reviewed', 'in_review', 'feedback_ready', 'graded')),
  add column if not exists grade_label text
    check (grade_label is null or char_length(grade_label) <= 40),
  add column if not exists feedback_published_at timestamptz,
  add column if not exists graded_at timestamptz;

create table if not exists public.assignment_document_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.assignment_form_submissions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null default 'comment'
    check (feedback_type in ('comment', 'question')),
  selected_text text not null default ''
    check (char_length(selected_text) <= 5000),
  comment text not null check (char_length(comment) between 1 and 20000),
  is_highlight boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignment_document_feedback_submission_idx
  on public.assignment_document_feedback (submission_id, created_at);

create index if not exists assignment_document_feedback_student_published_idx
  on public.assignment_document_feedback (student_id, published_at desc)
  where published_at is not null;

create or replace function private.prepare_assignment_document_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_course_id uuid;
  submission_student_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select submission.course_id, submission.student_id
    into submission_course_id, submission_student_id
  from public.assignment_form_submissions as submission
  where submission.id = new.submission_id;

  if not found then
    raise exception 'Assignment submission was not found';
  end if;

  if not private.can_manage_course(submission_course_id) then
    raise exception 'Only a course educator can review this document';
  end if;

  new.course_id := submission_course_id;
  new.student_id := submission_student_id;
  if tg_op = 'INSERT' then
    new.professor_id := current_user_id;
  else
    new.professor_id := old.professor_id;
    if new.submission_id <> old.submission_id then
      raise exception 'Feedback cannot move to another submission';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_assignment_document_feedback() from public;

drop trigger if exists assignment_document_feedback_prepare
  on public.assignment_document_feedback;
create trigger assignment_document_feedback_prepare
before insert or update on public.assignment_document_feedback
for each row execute function private.prepare_assignment_document_feedback();

drop trigger if exists assignment_document_feedback_touch_updated_at
  on public.assignment_document_feedback;
create trigger assignment_document_feedback_touch_updated_at
before update on public.assignment_document_feedback
for each row execute function private.touch_updated_at();

alter table public.assignment_document_feedback enable row level security;

drop policy if exists assignment_document_feedback_select
  on public.assignment_document_feedback;
create policy assignment_document_feedback_select
on public.assignment_document_feedback for select to authenticated
using (
  private.can_manage_course(course_id)
  or (
    student_id = (select auth.uid())
    and published_at is not null
  )
);

drop policy if exists assignment_document_feedback_insert
  on public.assignment_document_feedback;
create policy assignment_document_feedback_insert
on public.assignment_document_feedback for insert to authenticated
with check (
  professor_id = (select auth.uid())
  and private.can_manage_course(course_id)
);

drop policy if exists assignment_document_feedback_update
  on public.assignment_document_feedback;
create policy assignment_document_feedback_update
on public.assignment_document_feedback for update to authenticated
using (private.can_manage_course(course_id))
with check (private.can_manage_course(course_id));

drop policy if exists assignment_document_feedback_delete
  on public.assignment_document_feedback;
create policy assignment_document_feedback_delete
on public.assignment_document_feedback for delete to authenticated
using (
  private.can_manage_course(course_id)
  and published_at is null
);

revoke all on table public.assignment_document_feedback from anon, authenticated;
grant select, insert, update, delete
  on table public.assignment_document_feedback to authenticated;

comment on table public.assignment_document_feedback is
  'Professor comments and questions anchored to student assignment text; student visibility begins only when published.';

comment on column public.assignment_form_submissions.review_state is
  'Professor-owned review lifecycle used for feedback and graded notifications.';

create or replace function public.publish_assignment_document_review(
  p_submission_id uuid,
  p_feedback_ids uuid[],
  p_graded boolean,
  p_grade_label text
)
returns public.assignment_form_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_course_id uuid;
  published_at_value timestamptz := now();
  result_row public.assignment_form_submissions;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  select submission.course_id
    into submission_course_id
  from public.assignment_form_submissions as submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Assignment submission was not found';
  end if;

  if not private.can_manage_course(submission_course_id) then
    raise exception 'Only a course educator can publish this review';
  end if;

  if p_graded and (
    p_grade_label is null
    or char_length(trim(p_grade_label)) < 1
    or char_length(trim(p_grade_label)) > 40
  ) then
    raise exception 'A grade label between 1 and 40 characters is required';
  end if;

  update public.assignment_document_feedback
  set published_at = coalesce(published_at, published_at_value)
  where submission_id = p_submission_id
    and id = any(coalesce(p_feedback_ids, '{}'::uuid[]));

  update public.assignment_form_submissions
  set status = 'returned',
      review_state = case when p_graded then 'graded' else 'feedback_ready' end,
      grade_label = case when p_graded then trim(p_grade_label) else null end,
      feedback_published_at = published_at_value,
      graded_at = case when p_graded then published_at_value else null end
  where id = p_submission_id
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.publish_assignment_document_review(
  uuid, uuid[], boolean, text
) from public, anon;
grant execute on function public.publish_assignment_document_review(
  uuid, uuid[], boolean, text
) to authenticated;

create or replace function private.prepare_assignment_form_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_course_id uuid;
  template_status text;
  current_user_id uuid := (select auth.uid());
  manages_course boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select template.course_id, template.status
    into template_course_id, template_status
  from public.assignment_form_templates as template
  where template.id = new.template_id;

  if not found then
    raise exception 'Assignment template was not found';
  end if;

  manages_course := private.can_manage_course(template_course_id);
  new.course_id := template_course_id;

  if tg_op = 'UPDATE' then
    if new.template_id <> old.template_id or new.student_id <> old.student_id then
      raise exception 'Submission ownership cannot be changed';
    end if;
    if not manages_course then
      new.review_state := old.review_state;
      new.grade_label := old.grade_label;
      new.feedback_published_at := old.feedback_published_at;
      new.graded_at := old.graded_at;
    end if;
  elsif new.student_id <> current_user_id and not manages_course then
    raise exception 'A student can only create their own submission';
  end if;

  if new.student_id <> current_user_id and not manages_course then
    raise exception 'Submission access denied';
  end if;

  if not manages_course and template_status <> 'published' then
    raise exception 'This assignment is not available';
  end if;

  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at := now();
  elsif new.status = 'draft' then
    new.submitted_at := null;
  end if;

  return new;
end;
$$;
