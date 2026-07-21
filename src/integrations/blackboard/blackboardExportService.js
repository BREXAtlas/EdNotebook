import { isSupabaseConfigured, supabase } from "../../supabaseClient.js";

const DEMO_COURSE_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_LEARNERS = [
  { id: "21111111-1111-4111-8111-111111111111", full_name: "Maya Reynolds", email: "maya.reynolds@example.edu" },
  { id: "22222222-2222-4222-8222-222222222222", full_name: "Jordan Lee", email: "jordan.lee@example.edu" },
  { id: "23333333-3333-4333-8333-333333333333", full_name: "Avery Johnson", email: "avery.johnson@example.edu" },
];
const DEMO_ITEMS = [
  { id: "31111111-1111-4111-8111-111111111111", title: "Cell structure lab", max_points: 100, publish_state: "published", updated_at: "2026-07-20T12:00:00Z" },
  { id: "32222222-2222-4222-8222-222222222222", title: "Evidence paragraph", max_points: 50, publish_state: "published", updated_at: "2026-07-20T12:00:00Z" },
];

function demoCourse() {
  return {
    id: DEMO_COURSE_ID,
    title: "What Is a Cell?",
    course_code: "SCI 101",
    teaching_window: "Fall 2026",
    institution_id: null,
    enrolled_learners: 3,
    grade_items: 2,
    finalized_grades: 4,
    awaiting_grading: 1,
    updated_at: "2026-07-20T12:00:00Z",
  };
}

function demoContext() {
  return {
    course: demoCourse(),
    learners: DEMO_LEARNERS,
    gradeItems: DEMO_ITEMS,
    grades: [
      { student_id: DEMO_LEARNERS[0].id, grade_item_id: DEMO_ITEMS[0].id, score: 92, status: "finalized", updated_at: "2026-07-20T12:00:00Z" },
      { student_id: DEMO_LEARNERS[1].id, grade_item_id: DEMO_ITEMS[0].id, score: 84, status: "finalized", updated_at: "2026-07-20T12:00:00Z" },
      { student_id: DEMO_LEARNERS[2].id, grade_item_id: DEMO_ITEMS[0].id, score: 88, status: "finalized", updated_at: "2026-07-20T12:00:00Z" },
      { student_id: DEMO_LEARNERS[0].id, grade_item_id: DEMO_ITEMS[1].id, score: 46, status: "finalized", updated_at: "2026-07-20T12:00:00Z" },
      { student_id: DEMO_LEARNERS[1].id, grade_item_id: DEMO_ITEMS[1].id, score: null, status: "pending", updated_at: "2026-07-20T12:00:00Z" },
    ],
    progress: [
      { user_id: DEMO_LEARNERS[0].id, completion_percent: 100, status: "completed", final_score: 92, auto_score: 92, grade_status: "graded", updated_at: "2026-07-20T12:00:00Z" },
      { user_id: DEMO_LEARNERS[1].id, completion_percent: 80, status: "in_progress", final_score: null, auto_score: 84, grade_status: "in_progress", updated_at: "2026-07-20T12:00:00Z" },
      { user_id: DEMO_LEARNERS[2].id, completion_percent: 100, status: "completed", final_score: 88, auto_score: 88, grade_status: "auto_graded", updated_at: "2026-07-20T12:00:00Z" },
    ],
    identityMappings: [],
    columnMappings: [],
    history: [],
    source: "demo",
  };
}

function friendlyError(error, fallback) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("course access denied") || message.includes("permission")) return new Error("You no longer have permission to manage this course.");
  if (message.includes("stale") || message.includes("changed after preview")) return new Error("Grades changed after this preview. Return to Preview export and review the updated values.");
  if (message.includes("not configured") || message.includes("schema cache") || message.includes("function") && message.includes("not found")) return new Error("The Blackboard export database migration has not been deployed yet.");
  return new Error(fallback);
}

export async function listBlackboardCourses() {
  if (!isSupabaseConfigured) return { data: [demoCourse()], source: "demo" };
  const { data, error } = await supabase.rpc("get_blackboard_manageable_courses");
  if (error) throw friendlyError(error, "The professor course list could not be loaded.");
  return { data: data || [], source: "cloud" };
}

export async function loadBlackboardCourseContext(courseId) {
  if (!isSupabaseConfigured) return demoContext();
  const { data, error } = await supabase.rpc("get_blackboard_export_context", { p_course_id: courseId });
  if (error) throw friendlyError(error, "The course gradebook could not be loaded for export.");
  return {
    course: data?.course || null,
    learners: data?.learners || [],
    gradeItems: data?.grade_items || [],
    grades: data?.grades || [],
    progress: data?.progress || [],
    identityMappings: data?.identity_mappings || [],
    columnMappings: data?.column_mappings || [],
    history: data?.history || [],
    source: "cloud",
  };
}

export async function saveBlackboardIdentityMappings(courseId, mappings) {
  if (!isSupabaseConfigured) return { data: mappings, source: "demo" };
  const { data, error } = await supabase.rpc("save_blackboard_identity_mappings", { p_course_id: courseId, p_mappings: mappings });
  if (error) throw friendlyError(error, "The student matches could not be saved.");
  return { data, source: "cloud" };
}

export async function saveBlackboardColumnMappings(courseId, mappings) {
  if (!isSupabaseConfigured) return { data: mappings, source: "demo" };
  const { data, error } = await supabase.rpc("save_blackboard_column_mappings", { p_course_id: courseId, p_mappings: mappings });
  if (error) throw friendlyError(error, "The grade column matches could not be saved.");
  return { data, source: "cloud" };
}

export async function recordBlackboardAudit(courseId, eventType, details = {}) {
  if (!isSupabaseConfigured) return { data: null, source: "demo" };
  const { data, error } = await supabase.rpc("record_blackboard_export_event", {
    p_course_id: courseId,
    p_event_type: eventType,
    p_details: details,
  });
  if (error) throw friendlyError(error, "The Blackboard export audit event could not be recorded.");
  return { data, source: "cloud" };
}

export async function confirmBlackboardExport(payload) {
  if (!isSupabaseConfigured) return { data: { id: crypto.randomUUID(), status: "generated", generated_at: new Date().toISOString() }, source: "demo" };
  const { data, error } = await supabase.rpc("confirm_blackboard_grade_export", {
    p_course_id: payload.courseId,
    p_source_filename: payload.sourceFilename,
    p_source_file_hash: payload.sourceFileHash,
    p_export_filename: payload.exportFilename,
    p_format_detected: payload.formatDetected,
    p_total_rows: payload.totalRows,
    p_matched_students: payload.matchedStudents,
    p_unmatched_students: payload.unmatchedStudents,
    p_mapped_columns: payload.mappedColumns,
    p_changed_grade_cells: payload.changedGradeCells,
    p_warning_count: payload.warningCount,
    p_mapping_snapshot: payload.mappingSnapshot,
    p_grade_snapshot: payload.gradeSnapshot,
  });
  if (error) throw friendlyError(error, "The Blackboard export could not be confirmed.");
  return { data, source: "cloud" };
}

export async function recordBlackboardDownload(exportId) {
  if (!isSupabaseConfigured) return { data: { id: exportId, status: "downloaded" }, source: "demo" };
  const { data, error } = await supabase.rpc("record_blackboard_export_download", { p_export_id: exportId });
  if (error) throw friendlyError(error, "The export was generated, but its download event could not be recorded.");
  return { data, source: "cloud" };
}

export { DEMO_COURSE_ID };
