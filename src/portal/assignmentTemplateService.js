import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

export function isDatabaseId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export async function listAssignmentCourses() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };

  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,title,education_division,subject_id")
    .order("updated_at", { ascending: false });

  if (error) return { data: [], error, source: "device" };
  return {
    data: (data || []).map((course) => ({
      id: course.id,
      code: course.course_code || "CLASS",
      title: course.title,
      division: course.education_division || "university",
      subjectId: course.subject_id || null,
    })),
    source: "cloud",
  };
}

export async function listAssignmentTemplates(courseId, includeDrafts = false) {
  if (!isSupabaseConfigured || !isDatabaseId(courseId)) return { data: [], source: "device" };

  let query = supabase
    .from("assignment_form_templates")
    .select("id,course_id,created_by,title,instructions,sections,editor_config,status,subject_id,published_at,updated_at")
    .eq("course_id", courseId)
    .order("updated_at", { ascending: false });

  if (!includeDrafts) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) return { data: [], error, source: "device" };
  return { data: data || [], source: "cloud" };
}

export async function saveAssignmentTemplate(template, userId) {
  if (!isSupabaseConfigured || !isDatabaseId(template.course_id) || !userId) {
    return { data: template, source: "device" };
  }

  const payload = {
    ...(isDatabaseId(template.id) ? { id: template.id } : {}),
    course_id: template.course_id,
    subject_id: template.subject_id || null,
    created_by: userId,
    title: template.title,
    instructions: template.instructions || "",
    sections: template.sections,
    editor_config: template.editor_config,
    status: template.status,
    published_at: template.status === "published" ? (template.published_at || new Date().toISOString()) : null,
  };

  const { data, error } = await supabase
    .from("assignment_form_templates")
    .upsert(payload)
    .select()
    .single();
  return { data, error, source: error ? "device" : "cloud" };
}

export async function saveAssignmentSubmission(submission, studentId) {
  if (!isSupabaseConfigured || !isDatabaseId(submission.template_id) || !studentId) {
    return { data: submission, source: "device" };
  }

  const { data, error } = await supabase
    .from("assignment_form_submissions")
    .upsert(
      {
        template_id: submission.template_id,
        course_id: submission.course_id,
        student_id: studentId,
        answers: submission.answers,
        document_content: submission.document_content,
        word_count: submission.word_count,
        status: submission.status,
        submitted_at: submission.status === "submitted" ? new Date().toISOString() : null,
      },
      { onConflict: "template_id,student_id" }
    )
    .select()
    .single();
  return { data, error, source: error ? "device" : "cloud" };
}

export async function loadAssignmentSubmission(templateId, studentId) {
  if (!isSupabaseConfigured || !isDatabaseId(templateId) || !studentId) return { data: null, source: "device" };

  const { data, error } = await supabase
    .from("assignment_form_submissions")
    .select("id,template_id,course_id,student_id,answers,document_content,word_count,status,submitted_at,review_state,grade_label,feedback_published_at,graded_at,updated_at")
    .eq("template_id", templateId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) return { data: null, error, source: "device" };
  return { data, source: "cloud" };
}

export async function listAssignmentSubmissions(courseId) {
  if (!isSupabaseConfigured || !isDatabaseId(courseId)) {
    return { data: [], source: "device" };
  }
  const { data, error } = await supabase
    .from("assignment_form_submissions")
    .select("id,template_id,course_id,student_id,answers,document_content,word_count,status,submitted_at,review_state,grade_label,feedback_published_at,graded_at,updated_at,assignment_form_templates(title,instructions),profiles!assignment_form_submissions_student_id_fkey(full_name,email)")
    .eq("course_id", courseId)
    .in("status", ["submitted", "returned"])
    .order("submitted_at", { ascending: false });
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function listAssignmentFeedback(submissionId) {
  if (!isSupabaseConfigured || !isDatabaseId(submissionId)) {
    return { data: [], source: "device" };
  }
  const { data, error } = await supabase
    .from("assignment_document_feedback")
    .select("id,submission_id,course_id,student_id,professor_id,feedback_type,selected_text,comment,is_highlight,published_at,created_at,updated_at")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function saveAssignmentFeedback(feedback, professorId) {
  if (
    !isSupabaseConfigured ||
    !isDatabaseId(feedback.submission_id) ||
    !isDatabaseId(feedback.course_id) ||
    !feedback.student_id ||
    !professorId
  ) {
    return {
      data: {
        ...feedback,
        id: feedback.id || `device-feedback-${crypto.randomUUID()}`,
        professor_id: professorId,
        created_at: new Date().toISOString(),
      },
      source: "device",
    };
  }
  const { data, error } = await supabase
    .from("assignment_document_feedback")
    .insert({
      submission_id: feedback.submission_id,
      course_id: feedback.course_id,
      student_id: feedback.student_id,
      professor_id: professorId,
      feedback_type: feedback.feedback_type || "comment",
      selected_text: feedback.selected_text || "",
      comment: feedback.comment,
      is_highlight: feedback.is_highlight !== false,
    })
    .select()
    .single();
  return { data, error, source: error ? "device" : "cloud" };
}

export async function publishAssignmentReview({
  submissionId,
  feedbackIds,
  graded = false,
  gradeLabel = null,
}) {
  if (!isSupabaseConfigured || !isDatabaseId(submissionId)) {
    return {
      data: {
        review_state: graded ? "graded" : "feedback_ready",
        grade_label: graded ? gradeLabel : null,
      },
      source: "device",
    };
  }
  const { data, error } = await supabase.rpc(
    "publish_assignment_document_review",
    {
      p_submission_id: submissionId,
      p_feedback_ids: feedbackIds || [],
      p_graded: graded,
      p_grade_label: graded ? (gradeLabel || "Graded") : null,
    },
  );
  return { data, error, source: error ? "device" : "cloud" };
}

export async function listStudentAssignmentEvents({ studentId, courseId }) {
  if (!isSupabaseConfigured || !studentId || !isDatabaseId(courseId)) {
    return { data: [], source: "device" };
  }
  const { data, error } = await supabase
    .from("assignment_form_submissions")
    .select("id,template_id,review_state,grade_label,feedback_published_at,graded_at,assignment_form_templates(title)")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .in("review_state", ["feedback_ready", "graded"])
    .order("feedback_published_at", { ascending: false });
  if (error) return { data: [], error, source: "device" };
  return {
    data: (data || []).map((submission) => {
      const graded = submission.review_state === "graded";
      const createdAt = (graded ? submission.graded_at : null) ||
        submission.feedback_published_at;
      return {
        id: `${graded ? "graded" : "feedback"}-${submission.id}-${createdAt}`,
        templateId: submission.template_id,
        title: submission.assignment_form_templates?.title || "Assignment",
        kind: graded ? "assignment-graded" : "assignment-feedback",
        body: graded
          ? `Your professor finished grading this assignment${submission.grade_label ? ` · ${submission.grade_label}` : ""}.`
          : "Your professor published feedback on this assignment.",
        createdAt,
      };
    }).filter((event) => event.createdAt),
    source: "cloud",
  };
}
