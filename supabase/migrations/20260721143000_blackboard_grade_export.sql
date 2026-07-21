-- Manual Blackboard grade-file exchange.
-- This migration does not add OAuth, LTI, automatic grade passback, or public files.

create table public.blackboard_identity_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'blackboard' check (provider = 'blackboard'),
  integration_mode text not null default 'csv' check (integration_mode = 'csv'),
  institution_id uuid references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  ednotebook_user_id uuid not null references public.profiles(id) on delete cascade,
  blackboard_row_key text not null check (char_length(blackboard_row_key) between 1 and 500),
  blackboard_username text,
  blackboard_student_id text,
  blackboard_sis_user_id text,
  blackboard_email text,
  blackboard_display_name text,
  external_identifiers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(external_identifiers) = 'object' and octet_length(external_identifiers::text) <= 8192),
  match_method text not null,
  confidence text not null check (confidence in ('high','medium','low','manual')),
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  last_reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, blackboard_row_key),
  unique (course_id, ednotebook_user_id)
);

create table public.blackboard_grade_column_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'blackboard' check (provider = 'blackboard'),
  integration_mode text not null default 'csv' check (integration_mode = 'csv'),
  institution_id uuid references public.institutions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  blackboard_column_key text not null check (char_length(blackboard_column_key) between 1 and 500),
  blackboard_column_name text not null check (char_length(blackboard_column_name) between 1 and 500),
  blackboard_points_possible numeric(12,4),
  external_line_item_id text,
  external_category_id text,
  external_resource_link_id text,
  canonical_line_item jsonb not null default '{}'::jsonb
    check (jsonb_typeof(canonical_line_item) = 'object' and octet_length(canonical_line_item::text) <= 16384),
  ednotebook_grade_item_id uuid references public.grade_items(id) on delete set null,
  mapping_type text not null check (mapping_type in ('grade_item','course_completion','final_course_grade','ignore')),
  scaling_mode text not null check (scaling_mode in ('raw','proportional','percentage','none')),
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  last_reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, blackboard_column_key),
  check (
    (mapping_type = 'grade_item' and ednotebook_grade_item_id is not null)
    or (mapping_type <> 'grade_item' and ednotebook_grade_item_id is null)
  )
);

create table public.blackboard_grade_exports (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'blackboard' check (provider = 'blackboard'),
  integration_mode text not null default 'csv' check (integration_mode = 'csv'),
  data_contract_version text not null default '1.0',
  institution_id uuid references public.institutions(id) on delete set null,
  course_id uuid not null references public.courses(id) on delete cascade,
  external_context_id text,
  academic_session_label text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  source_filename text not null check (char_length(source_filename) between 1 and 255),
  source_file_hash text not null check (source_file_hash ~ '^[a-f0-9]{64}$'),
  export_filename text not null check (char_length(export_filename) between 1 and 255),
  blackboard_format_detected text not null,
  total_rows integer not null check (total_rows between 1 and 50000),
  matched_students integer not null check (matched_students between 0 and 50000),
  unmatched_students integer not null check (unmatched_students between 0 and 50000),
  mapped_columns integer not null check (mapped_columns between 1 and 1000),
  changed_grade_cells integer not null check (changed_grade_cells between 1 and 5000000),
  warning_count integer not null default 0 check (warning_count between 0 and 100000),
  blocking_issue_count integer not null default 0 check (blocking_issue_count >= 0),
  status text not null default 'generated'
    check (status in ('draft','mapping','blocked','confirmed','generated','downloaded','expired','failed')),
  confirmed_at timestamptz not null default now(),
  generated_at timestamptz not null default now(),
  downloaded_at timestamptz,
  export_summary jsonb not null default '{}'::jsonb,
  mapping_snapshot jsonb not null default '{}'::jsonb,
  grade_snapshot_hash text not null check (grade_snapshot_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blackboard_identity_mappings_course_idx on public.blackboard_identity_mappings (course_id);
create index blackboard_identity_mappings_institution_idx on public.blackboard_identity_mappings (institution_id);
create index blackboard_identity_mappings_user_idx on public.blackboard_identity_mappings (ednotebook_user_id);
create index blackboard_identity_mappings_username_idx on public.blackboard_identity_mappings (lower(blackboard_username));
create index blackboard_column_mappings_course_idx on public.blackboard_grade_column_mappings (course_id);
create index blackboard_column_mappings_institution_idx on public.blackboard_grade_column_mappings (institution_id);
create index blackboard_exports_course_created_idx on public.blackboard_grade_exports (course_id, created_at desc);
create index blackboard_exports_institution_created_idx on public.blackboard_grade_exports (institution_id, created_at desc);

alter table public.blackboard_identity_mappings enable row level security;
alter table public.blackboard_grade_column_mappings enable row level security;
alter table public.blackboard_grade_exports enable row level security;

create policy blackboard_identity_mappings_select
on public.blackboard_identity_mappings for select to authenticated
using (
  private.can_manage_course(course_id)
  or (institution_id is not null and private.is_institution_manager(institution_id, (select auth.uid())))
);

create policy blackboard_column_mappings_select
on public.blackboard_grade_column_mappings for select to authenticated
using (
  private.can_manage_course(course_id)
  or (institution_id is not null and private.is_institution_manager(institution_id, (select auth.uid())))
);

create policy blackboard_grade_exports_select
on public.blackboard_grade_exports for select to authenticated
using (
  private.can_manage_course(course_id)
  or (institution_id is not null and private.is_institution_manager(institution_id, (select auth.uid())))
);

grant select on public.blackboard_identity_mappings to authenticated;
grant select on public.blackboard_grade_column_mappings to authenticated;
grant select on public.blackboard_grade_exports to authenticated;

create trigger blackboard_identity_mappings_touch_updated_at
before update on public.blackboard_identity_mappings
for each row execute function private.touch_updated_at();

create trigger blackboard_column_mappings_touch_updated_at
before update on public.blackboard_grade_column_mappings
for each row execute function private.touch_updated_at();

create trigger blackboard_grade_exports_touch_updated_at
before update on public.blackboard_grade_exports
for each row execute function private.touch_updated_at();

create or replace function public.get_blackboard_manageable_courses()
returns table (
  id uuid,
  title text,
  course_code text,
  teaching_window text,
  institution_id uuid,
  enrolled_learners bigint,
  grade_items bigint,
  finalized_grades bigint,
  awaiting_grading bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    c.id,
    c.title,
    c.course_code,
    c.teaching_window,
    c.institution_id,
    (select count(*) from public.course_memberships cm where cm.course_id = c.id and cm.role = 'learner'),
    (select count(*) from public.grade_items gi where gi.course_id = c.id),
    (select count(*) from public.student_grades sg where sg.course_id = c.id and sg.status = 'finalized'),
    (select count(*) from public.student_grades sg where sg.course_id = c.id and sg.status in ('pending','missing')),
    c.updated_at
  from public.courses c
  where (select auth.uid()) is not null
    and private.can_manage_course(c.id)
  order by c.updated_at desc;
$$;

create or replace function public.get_blackboard_export_context(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_course public.courses%rowtype;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then
    raise exception 'course access denied';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found then raise exception 'course not found'; end if;

  return jsonb_build_object(
    'course', jsonb_build_object(
      'id', v_course.id,
      'title', v_course.title,
      'course_code', v_course.course_code,
      'teaching_window', v_course.teaching_window,
      'subject', v_course.subject,
      'audience', v_course.audience,
      'status', v_course.status,
      'institution_id', v_course.institution_id,
      'updated_at', v_course.updated_at
    ),
    'learners', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', cm.role) order by coalesce(p.full_name, p.email))
      from public.course_memberships cm
      join public.profiles p on p.id = cm.user_id
      where cm.course_id = p_course_id and cm.role = 'learner'
    ), '[]'::jsonb),
    'grade_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', gi.id,
        'course_id', gi.course_id,
        'assignment_id', gi.assignment_id,
        'category_id', gi.category_id,
        'category_name', gc.name,
        'category_weight_percent', gc.weight_percent,
        'title', gi.title,
        'max_points', gi.max_points,
        'publish_state', gi.publish_state,
        'due_at', gi.due_at,
        'created_at', gi.created_at,
        'updated_at', gi.updated_at
      ) order by gi.title)
      from public.grade_items gi
      left join public.grade_categories gc on gc.id = gi.category_id
      where gi.course_id = p_course_id
    ), '[]'::jsonb),
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sg.id,
        'student_id', sg.student_id,
        'grade_item_id', sg.grade_item_id,
        'score', sg.score,
        'status', sg.status,
        'published_at', sg.published_at,
        'finalized_at', sg.finalized_at,
        'updated_at', sg.updated_at
      )) from public.student_grades sg where sg.course_id = p_course_id
    ), '[]'::jsonb),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', cp.user_id,
        'status', cp.status,
        'completion_percent', cp.completion_percent,
        'auto_score', cp.auto_score,
        'final_score', cp.final_score,
        'grade_status', cp.grade_status,
        'updated_at', cp.updated_at
      )) from public.course_progress cp where cp.course_id = p_course_id
    ), '[]'::jsonb),
    'identity_mappings', coalesce((
      select jsonb_agg(to_jsonb(bim) order by bim.updated_at desc)
      from public.blackboard_identity_mappings bim where bim.course_id = p_course_id
    ), '[]'::jsonb),
    'column_mappings', coalesce((
      select jsonb_agg(to_jsonb(bcm) order by bcm.updated_at desc)
      from public.blackboard_grade_column_mappings bcm where bcm.course_id = p_course_id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(to_jsonb(bge) order by bge.created_at desc)
      from (
        select id, course_id, created_by, source_filename, export_filename, blackboard_format_detected,
          total_rows, matched_students, unmatched_students, mapped_columns, changed_grade_cells,
          warning_count, blocking_issue_count, status, confirmed_at, generated_at, downloaded_at, created_at
        from public.blackboard_grade_exports
        where course_id = p_course_id
        order by created_at desc
        limit 50
      ) bge
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_blackboard_export_event(
  p_course_id uuid,
  p_event_type text,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_institution_id uuid;
  v_event_id bigint;
  v_details jsonb;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then
    raise exception 'course access denied';
  end if;
  if p_event_type not in ('blackboard.template_uploaded','blackboard.preview_generated','blackboard.export_blocked','blackboard.export_failed','blackboard.history_viewed') then
    raise exception 'unsupported Blackboard audit event';
  end if;
  select institution_id into v_institution_id from public.courses where id = p_course_id;
  v_details := jsonb_strip_nulls(jsonb_build_object(
    'export_id', left(nullif(p_details->>'export_id',''), 64),
    'source_filename', left(nullif(p_details->>'source_filename',''), 255),
    'total_rows', nullif(p_details->>'total_rows','')::integer,
    'total_columns', nullif(p_details->>'total_columns','')::integer,
    'matched_students', nullif(p_details->>'matched_students','')::integer,
    'changed_grade_cells', nullif(p_details->>'changed_grade_cells','')::integer,
    'reason_code', left(nullif(p_details->>'reason_code',''), 100)
  ));
  insert into public.audit_events (
    actor_id, institution_id, course_id, event_type, target_type, target_id, details, event_hash
  ) values (
    (select auth.uid()), v_institution_id, p_course_id, p_event_type, 'blackboard_grade_export', p_course_id::text, v_details, ''
  ) returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.save_blackboard_identity_mappings(p_course_id uuid, p_mappings jsonb)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_course public.courses%rowtype;
  v_mapping jsonb;
  v_user_id uuid;
  v_count integer := 0;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then raise exception 'course access denied'; end if;
  if jsonb_typeof(p_mappings) <> 'array' or jsonb_array_length(p_mappings) > 50000 then raise exception 'invalid identity mapping payload'; end if;
  select * into v_course from public.courses where id = p_course_id;
  if not found then raise exception 'course not found'; end if;

  for v_mapping in select value from jsonb_array_elements(p_mappings) loop
    v_user_id := (v_mapping->>'ednotebook_user_id')::uuid;
    if not exists (
      select 1 from public.course_memberships cm
      where cm.course_id = p_course_id and cm.user_id = v_user_id and cm.role = 'learner'
    ) then raise exception 'identity mapping learner is not enrolled in this course'; end if;
    if length(trim(coalesce(v_mapping->>'blackboard_row_key',''))) = 0 then raise exception 'identity mapping row key is required'; end if;
    if jsonb_typeof(coalesce(v_mapping->'external_identifiers','{}'::jsonb)) <> 'object'
      or octet_length(coalesce(v_mapping->'external_identifiers','{}'::jsonb)::text) > 8192
    then raise exception 'invalid external identifier payload'; end if;

    insert into public.blackboard_identity_mappings (
      institution_id, course_id, ednotebook_user_id, blackboard_row_key,
      blackboard_username, blackboard_student_id, blackboard_sis_user_id,
      blackboard_email, blackboard_display_name, external_identifiers,
      match_method, confidence, confirmed_by, confirmed_at, last_reconciled_at
    ) values (
      v_course.institution_id, p_course_id, v_user_id, left(v_mapping->>'blackboard_row_key', 500),
      left(nullif(v_mapping->>'blackboard_username',''), 500),
      left(nullif(v_mapping->>'blackboard_student_id',''), 500),
      left(nullif(v_mapping->>'blackboard_sis_user_id',''), 500),
      left(lower(nullif(v_mapping->>'blackboard_email','')), 500),
      left(nullif(v_mapping->>'blackboard_display_name',''), 500),
      coalesce(v_mapping->'external_identifiers','{}'::jsonb),
      left(coalesce(nullif(v_mapping->>'match_method',''), 'Professor selected'), 200),
      case when v_mapping->>'confidence' in ('high','medium','low','manual') then v_mapping->>'confidence' else 'manual' end,
      (select auth.uid()), now(), now()
    ) on conflict (course_id, blackboard_row_key) do update set
      ednotebook_user_id = excluded.ednotebook_user_id,
      blackboard_username = excluded.blackboard_username,
      blackboard_student_id = excluded.blackboard_student_id,
      blackboard_sis_user_id = excluded.blackboard_sis_user_id,
      blackboard_email = excluded.blackboard_email,
      blackboard_display_name = excluded.blackboard_display_name,
      external_identifiers = excluded.external_identifiers,
      match_method = excluded.match_method,
      confidence = excluded.confidence,
      confirmed_by = excluded.confirmed_by,
      confirmed_at = now(),
      last_reconciled_at = now(),
      updated_at = now();
    v_count := v_count + 1;
  end loop;

  insert into public.audit_events (actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values ((select auth.uid()),v_course.institution_id,p_course_id,'blackboard.student_mapping_confirmed','blackboard_identity_mapping',p_course_id::text,jsonb_build_object('mapping_count',v_count),'');
  return v_count;
end;
$$;

create or replace function public.save_blackboard_column_mappings(p_course_id uuid, p_mappings jsonb)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_course public.courses%rowtype;
  v_mapping jsonb;
  v_grade_item_id uuid;
  v_mapping_type text;
  v_scaling_mode text;
  v_count integer := 0;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then raise exception 'course access denied'; end if;
  if jsonb_typeof(p_mappings) <> 'array' or jsonb_array_length(p_mappings) > 1000 then raise exception 'invalid column mapping payload'; end if;
  select * into v_course from public.courses where id = p_course_id;
  if not found then raise exception 'course not found'; end if;

  for v_mapping in select value from jsonb_array_elements(p_mappings) loop
    v_mapping_type := v_mapping->>'mapping_type';
    v_scaling_mode := v_mapping->>'scaling_mode';
    if v_mapping_type not in ('grade_item','course_completion','final_course_grade','ignore') then raise exception 'invalid column mapping type'; end if;
    if v_scaling_mode not in ('raw','proportional','percentage','none') then raise exception 'invalid column scaling mode'; end if;
    if length(trim(coalesce(v_mapping->>'blackboard_column_key',''))) = 0 then raise exception 'column mapping key is required'; end if;
    if jsonb_typeof(coalesce(v_mapping->'canonical_line_item','{}'::jsonb)) <> 'object'
      or octet_length(coalesce(v_mapping->'canonical_line_item','{}'::jsonb)::text) > 16384
    then raise exception 'invalid canonical line item payload'; end if;
    v_grade_item_id := nullif(v_mapping->>'ednotebook_grade_item_id','')::uuid;
    if v_mapping_type = 'grade_item' and not exists (
      select 1 from public.grade_items gi where gi.id = v_grade_item_id and gi.course_id = p_course_id
    ) then raise exception 'column mapping grade item does not belong to this course'; end if;
    if v_mapping_type <> 'grade_item' then v_grade_item_id := null; end if;

    insert into public.blackboard_grade_column_mappings (
      institution_id, course_id, blackboard_column_key, blackboard_column_name,
      blackboard_points_possible, external_line_item_id, external_category_id,
      external_resource_link_id, canonical_line_item, ednotebook_grade_item_id,
      mapping_type, scaling_mode, confirmed_by, confirmed_at, last_reconciled_at
    ) values (
      v_course.institution_id, p_course_id,
      left(v_mapping->>'blackboard_column_key', 500),
      left(v_mapping->>'blackboard_column_name', 500),
      nullif(v_mapping->>'blackboard_points_possible','')::numeric,
      left(nullif(v_mapping->>'external_line_item_id',''), 500),
      left(nullif(v_mapping->>'external_category_id',''), 500),
      left(nullif(v_mapping->>'external_resource_link_id',''), 500),
      coalesce(v_mapping->'canonical_line_item','{}'::jsonb),
      v_grade_item_id, v_mapping_type, v_scaling_mode, (select auth.uid()), now(), now()
    ) on conflict (course_id, blackboard_column_key) do update set
      blackboard_column_name = excluded.blackboard_column_name,
      blackboard_points_possible = excluded.blackboard_points_possible,
      external_line_item_id = excluded.external_line_item_id,
      external_category_id = excluded.external_category_id,
      external_resource_link_id = excluded.external_resource_link_id,
      canonical_line_item = excluded.canonical_line_item,
      ednotebook_grade_item_id = excluded.ednotebook_grade_item_id,
      mapping_type = excluded.mapping_type,
      scaling_mode = excluded.scaling_mode,
      confirmed_by = excluded.confirmed_by,
      confirmed_at = now(),
      last_reconciled_at = now(),
      updated_at = now();
    v_count := v_count + 1;
  end loop;

  insert into public.audit_events (actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values ((select auth.uid()),v_course.institution_id,p_course_id,'blackboard.assignment_mapping_confirmed','blackboard_column_mapping',p_course_id::text,jsonb_build_object('mapping_count',v_count),'');
  return v_count;
end;
$$;

create or replace function public.confirm_blackboard_grade_export(
  p_course_id uuid,
  p_source_filename text,
  p_source_file_hash text,
  p_export_filename text,
  p_format_detected text,
  p_total_rows integer,
  p_matched_students integer,
  p_unmatched_students integer,
  p_mapped_columns integer,
  p_changed_grade_cells integer,
  p_warning_count integer,
  p_mapping_snapshot jsonb,
  p_grade_snapshot jsonb
)
returns public.blackboard_grade_exports
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_course public.courses%rowtype;
  v_entry jsonb;
  v_source_kind text;
  v_student_id uuid;
  v_grade_item_id uuid;
  v_source_score numeric;
  v_source_updated_at timestamptz;
  v_actual_score numeric;
  v_actual_updated_at timestamptz;
  v_status text;
  v_export public.blackboard_grade_exports;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then raise exception 'course access denied'; end if;
  if p_source_file_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid source file hash'; end if;
  if jsonb_typeof(p_grade_snapshot) <> 'array' or jsonb_array_length(p_grade_snapshot) <> p_changed_grade_cells then raise exception 'grade snapshot does not match changed grade count'; end if;
  if jsonb_typeof(p_mapping_snapshot) <> 'object' then raise exception 'invalid mapping snapshot'; end if;
  if p_total_rows < 1 or p_total_rows > 50000 or p_mapped_columns < 1 or p_changed_grade_cells < 1 then raise exception 'invalid export summary'; end if;
  if p_source_filename ~ '[/\\]' or p_export_filename ~ '[/\\]' then raise exception 'invalid export filename'; end if;
  select * into v_course from public.courses where id = p_course_id;
  if not found then raise exception 'course not found'; end if;

  for v_entry in select value from jsonb_array_elements(p_grade_snapshot) loop
    v_source_kind := v_entry->>'source_kind';
    v_student_id := (v_entry->>'student_id')::uuid;
    v_grade_item_id := nullif(v_entry->>'grade_item_id','')::uuid;
    v_source_score := (v_entry->>'source_score')::numeric;
    v_source_updated_at := (v_entry->>'source_updated_at')::timestamptz;
    if not exists (
      select 1 from public.course_memberships cm
      where cm.course_id = p_course_id and cm.user_id = v_student_id and cm.role = 'learner'
    ) then raise exception 'export includes a learner outside the selected course'; end if;

    if v_source_kind = 'grade_item' then
      select sg.score, sg.updated_at, sg.status into v_actual_score, v_actual_updated_at, v_status
      from public.student_grades sg
      where sg.course_id = p_course_id and sg.student_id = v_student_id and sg.grade_item_id = v_grade_item_id;
      if not found or v_status <> 'finalized' then raise exception 'export includes a grade that is not finalized'; end if;
    elsif v_source_kind in ('course_completion','final_course_grade') then
      select
        case when v_source_kind = 'course_completion' then cp.completion_percent else coalesce(cp.final_score, cp.auto_score) end,
        cp.updated_at,
        case when v_source_kind = 'course_completion' then cp.status else cp.grade_status end
      into v_actual_score, v_actual_updated_at, v_status
      from public.course_progress cp
      where cp.course_id = p_course_id and cp.user_id = v_student_id
      order by cp.updated_at desc limit 1;
      if not found
        or (v_source_kind = 'course_completion' and v_status <> 'completed')
        or (v_source_kind = 'final_course_grade' and v_status not in ('graded','auto_graded'))
      then raise exception 'export includes course progress that is not finalized'; end if;
    else
      raise exception 'unsupported grade source';
    end if;

    if v_actual_score is distinct from v_source_score or v_actual_updated_at is distinct from v_source_updated_at then
      raise exception 'grades changed after preview; generate a new preview';
    end if;
    if (v_entry->>'exported_score')::numeric < 0 then raise exception 'exported grade cannot be negative'; end if;
  end loop;

  insert into public.blackboard_grade_exports (
    institution_id, course_id, academic_session_label, created_by, source_filename, source_file_hash,
    export_filename, blackboard_format_detected, total_rows, matched_students,
    unmatched_students, mapped_columns, changed_grade_cells, warning_count,
    blocking_issue_count, status, confirmed_at, generated_at, export_summary,
    mapping_snapshot, grade_snapshot_hash
  ) values (
    v_course.institution_id, p_course_id, left(v_course.teaching_window,180), (select auth.uid()), left(p_source_filename,255), p_source_file_hash,
    left(p_export_filename,255), left(coalesce(p_format_detected,'Blackboard CSV'),200),
    p_total_rows, greatest(p_matched_students,0), greatest(p_unmatched_students,0),
    p_mapped_columns, p_changed_grade_cells, greatest(p_warning_count,0), 0, 'generated', now(), now(),
    jsonb_build_object(
      'total_rows', p_total_rows,
      'matched_students', p_matched_students,
      'unmatched_students', p_unmatched_students,
      'mapped_columns', p_mapped_columns,
      'changed_grade_cells', p_changed_grade_cells,
      'warning_count', p_warning_count
    ),
    p_mapping_snapshot,
    encode(extensions.digest(p_grade_snapshot::text, 'sha256'), 'hex')
  ) returning * into v_export;

  insert into public.audit_events (actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values
    ((select auth.uid()),v_course.institution_id,p_course_id,'blackboard.export_confirmed','blackboard_grade_export',v_export.id::text,jsonb_build_object('changed_grade_cells',p_changed_grade_cells,'warning_count',p_warning_count),''),
    ((select auth.uid()),v_course.institution_id,p_course_id,'blackboard.csv_generated','blackboard_grade_export',v_export.id::text,jsonb_build_object('source_file_hash',p_source_file_hash,'changed_grade_cells',p_changed_grade_cells),'');
  return v_export;
end;
$$;

create or replace function public.record_blackboard_export_download(p_export_id uuid)
returns public.blackboard_grade_exports
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_export public.blackboard_grade_exports;
begin
  select * into v_export from public.blackboard_grade_exports where id = p_export_id for update;
  if not found or (select auth.uid()) is null or not private.can_manage_course(v_export.course_id) then raise exception 'course access denied'; end if;
  if v_export.status not in ('generated','downloaded') then raise exception 'export is not available for download'; end if;
  update public.blackboard_grade_exports
  set status = 'downloaded', downloaded_at = coalesce(downloaded_at, now()), updated_at = now()
  where id = p_export_id returning * into v_export;
  insert into public.audit_events (actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values ((select auth.uid()),v_export.institution_id,v_export.course_id,'blackboard.csv_downloaded','blackboard_grade_export',v_export.id::text,jsonb_build_object('changed_grade_cells',v_export.changed_grade_cells),'');
  return v_export;
end;
$$;

revoke all on function public.get_blackboard_manageable_courses() from public, anon;
revoke all on function public.get_blackboard_export_context(uuid) from public, anon;
revoke all on function public.record_blackboard_export_event(uuid,text,jsonb) from public, anon;
revoke all on function public.save_blackboard_identity_mappings(uuid,jsonb) from public, anon;
revoke all on function public.save_blackboard_column_mappings(uuid,jsonb) from public, anon;
revoke all on function public.confirm_blackboard_grade_export(uuid,text,text,text,text,integer,integer,integer,integer,integer,integer,jsonb,jsonb) from public, anon;
revoke all on function public.record_blackboard_export_download(uuid) from public, anon;

grant execute on function public.get_blackboard_manageable_courses() to authenticated;
grant execute on function public.get_blackboard_export_context(uuid) to authenticated;
grant execute on function public.record_blackboard_export_event(uuid,text,jsonb) to authenticated;
grant execute on function public.save_blackboard_identity_mappings(uuid,jsonb) to authenticated;
grant execute on function public.save_blackboard_column_mappings(uuid,jsonb) to authenticated;
grant execute on function public.confirm_blackboard_grade_export(uuid,text,text,text,text,integer,integer,integer,integer,integer,integer,jsonb,jsonb) to authenticated;
grant execute on function public.record_blackboard_export_download(uuid) to authenticated;

comment on table public.blackboard_identity_mappings is 'Course-scoped professor-confirmed Blackboard-to-EdNotebook learner mappings; never shared across institutions automatically.';
comment on table public.blackboard_grade_column_mappings is 'Course-scoped professor-confirmed Blackboard grade column mappings and scaling choices.';
comment on table public.blackboard_grade_exports is 'Permanent metadata, hashes, and reconciliation summaries for manual Blackboard CSV exports. Generated gradebook files are not stored here.';
