-- Unique invitation numbers, referral progress, verified email sync, and reversible account-audit tracking.
alter table public.profiles
  add column if not exists account_number text,
  add column if not exists meaningful_activity_at timestamptz,
  add column if not exists last_active_at timestamptz,
  add column if not exists account_audit_status text not null default 'active'
    check (account_audit_status in ('unreviewed', 'active', 'inactive_review', 'confirmed_user', 'test_account')),
  add column if not exists inactive_flagged_at timestamptz,
  add column if not exists audit_reviewed_at timestamptz,
  add column if not exists audit_reviewed_by uuid references public.profiles(id) on delete set null;

update public.profiles
set account_number = 'EN-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where account_number is null;

update public.profiles
set meaningful_activity_at = coalesce(updated_at, created_at),
    last_active_at = coalesce(updated_at, created_at)
where meaningful_activity_at is null;

alter table public.profiles
  alter column account_number set default ('EN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  alter column account_number set not null,
  alter column account_audit_status set default 'unreviewed';

create unique index if not exists profiles_account_number_unique
  on public.profiles (upper(account_number));
create unique index if not exists profiles_email_unique_ci
  on public.profiles (lower(email)) where email is not null;

create table if not exists public.account_referrals (
  id bigint generated always as identity primary key,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null,
  created_at timestamptz not null default now(),
  constraint account_referrals_one_inviter_per_account unique (invited_user_id),
  constraint account_referrals_not_self check (inviter_id <> invited_user_id)
);

create index if not exists account_referrals_inviter_created_idx
  on public.account_referrals (inviter_id, created_at desc);

alter table public.account_referrals enable row level security;
drop policy if exists account_referrals_read_own on public.account_referrals;
create policy account_referrals_read_own
  on public.account_referrals for select to authenticated
  using (inviter_id = (select auth.uid()) or invited_user_id = (select auth.uid()));

revoke all on public.account_referrals from anon;
revoke insert, update, delete on public.account_referrals from authenticated;
grant select on public.account_referrals to authenticated;

create or replace function public.record_account_activity(p_event text default 'session_open')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.profiles
  set last_active_at = now(),
      meaningful_activity_at = case
        when p_event in ('session_open', 'sign_in') then meaningful_activity_at
        else coalesce(meaningful_activity_at, now())
      end,
      account_audit_status = case
        when p_event not in ('session_open', 'sign_in') and account_audit_status in ('unreviewed', 'inactive_review') then 'active'
        else account_audit_status
      end,
      inactive_flagged_at = case
        when p_event not in ('session_open', 'sign_in') and account_audit_status in ('unreviewed', 'inactive_review') then null
        else inactive_flagged_at
      end
  where id = auth.uid();
end;
$$;
revoke all on function public.record_account_activity(text) from public, anon;
grant execute on function public.record_account_activity(text) to authenticated;

create or replace function public.get_my_referral_progress()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'account_number', p.account_number,
    'referral_count', count(r.id),
    'media_allowance', case when count(r.id) >= 5 then 10 when count(r.id) >= 1 then 4 else 2 end,
    'profile_colors_unlocked', count(r.id) >= 3,
    'creator_expanded', count(r.id) >= 5
  )
  from public.profiles p
  left join public.account_referrals r on r.inviter_id = p.id
  where p.id = auth.uid()
  group by p.id, p.account_number;
$$;
revoke all on function public.get_my_referral_progress() from public, anon;
grant execute on function public.get_my_referral_progress() to authenticated;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists sync_profile_email_after_auth_change on auth.users;
create trigger sync_profile_email_after_auth_change
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_role text;
  v_institution_name text;
  v_education_division text;
  v_invite_code text;
  v_inviter_id uuid;
begin
  v_requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'learner');
  v_institution_name := nullif(trim(new.raw_user_meta_data ->> 'institution_name'), '');
  v_education_division := coalesce(nullif(new.raw_user_meta_data ->> 'education_division', ''), 'university');
  v_invite_code := upper(nullif(trim(new.raw_user_meta_data ->> 'invite_code'), ''));

  if v_requested_role not in ('learner', 'professor') then v_requested_role := 'learner'; end if;
  if v_education_division not in ('university', 'k12', 'both') then v_education_division := 'university'; end if;
  if v_requested_role = 'learner' and v_education_division = 'both' then v_education_division := 'university'; end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when v_requested_role = 'professor' then 'professor' else 'learner' end);

  if v_invite_code is not null then
    select id into v_inviter_id from public.profiles where upper(account_number) = v_invite_code limit 1;
    if v_inviter_id is not null and v_inviter_id <> new.id then
      insert into public.account_referrals (inviter_id, invited_user_id, invite_code)
      values (v_inviter_id, new.id, v_invite_code)
      on conflict (invited_user_id) do nothing;
    end if;
  end if;

  if v_institution_name is not null then
    insert into public.identity_onboarding_requests (
      user_id, requested_role, institution_name, department,
      identifier_hash, identifier_last4, education_division
    ) values (
      new.id, v_requested_role, v_institution_name,
      nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
      nullif(new.raw_user_meta_data ->> 'institution_identifier_hash', ''),
      nullif(new.raw_user_meta_data ->> 'institution_identifier_last4', ''),
      v_education_division
    );
  end if;

  if v_requested_role = 'learner' then
    insert into public.student_education_paths (user_id, started_in, current_division)
    values (new.id, v_education_division, v_education_division)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Professor-controlled course publishing, guest presentation, and automatic class links.
create table if not exists public.course_publications (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  share_code text not null unique check (share_code ~ '^learn-[a-z0-9-]{12,72}$'),
  title text not null check (char_length(title) between 1 and 180),
  subtitle text not null default '' check (char_length(subtitle) <= 300),
  content_json jsonb not null,
  appearance_json jsonb not null default '{}'::jsonb,
  access_mode text not null default 'unlisted' check (access_mode in ('unlisted', 'public')),
  allows_guest_checks boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'ended')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pg_column_size(content_json) <= 1048576),
  check (pg_column_size(appearance_json) <= 16384)
);
create index if not exists course_publications_public_idx on public.course_publications (status, share_code);
alter table public.course_publications enable row level security;
drop policy if exists course_publications_public_read on public.course_publications;
create policy course_publications_public_read on public.course_publications for select to anon, authenticated
using (status = 'published');
drop policy if exists course_publications_owner_read on public.course_publications;
create policy course_publications_owner_read on public.course_publications for select to authenticated
using (owner_id = (select auth.uid()) and private.can_manage_course(course_id));
drop policy if exists course_publications_owner_insert on public.course_publications;
create policy course_publications_owner_insert on public.course_publications for insert to authenticated
with check (owner_id = (select auth.uid()) and private.can_manage_course(course_id));
drop policy if exists course_publications_owner_update on public.course_publications;
create policy course_publications_owner_update on public.course_publications for update to authenticated
using (owner_id = (select auth.uid()) and private.can_manage_course(course_id))
with check (owner_id = (select auth.uid()) and private.can_manage_course(course_id));
drop policy if exists course_publications_owner_delete on public.course_publications;
create policy course_publications_owner_delete on public.course_publications for delete to authenticated
using (owner_id = (select auth.uid()) and private.can_manage_course(course_id));
grant select on public.course_publications to anon, authenticated;
grant insert, update, delete on public.course_publications to authenticated;

create table if not exists public.course_join_links (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked', 'expired')),
  auto_enroll boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_join_links_course_idx on public.course_join_links (course_id, status, expires_at);
alter table public.course_join_links enable row level security;
drop policy if exists course_join_links_manager_read on public.course_join_links;
create policy course_join_links_manager_read on public.course_join_links for select to authenticated
using (private.can_manage_course(course_id));
revoke all on public.course_join_links from anon;
grant select on public.course_join_links to authenticated;

create or replace function private.create_course_join_link(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not private.can_manage_course(p_course_id) then
    raise exception 'Course not found or not manageable';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.course_join_links (course_id, created_by, token_hash)
  values (p_course_id, auth.uid(), encode(extensions.digest(v_token, 'sha256'), 'hex'));
  return v_token;
end;
$$;
revoke all on function private.create_course_join_link(uuid) from public;
grant execute on function private.create_course_join_link(uuid) to authenticated;

create or replace function public.create_course_join_link(p_course_id uuid)
returns text language sql security invoker set search_path = ''
as $$ select private.create_course_join_link(p_course_id); $$;
revoke all on function public.create_course_join_link(uuid) from public, anon;
grant execute on function public.create_course_join_link(uuid) to authenticated;

create or replace function private.claim_course_join_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.course_join_links%rowtype;
  v_new_membership boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_link from public.course_join_links
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and status = 'active' and expires_at > now()
    and (max_uses is null or use_count < max_uses)
  for update;
  if not found then raise exception 'Class invitation is invalid or expired'; end if;

  insert into public.course_memberships (course_id, user_id, role)
  values (v_link.course_id, auth.uid(), 'learner')
  on conflict (course_id, user_id) do nothing
  returning true into v_new_membership;
  insert into public.student_enrollment_requests (course_id, student_id, status, approved_by, decided_at)
  values (v_link.course_id, auth.uid(), 'approved', v_link.created_by, now())
  on conflict (course_id, student_id) do update set status = 'approved', approved_by = v_link.created_by, decided_at = now();
  update public.student_enrollment_requests
  set status = 'approved', approved_by = v_link.created_by, decided_at = now()
  where course_id = v_link.course_id and student_id = auth.uid();
  if coalesce(v_new_membership, false) then
    update public.course_join_links set use_count = use_count + 1, updated_at = now() where id = v_link.id;
  end if;
  update public.profiles
  set meaningful_activity_at = coalesce(meaningful_activity_at, now()),
      last_active_at = now(),
      account_audit_status = case when account_audit_status in ('unreviewed', 'inactive_review') then 'active' else account_audit_status end,
      inactive_flagged_at = case when account_audit_status in ('unreviewed', 'inactive_review') then null else inactive_flagged_at end
  where id = auth.uid();
  return v_link.course_id;
end;
$$;
revoke all on function private.claim_course_join_link(text) from public;
grant execute on function private.claim_course_join_link(text) to authenticated;

create or replace function public.claim_course_join_link(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.claim_course_join_link(p_token); $$;
revoke all on function public.claim_course_join_link(text) from public, anon;
grant execute on function public.claim_course_join_link(text) to authenticated;

-- Inactive accounts remain recoverable. The worker only flags them for owner
-- review; these policies hide flagged/test accounts from public discovery.
drop policy if exists student_profiles_public_select on public.student_public_profiles;
create policy student_profiles_public_select
on public.student_public_profiles for select to anon
using (
  education_division = 'university'
  and visibility = 'public'
  and exists (
    select 1 from public.profiles p
    where p.id = student_public_profiles.user_id
      and p.account_audit_status not in ('inactive_review', 'test_account')
  )
);

drop policy if exists student_profiles_authenticated_select on public.student_public_profiles;
create policy student_profiles_authenticated_select
on public.student_public_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_platform_manager()
  or (
    exists (
      select 1 from public.profiles p
      where p.id = student_public_profiles.user_id
        and p.account_audit_status not in ('inactive_review', 'test_account')
    )
    and exists (
      select 1 from public.student_education_paths sep
      where sep.user_id = (select auth.uid())
        and sep.current_division = student_public_profiles.education_division
    )
    and (
      visibility = 'public'
      or (visibility = 'class' and private.shares_course_with(user_id))
    )
  )
);

drop policy if exists directory_public_select on public.published_course_directory;
create policy directory_public_select
on public.published_course_directory for select to anon
using (
  is_listed
  and exists (
    select 1 from public.profiles p
    where p.id = published_course_directory.professor_id
      and p.account_audit_status not in ('inactive_review', 'test_account')
  )
);

drop policy if exists directory_authenticated_select on public.published_course_directory;
create policy directory_authenticated_select
on public.published_course_directory for select to authenticated
using (
  private.is_platform_manager()
  or private.can_manage_course(course_id)
  or (
    is_listed
    and exists (
      select 1 from public.profiles p
      where p.id = published_course_directory.professor_id
        and p.account_audit_status not in ('inactive_review', 'test_account')
    )
  )
);

drop policy if exists course_publications_public_read on public.course_publications;

create or replace function private.get_course_publication(p_share_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_share_code is null or p_share_code !~ '^learn-[a-z0-9-]{12,72}$' then return null; end if;
  select jsonb_build_object(
    'share_code', cp.share_code,
    'title', cp.title,
    'subtitle', cp.subtitle,
    'content_json', cp.content_json,
    'appearance_json', cp.appearance_json,
    'allows_guest_checks', cp.allows_guest_checks,
    'published_at', cp.published_at
  ) into result
  from public.course_publications cp
  join public.profiles p on p.id = cp.owner_id
  where cp.share_code = p_share_code
    and cp.status = 'published'
    and p.account_audit_status not in ('inactive_review', 'test_account')
  limit 1;
  return result;
end;
$$;
revoke all on function private.get_course_publication(text) from public;
grant execute on function private.get_course_publication(text) to anon, authenticated;

create or replace function public.get_course_publication(p_share_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_course_publication(p_share_code); $$;
revoke all on function public.get_course_publication(text) from public;
grant execute on function public.get_course_publication(text) to anon, authenticated;

create or replace function private.list_account_audit(p_status text default null)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  audit_status text,
  created_at timestamptz,
  last_active_at timestamptz,
  meaningful_activity_at timestamptz,
  inactive_flagged_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_manager() then
    raise exception 'Platform manager access required';
  end if;
  return query
  select p.id, p.email, p.full_name, p.role, p.account_audit_status,
         p.created_at, p.last_active_at, p.meaningful_activity_at, p.inactive_flagged_at
  from public.profiles p
  where p_status is null or p_status = 'all' or p.account_audit_status = p_status
  order by coalesce(p.inactive_flagged_at, p.created_at) desc
  limit 500;
end;
$$;
revoke all on function private.list_account_audit(text) from public, anon;
grant execute on function private.list_account_audit(text) to authenticated;

create or replace function public.list_account_audit(p_status text default null)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  audit_status text,
  created_at timestamptz,
  last_active_at timestamptz,
  meaningful_activity_at timestamptz,
  inactive_flagged_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_account_audit(p_status); $$;
revoke all on function public.list_account_audit(text) from public, anon;
grant execute on function public.list_account_audit(text) to authenticated;

create or replace function private.review_account_audit(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_manager() then
    raise exception 'Platform manager access required';
  end if;
  if p_status not in ('active', 'inactive_review', 'confirmed_user', 'test_account') then
    raise exception 'Unsupported account audit status';
  end if;
  update public.profiles
  set account_audit_status = p_status,
      inactive_flagged_at = case when p_status = 'inactive_review' then coalesce(inactive_flagged_at, now()) else null end,
      audit_reviewed_at = now(),
      audit_reviewed_by = auth.uid(),
      updated_at = now()
  where id = p_user_id;
end;
$$;
revoke all on function private.review_account_audit(uuid, text) from public, anon;
grant execute on function private.review_account_audit(uuid, text) to authenticated;

create or replace function public.review_account_audit(p_user_id uuid, p_status text)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.review_account_audit(p_user_id, p_status); $$;
revoke all on function public.review_account_audit(uuid, text) from public, anon;
grant execute on function public.review_account_audit(uuid, text) to authenticated;
