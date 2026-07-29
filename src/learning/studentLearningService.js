import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

function fromCloudRow(row) {
  return {
    id: row.record_id,
    rootId: row.root_id,
    previousVersionId: row.previous_version_id,
    version: row.version,
    kind: row.record_kind,
    courseId: row.course_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title,
    sourceRootId: row.source_root_id,
    title: row.title,
    filename: row.filename,
    content: row.content,
    createdAt: row.created_at,
    storage: "cloud",
  };
}

function toCloudRow(record, studentId) {
  return {
    student_id: studentId,
    record_id: record.id,
    root_id: record.rootId,
    previous_version_id: record.previousVersionId || null,
    version: record.version,
    record_kind: record.kind,
    course_id: /^[0-9a-f-]{36}$/iu.test(String(record.courseId || "")) ? record.courseId : null,
    course_code: record.courseCode,
    course_title: record.courseTitle,
    lesson_id: record.lessonId || null,
    lesson_title: record.lessonTitle || null,
    source_root_id: record.sourceRootId || null,
    title: record.title,
    filename: record.filename,
    content: record.content,
    created_at: record.createdAt,
  };
}

async function loadCloudLearningRecords(studentId) {
  if (!isSupabaseConfigured || !supabase || !studentId) return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("student_learning_records")
    .select("record_id,root_id,previous_version_id,version,record_kind,course_id,course_code,course_title,lesson_id,lesson_title,source_root_id,title,filename,content,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return { data: (data || []).map(fromCloudRow), error, source: error ? "device" : "cloud" };
}

async function appendCloudLearningRecord(record, studentId) {
  if (!isSupabaseConfigured || !supabase || !studentId) return { data: record, source: "device" };
  const { data, error } = await supabase
    .from("student_learning_records")
    .insert(toCloudRow(record, studentId))
    .select("record_id,root_id,previous_version_id,version,record_kind,course_id,course_code,course_title,lesson_id,lesson_title,source_root_id,title,filename,content,created_at")
    .single();
  return { data: data ? fromCloudRow(data) : record, error, source: error ? "device" : "cloud" };
}

export { loadCloudLearningRecords, appendCloudLearningRecord };
