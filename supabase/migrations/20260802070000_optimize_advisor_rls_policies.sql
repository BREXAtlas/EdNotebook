-- Resolve the staging Performance Advisor auth_rls_initplan warnings without
-- changing the row-level authorization model. Only request-scoped auth.uid()
-- calls are converted to init plans; row-dependent capability checks remain
-- correlated with each protected row.

alter policy digital_literacy_profiles_owner_all
on public.digital_literacy_profiles
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy digital_literacy_progress_owner_all
on public.digital_literacy_progress
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy digital_literacy_story_choices_owner_all
on public.digital_literacy_story_choices
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy digital_literacy_achievements_owner_all
on public.digital_literacy_achievements
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy digital_literacy_completion_records_owner_all
on public.digital_literacy_completion_records
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy course_publications_insert
on public.course_publications
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_manage_course(course_id)
);

alter policy course_publication_versions_insert
on public.course_publication_versions
to authenticated
with check (
  published_by = (select auth.uid())
  and exists (
    select 1
    from public.course_publications publication
    where publication.id = course_publication_versions.publication_id
      and private.can_manage_course(publication.course_id)
  )
);

alter policy course_lesson_progress_select
on public.course_lesson_progress
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_course(course_id)
);

alter policy course_lesson_progress_insert
on public.course_lesson_progress
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_access_course(course_id)
);

alter policy course_lesson_progress_update
on public.course_lesson_progress
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_course(course_id)
)
with check (
  user_id = (select auth.uid())
  or private.can_manage_course(course_id)
);

alter policy course_progress_select
on public.course_progress
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_course(course_id)
);

alter policy course_progress_insert
on public.course_progress
to authenticated
with check (
  user_id = (select auth.uid())
  and private.can_access_course(course_id)
);

alter policy course_progress_update
on public.course_progress
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_course(course_id)
)
with check (
  user_id = (select auth.uid())
  or private.can_manage_course(course_id)
);
