-- In-app assignment templates and student writing drafts.
-- Templates are class-scoped. Student responses remain private to the student
-- and educators who can manage that class.

create table public.assignment_form_templates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  instructions text not null default '' check (char_length(instructions) <= 20000),
  sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) between 1 and 50),
  editor_config jsonb not null default '{"full_page_editor":true,"spellcheck":true,"allow_word_export":true,"allow_pdf_export":true}'::jsonb
    check (jsonb_typeof(editor_config) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignment_form_submissions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.assignment_form_templates(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  document_content text not null default '' check (char_length(document_content) <= 1000000),
  word_count integer not null default 0 check (word_count between 0 and 250000),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, student_id)
);

create index assignment_form_templates_course_status_idx
  on public.assignment_form_templates (course_id, status, updated_at desc);
create index assignment_form_templates_assignment_idx
  on public.assignment_form_templates (assignment_id)
  where assignment_id is not null;
create index assignment_form_submissions_student_idx
  on public.assignment_form_submissions (student_id, updated_at desc);
create index assignment_form_submissions_course_idx
  on public.assignment_form_submissions (course_id, status, updated_at desc);

create or replace function private.prepare_assignment_form_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;

  return new;
end;
$$;

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

  new.course_id := template_course_id;

  if tg_op = 'UPDATE' then
    if new.template_id <> old.template_id or new.student_id <> old.student_id then
      raise exception 'Submission ownership cannot be changed';
    end if;
  elsif new.student_id <> current_user_id and not private.can_manage_course(template_course_id) then
    raise exception 'A student can only create their own submission';
  end if;

  if new.student_id <> current_user_id and not private.can_manage_course(template_course_id) then
    raise exception 'Submission access denied';
  end if;

  if not private.can_manage_course(template_course_id) and template_status <> 'published' then
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

revoke all on function private.prepare_assignment_form_template() from public;
revoke all on function private.prepare_assignment_form_submission() from public;

create trigger assignment_form_templates_prepare
before insert or update on public.assignment_form_templates
for each row execute function private.prepare_assignment_form_template();

create trigger assignment_form_templates_touch_updated_at
before update on public.assignment_form_templates
for each row execute function private.touch_updated_at();

create trigger assignment_form_submissions_prepare
before insert or update on public.assignment_form_submissions
for each row execute function private.prepare_assignment_form_submission();

create trigger assignment_form_submissions_touch_updated_at
before update on public.assignment_form_submissions
for each row execute function private.touch_updated_at();

alter table public.assignment_form_templates enable row level security;
alter table public.assignment_form_submissions enable row level security;

create policy assignment_form_templates_select
on public.assignment_form_templates for select to authenticated
using (
  private.can_manage_course(course_id)
  or (status = 'published' and private.can_access_course(course_id))
);

create policy assignment_form_templates_insert
on public.assignment_form_templates for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_manage_course(course_id)
);

create policy assignment_form_templates_update
on public.assignment_form_templates for update to authenticated
using (private.can_manage_course(course_id))
with check (private.can_manage_course(course_id));

create policy assignment_form_templates_delete
on public.assignment_form_templates for delete to authenticated
using (private.can_manage_course(course_id));

create policy assignment_form_submissions_select
on public.assignment_form_submissions for select to authenticated
using (
  student_id = (select auth.uid())
  or private.can_manage_course(course_id)
);

create policy assignment_form_submissions_insert
on public.assignment_form_submissions for insert to authenticated
with check (
  (student_id = (select auth.uid()) and private.can_access_course(course_id))
  or private.can_manage_course(course_id)
);

create policy assignment_form_submissions_update
on public.assignment_form_submissions for update to authenticated
using (
  (student_id = (select auth.uid()) and private.can_access_course(course_id))
  or private.can_manage_course(course_id)
)
with check (
  (student_id = (select auth.uid()) and private.can_access_course(course_id))
  or private.can_manage_course(course_id)
);

create policy assignment_form_submissions_delete
on public.assignment_form_submissions for delete to authenticated
using (
  (student_id = (select auth.uid()) and status = 'draft')
  or private.can_manage_course(course_id)
);

revoke all on table public.assignment_form_templates from anon;
revoke all on table public.assignment_form_submissions from anon;
grant select, insert, update, delete on table public.assignment_form_templates to authenticated;
grant select, insert, update, delete on table public.assignment_form_submissions to authenticated;

comment on table public.assignment_form_templates is
  'Professor-authored, class-scoped guided assignment forms and writing-editor settings.';
comment on table public.assignment_form_submissions is
  'Private student responses and in-app writing drafts for assignment form templates.';
