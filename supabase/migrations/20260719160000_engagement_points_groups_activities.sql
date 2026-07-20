-- Engagement points, class groups, rewards, and live classroom activities.
-- Engagement points are intentionally separate from grades and grade calculations.
-- Account/profile rows are never deleted by this feature; inactive audit states are
-- respected by every learner/professor mutation RPC.

create table if not exists public.assignment_point_rules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  points_value integer not null check (points_value between 0 and 100000),
  claim_mode text not null default 'learner_claim'
    check (claim_mode in ('learner_claim', 'professor_only')),
  requires_submission boolean not null default true,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, assignment_id),
  unique (id, course_id)
);

create table if not exists public.engagement_point_ledger (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  rule_id uuid references public.assignment_point_rules(id) on delete set null,
  source_type text not null
    check (source_type in ('assignment_claim', 'professor_award', 'activity_award', 'reward_unlock', 'adjustment')),
  points_delta integer not null check (points_delta between -100000 and 100000 and points_delta <> 0),
  reason text not null check (char_length(reason) between 1 and 500),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (course_id, learner_id, idempotency_key)
);

create table if not exists public.engagement_point_balances (
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  updated_at timestamptz not null default now(),
  primary key (course_id, learner_id)
);

create table if not exists public.course_engagement_settings (
  course_id uuid primary key references public.courses(id) on delete cascade,
  default_group_assignment_mode text not null default 'teacher_assign'
    check (default_group_assignment_mode in ('teacher_assign', 'student_choice')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engagement_reward_catalog (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  reward_type text not null default 'badge'
    check (reward_type in ('badge', 'theme', 'class_perk', 'recognition')),
  cost_points integer not null check (cost_points between 1 and 100000),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, course_id)
);

create table if not exists public.class_engagement_goals (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  reward_id uuid references public.engagement_reward_catalog(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  target_points bigint not null check (target_points between 1 and 1000000000),
  current_points bigint not null default 0 check (current_points >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'achieved', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  achieved_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, reward_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.engagement_reward_unlocks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  reward_id uuid not null,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  ledger_entry_id uuid not null unique references public.engagement_point_ledger(id) on delete restrict,
  points_spent integer not null check (points_spent > 0),
  unlocked_at timestamptz not null default now(),
  unique (reward_id, learner_id),
  foreign key (reward_id, course_id) references public.engagement_reward_catalog(id, course_id) on delete restrict
);

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  assignment_mode text not null default 'teacher_assign'
    check (assignment_mode in ('teacher_assign', 'student_choice')),
  join_open boolean not null default false,
  max_members integer not null default 6 check (max_members between 2 and 100),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, course_id),
  unique (course_id, name)
);

create table if not exists public.class_group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'left')),
  assigned_by uuid references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (group_id, learner_id),
  foreign key (group_id, course_id) references public.class_groups(id, course_id) on delete cascade,
  check ((status = 'active' and left_at is null) or (status = 'left' and left_at is not null))
);

create table if not exists public.classroom_activities (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  instructions text not null default '' check (char_length(instructions) <= 10000),
  activity_type text not null check (activity_type in ('quiz', 'poll', 'group_challenge')),
  status text not null default 'draft' check (status in ('draft', 'live', 'closed')),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, course_id),
  check ((status = 'draft' and started_at is null and closed_at is null)
    or (status = 'live' and started_at is not null and closed_at is null)
    or (status = 'closed' and started_at is not null and closed_at is not null))
);

create table if not exists public.classroom_activity_questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null check (position between 0 and 49),
  prompt text not null check (char_length(prompt) between 1 and 2000),
  response_kind text not null default 'single_choice'
    check (response_kind in ('single_choice', 'multiple_choice', 'free_text')),
  is_required boolean not null default true,
  points_available integer not null default 0 check (points_available between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, position),
  unique (id, activity_id, course_id),
  foreign key (activity_id, course_id) references public.classroom_activities(id, course_id) on delete cascade
);

create table if not exists public.classroom_activity_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  activity_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null check (position between 0 and 19),
  label text not null check (char_length(label) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, position),
  foreign key (question_id, activity_id, course_id)
    references public.classroom_activity_questions(id, activity_id, course_id) on delete cascade
);

create table if not exists public.classroom_activity_participants (
  activity_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (activity_id, learner_id),
  foreign key (activity_id, course_id) references public.classroom_activities(id, course_id) on delete cascade
);

create table if not exists public.classroom_activity_responses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  question_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  group_id uuid,
  option_ids uuid[] not null default '{}',
  text_response text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, question_id, learner_id),
  foreign key (question_id, activity_id, course_id)
    references public.classroom_activity_questions(id, activity_id, course_id) on delete cascade,
  foreign key (group_id, course_id) references public.class_groups(id, course_id) on delete restrict,
  check (cardinality(option_ids) <= 20),
  check (text_response is null or char_length(text_response) between 1 and 10000)
);

create index if not exists assignment_point_rules_course_active_idx
  on public.assignment_point_rules (course_id, is_active, updated_at desc);
create index if not exists engagement_point_ledger_learner_idx
  on public.engagement_point_ledger (learner_id, course_id, created_at desc);
create index if not exists engagement_point_ledger_course_idx
  on public.engagement_point_ledger (course_id, created_at desc);
create index if not exists engagement_point_ledger_rule_idx
  on public.engagement_point_ledger (rule_id) where rule_id is not null;
create index if not exists engagement_point_balances_course_idx
  on public.engagement_point_balances (course_id, points_balance desc);
create index if not exists engagement_reward_catalog_course_idx
  on public.engagement_reward_catalog (course_id, is_active, cost_points);
create index if not exists class_engagement_goals_course_idx
  on public.class_engagement_goals (course_id, status, updated_at desc);
create index if not exists engagement_reward_unlocks_learner_idx
  on public.engagement_reward_unlocks (learner_id, course_id, unlocked_at desc);
create index if not exists class_groups_course_idx
  on public.class_groups (course_id, status, assignment_mode);
create index if not exists class_group_memberships_learner_idx
  on public.class_group_memberships (learner_id, course_id, status);
create index if not exists class_group_memberships_active_group_idx
  on public.class_group_memberships (group_id, status) where status = 'active';
create unique index if not exists class_group_memberships_one_active_per_course_idx
  on public.class_group_memberships (course_id, learner_id) where status = 'active';
create index if not exists classroom_activities_course_status_idx
  on public.classroom_activities (course_id, status, updated_at desc);
create index if not exists classroom_activity_questions_activity_idx
  on public.classroom_activity_questions (activity_id, position);
create index if not exists classroom_activity_options_question_idx
  on public.classroom_activity_options (question_id, position);
create index if not exists classroom_activity_participants_course_idx
  on public.classroom_activity_participants (course_id, last_seen_at desc);
create index if not exists classroom_activity_responses_activity_idx
  on public.classroom_activity_responses (activity_id, submitted_at desc);
create index if not exists classroom_activity_responses_learner_idx
  on public.classroom_activity_responses (learner_id, course_id, submitted_at desc);

create or replace function private.is_active_engagement_account(p_user_id uuid)
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

revoke all on function private.is_active_engagement_account(uuid) from public;
grant execute on function private.is_active_engagement_account(uuid) to authenticated;

create or replace function private.is_active_course_learner(p_course_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_engagement_account(p_user_id) and exists (
    select 1 from public.course_memberships cm
    where cm.course_id = p_course_id and cm.user_id = p_user_id and cm.role = 'learner'
  );
$$;

revoke all on function private.is_active_course_learner(uuid, uuid) from public, anon, authenticated;

create or replace function private.apply_engagement_point_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.points_delta > 0 then
    insert into public.engagement_point_balances (
      course_id, learner_id, points_balance, lifetime_earned, lifetime_spent, updated_at
    ) values (
      new.course_id, new.learner_id, new.points_delta, new.points_delta, 0, now()
    )
    on conflict (course_id, learner_id) do update
      set points_balance = public.engagement_point_balances.points_balance + excluded.points_balance,
          lifetime_earned = public.engagement_point_balances.lifetime_earned + excluded.lifetime_earned,
          updated_at = now();
  else
    update public.engagement_point_balances
       set points_balance = points_balance + new.points_delta,
           lifetime_spent = lifetime_spent + case
             when new.source_type = 'reward_unlock' then abs(new.points_delta) else 0 end,
           updated_at = now()
     where course_id = new.course_id
       and learner_id = new.learner_id
       and points_balance >= abs(new.points_delta);
    if not found then
      raise exception 'Not enough engagement points for this unlock';
    end if;
  end if;
  if new.points_delta > 0 then
    update public.class_engagement_goals
       set current_points = current_points + new.points_delta,
           status = case when current_points + new.points_delta >= target_points then 'achieved' else status end,
           achieved_at = case
             when current_points + new.points_delta >= target_points then coalesce(achieved_at, now())
             else achieved_at
           end,
           updated_at = now()
     where course_id = new.course_id
       and status = 'active'
       and (starts_at is null or starts_at <= new.created_at)
       and (ends_at is null or ends_at >= new.created_at);
  end if;
  return new;
end;
$$;

create or replace function private.prevent_engagement_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Engagement point ledger entries are immutable';
end;
$$;

revoke all on function private.apply_engagement_point_balance() from public;
revoke all on function private.prevent_engagement_ledger_mutation() from public;

drop trigger if exists engagement_point_ledger_apply_balance on public.engagement_point_ledger;
create trigger engagement_point_ledger_apply_balance
after insert on public.engagement_point_ledger
for each row execute function private.apply_engagement_point_balance();

drop trigger if exists engagement_point_ledger_immutable on public.engagement_point_ledger;
create trigger engagement_point_ledger_immutable
before update or delete on public.engagement_point_ledger
for each row execute function private.prevent_engagement_ledger_mutation();

create or replace function private.set_assignment_point_rule(
  p_course_id uuid,
  p_assignment_id uuid,
  p_points integer,
  p_claim_mode text default 'learner_claim',
  p_requires_submission boolean default true,
  p_is_active boolean default true
)
returns public.assignment_point_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rule public.assignment_point_rules%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(p_course_id) then
    raise exception 'Only an active course educator can set engagement points';
  end if;
  if p_points not between 0 and 100000 then
    raise exception 'Point value must be between 0 and 100000';
  end if;
  if p_claim_mode not in ('learner_claim', 'professor_only') then
    raise exception 'Unsupported point claim mode';
  end if;
  if not exists (
    select 1 from public.assignments a
    where a.id = p_assignment_id and a.course_id = p_course_id
  ) then
    raise exception 'Assignment does not belong to this course';
  end if;

  insert into public.assignment_point_rules (
    course_id, assignment_id, points_value, claim_mode,
    requires_submission, is_active, created_by
  ) values (
    p_course_id, p_assignment_id, p_points, p_claim_mode,
    p_requires_submission, p_is_active and p_points > 0, v_user_id
  )
  on conflict (course_id, assignment_id) do update
    set points_value = excluded.points_value,
        claim_mode = excluded.claim_mode,
        requires_submission = excluded.requires_submission,
        is_active = excluded.is_active,
        updated_at = now()
  returning * into v_rule;
  return v_rule;
end;
$$;

create or replace function private.claim_assignment_engagement_points(p_rule_id uuid)
returns public.engagement_point_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rule public.assignment_point_rules%rowtype;
  v_entry public.engagement_point_ledger%rowtype;
  v_key text;
begin
  if not private.is_active_engagement_account(v_user_id) then
    raise exception 'An active account is required';
  end if;
  select * into v_rule
  from public.assignment_point_rules
  where id = p_rule_id
  for update;
  if not found or not v_rule.is_active or v_rule.claim_mode <> 'learner_claim' then
    raise exception 'This assignment point award is not available for learner claim';
  end if;
  if not private.is_active_course_learner(v_rule.course_id, v_user_id) then
    raise exception 'Course enrollment is required';
  end if;
  if v_rule.requires_submission and not exists (
    select 1
    from public.assignment_form_templates t
    join public.assignment_form_submissions s on s.template_id = t.id
    where t.course_id = v_rule.course_id
      and t.assignment_id = v_rule.assignment_id
      and s.student_id = v_user_id
      and s.status = 'submitted'
  ) then
    raise exception 'Submit this assignment before claiming its engagement points';
  end if;

  v_key := 'assignment-rule:' || v_rule.id::text;
  insert into public.engagement_point_ledger (
    course_id, learner_id, rule_id, source_type, points_delta,
    reason, idempotency_key, metadata, created_by
  ) values (
    v_rule.course_id, v_user_id, v_rule.id, 'assignment_claim', v_rule.points_value,
    'Assignment engagement award', v_key,
    jsonb_build_object('assignment_id', v_rule.assignment_id), v_user_id
  )
  on conflict (course_id, learner_id, idempotency_key) do nothing
  returning * into v_entry;
  if v_entry.id is null then
    select * into v_entry from public.engagement_point_ledger
    where course_id = v_rule.course_id and learner_id = v_user_id and idempotency_key = v_key;
  end if;
  return v_entry;
end;
$$;

create or replace function private.award_course_engagement_points(
  p_course_id uuid,
  p_learner_id uuid,
  p_points integer,
  p_reason text,
  p_idempotency_key text
)
returns public.engagement_point_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_entry public.engagement_point_ledger%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(p_course_id) then
    raise exception 'Only an active course educator can award engagement points';
  end if;
  if not private.is_active_course_learner(p_course_id, p_learner_id) then
    raise exception 'Learner is not active in this course';
  end if;
  if p_points = 0 or p_points not between -100000 and 100000 then
    raise exception 'Point adjustment must be between -100000 and 100000 and cannot be zero';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception 'A reason and stable idempotency key are required';
  end if;

  insert into public.engagement_point_ledger (
    course_id, learner_id, source_type, points_delta, reason,
    idempotency_key, metadata, created_by
  ) values (
    p_course_id, p_learner_id,
    case when p_points > 0 then 'professor_award' else 'adjustment' end,
    p_points, trim(p_reason), trim(p_idempotency_key), '{}'::jsonb, v_user_id
  )
  on conflict (course_id, learner_id, idempotency_key) do nothing
  returning * into v_entry;
  if v_entry.id is null then
    select * into v_entry from public.engagement_point_ledger
    where course_id = p_course_id and learner_id = p_learner_id
      and idempotency_key = trim(p_idempotency_key);
    if v_entry.points_delta <> p_points
       or v_entry.reason <> trim(p_reason)
       or v_entry.source_type <> case when p_points > 0 then 'professor_award' else 'adjustment' end then
      raise exception 'This idempotency key is already used by a different engagement award';
    end if;
  end if;
  return v_entry;
end;
$$;

create or replace function private.save_class_engagement_reward(
  p_course_id uuid,
  p_title text,
  p_cost_points integer,
  p_reward_id uuid default null,
  p_description text default '',
  p_reward_type text default 'badge',
  p_is_active boolean default true,
  p_goal_title text default null,
  p_goal_target_points bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reward public.engagement_reward_catalog%rowtype;
  v_goal public.class_engagement_goals%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(p_course_id) then
    raise exception 'Only an active course educator can save rewards';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 160
     or char_length(coalesce(p_description, '')) > 2000
     or p_cost_points not between 1 and 100000
     or p_reward_type not in ('badge', 'theme', 'class_perk', 'recognition') then
    raise exception 'Reward details are invalid';
  end if;

  if p_reward_id is null then
    insert into public.engagement_reward_catalog (
      course_id, title, description, reward_type, cost_points, is_active, created_by
    ) values (
      p_course_id, trim(p_title), coalesce(p_description, ''), p_reward_type,
      p_cost_points, p_is_active, v_user_id
    ) returning * into v_reward;
  else
    update public.engagement_reward_catalog
       set title = trim(p_title), description = coalesce(p_description, ''),
           reward_type = p_reward_type, cost_points = p_cost_points,
           is_active = p_is_active, updated_at = now()
     where id = p_reward_id and course_id = p_course_id
     returning * into v_reward;
    if not found then raise exception 'Reward was not found in this course'; end if;
  end if;

  if p_goal_target_points is not null then
    if p_goal_target_points not between 1 and 1000000000 then
      raise exception 'Class goal target is outside the allowed range';
    end if;
    insert into public.class_engagement_goals (
      course_id, reward_id, title, target_points, status, created_by, starts_at
    ) values (
      p_course_id, v_reward.id, coalesce(nullif(trim(p_goal_title), ''), trim(p_title)),
      p_goal_target_points, 'active', v_user_id, now()
    )
    on conflict (course_id, reward_id) do update
      set title = excluded.title, target_points = excluded.target_points,
          status = case
            when public.class_engagement_goals.current_points >= excluded.target_points then 'achieved'
            when public.class_engagement_goals.status = 'archived' then 'active'
            else public.class_engagement_goals.status
          end,
          achieved_at = case
            when public.class_engagement_goals.current_points >= excluded.target_points
              then coalesce(public.class_engagement_goals.achieved_at, now())
            else public.class_engagement_goals.achieved_at
          end,
          updated_at = now()
    returning * into v_goal;
  end if;

  return jsonb_build_object('reward', to_jsonb(v_reward), 'goal', to_jsonb(v_goal));
end;
$$;

create or replace function private.save_class_engagement_goal(
  p_course_id uuid,
  p_title text,
  p_target_points bigint,
  p_goal_id uuid default null,
  p_description text default '',
  p_status text default 'active',
  p_reward_id uuid default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns public.class_engagement_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_goal public.class_engagement_goals%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(p_course_id) then
    raise exception 'Only an active course educator can save class goals';
  end if;
  if p_status not in ('draft', 'active', 'achieved', 'archived')
     or p_target_points not between 1 and 1000000000
     or char_length(trim(coalesce(p_title, ''))) not between 1 and 160
     or (p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'Class goal details are invalid';
  end if;
  if p_reward_id is not null and not exists (
    select 1 from public.engagement_reward_catalog r
    where r.id = p_reward_id and r.course_id = p_course_id
  ) then
    raise exception 'Reward does not belong to this course';
  end if;

  if p_goal_id is null then
    insert into public.class_engagement_goals (
      course_id, reward_id, title, description, target_points, status,
      starts_at, ends_at, achieved_at, created_by
    ) values (
      p_course_id, p_reward_id, trim(p_title), coalesce(p_description, ''),
      p_target_points, p_status, p_starts_at, p_ends_at,
      case when p_status = 'achieved' then now() else null end, v_user_id
    ) returning * into v_goal;
  else
    update public.class_engagement_goals
       set reward_id = p_reward_id, title = trim(p_title), description = coalesce(p_description, ''),
           target_points = p_target_points,
           status = case
             when p_status = 'active' and current_points >= p_target_points then 'achieved'
             else p_status
           end,
           starts_at = p_starts_at,
           ends_at = p_ends_at,
           achieved_at = case
             when p_status = 'achieved' or (p_status = 'active' and current_points >= p_target_points)
               then coalesce(achieved_at, now())
             else null
           end,
           updated_at = now()
     where id = p_goal_id and course_id = p_course_id
     returning * into v_goal;
    if not found then raise exception 'Class goal was not found'; end if;
  end if;
  return v_goal;
end;
$$;

create or replace function private.unlock_engagement_reward(p_reward_id uuid)
returns public.engagement_reward_unlocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reward public.engagement_reward_catalog%rowtype;
  v_entry public.engagement_point_ledger%rowtype;
  v_unlock public.engagement_reward_unlocks%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id) then
    raise exception 'An active account is required';
  end if;
  select * into v_reward from public.engagement_reward_catalog
  where id = p_reward_id for update;
  if not found or not v_reward.is_active
     or not private.is_active_course_learner(v_reward.course_id, v_user_id) then
    raise exception 'This reward is not available';
  end if;
  select * into v_unlock from public.engagement_reward_unlocks
  where reward_id = v_reward.id and learner_id = v_user_id;
  if found then return v_unlock; end if;

  insert into public.engagement_point_ledger (
    course_id, learner_id, source_type, points_delta, reason,
    idempotency_key, metadata, created_by
  ) values (
    v_reward.course_id, v_user_id, 'reward_unlock', -v_reward.cost_points,
    'Unlocked reward: ' || v_reward.title, 'reward-unlock:' || v_reward.id::text,
    jsonb_build_object('reward_id', v_reward.id), v_user_id
  ) returning * into v_entry;

  insert into public.engagement_reward_unlocks (
    course_id, reward_id, learner_id, ledger_entry_id, points_spent
  ) values (
    v_reward.course_id, v_reward.id, v_user_id, v_entry.id, v_reward.cost_points
  ) returning * into v_unlock;
  return v_unlock;
end;
$$;

create or replace function private.create_class_group(
  p_course_id uuid,
  p_name text,
  p_description text default '',
  p_assignment_mode text default 'teacher_assign',
  p_max_members integer default 6
)
returns public.class_groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_group public.class_groups%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(p_course_id) then
    raise exception 'Only an active course educator can create class groups';
  end if;
  if p_assignment_mode not in ('teacher_assign', 'student_choice')
     or p_max_members not between 2 and 100
     or char_length(trim(coalesce(p_name, ''))) not between 1 and 160
     or char_length(coalesce(p_description, '')) > 2000 then
    raise exception 'Class group details are invalid';
  end if;
  insert into public.class_groups (
    course_id, name, description, assignment_mode, join_open, max_members, created_by
  ) values (
    p_course_id, trim(p_name), coalesce(p_description, ''), p_assignment_mode,
    p_assignment_mode = 'student_choice', p_max_members, v_user_id
  ) returning * into v_group;
  return v_group;
end;
$$;

create or replace function private.set_course_group_assignment_mode(
  p_course_id uuid,
  p_assignment_mode text
)
returns public.course_engagement_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_settings public.course_engagement_settings%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(p_course_id) then
    raise exception 'Only an active course educator can change group defaults';
  end if;
  if p_assignment_mode not in ('teacher_assign', 'student_choice') then
    raise exception 'Unsupported class group assignment mode';
  end if;
  insert into public.course_engagement_settings (
    course_id, default_group_assignment_mode, created_by
  ) values (
    p_course_id, p_assignment_mode, v_user_id
  )
  on conflict (course_id) do update
    set default_group_assignment_mode = excluded.default_group_assignment_mode,
        updated_at = now()
  returning * into v_settings;
  return v_settings;
end;
$$;

create or replace function private.set_class_group_assignment_mode(
  p_group_id uuid,
  p_assignment_mode text,
  p_join_open boolean default true
)
returns public.class_groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_group public.class_groups%rowtype;
begin
  select * into v_group from public.class_groups where id = p_group_id for update;
  if not found
     or not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(v_group.course_id) then
    raise exception 'Class group management is not allowed';
  end if;
  if p_assignment_mode not in ('teacher_assign', 'student_choice') then
    raise exception 'Unsupported class group assignment mode';
  end if;
  update public.class_groups
     set assignment_mode = p_assignment_mode,
         join_open = case when p_assignment_mode = 'student_choice' then p_join_open else false end,
         updated_at = now()
   where id = p_group_id
   returning * into v_group;
  return v_group;
end;
$$;

create or replace function private.set_class_group_member(
  p_group_id uuid,
  p_learner_id uuid,
  p_active boolean default true
)
returns public.class_group_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_group public.class_groups%rowtype;
  v_membership public.class_group_memberships%rowtype;
  v_active_count integer;
begin
  select * into v_group from public.class_groups where id = p_group_id for update;
  if not found or v_group.status <> 'active'
     or not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(v_group.course_id) then
    raise exception 'Class group management is not allowed';
  end if;
  if not private.is_active_course_learner(v_group.course_id, p_learner_id) then
    raise exception 'Learner is not active in this course';
  end if;
  if p_active then
    update public.class_group_memberships
       set status = 'left', left_at = now(), updated_at = now()
     where course_id = v_group.course_id and learner_id = p_learner_id
       and group_id <> p_group_id and status = 'active';
    select count(*) into v_active_count from public.class_group_memberships
    where group_id = p_group_id and status = 'active' and learner_id <> p_learner_id;
    if v_active_count >= v_group.max_members then raise exception 'This class group is full'; end if;
    insert into public.class_group_memberships (
      group_id, course_id, learner_id, status, assigned_by, joined_at, left_at
    ) values (
      v_group.id, v_group.course_id, p_learner_id, 'active', v_user_id, now(), null
    )
    on conflict (group_id, learner_id) do update
      set status = 'active', assigned_by = v_user_id, joined_at = now(), left_at = null, updated_at = now()
    returning * into v_membership;
  else
    update public.class_group_memberships
       set status = 'left', left_at = now(), assigned_by = v_user_id, updated_at = now()
     where group_id = p_group_id and learner_id = p_learner_id
     returning * into v_membership;
    if not found then raise exception 'Class group membership was not found'; end if;
  end if;
  return v_membership;
end;
$$;

create or replace function private.join_class_group(p_group_id uuid)
returns public.class_group_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_group public.class_groups%rowtype;
  v_membership public.class_group_memberships%rowtype;
  v_active_count integer;
begin
  if not private.is_active_engagement_account(v_user_id) then
    raise exception 'An active account is required';
  end if;
  select * into v_group from public.class_groups where id = p_group_id for update;
  if not found or v_group.status <> 'active' or v_group.assignment_mode <> 'student_choice'
     or not v_group.join_open or not private.is_active_course_learner(v_group.course_id, v_user_id) then
    raise exception 'This class group is not open for student choice';
  end if;
  update public.class_group_memberships
     set status = 'left', left_at = now(), updated_at = now()
   where course_id = v_group.course_id and learner_id = v_user_id
     and group_id <> p_group_id and status = 'active';
  select count(*) into v_active_count from public.class_group_memberships
  where group_id = p_group_id and status = 'active' and learner_id <> v_user_id;
  if v_active_count >= v_group.max_members then raise exception 'This class group is full'; end if;

  insert into public.class_group_memberships (
    group_id, course_id, learner_id, status, assigned_by, joined_at, left_at
  ) values (
    v_group.id, v_group.course_id, v_user_id, 'active', null, now(), null
  )
  on conflict (group_id, learner_id) do update
    set status = 'active', assigned_by = null, joined_at = now(), left_at = null, updated_at = now()
  returning * into v_membership;
  return v_membership;
end;
$$;

create or replace function private.leave_class_group(p_group_id uuid)
returns public.class_group_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_group public.class_groups%rowtype;
  v_membership public.class_group_memberships%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id) then
    raise exception 'An active account is required';
  end if;
  select * into v_group from public.class_groups where id = p_group_id;
  if not found or v_group.assignment_mode <> 'student_choice' then
    raise exception 'Teacher-assigned groups must be changed by the educator';
  end if;
  update public.class_group_memberships
     set status = 'left', left_at = now(), updated_at = now()
   where group_id = p_group_id and learner_id = v_user_id and status = 'active'
   returning * into v_membership;
  if not found then raise exception 'Active class group membership was not found'; end if;
  return v_membership;
end;
$$;

create or replace function private.create_classroom_activity(
  p_course_id uuid,
  p_title text,
  p_activity_type text,
  p_instructions text default '',
  p_questions jsonb default '[]'::jsonb,
  p_settings jsonb default '{}'::jsonb
)
returns public.classroom_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_activity public.classroom_activities%rowtype;
  v_question jsonb;
  v_option jsonb;
  v_question_id uuid;
  v_question_position integer := 0;
  v_option_position integer;
  v_kind text;
  v_prompt text;
  v_options jsonb;
  v_label text;
begin
  if not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(p_course_id) then
    raise exception 'Only an active course educator can create classroom activities';
  end if;
  if p_activity_type not in ('quiz', 'poll', 'group_challenge')
     or char_length(trim(coalesce(p_title, ''))) not between 1 and 200
     or char_length(coalesce(p_instructions, '')) > 10000
     or jsonb_typeof(coalesce(p_settings, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) not between 1 and 50 then
    raise exception 'Classroom activity details are invalid';
  end if;

  insert into public.classroom_activities (
    course_id, created_by, title, instructions, activity_type, status, settings
  ) values (
    p_course_id, v_user_id, trim(p_title), coalesce(p_instructions, ''),
    p_activity_type, 'draft', coalesce(p_settings, '{}'::jsonb)
  ) returning * into v_activity;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    if jsonb_typeof(v_question) <> 'object' then raise exception 'Each activity question must be an object'; end if;
    v_prompt := trim(coalesce(v_question ->> 'prompt', ''));
    v_kind := coalesce(v_question ->> 'responseKind', v_question ->> 'response_kind', 'single_choice');
    v_options := coalesce(v_question -> 'options', '[]'::jsonb);
    if char_length(v_prompt) not between 1 and 2000
       or v_kind not in ('single_choice', 'multiple_choice', 'free_text')
       or jsonb_typeof(v_options) <> 'array' then
      raise exception 'Activity question details are invalid';
    end if;
    if v_kind = 'free_text' and jsonb_array_length(v_options) <> 0 then
      raise exception 'Free-text questions cannot include choice options';
    elsif v_kind <> 'free_text' and jsonb_array_length(v_options) not between 2 and 20 then
      raise exception 'Choice questions require between 2 and 20 options';
    end if;

    insert into public.classroom_activity_questions (
      activity_id, course_id, position, prompt, response_kind, is_required, points_available
    ) values (
      v_activity.id, p_course_id, v_question_position, v_prompt, v_kind,
      coalesce((v_question ->> 'required')::boolean, true),
      greatest(0, least(100000, coalesce((v_question ->> 'points')::integer, 0)))
    ) returning id into v_question_id;

    v_option_position := 0;
    for v_option in select value from jsonb_array_elements(v_options)
    loop
      v_label := trim(case when jsonb_typeof(v_option) = 'string'
        then v_option #>> '{}'
        else coalesce(v_option ->> 'label', '') end);
      if char_length(v_label) not between 1 and 500 then raise exception 'Activity option label is invalid'; end if;
      insert into public.classroom_activity_options (
        question_id, activity_id, course_id, position, label
      ) values (
        v_question_id, v_activity.id, p_course_id, v_option_position, v_label
      );
      v_option_position := v_option_position + 1;
    end loop;
    v_question_position := v_question_position + 1;
  end loop;
  return v_activity;
end;
$$;

create or replace function private.start_classroom_activity(p_activity_id uuid)
returns public.classroom_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_activity public.classroom_activities%rowtype;
begin
  select * into v_activity from public.classroom_activities where id = p_activity_id for update;
  if not found
     or not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(v_activity.course_id) then
    raise exception 'Classroom activity management is not allowed';
  end if;
  if v_activity.status = 'closed' then raise exception 'A closed activity cannot be restarted'; end if;
  if v_activity.status = 'live' then return v_activity; end if;
  if not exists (select 1 from public.classroom_activity_questions q where q.activity_id = p_activity_id) then
    raise exception 'Add at least one question before starting';
  end if;
  update public.classroom_activities
     set status = 'live', started_at = now(), closed_at = null, updated_at = now()
   where id = p_activity_id
   returning * into v_activity;
  return v_activity;
end;
$$;

create or replace function private.close_classroom_activity(p_activity_id uuid)
returns public.classroom_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_activity public.classroom_activities%rowtype;
begin
  select * into v_activity from public.classroom_activities where id = p_activity_id for update;
  if not found
     or not private.is_active_engagement_account(v_user_id)
     or not private.can_manage_course(v_activity.course_id) then
    raise exception 'Classroom activity management is not allowed';
  end if;
  if v_activity.status = 'draft' then raise exception 'Start the activity before closing it'; end if;
  if v_activity.status = 'closed' then return v_activity; end if;
  update public.classroom_activities
     set status = 'closed', closed_at = now(), updated_at = now()
   where id = p_activity_id
   returning * into v_activity;
  return v_activity;
end;
$$;

create or replace function private.join_classroom_activity(p_activity_id uuid)
returns public.classroom_activity_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_activity public.classroom_activities%rowtype;
  v_participant public.classroom_activity_participants%rowtype;
begin
  if not private.is_active_engagement_account(v_user_id) then raise exception 'An active account is required'; end if;
  select * into v_activity from public.classroom_activities where id = p_activity_id for share;
  if not found or v_activity.status <> 'live'
     or not private.is_active_course_learner(v_activity.course_id, v_user_id) then
    raise exception 'This classroom activity is not live for your course';
  end if;
  insert into public.classroom_activity_participants (activity_id, course_id, learner_id)
  values (v_activity.id, v_activity.course_id, v_user_id)
  on conflict (activity_id, learner_id) do update set last_seen_at = now()
  returning * into v_participant;
  return v_participant;
end;
$$;

create or replace function private.submit_classroom_activity_response(
  p_activity_id uuid,
  p_question_id uuid,
  p_option_ids uuid[] default '{}',
  p_text_response text default null,
  p_group_id uuid default null
)
returns public.classroom_activity_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_activity public.classroom_activities%rowtype;
  v_question public.classroom_activity_questions%rowtype;
  v_response public.classroom_activity_responses%rowtype;
  v_option_count integer;
  v_options uuid[] := coalesce(p_option_ids, '{}'::uuid[]);
  v_text text := nullif(trim(coalesce(p_text_response, '')), '');
begin
  if not private.is_active_engagement_account(v_user_id) then raise exception 'An active account is required'; end if;
  select * into v_activity from public.classroom_activities where id = p_activity_id for share;
  if not found or v_activity.status <> 'live'
     or not private.is_active_course_learner(v_activity.course_id, v_user_id) then
    raise exception 'This classroom activity is not accepting responses';
  end if;
  select * into v_question from public.classroom_activity_questions
  where id = p_question_id and activity_id = p_activity_id;
  if not found then raise exception 'Question does not belong to this activity'; end if;

  if v_question.response_kind = 'free_text' then
    if v_text is null or char_length(v_text) > 10000 or cardinality(v_options) <> 0 then
      raise exception 'A valid text response is required';
    end if;
  else
    if v_text is not null
       or (v_question.response_kind = 'single_choice' and cardinality(v_options) <> 1)
       or (v_question.response_kind = 'multiple_choice' and cardinality(v_options) not between 1 and 20) then
      raise exception 'Choose a valid response option';
    end if;
    select count(distinct selected.option_id) into v_option_count
    from unnest(v_options) as selected(option_id)
    join public.classroom_activity_options o on o.id = selected.option_id
    where o.question_id = p_question_id;
    if v_option_count <> cardinality(v_options) then raise exception 'One or more options do not belong to this question'; end if;
  end if;

  if v_activity.activity_type = 'group_challenge' then
    if p_group_id is null or not exists (
      select 1 from public.class_group_memberships gm
      where gm.group_id = p_group_id and gm.course_id = v_activity.course_id
        and gm.learner_id = v_user_id and gm.status = 'active'
    ) then
      raise exception 'Join the selected course group before responding';
    end if;
  elsif p_group_id is not null then
    raise exception 'Only group challenges accept a class group';
  end if;

  insert into public.classroom_activity_participants (activity_id, course_id, learner_id)
  values (v_activity.id, v_activity.course_id, v_user_id)
  on conflict (activity_id, learner_id) do update set last_seen_at = now();

  insert into public.classroom_activity_responses (
    activity_id, question_id, course_id, learner_id, group_id,
    option_ids, text_response, submitted_at
  ) values (
    v_activity.id, v_question.id, v_activity.course_id, v_user_id, p_group_id,
    v_options, v_text, now()
  )
  on conflict (activity_id, question_id, learner_id) do update
    set group_id = excluded.group_id, option_ids = excluded.option_ids,
        text_response = excluded.text_response, submitted_at = now(), updated_at = now()
  returning * into v_response;
  return v_response;
end;
$$;

-- Public RPC wrappers stay security-invoker. Privileged mutations live only in
-- the non-exposed private schema and perform their own auth/course checks.
create or replace function public.set_assignment_point_rule(
  p_course_id uuid, p_assignment_id uuid, p_points integer,
  p_claim_mode text default 'learner_claim',
  p_requires_submission boolean default true,
  p_is_active boolean default true
)
returns public.assignment_point_rules
language sql volatile security invoker set search_path = ''
as $$ select private.set_assignment_point_rule(p_course_id, p_assignment_id, p_points, p_claim_mode, p_requires_submission, p_is_active); $$;

create or replace function public.claim_assignment_engagement_points(p_rule_id uuid)
returns public.engagement_point_ledger
language sql volatile security invoker set search_path = ''
as $$ select private.claim_assignment_engagement_points(p_rule_id); $$;

create or replace function public.award_course_engagement_points(
  p_course_id uuid, p_learner_id uuid, p_points integer, p_reason text, p_idempotency_key text
)
returns public.engagement_point_ledger
language sql volatile security invoker set search_path = ''
as $$ select private.award_course_engagement_points(p_course_id, p_learner_id, p_points, p_reason, p_idempotency_key); $$;

create or replace function public.save_class_engagement_reward(
  p_course_id uuid, p_title text, p_cost_points integer,
  p_reward_id uuid default null, p_description text default '',
  p_reward_type text default 'badge', p_is_active boolean default true,
  p_goal_title text default null, p_goal_target_points bigint default null
)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select private.save_class_engagement_reward(p_course_id, p_title, p_cost_points, p_reward_id, p_description, p_reward_type, p_is_active, p_goal_title, p_goal_target_points); $$;

create or replace function public.save_class_engagement_goal(
  p_course_id uuid, p_title text, p_target_points bigint,
  p_goal_id uuid default null, p_description text default '',
  p_status text default 'active', p_reward_id uuid default null,
  p_starts_at timestamptz default null, p_ends_at timestamptz default null
)
returns public.class_engagement_goals
language sql volatile security invoker set search_path = ''
as $$ select private.save_class_engagement_goal(p_course_id, p_title, p_target_points, p_goal_id, p_description, p_status, p_reward_id, p_starts_at, p_ends_at); $$;

create or replace function public.unlock_engagement_reward(p_reward_id uuid)
returns public.engagement_reward_unlocks
language sql volatile security invoker set search_path = ''
as $$ select private.unlock_engagement_reward(p_reward_id); $$;

create or replace function public.create_class_group(
  p_course_id uuid, p_name text, p_description text default '',
  p_assignment_mode text default 'teacher_assign', p_max_members integer default 6
)
returns public.class_groups
language sql volatile security invoker set search_path = ''
as $$ select private.create_class_group(p_course_id, p_name, p_description, p_assignment_mode, p_max_members); $$;

create or replace function public.set_course_group_assignment_mode(
  p_course_id uuid, p_assignment_mode text
)
returns public.course_engagement_settings
language sql volatile security invoker set search_path = ''
as $$ select private.set_course_group_assignment_mode(p_course_id, p_assignment_mode); $$;

create or replace function public.set_class_group_assignment_mode(
  p_group_id uuid, p_assignment_mode text, p_join_open boolean default true
)
returns public.class_groups
language sql volatile security invoker set search_path = ''
as $$ select private.set_class_group_assignment_mode(p_group_id, p_assignment_mode, p_join_open); $$;

create or replace function public.set_class_group_member(
  p_group_id uuid, p_learner_id uuid, p_active boolean default true
)
returns public.class_group_memberships
language sql volatile security invoker set search_path = ''
as $$ select private.set_class_group_member(p_group_id, p_learner_id, p_active); $$;

create or replace function public.join_class_group(p_group_id uuid)
returns public.class_group_memberships
language sql volatile security invoker set search_path = ''
as $$ select private.join_class_group(p_group_id); $$;

create or replace function public.leave_class_group(p_group_id uuid)
returns public.class_group_memberships
language sql volatile security invoker set search_path = ''
as $$ select private.leave_class_group(p_group_id); $$;

create or replace function public.create_classroom_activity(
  p_course_id uuid, p_title text, p_activity_type text,
  p_instructions text default '', p_questions jsonb default '[]'::jsonb,
  p_settings jsonb default '{}'::jsonb
)
returns public.classroom_activities
language sql volatile security invoker set search_path = ''
as $$ select private.create_classroom_activity(p_course_id, p_title, p_activity_type, p_instructions, p_questions, p_settings); $$;

create or replace function public.start_classroom_activity(p_activity_id uuid)
returns public.classroom_activities
language sql volatile security invoker set search_path = ''
as $$ select private.start_classroom_activity(p_activity_id); $$;

create or replace function public.close_classroom_activity(p_activity_id uuid)
returns public.classroom_activities
language sql volatile security invoker set search_path = ''
as $$ select private.close_classroom_activity(p_activity_id); $$;

create or replace function public.join_classroom_activity(p_activity_id uuid)
returns public.classroom_activity_participants
language sql volatile security invoker set search_path = ''
as $$ select private.join_classroom_activity(p_activity_id); $$;

create or replace function public.submit_classroom_activity_response(
  p_activity_id uuid, p_question_id uuid, p_option_ids uuid[] default '{}',
  p_text_response text default null, p_group_id uuid default null
)
returns public.classroom_activity_responses
language sql volatile security invoker set search_path = ''
as $$ select private.submit_classroom_activity_response(p_activity_id, p_question_id, p_option_ids, p_text_response, p_group_id); $$;

revoke all on function private.set_assignment_point_rule(uuid, uuid, integer, text, boolean, boolean) from public, anon, authenticated;
revoke all on function private.claim_assignment_engagement_points(uuid) from public, anon, authenticated;
revoke all on function private.award_course_engagement_points(uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function private.save_class_engagement_reward(uuid, text, integer, uuid, text, text, boolean, text, bigint) from public, anon, authenticated;
revoke all on function private.save_class_engagement_goal(uuid, text, bigint, uuid, text, text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function private.unlock_engagement_reward(uuid) from public, anon, authenticated;
revoke all on function private.create_class_group(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function private.set_course_group_assignment_mode(uuid, text) from public, anon, authenticated;
revoke all on function private.set_class_group_assignment_mode(uuid, text, boolean) from public, anon, authenticated;
revoke all on function private.set_class_group_member(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function private.join_class_group(uuid) from public, anon, authenticated;
revoke all on function private.leave_class_group(uuid) from public, anon, authenticated;
revoke all on function private.create_classroom_activity(uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.start_classroom_activity(uuid) from public, anon, authenticated;
revoke all on function private.close_classroom_activity(uuid) from public, anon, authenticated;
revoke all on function private.join_classroom_activity(uuid) from public, anon, authenticated;
revoke all on function private.submit_classroom_activity_response(uuid, uuid, uuid[], text, uuid) from public, anon, authenticated;

grant execute on function private.set_assignment_point_rule(uuid, uuid, integer, text, boolean, boolean) to authenticated;
grant execute on function private.claim_assignment_engagement_points(uuid) to authenticated;
grant execute on function private.award_course_engagement_points(uuid, uuid, integer, text, text) to authenticated;
grant execute on function private.save_class_engagement_reward(uuid, text, integer, uuid, text, text, boolean, text, bigint) to authenticated;
grant execute on function private.save_class_engagement_goal(uuid, text, bigint, uuid, text, text, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function private.unlock_engagement_reward(uuid) to authenticated;
grant execute on function private.create_class_group(uuid, text, text, text, integer) to authenticated;
grant execute on function private.set_course_group_assignment_mode(uuid, text) to authenticated;
grant execute on function private.set_class_group_assignment_mode(uuid, text, boolean) to authenticated;
grant execute on function private.set_class_group_member(uuid, uuid, boolean) to authenticated;
grant execute on function private.join_class_group(uuid) to authenticated;
grant execute on function private.leave_class_group(uuid) to authenticated;
grant execute on function private.create_classroom_activity(uuid, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function private.start_classroom_activity(uuid) to authenticated;
grant execute on function private.close_classroom_activity(uuid) to authenticated;
grant execute on function private.join_classroom_activity(uuid) to authenticated;
grant execute on function private.submit_classroom_activity_response(uuid, uuid, uuid[], text, uuid) to authenticated;

alter table public.assignment_point_rules enable row level security;
alter table public.engagement_point_ledger enable row level security;
alter table public.engagement_point_balances enable row level security;
alter table public.course_engagement_settings enable row level security;
alter table public.engagement_reward_catalog enable row level security;
alter table public.class_engagement_goals enable row level security;
alter table public.engagement_reward_unlocks enable row level security;
alter table public.class_groups enable row level security;
alter table public.class_group_memberships enable row level security;
alter table public.classroom_activities enable row level security;
alter table public.classroom_activity_questions enable row level security;
alter table public.classroom_activity_options enable row level security;
alter table public.classroom_activity_participants enable row level security;
alter table public.classroom_activity_responses enable row level security;

drop policy if exists assignment_point_rules_read on public.assignment_point_rules;
create policy assignment_point_rules_read
on public.assignment_point_rules for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (private.can_manage_course(course_id) or (is_active and private.can_access_course(course_id)))
);

drop policy if exists engagement_point_ledger_read on public.engagement_point_ledger;
create policy engagement_point_ledger_read
on public.engagement_point_ledger for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (learner_id = (select auth.uid()) or private.can_manage_course(course_id))
);

drop policy if exists engagement_point_balances_read on public.engagement_point_balances;
create policy engagement_point_balances_read
on public.engagement_point_balances for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (learner_id = (select auth.uid()) or private.can_manage_course(course_id))
);

drop policy if exists course_engagement_settings_read on public.course_engagement_settings;
create policy course_engagement_settings_read
on public.course_engagement_settings for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and private.can_access_course(course_id)
);

drop policy if exists engagement_reward_catalog_read on public.engagement_reward_catalog;
create policy engagement_reward_catalog_read
on public.engagement_reward_catalog for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (private.can_manage_course(course_id) or (is_active and private.can_access_course(course_id)))
);

drop policy if exists class_engagement_goals_read on public.class_engagement_goals;
create policy class_engagement_goals_read
on public.class_engagement_goals for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (
    private.can_manage_course(course_id)
    or (status in ('active', 'achieved') and private.can_access_course(course_id))
  )
);

drop policy if exists engagement_reward_unlocks_read on public.engagement_reward_unlocks;
create policy engagement_reward_unlocks_read
on public.engagement_reward_unlocks for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (learner_id = (select auth.uid()) or private.can_manage_course(course_id))
);

drop policy if exists class_groups_read on public.class_groups;
create policy class_groups_read
on public.class_groups for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (private.can_manage_course(course_id) or (status = 'active' and private.can_access_course(course_id)))
);

drop policy if exists class_group_memberships_read on public.class_group_memberships;
create policy class_group_memberships_read
on public.class_group_memberships for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (
    private.can_manage_course(course_id)
    or (
      private.can_access_course(course_id)
      and exists (select 1 from public.class_groups g where g.id = group_id and g.status = 'active')
    )
  )
);

drop policy if exists classroom_activities_read on public.classroom_activities;
create policy classroom_activities_read
on public.classroom_activities for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (
    private.can_manage_course(course_id)
    or (status in ('live', 'closed') and private.can_access_course(course_id))
  )
);

drop policy if exists classroom_activity_questions_read on public.classroom_activity_questions;
create policy classroom_activity_questions_read
on public.classroom_activity_questions for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and exists (
    select 1 from public.classroom_activities a
    where a.id = activity_id
      and (private.can_manage_course(a.course_id) or (a.status in ('live', 'closed') and private.can_access_course(a.course_id)))
  )
);

drop policy if exists classroom_activity_options_read on public.classroom_activity_options;
create policy classroom_activity_options_read
on public.classroom_activity_options for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and exists (
    select 1 from public.classroom_activities a
    where a.id = activity_id
      and (private.can_manage_course(a.course_id) or (a.status in ('live', 'closed') and private.can_access_course(a.course_id)))
  )
);

drop policy if exists classroom_activity_participants_read on public.classroom_activity_participants;
create policy classroom_activity_participants_read
on public.classroom_activity_participants for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (private.can_manage_course(course_id) or private.can_access_course(course_id))
);

drop policy if exists classroom_activity_responses_read on public.classroom_activity_responses;
create policy classroom_activity_responses_read
on public.classroom_activity_responses for select to authenticated
using (
  private.is_active_engagement_account((select auth.uid()))
  and (learner_id = (select auth.uid()) or private.can_manage_course(course_id))
);

revoke all on table public.assignment_point_rules from anon, authenticated;
revoke all on table public.engagement_point_ledger from anon, authenticated;
revoke all on table public.engagement_point_balances from anon, authenticated;
revoke all on table public.course_engagement_settings from anon, authenticated;
revoke all on table public.engagement_reward_catalog from anon, authenticated;
revoke all on table public.class_engagement_goals from anon, authenticated;
revoke all on table public.engagement_reward_unlocks from anon, authenticated;
revoke all on table public.class_groups from anon, authenticated;
revoke all on table public.class_group_memberships from anon, authenticated;
revoke all on table public.classroom_activities from anon, authenticated;
revoke all on table public.classroom_activity_questions from anon, authenticated;
revoke all on table public.classroom_activity_options from anon, authenticated;
revoke all on table public.classroom_activity_participants from anon, authenticated;
revoke all on table public.classroom_activity_responses from anon, authenticated;

grant select on table public.assignment_point_rules to authenticated;
grant select on table public.engagement_point_ledger to authenticated;
grant select on table public.engagement_point_balances to authenticated;
grant select on table public.course_engagement_settings to authenticated;
grant select on table public.engagement_reward_catalog to authenticated;
grant select on table public.class_engagement_goals to authenticated;
grant select on table public.engagement_reward_unlocks to authenticated;
grant select on table public.class_groups to authenticated;
grant select on table public.class_group_memberships to authenticated;
grant select on table public.classroom_activities to authenticated;
grant select on table public.classroom_activity_questions to authenticated;
grant select on table public.classroom_activity_options to authenticated;
grant select on table public.classroom_activity_participants to authenticated;
grant select on table public.classroom_activity_responses to authenticated;

revoke all on function public.set_assignment_point_rule(uuid, uuid, integer, text, boolean, boolean) from public, anon;
revoke all on function public.claim_assignment_engagement_points(uuid) from public, anon;
revoke all on function public.award_course_engagement_points(uuid, uuid, integer, text, text) from public, anon;
revoke all on function public.save_class_engagement_reward(uuid, text, integer, uuid, text, text, boolean, text, bigint) from public, anon;
revoke all on function public.save_class_engagement_goal(uuid, text, bigint, uuid, text, text, uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.unlock_engagement_reward(uuid) from public, anon;
revoke all on function public.create_class_group(uuid, text, text, text, integer) from public, anon;
revoke all on function public.set_course_group_assignment_mode(uuid, text) from public, anon;
revoke all on function public.set_class_group_assignment_mode(uuid, text, boolean) from public, anon;
revoke all on function public.set_class_group_member(uuid, uuid, boolean) from public, anon;
revoke all on function public.join_class_group(uuid) from public, anon;
revoke all on function public.leave_class_group(uuid) from public, anon;
revoke all on function public.create_classroom_activity(uuid, text, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.start_classroom_activity(uuid) from public, anon;
revoke all on function public.close_classroom_activity(uuid) from public, anon;
revoke all on function public.join_classroom_activity(uuid) from public, anon;
revoke all on function public.submit_classroom_activity_response(uuid, uuid, uuid[], text, uuid) from public, anon;

grant execute on function public.set_assignment_point_rule(uuid, uuid, integer, text, boolean, boolean) to authenticated;
grant execute on function public.claim_assignment_engagement_points(uuid) to authenticated;
grant execute on function public.award_course_engagement_points(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.save_class_engagement_reward(uuid, text, integer, uuid, text, text, boolean, text, bigint) to authenticated;
grant execute on function public.save_class_engagement_goal(uuid, text, bigint, uuid, text, text, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.unlock_engagement_reward(uuid) to authenticated;
grant execute on function public.create_class_group(uuid, text, text, text, integer) to authenticated;
grant execute on function public.set_course_group_assignment_mode(uuid, text) to authenticated;
grant execute on function public.set_class_group_assignment_mode(uuid, text, boolean) to authenticated;
grant execute on function public.set_class_group_member(uuid, uuid, boolean) to authenticated;
grant execute on function public.join_class_group(uuid) to authenticated;
grant execute on function public.leave_class_group(uuid) to authenticated;
grant execute on function public.create_classroom_activity(uuid, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.start_classroom_activity(uuid) to authenticated;
grant execute on function public.close_classroom_activity(uuid) to authenticated;
grant execute on function public.join_classroom_activity(uuid) to authenticated;
grant execute on function public.submit_classroom_activity_response(uuid, uuid, uuid[], text, uuid) to authenticated;

drop trigger if exists assignment_point_rules_touch_updated_at on public.assignment_point_rules;
create trigger assignment_point_rules_touch_updated_at before update on public.assignment_point_rules
for each row execute function private.touch_updated_at();
drop trigger if exists course_engagement_settings_touch_updated_at on public.course_engagement_settings;
create trigger course_engagement_settings_touch_updated_at before update on public.course_engagement_settings
for each row execute function private.touch_updated_at();
drop trigger if exists engagement_reward_catalog_touch_updated_at on public.engagement_reward_catalog;
create trigger engagement_reward_catalog_touch_updated_at before update on public.engagement_reward_catalog
for each row execute function private.touch_updated_at();
drop trigger if exists class_engagement_goals_touch_updated_at on public.class_engagement_goals;
create trigger class_engagement_goals_touch_updated_at before update on public.class_engagement_goals
for each row execute function private.touch_updated_at();
drop trigger if exists class_groups_touch_updated_at on public.class_groups;
create trigger class_groups_touch_updated_at before update on public.class_groups
for each row execute function private.touch_updated_at();
drop trigger if exists class_group_memberships_touch_updated_at on public.class_group_memberships;
create trigger class_group_memberships_touch_updated_at before update on public.class_group_memberships
for each row execute function private.touch_updated_at();
drop trigger if exists classroom_activities_touch_updated_at on public.classroom_activities;
create trigger classroom_activities_touch_updated_at before update on public.classroom_activities
for each row execute function private.touch_updated_at();
drop trigger if exists classroom_activity_questions_touch_updated_at on public.classroom_activity_questions;
create trigger classroom_activity_questions_touch_updated_at before update on public.classroom_activity_questions
for each row execute function private.touch_updated_at();
drop trigger if exists classroom_activity_options_touch_updated_at on public.classroom_activity_options;
create trigger classroom_activity_options_touch_updated_at before update on public.classroom_activity_options
for each row execute function private.touch_updated_at();
drop trigger if exists classroom_activity_responses_touch_updated_at on public.classroom_activity_responses;
create trigger classroom_activity_responses_touch_updated_at before update on public.classroom_activity_responses
for each row execute function private.touch_updated_at();

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'assignment_point_rules', 'engagement_point_ledger', 'engagement_point_balances',
      'course_engagement_settings', 'engagement_reward_catalog', 'class_engagement_goals', 'engagement_reward_unlocks',
      'class_groups', 'class_group_memberships', 'classroom_activities',
      'classroom_activity_questions', 'classroom_activity_options',
      'classroom_activity_participants', 'classroom_activity_responses'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

comment on table public.engagement_point_ledger is
  'Immutable engagement-only point events. These rows are not grades and never feed grade calculations.';
comment on table public.engagement_point_balances is
  'Derived engagement balances maintained transactionally from the immutable point ledger.';
comment on table public.course_engagement_settings is
  'Course-level defaults for engagement experiences, including how newly planned class groups are assigned.';
comment on table public.assignment_point_rules is
  'Professor-controlled engagement point values and learner-claim requirements for assignments.';
comment on table public.class_engagement_goals is
  'Shared course engagement goals whose progress increases from positive engagement ledger events.';
comment on table public.engagement_reward_catalog is
  'Small professor-authored class reward catalog paid for with engagement points.';
comment on table public.engagement_reward_unlocks is
  'Immutable learner reward unlock receipts linked to a point-spend ledger entry.';
comment on table public.class_groups is
  'Course groups supporting teacher assignment or student choice without deleting membership history.';
comment on table public.class_group_memberships is
  'Soft-state course group membership history; leaving marks a row left rather than deleting it.';
comment on table public.classroom_activities is
  'Realtime quiz, poll, and group-challenge sessions with draft, live, and closed states.';
comment on table public.classroom_activity_responses is
  'Per-question learner responses; unique per learner and visible only to that learner or course managers.';
