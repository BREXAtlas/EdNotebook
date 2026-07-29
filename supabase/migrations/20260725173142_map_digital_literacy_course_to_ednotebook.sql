create extension if not exists "pgcrypto";

create table if not exists public.digital_literacy_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  presentation_id text check (presentation_id in ('man','woman')),
  avatar_style text,
  values_tags text[] not null default '{}',
  interest_tags text[] not null default '{}',
  academic_direction text,
  digital_priority_tags text[] not null default '{}',
  digital_goal text,
  file_organization text,
  research_confidence text,
  ai_experience text,
  ai_personalization_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_literacy_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null check (path in ('foundations','ai-quest')),
  current_node_id text,
  completed_node_ids text[] not null default '{}',
  stars jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id,path)
);

create table if not exists public.digital_literacy_story_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null check (path in ('foundations','ai-quest')),
  node_id text not null,
  choice_id text not null,
  chosen_at timestamptz not null default now()
);

create table if not exists public.digital_literacy_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  unique(user_id,achievement_id)
);

create table if not exists public.digital_literacy_completion_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null check (path in ('foundations','ai-quest','full-course')),
  completed_at timestamptz not null default now(),
  unique(user_id,path)
);

alter table public.digital_literacy_profiles enable row level security;
alter table public.digital_literacy_progress enable row level security;
alter table public.digital_literacy_story_choices enable row level security;
alter table public.digital_literacy_achievements enable row level security;
alter table public.digital_literacy_completion_records enable row level security;

create policy digital_literacy_profiles_owner_all on public.digital_literacy_profiles for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy digital_literacy_progress_owner_all on public.digital_literacy_progress for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy digital_literacy_story_choices_owner_all on public.digital_literacy_story_choices for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy digital_literacy_achievements_owner_all on public.digital_literacy_achievements for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy digital_literacy_completion_records_owner_all on public.digital_literacy_completion_records for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

grant select, insert, update, delete on public.digital_literacy_profiles to authenticated;
grant select, insert, update, delete on public.digital_literacy_progress to authenticated;
grant select, insert, update, delete on public.digital_literacy_story_choices to authenticated;
grant select, insert, update, delete on public.digital_literacy_achievements to authenticated;
grant select, insert, update, delete on public.digital_literacy_completion_records to authenticated;

revoke all on public.digital_literacy_profiles from anon;
revoke all on public.digital_literacy_progress from anon;
revoke all on public.digital_literacy_story_choices from anon;
revoke all on public.digital_literacy_achievements from anon;
revoke all on public.digital_literacy_completion_records from anon;
