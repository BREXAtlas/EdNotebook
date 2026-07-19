-- Public interest forms and opt-in student name discovery.
-- Public visitors may submit forms but cannot read, update, or delete responses.

create table public.portal_interest_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pricing_waitlist', 'feature_feedback', 'student_opportunities')),
  name text not null default '' check (char_length(name) <= 160),
  email text not null default '' check (char_length(email) <= 320),
  school text not null default '' check (char_length(school) <= 240),
  message text not null default '' check (char_length(message) <= 5000),
  education_division text not null default 'university' check (education_division in ('university', 'k12')),
  source_path text not null default '' check (char_length(source_path) <= 500),
  created_at timestamptz not null default now(),
  check (kind = 'feature_feedback' or position('@' in email) > 1),
  check (kind <> 'feature_feedback' or char_length(trim(message)) > 0)
);

alter table public.student_public_profiles
  add column if not exists discoverable_by_name boolean not null default false;

create index portal_interest_submissions_review_idx
  on public.portal_interest_submissions (kind, created_at desc);

create index student_public_profiles_name_discovery_idx
  on public.student_public_profiles (education_division, lower(display_name))
  where discoverable_by_name and visibility <> 'private';

alter table public.portal_interest_submissions enable row level security;

create policy portal_interest_submit_anon
on public.portal_interest_submissions for insert to anon
with check (
  kind in ('pricing_waitlist', 'feature_feedback', 'student_opportunities')
  and char_length(name) <= 160
  and char_length(email) <= 320
  and char_length(school) <= 240
  and char_length(message) <= 5000
  and char_length(source_path) <= 500
  and education_division in ('university', 'k12')
  and (kind = 'feature_feedback' or position('@' in email) > 1)
  and (kind <> 'feature_feedback' or char_length(trim(message)) > 0)
);

create policy portal_interest_submit_authenticated
on public.portal_interest_submissions for insert to authenticated
with check (
  kind in ('pricing_waitlist', 'feature_feedback', 'student_opportunities')
  and char_length(name) <= 160
  and char_length(email) <= 320
  and char_length(school) <= 240
  and char_length(message) <= 5000
  and char_length(source_path) <= 500
  and education_division in ('university', 'k12')
  and (kind = 'feature_feedback' or position('@' in email) > 1)
  and (kind <> 'feature_feedback' or char_length(trim(message)) > 0)
);

create policy portal_interest_manager_select
on public.portal_interest_submissions for select to authenticated
using (private.is_platform_manager());

create policy portal_interest_manager_delete
on public.portal_interest_submissions for delete to authenticated
using (private.is_platform_manager());

revoke all on table public.portal_interest_submissions from anon, authenticated;
grant insert on table public.portal_interest_submissions to anon, authenticated;
grant select, delete on table public.portal_interest_submissions to authenticated;

comment on table public.portal_interest_submissions is
  'Product waitlist, opportunity, and software feedback submissions from EdNotebook portal forms.';
comment on column public.student_public_profiles.discoverable_by_name is
  'Student-controlled opt-in for authenticated name search; profile visibility policies still apply.';
