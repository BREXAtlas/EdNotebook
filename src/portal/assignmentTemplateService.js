import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

export function isDatabaseId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export async function listAssignmentCourses() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };

  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,title,education_division")
    .order("updated_at", { ascending: false });

  if (error) return { data: [], error, source: "device" };
  return {
    data: (data || []).map((course) => ({
      id: course.id,
      code: course.course_code || "CLASS",
      title: course.title,
      division: course.education_division || "university",
    })),
    source: "cloud",
  };
}

export async function listAssignmentTemplates(courseId, includeDrafts = false) {
  if (!isSupabaseConfigured || !isDatabaseId(courseId)) return { data: [], source: "device" };

  let query = supabase
    .from("assignment_form_templates")
    .select("id,course_id,created_by,title,instructions,sections,editor_config,status,published_at,updated_at")
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
    .select("id,template_id,course_id,student_id,answers,document_content,word_count,status,submitted_at,updated_at")
    .eq("template_id", templateId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) return { data: null, error, source: "device" };
  return { data, source: "cloud" };
}
