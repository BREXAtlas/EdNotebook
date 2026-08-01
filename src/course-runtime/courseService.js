import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );

export async function listManageableCourses() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id,institution_id,title,course_code,subject,audience,teaching_window,status,education_division,settings,updated_at",
    )
    .order("updated_at", { ascending: false });
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function loadPublicationForCourse(courseId) {
  if (!isSupabaseConfigured || !isUuid(courseId))
    return { data: null, source: "device" };
  const { data, error } = await supabase
    .from("course_publications")
    .select(
      "id,course_id,current_version,status,display_mode,theme_preset,grading_mode,grade_item_id,draft_manifest,published_at,updated_at",
    )
    .eq("course_id", courseId)
    .maybeSingle();
  return { data, error, source: error ? "device" : "cloud" };
}

export async function saveCoursePackageDraft(courseId, manifest, options = {}) {
  if (!isSupabaseConfigured || !isUuid(courseId))
    return {
      data: null,
      error: new Error("Cloud course publishing is not connected."),
      source: "device",
    };
  const { data, error } = await supabase.rpc("save_course_package_draft", {
    p_course_id: courseId,
    p_manifest: manifest,
    p_display_mode: options.displayMode || "full_course",
    p_theme_preset:
      options.themePreset || manifest?.preset?.id || "ednotebook-default",
    p_grading_mode: options.gradingMode || manifest?.grading?.mode || "auto",
  });
  return { data, error, source: error ? "device" : "cloud" };
}

export async function publishCoursePackage(courseId, manifest, options = {}) {
  if (!isSupabaseConfigured || !isUuid(courseId))
    return {
      data: null,
      error: new Error("Cloud course publishing is not connected."),
      source: "device",
    };
  const { data, error } = await supabase.rpc("publish_course_package", {
    p_course_id: courseId,
    p_manifest: manifest,
    p_display_mode: options.displayMode || "full_course",
    p_theme_preset:
      options.themePreset || manifest?.preset?.id || "ednotebook-default",
    p_grading_mode: options.gradingMode || manifest?.grading?.mode || "auto",
    p_change_summary:
      options.changeSummary || "Published from Course Output Studio",
  });
  return { data, error, source: error ? "device" : "cloud" };
}

export async function setPublicationState(publicationId, status) {
  const { data, error } = await supabase.rpc("set_course_publication_state", {
    p_publication_id: publicationId,
    p_status: status,
  });
  return { data, error };
}

export async function loadPublishedCourse(publicationId) {
  if (!isSupabaseConfigured || !isUuid(publicationId))
    return {
      data: null,
      error: new Error("Course address is invalid."),
      source: "device",
    };
  const { data: publication, error: publicationError } = await supabase
    .from("course_publications")
    .select(
      "id,course_id,current_version,status,display_mode,theme_preset,grading_mode,grade_item_id,published_at,courses(id,title,course_code,subject,audience,teaching_window,education_division)",
    )
    .eq("id", publicationId)
    .eq("status", "published")
    .maybeSingle();
  if (publicationError || !publication)
    return {
      data: null,
      error:
        publicationError ||
        new Error("This course is not published or you do not have access."),
      source: "cloud",
    };
  const [
    { data: version, error: versionError },
    { data: directory },
    { data: resourceEnvelope, error: resourceError },
  ] =
    await Promise.all([
      supabase
        .from("course_publication_versions")
        .select("version_number,manifest,published_at")
        .eq("publication_id", publicationId)
        .eq("version_number", publication.current_version)
        .single(),
      supabase
        .from("published_course_directory")
        .select(
          "professor_id,professor_display_name,institution_name,course_code,title,summary",
        )
        .eq("course_id", publication.course_id)
        .maybeSingle(),
      supabase.rpc("get_published_course_resources", {
        p_publication_id: publicationId,
      }),
    ]);
  if (versionError || resourceError)
    return {
      data: null,
      error: versionError || resourceError,
      source: "cloud",
    };
  return {
    data: {
      publication,
      version,
      manifest: version.manifest,
      directory,
      resources: resourceEnvelope?.resources || [],
      resourcePolicy: resourceEnvelope?.reader_policy || null,
    },
    source: "cloud",
  };
}

export async function listMyCourseResources(courseId) {
  if (!isSupabaseConfigured || !isUuid(courseId))
    return { data: [], source: "device" };
  const { data, error } = await supabase.rpc("get_my_course_resources", {
    p_course_id: courseId,
  });
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function saveMyCourseLink(courseId, values) {
  const { data, error } = await supabase.rpc("save_my_course_link", {
    p_course_id: courseId,
    p_url: values.url,
    p_title: values.title,
    p_description: values.description || "",
  });
  return { data, error };
}

export async function deleteMyCourseLink(resourceId) {
  const { data, error } = await supabase.rpc("delete_my_course_link", {
    p_resource_id: resourceId,
  });
  return { data, error };
}

export async function recordCourseMediaProgress(resourceId, event) {
  if (!isSupabaseConfigured || !isUuid(resourceId))
    return {
      data: null,
      error: new Error("Media progress sync is unavailable."),
      source: "device",
    };
  const { data, error } = await supabase.rpc("record_course_media_progress", {
    p_publication_resource_id: resourceId,
    p_event_type: event.type,
    p_position_seconds: Number.isFinite(event.positionSeconds) ? event.positionSeconds : null,
    p_duration_seconds: Number.isFinite(event.durationSeconds) ? event.durationSeconds : null,
  });
  return { data, error, source: error ? "device" : "cloud" };
}

export async function loadStudentCourseLinks(courseIds = []) {
  const ids = courseIds.filter(isUuid);
  if (!isSupabaseConfigured || !ids.length)
    return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("course_publications")
    .select("id,course_id,current_version,status,published_at")
    .in("course_id", ids)
    .eq("status", "published");
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function loadLearnerProgress(publicationId, userId) {
  if (!isSupabaseConfigured || !isUuid(publicationId) || !userId)
    return { data: null, source: "device" };
  const [
    { data: summary, error: summaryError },
    { data: lessons, error: lessonsError },
  ] = await Promise.all([
    supabase
      .from("course_progress")
      .select("*")
      .eq("publication_id", publicationId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("course_lesson_progress")
      .select(
        "version_number,path_id,lesson_id,section_index,phase,status,interaction_state,auto_score,completed_at,updated_at",
      )
      .eq("publication_id", publicationId)
      .eq("user_id", userId),
  ]);
  return {
    data: { summary, lessons: lessons || [] },
    error: summaryError || lessonsError,
    source: summaryError || lessonsError ? "device" : "cloud",
  };
}

export async function saveLessonProgress(payload) {
  if (!isSupabaseConfigured)
    return {
      data: null,
      error: new Error("Progress sync is unavailable."),
      source: "device",
    };
  const { data, error } = await supabase.rpc("save_course_lesson_progress", {
    p_publication_id: payload.publicationId,
    p_path_id: payload.pathId,
    p_lesson_id: payload.lessonId,
    p_section_index: Math.max(0, Number(payload.sectionIndex) || 0),
    p_phase: payload.phase || "lesson",
    p_interaction_state: payload.interactionState || {},
    p_complete: Boolean(payload.complete),
  });
  return { data, error, source: error ? "device" : "cloud" };
}

export async function listCourseDueWork(courseId) {
  if (!isSupabaseConfigured || !isUuid(courseId))
    return {
      data: { assignments: [], templates: [], gradeItems: [] },
      source: "device",
    };
  const [assignments, templates, gradeItems] = await Promise.all([
    supabase
      .from("assignments")
      .select("id,title,instructions,due_at,status,settings")
      .eq("course_id", courseId)
      .eq("status", "published")
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("assignment_form_templates")
      .select(
        "id,course_id,title,instructions,sections,editor_config,status,published_at,updated_at",
      )
      .eq("course_id", courseId)
      .eq("status", "published")
      .order("updated_at", { ascending: false }),
    supabase
      .from("grade_items")
      .select("id,title,max_points,publish_state,due_at,assignment_id")
      .eq("course_id", courseId)
      .eq("publish_state", "published")
      .order("due_at", { ascending: true, nullsFirst: false }),
  ]);
  return {
    data: {
      assignments: assignments.data || [],
      templates: templates.data || [],
      gradeItems: gradeItems.data || [],
    },
    error: assignments.error || templates.error || gradeItems.error,
    source:
      assignments.error || templates.error || gradeItems.error
        ? "device"
        : "cloud",
  };
}

export async function listProgressOverview(courseId) {
  if (!isSupabaseConfigured || !isUuid(courseId))
    return { data: [], source: "device" };
  const { data, error } = await supabase.rpc("get_course_progress_overview", {
    p_course_id: courseId,
  });
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function gradeCourseProgress(
  publicationId,
  studentId,
  score,
  feedback,
) {
  const { data, error } = await supabase.rpc("grade_course_progress", {
    p_publication_id: publicationId,
    p_student_id: studentId,
    p_score: Number(score),
    p_feedback: feedback || null,
  });
  return { data, error };
}

export async function listEnrollmentRequests(courseId) {
  if (!isSupabaseConfigured || !isUuid(courseId))
    return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("student_enrollment_requests")
    .select(
      "id,course_id,student_id,status,requested_at,decided_at,profiles!student_enrollment_requests_student_id_fkey(full_name,email)",
    )
    .eq("course_id", courseId)
    .order("requested_at", { ascending: true });
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function approveEnrollmentRequest(requestId) {
  const { data, error } = await supabase.rpc("approve_student_enrollment", {
    p_request_id: requestId,
  });
  return { data, error };
}

export async function rejectEnrollmentRequest(requestId) {
  const { data, error } = await supabase
    .from("student_enrollment_requests")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", requestId)
    .select()
    .single();
  return { data, error };
}
