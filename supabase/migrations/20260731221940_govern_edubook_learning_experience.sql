-- Govern the interactive EduBook learning layer without duplicating the
-- publication source. Correct answers remain server-side, every professor
-- change is versioned, and learner progress requires current book access.

alter table public.publications
  add column if not exists current_learning_version integer not null default 0
    check (current_learning_version >= 0);

create table public.publication_learning_versions (
  publication_id uuid not null references public.publications(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  manifest_snapshot jsonb not null,
  change_summary text not null default '' check (char_length(change_summary) <= 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (publication_id,version_number)
);

create table private.publication_learning_author_versions (
  publication_id uuid not null references public.publications(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  learning_layer jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (publication_id,version_number),
  foreign key (publication_id,version_number)
    references public.publication_learning_versions(publication_id,version_number)
    on delete cascade
);

create table public.publication_reading_progress (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  learning_version integer not null default 0 check (learning_version >= 0),
  chapter_index integer not null default 0 check (chapter_index >= 0),
  chapter_id text not null default '',
  status text not null default 'in_progress'
    check (status in ('in_progress','completed')),
  completion_percent numeric(5,2) not null default 0
    check (completion_percent between 0 and 100),
  interaction_state jsonb not null default '{}'::jsonb,
  auto_score numeric(5,2) check (auto_score is null or auto_score between 0 and 100),
  started_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (publication_id,user_id)
);

create index publication_learning_versions_created_idx
  on public.publication_learning_versions(publication_id,created_at desc);
create index publication_reading_progress_user_idx
  on public.publication_reading_progress(user_id,updated_at desc);
create index publication_reading_progress_publication_idx
  on public.publication_reading_progress(publication_id,status,updated_at desc);

alter table public.publication_learning_versions enable row level security;
alter table public.publication_reading_progress enable row level security;

revoke all on public.publication_learning_versions from public,anon,authenticated;
revoke all on public.publication_reading_progress from public,anon,authenticated;
revoke all on private.publication_learning_author_versions from public,anon,authenticated;
grant select on public.publication_learning_versions to authenticated;
grant select on public.publication_reading_progress to authenticated;

create policy publication_learning_versions_select
on public.publication_learning_versions
for select to authenticated
using (
  exists (
    select 1
    from public.publications publication
    where publication.id=publication_learning_versions.publication_id
      and (
        publication.owner_id=(select auth.uid())
        or private.is_platform_owner((select auth.uid()))
      )
  )
);

create policy publication_reading_progress_select
on public.publication_reading_progress
for select to authenticated
using (
  user_id=(select auth.uid())
);

create or replace function private.edubook_question_valid(
  p_question jsonb
)
returns boolean
language plpgsql
immutable
set search_path=''
as $$
declare
  v_option text;
  v_correct_found boolean := false;
begin
  if jsonb_typeof(p_question)<>'object'
     or char_length(trim(coalesce(p_question->>'id',''))) not between 1 and 120
     or char_length(trim(coalesce(p_question->>'prompt',''))) not between 5 and 1000
     or jsonb_typeof(p_question->'options')<>'array'
     or jsonb_array_length(p_question->'options') not between 2 and 6
     or char_length(trim(coalesce(p_question->>'correctAnswer',''))) not between 1 and 500
     or char_length(coalesce(p_question->>'explanation',''))>2000 then
    return false;
  end if;
  for v_option in
    select value from jsonb_array_elements_text(p_question->'options')
  loop
    if char_length(trim(v_option)) not between 1 and 500 then return false; end if;
    if v_option=p_question->>'correctAnswer' then v_correct_found := true; end if;
  end loop;
  return v_correct_found;
exception when others then
  return false;
end;
$$;

create or replace function private.edubook_learning_layer_valid(
  p_publication_id uuid,
  p_learning_layer jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_manifest jsonb;
  v_chapter jsonb;
  v_question jsonb;
  v_prompt jsonb;
begin
  select publication.edubook_manifest into v_manifest
  from public.publications publication
  where publication.id=p_publication_id;
  if not found
     or jsonb_typeof(p_learning_layer)<>'object'
     or p_learning_layer->>'schemaVersion'<>'EduBookLearning/1.0'
     or jsonb_typeof(p_learning_layer->'chapters')<>'array'
     or jsonb_typeof(p_learning_layer->'finalQuiz')<>'array'
     or octet_length(p_learning_layer::text)>131072
     or jsonb_array_length(p_learning_layer->'chapters')>
        jsonb_array_length(coalesce(v_manifest->'chapters','[]'::jsonb))
     or jsonb_array_length(p_learning_layer->'finalQuiz')>50 then
    return false;
  end if;
  if (
    select count(*)<>count(distinct chapter->>'chapterId')
    from jsonb_array_elements(p_learning_layer->'chapters') chapter
  ) then return false; end if;
  for v_chapter in select value from jsonb_array_elements(p_learning_layer->'chapters') loop
    if char_length(trim(coalesce(v_chapter->>'chapterId',''))) not between 1 and 160
       or not exists (
         select 1 from jsonb_array_elements(coalesce(v_manifest->'chapters','[]'::jsonb)) source_chapter
         where source_chapter->>'id'=v_chapter->>'chapterId'
       )
       or jsonb_typeof(v_chapter->'knowledgeChecks')<>'array'
       or jsonb_typeof(v_chapter->'discussionPrompts')<>'array'
       or jsonb_array_length(v_chapter->'knowledgeChecks')>20
       or jsonb_array_length(v_chapter->'discussionPrompts')>20 then
      return false;
    end if;
    for v_question in select value from jsonb_array_elements(v_chapter->'knowledgeChecks') loop
      if not private.edubook_question_valid(v_question) then return false; end if;
    end loop;
    for v_prompt in select value from jsonb_array_elements(v_chapter->'discussionPrompts') loop
      if jsonb_typeof(v_prompt)<>'object'
         or char_length(trim(coalesce(v_prompt->>'id',''))) not between 1 and 120
         or char_length(trim(coalesce(v_prompt->>'prompt',''))) not between 5 and 2000 then
        return false;
      end if;
    end loop;
  end loop;
  for v_question in select value from jsonb_array_elements(p_learning_layer->'finalQuiz') loop
    if not private.edubook_question_valid(v_question) then return false; end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function private.sanitize_edubook_learning_layer(
  p_learning_layer jsonb
)
returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare
  v_result jsonb := jsonb_build_object(
    'schemaVersion','EduBookLearning/1.0',
    'chapters','[]'::jsonb,
    'finalQuiz','[]'::jsonb
  );
  v_chapter jsonb;
  v_question jsonb;
  v_checks jsonb;
  v_quiz jsonb := '[]'::jsonb;
begin
  for v_chapter in select value from jsonb_array_elements(p_learning_layer->'chapters') loop
    v_checks := '[]'::jsonb;
    for v_question in select value from jsonb_array_elements(v_chapter->'knowledgeChecks') loop
      v_checks := v_checks || jsonb_build_array(v_question-'correctAnswer'-'explanation');
    end loop;
    v_result := jsonb_set(
      v_result,
      '{chapters}',
      (v_result->'chapters') || jsonb_build_array(jsonb_build_object(
        'chapterId',v_chapter->>'chapterId',
        'knowledgeChecks',v_checks,
        'discussionPrompts',v_chapter->'discussionPrompts'
      )),
      true
    );
  end loop;
  for v_question in select value from jsonb_array_elements(p_learning_layer->'finalQuiz') loop
    v_quiz := v_quiz || jsonb_build_array(v_question-'correctAnswer'-'explanation');
  end loop;
  return jsonb_set(v_result,'{finalQuiz}',v_quiz,true);
end;
$$;

create or replace function public.get_publication_learning_layer_for_author(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_publication public.publications%rowtype;
  v_layer jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_publication
  from public.publications publication
  where publication.id=p_publication_id;
  if not found
     or (
       v_publication.owner_id<>(select auth.uid())
       and not private.is_platform_owner((select auth.uid()))
     ) then raise exception 'Publication author access denied'; end if;
  select author_version.learning_layer into v_layer
  from private.publication_learning_author_versions author_version
  where author_version.publication_id=p_publication_id
    and author_version.version_number=v_publication.current_learning_version;
  return coalesce(v_layer,jsonb_build_object(
    'schemaVersion','EduBookLearning/1.0',
    'chapters','[]'::jsonb,
    'finalQuiz','[]'::jsonb
  ));
end;
$$;

create or replace function public.save_publication_learning_layer(
  p_publication_id uuid,
  p_learning_layer jsonb,
  p_change_summary text default ''
)
returns public.publications
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_publication public.publications%rowtype;
  v_next_version integer;
  v_public_layer jsonb;
  v_manifest jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_publication
  from public.publications publication
  where publication.id=p_publication_id
  for update;
  if not found or v_publication.owner_id<>v_user_id then
    raise exception 'Only the publication owner can change the teaching layer';
  end if;
  if v_publication.reading_mode<>'interactive' then
    raise exception 'Read-only books do not use an interactive teaching layer';
  end if;
  if v_publication.conversion_status<>'ready' then
    raise exception 'Publication conversion must be ready before teaching design';
  end if;
  if not private.edubook_learning_layer_valid(p_publication_id,p_learning_layer) then
    raise exception 'Invalid EduBook learning layer';
  end if;
  v_next_version := v_publication.current_learning_version+1;
  v_public_layer := private.sanitize_edubook_learning_layer(p_learning_layer);
  v_manifest := jsonb_set(
    v_publication.edubook_manifest,
    '{learningLayer}',
    v_public_layer,
    true
  );
  insert into public.publication_learning_versions (
    publication_id,version_number,manifest_snapshot,change_summary,created_by
  ) values (
    p_publication_id,v_next_version,v_manifest,
    left(trim(coalesce(p_change_summary,'')),1000),v_user_id
  );
  insert into private.publication_learning_author_versions (
    publication_id,version_number,learning_layer,created_by
  ) values (
    p_publication_id,v_next_version,p_learning_layer,v_user_id
  );
  update public.publications
  set edubook_manifest=v_manifest,
      current_learning_version=v_next_version,
      updated_at=now()
  where id=p_publication_id
  returning * into v_publication;
  return v_publication;
end;
$$;

create or replace function public.save_publication_reading_progress(
  p_publication_id uuid,
  p_chapter_index integer,
  p_chapter_id text,
  p_interaction_state jsonb default '{}'::jsonb,
  p_complete boolean default false
)
returns public.publication_reading_progress
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_publication public.publications%rowtype;
  v_chapters jsonb;
  v_chapter_count integer;
  v_expected_chapter_id text;
  v_learning_layer jsonb;
  v_chapter_layer jsonb;
  v_question jsonb;
  v_total_questions integer := 0;
  v_answered_questions integer := 0;
  v_correct_questions integer := 0;
  v_completion numeric(5,2);
  v_score numeric(5,2) := null;
  v_progress public.publication_reading_progress%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(coalesce(p_interaction_state,'{}'::jsonb))<>'object'
     or octet_length(coalesce(p_interaction_state,'{}'::jsonb)::text)>65536 then
    raise exception 'Invalid EduBook interaction state';
  end if;
  select * into v_publication
  from public.publications publication
  where publication.id=p_publication_id
    and publication.status='published'
    and publication.conversion_status='ready';
  if not found or not private.can_access_publication(p_publication_id,v_user_id) then
    raise exception 'Current publication access required';
  end if;
  v_chapters := coalesce(v_publication.edubook_manifest->'chapters','[]'::jsonb);
  v_chapter_count := jsonb_array_length(v_chapters);
  if v_chapter_count=0
     or p_chapter_index not between 0 and v_chapter_count-1 then
    raise exception 'Choose a valid book chapter';
  end if;
  v_expected_chapter_id := v_chapters->p_chapter_index->>'id';
  if v_expected_chapter_id is distinct from p_chapter_id then
    raise exception 'Book chapter does not match the published source';
  end if;
  if p_complete and p_chapter_index<>v_chapter_count-1 then
    raise exception 'Open the final chapter before completing the book';
  end if;
  select author_version.learning_layer into v_learning_layer
  from private.publication_learning_author_versions author_version
  where author_version.publication_id=p_publication_id
    and author_version.version_number=v_publication.current_learning_version;
  v_learning_layer := coalesce(v_learning_layer,jsonb_build_object(
    'schemaVersion','EduBookLearning/1.0',
    'chapters','[]'::jsonb,
    'finalQuiz','[]'::jsonb
  ));
  for v_chapter_layer in select value from jsonb_array_elements(v_learning_layer->'chapters') loop
    for v_question in select value from jsonb_array_elements(v_chapter_layer->'knowledgeChecks') loop
      v_total_questions := v_total_questions+1;
      if coalesce(p_interaction_state->'answers'->>(v_question->>'id'),'')<>'' then
        v_answered_questions := v_answered_questions+1;
      end if;
      if coalesce(p_interaction_state->'answers'->>(v_question->>'id'),'')=v_question->>'correctAnswer' then
        v_correct_questions := v_correct_questions+1;
      end if;
    end loop;
  end loop;
  for v_question in select value from jsonb_array_elements(v_learning_layer->'finalQuiz') loop
    v_total_questions := v_total_questions+1;
    if coalesce(p_interaction_state->'answers'->>(v_question->>'id'),'')<>'' then
      v_answered_questions := v_answered_questions+1;
    end if;
    if coalesce(p_interaction_state->'answers'->>(v_question->>'id'),'')=v_question->>'correctAnswer' then
      v_correct_questions := v_correct_questions+1;
    end if;
  end loop;
  if p_complete
     and v_publication.reading_mode='interactive'
     and v_answered_questions<v_total_questions then
    raise exception 'Complete every knowledge check and final quiz question first';
  end if;
  v_completion := case
    when p_complete then 100
    else round(((p_chapter_index+1)::numeric/v_chapter_count::numeric)*100,2)
  end;
  if p_complete and v_total_questions>0 then
    v_score := round((v_correct_questions::numeric/v_total_questions::numeric)*100,2);
  end if;
  insert into public.publication_reading_progress (
    publication_id,user_id,learning_version,chapter_index,chapter_id,
    status,completion_percent,interaction_state,auto_score,
    completed_at,last_opened_at,updated_at
  ) values (
    p_publication_id,v_user_id,v_publication.current_learning_version,
    p_chapter_index,p_chapter_id,
    case when p_complete then 'completed' else 'in_progress' end,
    v_completion,coalesce(p_interaction_state,'{}'::jsonb),v_score,
    case when p_complete then now() end,now(),now()
  )
  on conflict (publication_id,user_id) do update set
    learning_version=excluded.learning_version,
    chapter_index=case
      when public.publication_reading_progress.status='completed'
        then public.publication_reading_progress.chapter_index
      else excluded.chapter_index
    end,
    chapter_id=case
      when public.publication_reading_progress.status='completed'
        then public.publication_reading_progress.chapter_id
      else excluded.chapter_id
    end,
    status=case
      when public.publication_reading_progress.status='completed' then 'completed'
      else excluded.status
    end,
    completion_percent=greatest(
      public.publication_reading_progress.completion_percent,
      excluded.completion_percent
    ),
    interaction_state=excluded.interaction_state,
    auto_score=coalesce(excluded.auto_score,public.publication_reading_progress.auto_score),
    completed_at=coalesce(public.publication_reading_progress.completed_at,excluded.completed_at),
    last_opened_at=now(),
    updated_at=now()
  returning * into v_progress;
  return v_progress;
end;
$$;

create or replace function public.get_publication_reading_progress_summary(
  p_publication_id uuid
)
returns table (
  publication_id uuid,
  user_id uuid,
  learning_version integer,
  chapter_index integer,
  chapter_id text,
  status text,
  completion_percent numeric,
  auto_score numeric,
  started_at timestamptz,
  last_opened_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_course_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select publication.course_id into v_course_id
  from public.publications publication
  where publication.id=p_publication_id;
  if not found then raise exception 'Publication not found'; end if;
  if not private.is_platform_owner(v_user_id)
     and (v_course_id is null or not private.can_manage_course(v_course_id)) then
    raise exception 'Course professor or platform owner access required';
  end if;
  return query
  select progress.publication_id,progress.user_id,progress.learning_version,
         progress.chapter_index,progress.chapter_id,progress.status,
         progress.completion_percent,progress.auto_score,progress.started_at,
         progress.last_opened_at,progress.completed_at,progress.updated_at
  from public.publication_reading_progress progress
  join public.course_memberships membership
    on membership.course_id=v_course_id
   and membership.user_id=progress.user_id
   and membership.role='student'
  where progress.publication_id=p_publication_id
    and (
      private.is_platform_owner(v_user_id)
      or private.course_membership_is_current(
        membership.course_id,
        membership.user_id,
        membership.role
      )
    );
end;
$$;

drop policy if exists reading_annotations_insert on public.reading_annotations;
create policy reading_annotations_insert
on public.reading_annotations for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.can_access_publication(publication_id,(select auth.uid()))
);

drop policy if exists reading_annotations_update on public.reading_annotations;
create policy reading_annotations_update
on public.reading_annotations for update to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and private.can_access_publication(publication_id,(select auth.uid()))
);

revoke all on function private.edubook_question_valid(jsonb) from public,anon,authenticated;
revoke all on function private.edubook_learning_layer_valid(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.sanitize_edubook_learning_layer(jsonb) from public,anon,authenticated;
revoke all on function public.get_publication_learning_layer_for_author(uuid) from public,anon;
revoke all on function public.save_publication_learning_layer(uuid,jsonb,text) from public,anon;
revoke all on function public.save_publication_reading_progress(uuid,integer,text,jsonb,boolean) from public,anon;
revoke all on function public.get_publication_reading_progress_summary(uuid) from public,anon;
grant execute on function public.get_publication_learning_layer_for_author(uuid) to authenticated;
grant execute on function public.save_publication_learning_layer(uuid,jsonb,text) to authenticated;
grant execute on function public.save_publication_reading_progress(uuid,integer,text,jsonb,boolean) to authenticated;
grant execute on function public.get_publication_reading_progress_summary(uuid) to authenticated;

create trigger publication_reading_progress_touch_updated_at
before update on public.publication_reading_progress
for each row execute function private.touch_updated_at();
