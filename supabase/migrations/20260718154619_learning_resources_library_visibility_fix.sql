drop policy if exists learning_resources_select on public.learning_resources;
create policy learning_resources_select on public.learning_resources
for select to authenticated
using (
  owner_id = (select auth.uid())
  or (
    course_id is not null
    and private.can_access_course(course_id)
    and visibility in ('course','public','publisher')
  )
);
