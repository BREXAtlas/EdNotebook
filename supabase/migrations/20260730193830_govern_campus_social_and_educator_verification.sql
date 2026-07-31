-- Governed campus social layer and one affiliation-review queue.
-- "Public university" means visible to authenticated university participants,
-- never anonymous internet access. K-12 and university feeds remain separated.

create table public.campus_social_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_type text not null check (account_type in ('student','professor')),
  education_division text not null check (education_division in ('university','k12')),
  institution_id uuid references public.institutions(id) on delete set null,
  institution_name text not null default 'Independent',
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 500),
  visibility text not null default 'campus'
    check (visibility in ('private','campus','public_university')),
  discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campus_social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.campus_social_profiles(user_id) on delete cascade,
  education_division text not null check (education_division in ('university','k12')),
  institution_id uuid references public.institutions(id) on delete set null,
  audience text not null default 'campus'
    check (audience in ('private','institution','public_university')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  media_url text,
  media_kind text check (media_kind is null or media_kind in ('image','video','link')),
  comments_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campus_social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.campus_social_posts(id) on delete cascade,
  author_id uuid not null references public.campus_social_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campus_social_reactions (
  post_id uuid not null references public.campus_social_posts(id) on delete cascade,
  user_id uuid not null references public.campus_social_profiles(user_id) on delete cascade,
  reaction_type text not null default 'support'
    check (reaction_type in ('support','insightful','celebrate')),
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);

create table public.campus_social_follows (
  follower_id uuid not null references public.campus_social_profiles(user_id) on delete cascade,
  followed_id uuid not null references public.campus_social_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id,followed_id),
  check (follower_id <> followed_id)
);

create index campus_social_profiles_scope_idx
  on public.campus_social_profiles (education_division,institution_id,visibility,discoverable);
create index campus_social_posts_feed_idx
  on public.campus_social_posts (education_division,audience,created_at desc);
create index campus_social_posts_institution_idx
  on public.campus_social_posts (institution_id,created_at desc);
create index campus_social_comments_post_idx
  on public.campus_social_comments (post_id,created_at);
create index campus_social_reactions_post_idx
  on public.campus_social_reactions (post_id);
create index campus_social_follows_followed_idx
  on public.campus_social_follows (followed_id);

create or replace function private.social_education_division(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(
      (select sep.current_division from public.student_education_paths sep where sep.user_id=p_user_id),
      (select case when ior.education_division='k12' then 'k12' else 'university' end
       from public.identity_onboarding_requests ior where ior.user_id=p_user_id),
      'university'
    )='k12' then 'k12'
    else 'university'
  end;
$$;

create or replace function private.social_institution_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ia.institution_id
  from public.institution_affiliations ia
  where ia.user_id=p_user_id
    and ia.status='active'
    and ia.institution_id is not null
  order by ia.is_primary desc,ia.verified_at desc nulls last,ia.created_at desc
  limit 1;
$$;

create or replace function private.set_campus_social_profile_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_institution_id uuid;
  v_institution_name text;
begin
  if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid()) then
    raise exception 'A social profile must belong to the signed-in account';
  end if;

  select * into v_profile from public.profiles where id=new.user_id;
  if not found then raise exception 'Profile not found'; end if;

  v_institution_id := private.social_institution_id(new.user_id);
  select i.name into v_institution_name from public.institutions i where i.id=v_institution_id;

  new.account_type := case when v_profile.role in ('owner','admin','professor') then 'professor' else 'student' end;
  new.education_division := private.social_education_division(new.user_id);
  new.institution_id := v_institution_id;
  new.institution_name := coalesce(
    v_institution_name,
    (select evr.institution_name from public.educator_verification_requests evr where evr.user_id=new.user_id),
    (select spp.school_name from public.student_public_profiles spp
      where spp.user_id=new.user_id and spp.education_division=new.education_division),
    'Independent'
  );
  new.display_name := coalesce(nullif(trim(new.display_name),''),nullif(trim(v_profile.full_name),''),'EdNotebook member');
  new.avatar_url := nullif(trim(new.avatar_url),'');
  new.bio := left(coalesce(new.bio,''),500);
  if new.education_division='k12' and new.visibility='public_university' then
    new.visibility := 'campus';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.set_campus_social_post_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.campus_social_profiles%rowtype;
begin
  if (select auth.uid()) is null or new.author_id is distinct from (select auth.uid()) then
    raise exception 'A social post must belong to the signed-in account';
  end if;
  select * into v_profile from public.campus_social_profiles where user_id=new.author_id;
  if not found then raise exception 'Create a social profile before posting'; end if;
  new.education_division := v_profile.education_division;
  new.institution_id := v_profile.institution_id;
  new.body := trim(new.body);
  new.media_url := nullif(trim(new.media_url),'');
  if new.education_division='k12' and new.audience='public_university' then
    raise exception 'K-12 posts cannot enter the university-wide feed';
  end if;
  if new.audience='institution' and new.institution_id is null then
    raise exception 'A verified campus affiliation is required for campus posts';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.can_view_campus_social_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campus_social_profiles target
    left join public.campus_social_profiles viewer on viewer.user_id=(select auth.uid())
    where target.user_id=p_user_id
      and (
        target.user_id=(select auth.uid())
        or (
          target.discoverable
          and target.visibility='public_university'
          and target.education_division='university'
          and private.social_education_division((select auth.uid()))='university'
        )
        or (
          target.discoverable
          and target.visibility='campus'
          and target.institution_id is not null
          and viewer.institution_id=target.institution_id
          and viewer.education_division=target.education_division
        )
      )
  );
$$;

create or replace function private.can_view_campus_social_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campus_social_posts post
    left join public.campus_social_profiles viewer on viewer.user_id=(select auth.uid())
    where post.id=p_post_id
      and (
        post.author_id=(select auth.uid())
        or post.audience='public_university'
          and post.education_division='university'
          and private.social_education_division((select auth.uid()))='university'
        or post.audience='institution'
          and post.institution_id is not null
          and viewer.institution_id=post.institution_id
          and viewer.education_division=post.education_division
      )
  );
$$;

revoke all on function private.social_education_division(uuid) from public;
revoke all on function private.social_institution_id(uuid) from public;
revoke all on function private.set_campus_social_profile_scope() from public;
revoke all on function private.set_campus_social_post_scope() from public;
revoke all on function private.can_view_campus_social_profile(uuid) from public;
revoke all on function private.can_view_campus_social_post(uuid) from public;
grant execute on function private.can_view_campus_social_profile(uuid) to authenticated;
grant execute on function private.can_view_campus_social_post(uuid) to authenticated;

create trigger campus_social_profiles_scope
before insert or update on public.campus_social_profiles
for each row execute function private.set_campus_social_profile_scope();
create trigger campus_social_posts_scope
before insert or update on public.campus_social_posts
for each row execute function private.set_campus_social_post_scope();
create trigger campus_social_comments_touch_updated_at
before update on public.campus_social_comments
for each row execute function private.touch_updated_at();

alter table public.campus_social_profiles enable row level security;
alter table public.campus_social_posts enable row level security;
alter table public.campus_social_comments enable row level security;
alter table public.campus_social_reactions enable row level security;
alter table public.campus_social_follows enable row level security;

create policy campus_social_profiles_select
on public.campus_social_profiles for select to authenticated
using (private.can_view_campus_social_profile(user_id));
create policy campus_social_profiles_insert
on public.campus_social_profiles for insert to authenticated
with check (user_id=(select auth.uid()));
create policy campus_social_profiles_update
on public.campus_social_profiles for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy campus_social_posts_select
on public.campus_social_posts for select to authenticated
using (private.can_view_campus_social_post(id));
create policy campus_social_posts_insert
on public.campus_social_posts for insert to authenticated
with check (author_id=(select auth.uid()));
create policy campus_social_posts_update
on public.campus_social_posts for update to authenticated
using (author_id=(select auth.uid())) with check (author_id=(select auth.uid()));
create policy campus_social_posts_delete
on public.campus_social_posts for delete to authenticated
using (author_id=(select auth.uid()));

create policy campus_social_comments_select
on public.campus_social_comments for select to authenticated
using (private.can_view_campus_social_post(post_id));
create policy campus_social_comments_insert
on public.campus_social_comments for insert to authenticated
with check (
  author_id=(select auth.uid())
  and private.can_view_campus_social_post(post_id)
  and exists (select 1 from public.campus_social_posts post where post.id=post_id and post.comments_enabled)
);
create policy campus_social_comments_update
on public.campus_social_comments for update to authenticated
using (author_id=(select auth.uid())) with check (author_id=(select auth.uid()));
create policy campus_social_comments_delete
on public.campus_social_comments for delete to authenticated
using (
  author_id=(select auth.uid())
  or exists (select 1 from public.campus_social_posts post where post.id=post_id and post.author_id=(select auth.uid()))
);

create policy campus_social_reactions_select
on public.campus_social_reactions for select to authenticated
using (private.can_view_campus_social_post(post_id));
create policy campus_social_reactions_insert
on public.campus_social_reactions for insert to authenticated
with check (user_id=(select auth.uid()) and private.can_view_campus_social_post(post_id));
create policy campus_social_reactions_update
on public.campus_social_reactions for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy campus_social_reactions_delete
on public.campus_social_reactions for delete to authenticated
using (user_id=(select auth.uid()));

create policy campus_social_follows_select
on public.campus_social_follows for select to authenticated
using (follower_id=(select auth.uid()) or followed_id=(select auth.uid()));
create policy campus_social_follows_insert
on public.campus_social_follows for insert to authenticated
with check (
  follower_id=(select auth.uid())
  and private.can_view_campus_social_profile(followed_id)
);
create policy campus_social_follows_delete
on public.campus_social_follows for delete to authenticated
using (follower_id=(select auth.uid()));

revoke all on public.campus_social_profiles from anon;
revoke all on public.campus_social_posts from anon;
revoke all on public.campus_social_comments from anon;
revoke all on public.campus_social_reactions from anon;
revoke all on public.campus_social_follows from anon;
grant select,insert,update on public.campus_social_profiles to authenticated;
grant select,insert,update,delete on public.campus_social_posts to authenticated;
grant select,insert,update,delete on public.campus_social_comments to authenticated;
grant select,insert,update,delete on public.campus_social_reactions to authenticated;
grant select,insert,delete on public.campus_social_follows to authenticated;

-- Educator verification and TOS control-center affiliation review now share
-- a single governed decision record. Existing reviewer permissions are honored.
create or replace function private.set_educator_verification_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_can_review boolean;
begin
  v_can_review := private.is_platform_manager()
    or (
      new.institution_id is not null
      and private.has_institution_capability(new.institution_id,'manage_affiliations',(select auth.uid()))
    );
  if not v_can_review then
    new.user_id := (select auth.uid());
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create or replace function private.sync_educator_verification_to_onboarding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid;
begin
  v_institution_id := coalesce(
    new.institution_id,
    (select i.id from public.institutions i
      where lower(trim(i.name))=lower(trim(new.institution_name))
        and i.education_division in (
          case when new.education_division='both' then 'university' else new.education_division end,
          case when new.education_division='both' then 'k12' else new.education_division end
        )
      order by i.created_at
      limit 1)
  );

  if new.institution_id is distinct from v_institution_id then
    update public.educator_verification_requests
    set institution_id=v_institution_id
    where user_id=new.user_id and institution_id is distinct from v_institution_id;
  end if;

  insert into public.identity_onboarding_requests (
    user_id,requested_role,institution_id,institution_name,department,
    identifier_last4,education_division,affiliation_choice,
    verification_status,reviewed_by,reviewed_at,created_at,updated_at
  ) values (
    new.user_id,'professor',v_institution_id,new.institution_name,new.department,
    new.teacher_identifier_last4,new.education_division,
    case when v_institution_id is null then 'other' else 'institution' end,
    new.status,new.reviewed_by,new.reviewed_at,new.submitted_at,now()
  )
  on conflict (user_id) do update set
    requested_role='professor',
    institution_id=excluded.institution_id,
    institution_name=excluded.institution_name,
    department=excluded.department,
    identifier_last4=excluded.identifier_last4,
    education_division=excluded.education_division,
    affiliation_choice=excluded.affiliation_choice,
    verification_status=excluded.verification_status,
    reviewed_by=excluded.reviewed_by,
    reviewed_at=excluded.reviewed_at,
    updated_at=now()
  where public.identity_onboarding_requests.requested_role is distinct from 'professor'
     or public.identity_onboarding_requests.institution_id is distinct from excluded.institution_id
     or public.identity_onboarding_requests.institution_name is distinct from excluded.institution_name
     or public.identity_onboarding_requests.department is distinct from excluded.department
     or public.identity_onboarding_requests.identifier_last4 is distinct from excluded.identifier_last4
     or public.identity_onboarding_requests.education_division is distinct from excluded.education_division
     or public.identity_onboarding_requests.verification_status is distinct from excluded.verification_status
     or public.identity_onboarding_requests.reviewed_by is distinct from excluded.reviewed_by
     or public.identity_onboarding_requests.reviewed_at is distinct from excluded.reviewed_at;
  return new;
end;
$$;

create or replace function private.sync_onboarding_review_to_educator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requested_role='professor'
     and new.verification_status in ('approved','rejected')
     and new.verification_status is distinct from old.verification_status then
    update public.educator_verification_requests
    set status=new.verification_status,
        institution_id=coalesce(new.institution_id,institution_id),
        reviewed_by=new.reviewed_by,
        reviewed_at=new.reviewed_at,
        updated_at=now()
    where user_id=new.user_id
      and (
        status is distinct from new.verification_status
        or reviewed_by is distinct from new.reviewed_by
        or reviewed_at is distinct from new.reviewed_at
      );

    update public.published_course_directory
    set educator_verification_status=new.verification_status,updated_at=now()
    where professor_id=new.user_id
      and (new.institution_id is null or institution_id=new.institution_id);
  end if;
  return new;
end;
$$;

revoke all on function private.sync_educator_verification_to_onboarding() from public;
revoke all on function private.sync_onboarding_review_to_educator() from public;

create trigger educator_verification_control_center_sync
after insert or update of institution_id,institution_name,education_division,department,
  teacher_identifier_last4,status,reviewed_by,reviewed_at
on public.educator_verification_requests
for each row execute function private.sync_educator_verification_to_onboarding();

create trigger onboarding_educator_verification_review_sync
after update of verification_status,reviewed_by,reviewed_at
on public.identity_onboarding_requests
for each row execute function private.sync_onboarding_review_to_educator();

-- Backfill previously submitted educator requests into the TOS queue.
insert into public.identity_onboarding_requests (
  user_id,requested_role,institution_id,institution_name,department,
  identifier_last4,education_division,affiliation_choice,
  verification_status,reviewed_by,reviewed_at,created_at,updated_at
)
select
  evr.user_id,'professor',evr.institution_id,evr.institution_name,evr.department,
  evr.teacher_identifier_last4,evr.education_division,
  case when evr.institution_id is null then 'other' else 'institution' end,
  evr.status,evr.reviewed_by,evr.reviewed_at,evr.submitted_at,now()
from public.educator_verification_requests evr
on conflict (user_id) do update set
  requested_role='professor',
  institution_id=excluded.institution_id,
  institution_name=excluded.institution_name,
  department=excluded.department,
  identifier_last4=excluded.identifier_last4,
  education_division=excluded.education_division,
  affiliation_choice=excluded.affiliation_choice,
  verification_status=excluded.verification_status,
  reviewed_by=excluded.reviewed_by,
  reviewed_at=excluded.reviewed_at,
  updated_at=now();
