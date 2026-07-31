-- PostgREST inserts commonly request the inserted row with RETURNING.
-- The original profile and post SELECT policies delegated every row to stable
-- helpers that query the same table. During the same INSERT command those
-- helpers cannot see the newly inserted row yet, so otherwise valid owner
-- inserts fail the SELECT check. Keep the governed audience helpers for other
-- accounts while making the signed-in account's own rows directly readable.

drop policy if exists campus_social_profiles_select
on public.campus_social_profiles;

create policy campus_social_profiles_select
on public.campus_social_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_view_campus_social_profile(user_id)
);

drop policy if exists campus_social_posts_select
on public.campus_social_posts;

create policy campus_social_posts_select
on public.campus_social_posts
for select
to authenticated
using (
  author_id = (select auth.uid())
  or private.can_view_campus_social_post(id)
);
