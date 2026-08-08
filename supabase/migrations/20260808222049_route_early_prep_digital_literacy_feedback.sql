-- Route each private feedback notification to its exact Digital Literacy assignment.
-- The feedback ID remains in the dedupe key so later feedback is not collapsed.

create or replace function public.record_digital_literacy_teacher_feedback(
  p_assignment_id uuid,
  p_student_id uuid,
  p_unit_id text,
  p_feedback_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_course_id uuid;
  v_feedback private.digital_literacy_teacher_feedback%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(coalesce(p_feedback_text,''))) not between 1 and 3000 then
    raise exception 'Feedback must contain between 1 and 3000 characters';
  end if;

  select assignment.course_id into v_course_id
  from public.assignments assignment
  join public.courses course on course.id=assignment.course_id
  join public.digital_literacy_assignment_recipients recipient
    on recipient.assignment_id=assignment.id and recipient.student_id=p_student_id
  join public.digital_literacy_assignment_units assignment_unit
    on assignment_unit.assignment_id=assignment.id and assignment_unit.unit_id=p_unit_id
  where assignment.id=p_assignment_id
    and assignment.settings->>'kind'='digital_literacy_course_units'
    and course.education_division='k12';

  if v_course_id is null or not private.can_manage_course(v_course_id) then
    raise exception 'Early Prep class management access required';
  end if;

  insert into private.digital_literacy_teacher_feedback (
    assignment_id,student_id,unit_id,educator_id,feedback_text
  ) values (
    p_assignment_id,p_student_id,p_unit_id,v_user_id,btrim(p_feedback_text)
  ) returning * into v_feedback;

  perform private.create_student_course_notification(
    p_student_id,
    v_course_id,
    'course_feedback',
    'Digital Literacy feedback ready',
    'Feedback is ready for '||upper(p_unit_id)||'. Open the assignment to review and acknowledge it.',
    'course',
    'digital-literacy-feedback:'||p_assignment_id::text||':'||v_feedback.id::text
  );

  insert into public.audit_events (
    actor_id,course_id,assignment_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_course_id,p_assignment_id,'digital_literacy.feedback_recorded',
    'digital_literacy_teacher_feedback',v_feedback.id::text,
    jsonb_build_object('student_id',p_student_id,'unit_id',p_unit_id,'feedback_length',char_length(v_feedback.feedback_text)),''
  );

  return jsonb_build_object(
    'id',v_feedback.id,
    'assignment_id',v_feedback.assignment_id,
    'student_id',v_feedback.student_id,
    'unit_id',v_feedback.unit_id,
    'feedback_text',v_feedback.feedback_text,
    'acknowledged_at',v_feedback.acknowledged_at,
    'helpful',v_feedback.helpful,
    'created_at',v_feedback.created_at
  );
end;
$$;
