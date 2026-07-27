import { supabase } from "../supabaseClient.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertCourseId(courseId) {
  if (!UUID_PATTERN.test(String(courseId || ""))) throw new Error("A valid EdNotebook course is required before saving the syllabus to the cloud.");
}

export function sourceTypeForSyllabus(sourceLabel = "", hasSourceText = true) {
  const label = String(sourceLabel || "").toLowerCase();
  if (!hasSourceText) return "blank";
  if (label.includes(".pdf")) return "pdf";
  if (label.includes(".docx")) return "docx";
  if (/\.(txt|md|csv)\b/.test(label)) return "text";
  return "pasted";
}

export async function saveCourseSyllabusDraft(courseId, payload, options = {}) {
  assertCourseId(courseId);
  const { data, error } = await supabase.rpc("save_course_syllabus_draft", {
    p_course_id: courseId,
    p_payload: payload,
    p_source_type: options.sourceType || "pasted",
    p_source_name: options.sourceName || "",
    p_source_checksum_sha256: options.sourceChecksumSha256 || null,
    p_change_summary: options.changeSummary || "Professor-reviewed syllabus draft",
  });
  if (error) throw error;
  return data;
}

export async function loadCourseSyllabus(courseId) {
  assertCourseId(courseId);
  const { data, error } = await supabase
    .from("course_syllabi")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCourseSyllabusVersions(syllabusId) {
  if (!UUID_PATTERN.test(String(syllabusId || ""))) return [];
  const { data, error } = await supabase
    .from("course_syllabus_versions")
    .select("version_number, review_state, change_summary, created_by, created_at, compliance_summary, lms_mapping")
    .eq("syllabus_id", syllabusId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return data || [];
}
