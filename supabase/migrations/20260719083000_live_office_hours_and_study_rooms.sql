-- Additive live-room foundation. Media is audio-only by product policy; a screen-share
-- track is the only video-class track the room token permits the client to publish.

create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  room_type text not null check (room_type in ('office_hours', 'study_room')),
  title text not null check (char_length(title) between 1 and 120),
  provider text not null default 'livekit' check (provider in ('livekit')),
  provider_room_name text not null unique check (char_length(provider_room_name) between 8 and 180),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  starts_at timestamptz,
  ended_at timestamptz,
  max_participants integer not null default 25 check (max_participants between 2 and 100),
  allow_participant_screen_share boolean not null default false,
  recording_policy text not null default 'off' check (recording_policy in ('off', 'host_opt_in', 'everyone_opt_in')),
  recording_status text not null default 'off' check (recording_status in ('off', 'awaiting_consent', 'recording', 'stopped', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_rooms_course_status_idx on public.live_rooms (course_id, status, starts_at);
alter table public.live_rooms enable row level security;

create table if not exists public.live_room_participants (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_role text not null default 'participant' check (room_role in ('host', 'participant')),
  joined_at timestamptz,
  left_at timestamptz,
  last_seen_at timestamptz,
  primary key (room_id, user_id)
);
alter table public.live_room_participants enable row level security;

create table if not exists public.live_room_recording_consents (
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consented boolean not null,
  decided_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.live_room_recording_consents enable row level security;

create table if not exists public.study_room_scratchpads (
  room_id uuid primary key references public.live_rooms(id) on delete cascade,
  content jsonb not null default '{}'::jsonb check (octet_length(content::text) <= 262144),
  version bigint not null default 1,
  updated_by uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.study_room_scratchpads enable row level security;

create table if not exists public.live_room_usage (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.live_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  connected_seconds integer not null check (connected_seconds between 0 and 86400),
  screen_share_seconds integer not null default 0 check (screen_share_seconds between 0 and 86400),
  recorded_seconds integer not null default 0 check (recorded_seconds between 0 and 86400),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.live_room_usage enable row level security;

create or replace function private.can_access_live_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.live_rooms r
    where r.id = p_room_id
      and private.can_access_course(r.course_id)
  );
$$;

revoke all on function private.can_access_live_room(uuid) from public;
grant execute on function private.can_access_live_room(uuid) to authenticated;

drop policy if exists live_rooms_member_read on public.live_rooms;
create policy live_rooms_member_read on public.live_rooms for select to authenticated
using (private.can_access_course(course_id));
drop policy if exists live_rooms_member_create on public.live_rooms;
create policy live_rooms_member_create on public.live_rooms for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_access_course(course_id)
  and (room_type = 'study_room' or private.can_manage_course(course_id))
);
drop policy if exists live_rooms_owner_update on public.live_rooms;
create policy live_rooms_owner_update on public.live_rooms for update to authenticated
using ((created_by = (select auth.uid()) and private.can_access_course(course_id)) or private.can_manage_course(course_id))
with check ((created_by = (select auth.uid()) and private.can_access_course(course_id)) or private.can_manage_course(course_id));
drop policy if exists live_rooms_owner_delete on public.live_rooms;
create policy live_rooms_owner_delete on public.live_rooms for delete to authenticated
using ((created_by = (select auth.uid()) and private.can_access_course(course_id)) or private.can_manage_course(course_id));

drop policy if exists live_room_participants_member_read on public.live_room_participants;
create policy live_room_participants_member_read on public.live_room_participants for select to authenticated
using (private.can_access_live_room(room_id));
drop policy if exists live_room_participants_self_join on public.live_room_participants;
create policy live_room_participants_self_join on public.live_room_participants for insert to authenticated
with check (
  user_id = (select auth.uid()) and private.can_access_live_room(room_id)
  and (room_role = 'participant' or exists (
    select 1 from public.live_rooms r where r.id = room_id and r.created_by = (select auth.uid())
  ))
);
drop policy if exists live_room_participants_self_update on public.live_room_participants;
create policy live_room_participants_self_update on public.live_room_participants for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists live_room_consents_room_read on public.live_room_recording_consents;
create policy live_room_consents_room_read on public.live_room_recording_consents for select to authenticated
using (private.can_access_live_room(room_id));
drop policy if exists live_room_consents_self_write on public.live_room_recording_consents;
create policy live_room_consents_self_write on public.live_room_recording_consents for insert to authenticated
with check (user_id = (select auth.uid()) and private.can_access_live_room(room_id));
drop policy if exists live_room_consents_self_update on public.live_room_recording_consents;
create policy live_room_consents_self_update on public.live_room_recording_consents for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists study_scratchpads_member_read on public.study_room_scratchpads;
create policy study_scratchpads_member_read on public.study_room_scratchpads for select to authenticated
using (private.can_access_live_room(room_id));
drop policy if exists study_scratchpads_member_create on public.study_room_scratchpads;
create policy study_scratchpads_member_create on public.study_room_scratchpads for insert to authenticated
with check (updated_by = (select auth.uid()) and private.can_access_live_room(room_id));
drop policy if exists study_scratchpads_member_update on public.study_room_scratchpads;
create policy study_scratchpads_member_update on public.study_room_scratchpads for update to authenticated
using (private.can_access_live_room(room_id))
with check (updated_by = (select auth.uid()) and private.can_access_live_room(room_id));

drop policy if exists live_room_usage_self_read on public.live_room_usage;
create policy live_room_usage_self_read on public.live_room_usage for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.live_rooms, public.live_room_participants, public.live_room_recording_consents,
  public.study_room_scratchpads, public.live_room_usage from anon;
grant select, insert, update, delete on public.live_rooms to authenticated;
grant select, insert on public.live_room_participants to authenticated;
grant update (joined_at, left_at, last_seen_at) on public.live_room_participants to authenticated;
grant select, insert on public.live_room_recording_consents to authenticated;
grant update (consented, decided_at) on public.live_room_recording_consents to authenticated;
grant select, insert, update on public.study_room_scratchpads to authenticated;
grant select on public.live_room_usage to authenticated;

drop trigger if exists live_rooms_touch_updated_at on public.live_rooms;
create trigger live_rooms_touch_updated_at before update on public.live_rooms
for each row execute function private.touch_updated_at();

comment on table public.live_rooms is 'Course-scoped audio and screen-share rooms; raw media is never stored here.';
comment on column public.live_rooms.recording_policy is 'Recording is off by default and requires explicit room policy plus consent.';
