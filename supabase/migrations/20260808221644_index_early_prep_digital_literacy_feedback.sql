-- Cover every foreign key introduced by the Early Prep Digital Literacy
-- feedback and milestone unit. These indexes are private-schema only.

create index digital_literacy_teacher_feedback_recipient_idx
  on private.digital_literacy_teacher_feedback(assignment_id,student_id);
create index digital_literacy_teacher_feedback_unit_idx
  on private.digital_literacy_teacher_feedback(assignment_id,unit_id);
create index digital_literacy_teacher_feedback_educator_idx
  on private.digital_literacy_teacher_feedback(educator_id);
create index digital_literacy_standard_badges_release_idx
  on private.digital_literacy_standard_badges(release_id);
