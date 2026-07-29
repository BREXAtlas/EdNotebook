-- Student-owned, append-only learning records.
-- Device-first operation does not depend on this table; it enables optional signed-in sync.
create table if not exists public.student_learning_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null check (char_length(record_id) between 1 and 128),
  root_id text not null check (char_length(root_id) between 1 and 128),
  previous_version_id text check (previous_version_id is null or char_length(previous_version_id) between 1 and 128),
  version integer not null check (version > 0),
  record_kind text not null check (record_kind in ('note', 'source', 'feedback')),
  course_id uuid references public.courses(id) on delete set null,
  course_code text not null check (char_length(course_code) between 1 and 80),
  course_title text not null check (char_length(course_title) between 1 and 240),
  lesson_id text check (lesson_id is null or char_length(lesson_id) <= 160),
  lesson_title text check (lesson_title is null or char_length(lesson_title) <= 300),
  source_root_id text check (source_root_id is null or char_length(source_root_id) <= 128),
  title text not null check (char_length(title) between 1 and 300),
  filename text not null check (char_length(filename) between 1 and 320),
  content jsonb not null check (
    jsonb_typeof(content) = 'object'
    and octet_length(content::text) <= 1048576
  ),
  created_at timestamptz not null,
  inserted_at timestamptz not null default now(),
  unique (student_id, record_id),
  unique (student_id, root_id, version)
);

comment on table public.student_learning_records is
  'Student-owned append-only notes, citation sources, and retained feedback versions for the learning workspace.';
comment on column public.student_learning_records.content is
  'Structured record payload. No privileged credentials or research-study consent state belongs here.';

create index if not exists student_learning_records_student_created_idx
  on public.student_learning_records (student_id, created_at desc);
create index if not exists student_learning_records_student_root_version_idx
  on public.student_learning_records (student_id, root_id, version desc);
create index if not exists student_learning_records_student_course_idx
  on public.student_learning_records (student_id, course_id)
  where course_id is not null;

alter table public.student_learning_records enable row level security;

drop policy if exists student_learning_records_select_own on public.student_learning_records;
create policy student_learning_records_select_own
  on public.student_learning_records
  for select
  to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists student_learning_records_insert_own on public.student_learning_records;
create policy student_learning_records_insert_own
  on public.student_learning_records
  for insert
  to authenticated
  with check (
    (select auth.uid()) = student_id
    and (
      course_id is null
      or (select private.can_access_course(course_id))
    )
  );

-- Current Supabase Data API defaults may not auto-expose new tables. Opt in narrowly:
-- authenticated students may read and append their own rows; UPDATE and DELETE remain denied.
revoke all on table public.student_learning_records from anon, authenticated;
grant select, insert on table public.student_learning_records to authenticated;
