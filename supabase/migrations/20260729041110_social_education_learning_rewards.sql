-- Social Education Learning
-- Private-by-default, professor-authored recognition for concrete learning
-- evidence. This ledger is intentionally separate from every grade table.

create table public.social_learning_milestones (
  threshold_points integer primary key check (threshold_points > 0),
  badge_name text not null check (char_length(badge_name) between 2 and 80),
  badge_description text not null check (char_length(badge_description) between 10 and 300),
  unlock_key text not null unique check (unlock_key ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  unlock_name text not null check (char_length(unlock_name) between 2 and 100),
  unlock_description text not null check (char_length(unlock_description) between 10 and 300),
  unlock_kind text not null check (unlock_kind in ('theme', 'study_aid', 'profile_option')),
  is_optional boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.social_learning_milestones (
  threshold_points,
  badge_name,
  badge_description,
  unlock_key,
  unlock_name,
  unlock_description,
  unlock_kind,
  is_optional
) values
  (
    100,
    'Source Scout',
    'Recognizes careful source checking and clear evidence choices.',
    'focus_palette',
    'Focus palette',
    'An optional low-distraction color theme for reading and study.',
    'theme',
    true
  ),
  (
    250,
    'Digital Citizen',
    'Recognizes responsible, accessible, and thoughtful participation.',
    'source_organizer_layout',
    'Source organizer layout',
    'An optional source-card layout for organizing citation practice.',
    'study_aid',
    true
  ),
  (
    500,
    'Evidence Builder',
    'Recognizes sustained growth in explaining and supporting ideas.',
    'reflection_prompt_pack',
    'Reflection prompt pack',
    'Optional reflection prompts that help a learner describe how their work improved.',
    'study_aid',
    true
  ),
  (
    1000,
    'Learning Guide',
    'Recognizes a sustained record of thoughtful, evidence-based learning.',
    'private_badge_display',
    'Badge display choice',
    'An optional profile setting; badges remain private unless the student chooses to display them.',
    'profile_option',
    true
  )
on conflict (threshold_points) do update
set badge_name = excluded.badge_name,
    badge_description = excluded.badge_description,
    unlock_key = excluded.unlock_key,
    unlock_name = excluded.unlock_name,
    unlock_description = excluded.unlock_description,
    unlock_kind = excluded.unlock_kind,
    is_optional = excluded.is_optional;

create table public.social_learning_reward_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  issued_by uuid not null references public.profiles(id) on delete cascade,
  issuer_display_name text not null check (char_length(issuer_display_name) between 1 and 120),
  event_type text not null check (event_type in ('award', 'adjustment', 'reversal')),
  source_event_id uuid references public.social_learning_reward_events(id) on delete cascade,
  reward_name text not null check (char_length(reward_name) between 2 and 80),
  visual_key text not null check (
    visual_key in ('spark', 'star', 'book', 'lightbulb', 'compass', 'shield', 'growth')
  ),
  category text not null check (
    category in (
      'evidence',
      'effort',
      'growth',
      'collaboration',
      'digital_citizenship',
      'source_literacy',
      'reflection'
    )
  ),
  activity_reference text not null check (char_length(activity_reference) between 3 and 160),
  points_delta integer not null check (points_delta between -100 and 100 and points_delta <> 0),
  reason text not null check (char_length(reason) between 10 and 500),
  idempotency_key uuid not null,
  semantic_key text not null check (char_length(semantic_key) = 32),
  created_at timestamptz not null default now(),
  check (
    (event_type = 'award' and source_event_id is null and points_delta > 0)
    or
    (event_type in ('adjustment', 'reversal') and source_event_id is not null)
  )
);

comment on table public.social_learning_reward_events is
  'Append-only learning recognition ledger. It never calculates or changes official grades.';
comment on column public.social_learning_reward_events.activity_reference is
  'Plain-language lesson, assignment, quest, or learning moment the recognition belongs to.';
comment on column public.social_learning_reward_events.semantic_key is
  'Server-computed duplicate guard for one named reward per student and learning activity.';

create unique index social_learning_reward_events_idempotency_idx
  on public.social_learning_reward_events (issued_by, idempotency_key);
create unique index social_learning_reward_events_semantic_award_idx
  on public.social_learning_reward_events (course_id, student_id, semantic_key)
  where event_type = 'award';
create unique index social_learning_reward_events_single_reversal_idx
  on public.social_learning_reward_events (source_event_id)
  where event_type = 'reversal';
create index social_learning_reward_events_student_idx
  on public.social_learning_reward_events (student_id, created_at desc);
create index social_learning_reward_events_course_idx
  on public.social_learning_reward_events (course_id, student_id, created_at desc);
create index social_learning_reward_events_source_idx
  on public.social_learning_reward_events (source_event_id)
  where source_event_id is not null;

alter table public.social_learning_milestones enable row level security;
alter table public.social_learning_reward_events enable row level security;

create policy social_learning_milestones_read
on public.social_learning_milestones for select
to authenticated
using (true);

create policy social_learning_reward_events_read
on public.social_learning_reward_events for select
to authenticated
using (
  student_id = (select auth.uid())
  or private.can_manage_course(course_id)
);

-- The browser may read only. All event writes go through the checked RPCs below.
revoke all on table public.social_learning_milestones from anon, authenticated;
revoke all on table public.social_learning_reward_events from anon, authenticated;
grant select on table public.social_learning_milestones to authenticated;
grant select on table public.social_learning_reward_events to authenticated;
grant all on table public.social_learning_milestones to service_role;
grant select, insert on table public.social_learning_reward_events to service_role;

create or replace function public.list_social_learning_managed_roster()
returns table (
  course_id uuid,
  course_code text,
  course_title text,
  student_id uuid,
  student_display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    coalesce(nullif(c.course_code, ''), 'COURSE'),
    c.title,
    cm.user_id,
    coalesce(nullif(p.full_name, ''), split_part(coalesce(p.email, 'Student'), '@', 1))
  from public.courses c
  join public.course_memberships cm
    on cm.course_id = c.id
   and cm.role = 'learner'
  join public.profiles p on p.id = cm.user_id
  where (select auth.uid()) is not null
    and private.can_manage_course(c.id)
    and private.course_membership_is_current(cm.course_id, cm.user_id, cm.role)
  order by c.title, 5;
$$;

revoke all on function public.list_social_learning_managed_roster() from public;
grant execute on function public.list_social_learning_managed_roster() to authenticated;

create or replace function public.issue_social_learning_reward(
  p_course_id uuid,
  p_student_id uuid,
  p_reward_name text,
  p_visual_key text,
  p_category text,
  p_activity_reference text,
  p_points integer,
  p_reason text,
  p_idempotency_key uuid
)
returns public.social_learning_reward_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_semantic_key text;
  v_existing public.social_learning_reward_events;
  v_created public.social_learning_reward_events;
begin
  if v_actor is null then
    raise exception 'Authentication is required';
  end if;
  if not private.can_manage_course(p_course_id) then
    raise exception 'Course access denied';
  end if;
  if not exists (
    select 1
    from public.course_memberships cm
    where cm.course_id = p_course_id
      and cm.user_id = p_student_id
      and cm.role = 'learner'
      and private.course_membership_is_current(cm.course_id, cm.user_id, cm.role)
  ) then
    raise exception 'The selected student is not actively enrolled in this course';
  end if;
  if p_reward_name is null or char_length(btrim(p_reward_name)) not between 2 and 80 then
    raise exception 'Reward name must be 2 to 80 characters';
  end if;
  if p_visual_key is null or p_visual_key not in (
    'spark', 'star', 'book', 'lightbulb', 'compass', 'shield', 'growth'
  ) then
    raise exception 'Choose a supported recognition visual';
  end if;
  if p_category is null or p_category not in (
    'evidence',
    'effort',
    'growth',
    'collaboration',
    'digital_citizenship',
    'source_literacy',
    'reflection'
  ) then
    raise exception 'Choose a supported learning category';
  end if;
  if p_activity_reference is null
     or char_length(btrim(p_activity_reference)) not between 3 and 160 then
    raise exception 'Learning activity must be 3 to 160 characters';
  end if;
  if p_points is null or p_points not between 1 and 100 then
    raise exception 'Recognition points must be between 1 and 100';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 500 then
    raise exception 'Reason must be a plain-language explanation of 10 to 500 characters';
  end if;
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required';
  end if;

  select *
  into v_existing
  from public.social_learning_reward_events e
  where e.issued_by = v_actor
    and e.idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  v_semantic_key := md5(
    p_course_id::text || '|' ||
    p_student_id::text || '|' ||
    lower(regexp_replace(btrim(p_reward_name), '\s+', ' ', 'g')) || '|' ||
    p_category || '|' ||
    lower(regexp_replace(btrim(p_activity_reference), '\s+', ' ', 'g'))
  );

  if exists (
    select 1
    from public.social_learning_reward_events e
    where e.course_id = p_course_id
      and e.student_id = p_student_id
      and e.semantic_key = v_semantic_key
      and e.event_type = 'award'
  ) then
    raise exception 'This named reward already exists for the same student and learning activity. Use an adjustment to correct it.';
  end if;

  select coalesce(nullif(p.full_name, ''), split_part(coalesce(p.email, 'Educator'), '@', 1))
  into v_actor_name
  from public.profiles p
  where p.id = v_actor;

  begin
    insert into public.social_learning_reward_events (
      course_id,
      student_id,
      issued_by,
      issuer_display_name,
      event_type,
      reward_name,
      visual_key,
      category,
      activity_reference,
      points_delta,
      reason,
      idempotency_key,
      semantic_key
    ) values (
      p_course_id,
      p_student_id,
      v_actor,
      coalesce(v_actor_name, 'Educator'),
      'award',
      btrim(p_reward_name),
      p_visual_key,
      p_category,
      btrim(p_activity_reference),
      p_points,
      btrim(p_reason),
      p_idempotency_key,
      v_semantic_key
    )
    returning * into v_created;
  exception
    when unique_violation then
      select *
      into v_existing
      from public.social_learning_reward_events e
      where e.issued_by = v_actor
        and e.idempotency_key = p_idempotency_key;
      if found then
        return v_existing;
      end if;
      raise exception 'This named reward already exists for the same student and learning activity. Use an adjustment to correct it.';
  end;

  return v_created;
end;
$$;

revoke all on function public.issue_social_learning_reward(
  uuid, uuid, text, text, text, text, integer, text, uuid
) from public;
grant execute on function public.issue_social_learning_reward(
  uuid, uuid, text, text, text, text, integer, text, uuid
) to authenticated;

create or replace function public.correct_social_learning_reward(
  p_source_event_id uuid,
  p_correction_type text,
  p_points_delta integer,
  p_reason text,
  p_idempotency_key uuid
)
returns public.social_learning_reward_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_source public.social_learning_reward_events;
  v_existing public.social_learning_reward_events;
  v_created public.social_learning_reward_events;
  v_current_points integer;
  v_delta integer;
begin
  if v_actor is null then
    raise exception 'Authentication is required';
  end if;
  if p_correction_type is null or p_correction_type not in ('adjustment', 'reversal') then
    raise exception 'Correction type must be adjustment or reversal';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 500 then
    raise exception 'Correction reason must be 10 to 500 characters';
  end if;
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required';
  end if;

  select *
  into v_existing
  from public.social_learning_reward_events e
  where e.issued_by = v_actor
    and e.idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select *
  into v_source
  from public.social_learning_reward_events e
  where e.id = p_source_event_id
    and e.event_type = 'award'
  for update;

  if not found or not private.can_manage_course(v_source.course_id) then
    raise exception 'Reward was not found or is outside your managed courses';
  end if;
  if exists (
    select 1
    from public.social_learning_reward_events e
    where e.source_event_id = v_source.id
      and e.event_type = 'reversal'
  ) then
    raise exception 'This reward has already been reversed';
  end if;

  select coalesce(sum(e.points_delta), 0)::integer
  into v_current_points
  from public.social_learning_reward_events e
  where e.id = v_source.id
     or e.source_event_id = v_source.id;

  if p_correction_type = 'adjustment' then
    if p_points_delta is null or p_points_delta = 0 or p_points_delta not between -100 and 100 then
      raise exception 'Adjustment must be a non-zero value between -100 and 100';
    end if;
    if v_current_points + p_points_delta not between 1 and 100 then
      raise exception 'Adjusted recognition must remain between 1 and 100 points; use reversal to remove it';
    end if;
    v_delta := p_points_delta;
  else
    if v_current_points <= 0 then
      raise exception 'This reward has no remaining points to reverse';
    end if;
    v_delta := -v_current_points;
  end if;

  select coalesce(nullif(p.full_name, ''), split_part(coalesce(p.email, 'Educator'), '@', 1))
  into v_actor_name
  from public.profiles p
  where p.id = v_actor;

  begin
    insert into public.social_learning_reward_events (
      course_id,
      student_id,
      issued_by,
      issuer_display_name,
      event_type,
      source_event_id,
      reward_name,
      visual_key,
      category,
      activity_reference,
      points_delta,
      reason,
      idempotency_key,
      semantic_key
    ) values (
      v_source.course_id,
      v_source.student_id,
      v_actor,
      coalesce(v_actor_name, 'Educator'),
      p_correction_type,
      v_source.id,
      v_source.reward_name,
      v_source.visual_key,
      v_source.category,
      v_source.activity_reference,
      v_delta,
      btrim(p_reason),
      p_idempotency_key,
      md5(v_source.id::text || '|' || p_correction_type || '|' || p_idempotency_key::text)
    )
    returning * into v_created;
  exception
    when unique_violation then
      select *
      into v_existing
      from public.social_learning_reward_events e
      where e.issued_by = v_actor
        and e.idempotency_key = p_idempotency_key;
      if found then
        return v_existing;
      end if;
      raise;
  end;

  return v_created;
end;
$$;

revoke all on function public.correct_social_learning_reward(
  uuid, text, integer, text, uuid
) from public;
grant execute on function public.correct_social_learning_reward(
  uuid, text, integer, text, uuid
) to authenticated;
