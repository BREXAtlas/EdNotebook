-- Follow-up from the database advisors after the portal migration was applied.

revoke execute on function public.approve_student_enrollment(uuid) from anon;
revoke execute on function public.review_identity_onboarding(uuid, text) from anon;

alter function public.approve_student_enrollment(uuid) security invoker;

create index if not exists grade_items_category_id_idx
  on public.grade_items (category_id);
create index if not exists grade_share_links_student_id_idx
  on public.grade_share_links (student_id);
create index if not exists identity_onboarding_requests_reviewed_by_idx
  on public.identity_onboarding_requests (reviewed_by);
create index if not exists professor_announcements_professor_id_idx
  on public.professor_announcements (professor_id);
create index if not exists published_course_directory_institution_id_idx
  on public.published_course_directory (institution_id);
create index if not exists student_enrollment_requests_approved_by_idx
  on public.student_enrollment_requests (approved_by);
create index if not exists student_enrollment_requests_roster_entry_id_idx
  on public.student_enrollment_requests (roster_entry_id);
create index if not exists student_groups_created_by_idx
  on public.student_groups (created_by);
create index if not exists student_posts_author_id_idx
  on public.student_posts (author_id);
create index if not exists student_roster_entries_added_by_idx
  on public.student_roster_entries (added_by);

drop policy if exists grade_categories_manage on public.grade_categories;
create policy grade_categories_insert
on public.grade_categories for insert to authenticated
with check (private.can_manage_course(course_id));
create policy grade_categories_update
on public.grade_categories for update to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));
create policy grade_categories_delete
on public.grade_categories for delete to authenticated
using (private.can_manage_course(course_id));

drop policy if exists grade_items_manage on public.grade_items;
create policy grade_items_insert
on public.grade_items for insert to authenticated
with check (private.can_manage_course(course_id));
create policy grade_items_update
on public.grade_items for update to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));
create policy grade_items_delete
on public.grade_items for delete to authenticated
using (private.can_manage_course(course_id));

drop policy if exists student_grades_manage on public.student_grades;
create policy student_grades_insert
on public.student_grades for insert to authenticated
with check (private.can_manage_course(course_id));
create policy student_grades_update
on public.student_grades for update to authenticated
using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));
create policy student_grades_delete
on public.student_grades for delete to authenticated
using (private.can_manage_course(course_id));
