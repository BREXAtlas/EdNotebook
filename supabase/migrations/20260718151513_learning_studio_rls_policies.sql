create policy courses_select on public.courses for select to authenticated using (owner_id=auth.uid() or private.can_access_course(id));
create policy courses_insert on public.courses for insert to authenticated with check (owner_id=auth.uid());
create policy courses_update on public.courses for update to authenticated using (private.can_manage_course(id)) with check (private.can_manage_course(id));
create policy courses_delete on public.courses for delete to authenticated using (private.can_manage_course(id));

create policy course_memberships_select on public.course_memberships for select to authenticated using (user_id=auth.uid() or private.can_manage_course(course_id));
create policy course_memberships_insert on public.course_memberships for insert to authenticated with check (private.can_manage_course(course_id));
create policy course_memberships_update on public.course_memberships for update to authenticated using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));
create policy course_memberships_delete on public.course_memberships for delete to authenticated using (private.can_manage_course(course_id));

create policy learning_resources_select on public.learning_resources for select to authenticated using (
 owner_id=auth.uid() or (course_id is not null and private.can_access_course(course_id) and visibility in ('course','public','publisher'))
);
create policy learning_resources_insert on public.learning_resources for insert to authenticated with check (
 owner_id=auth.uid() and (course_id is null or private.can_access_course(course_id))
);
create policy learning_resources_update on public.learning_resources for update to authenticated using (
 owner_id=auth.uid() or (course_id is not null and private.can_manage_course(course_id))
) with check (owner_id=auth.uid() or (course_id is not null and private.can_manage_course(course_id)));
create policy learning_resources_delete on public.learning_resources for delete to authenticated using (
 owner_id=auth.uid() or (course_id is not null and private.can_manage_course(course_id))
);

create policy assignments_select on public.assignments for select to authenticated using (private.can_access_course(course_id));
create policy assignments_insert on public.assignments for insert to authenticated with check (professor_id=auth.uid() and private.can_manage_course(course_id));
create policy assignments_update on public.assignments for update to authenticated using (private.can_manage_course(course_id)) with check (private.can_manage_course(course_id));
create policy assignments_delete on public.assignments for delete to authenticated using (private.can_manage_course(course_id));

create policy rubrics_select on public.rubrics for select to authenticated using (owner_id=auth.uid() or private.can_access_assignment(assignment_id));
create policy rubrics_insert on public.rubrics for insert to authenticated with check (owner_id=auth.uid() and private.can_manage_assignment(assignment_id));
create policy rubrics_update on public.rubrics for update to authenticated using (owner_id=auth.uid() or private.can_manage_assignment(assignment_id)) with check (owner_id=auth.uid() or private.can_manage_assignment(assignment_id));
create policy rubrics_delete on public.rubrics for delete to authenticated using (owner_id=auth.uid() or private.can_manage_assignment(assignment_id));

create policy assignment_drafts_select on public.assignment_drafts for select to authenticated using (student_id=auth.uid() or private.can_manage_assignment(assignment_id));
create policy assignment_drafts_insert on public.assignment_drafts for insert to authenticated with check (student_id=auth.uid() and private.can_access_assignment(assignment_id));
create policy assignment_drafts_update on public.assignment_drafts for update to authenticated using (student_id=auth.uid()) with check (student_id=auth.uid());
create policy assignment_drafts_delete on public.assignment_drafts for delete to authenticated using (student_id=auth.uid() or private.can_manage_assignment(assignment_id));

create policy learning_messages_select on public.learning_messages for select to authenticated using (
 sender_id=auth.uid() or recipient_id=auth.uid() or (recipient_id is null and course_id is not null and private.can_access_course(course_id))
);
create policy learning_messages_insert on public.learning_messages for insert to authenticated with check (
 sender_id=auth.uid() and (course_id is null or private.can_access_course(course_id)) and (assignment_id is null or private.can_access_assignment(assignment_id))
);
create policy learning_messages_delete on public.learning_messages for delete to authenticated using (sender_id=auth.uid() or private.is_platform_manager());

create policy publications_select on public.publications for select to authenticated using (
 owner_id=auth.uid() or status='published' or (course_id is not null and private.can_access_course(course_id))
);
create policy publications_insert on public.publications for insert to authenticated with check (owner_id=auth.uid() and (course_id is null or private.can_manage_course(course_id)));
create policy publications_update on public.publications for update to authenticated using (owner_id=auth.uid() or private.is_platform_manager()) with check (owner_id=auth.uid() or private.is_platform_manager());
create policy publications_delete on public.publications for delete to authenticated using (owner_id=auth.uid() or private.is_platform_manager());

create policy reading_annotations_select on public.reading_annotations for select to authenticated using (user_id=auth.uid());
create policy reading_annotations_insert on public.reading_annotations for insert to authenticated with check (user_id=auth.uid());
create policy reading_annotations_update on public.reading_annotations for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy reading_annotations_delete on public.reading_annotations for delete to authenticated using (user_id=auth.uid());

create policy publisher_applications_select on public.publisher_applications for select to authenticated using (applicant_id=auth.uid() or private.is_platform_manager());
create policy publisher_applications_insert on public.publisher_applications for insert to authenticated with check (applicant_id=auth.uid());
create policy publisher_applications_update on public.publisher_applications for update to authenticated using (applicant_id=auth.uid() or private.is_platform_manager()) with check (applicant_id=auth.uid() or private.is_platform_manager());
create policy publisher_applications_delete on public.publisher_applications for delete to authenticated using (applicant_id=auth.uid() or private.is_platform_manager());

create policy slide_decks_select on public.slide_decks for select to authenticated using (owner_id=auth.uid() or (course_id is not null and private.can_access_course(course_id)));
create policy slide_decks_insert on public.slide_decks for insert to authenticated with check (owner_id=auth.uid() and (course_id is null or private.can_access_course(course_id)));
create policy slide_decks_update on public.slide_decks for update to authenticated using (owner_id=auth.uid() or (course_id is not null and private.can_manage_course(course_id))) with check (owner_id=auth.uid() or (course_id is not null and private.can_manage_course(course_id)));
create policy slide_decks_delete on public.slide_decks for delete to authenticated using (owner_id=auth.uid() or (course_id is not null and private.can_manage_course(course_id)));
