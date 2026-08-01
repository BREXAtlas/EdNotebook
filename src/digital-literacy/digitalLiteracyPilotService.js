import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { DIGITAL_LITERACY_RELEASE_ID } from "./digitalLiteracyPilotModel.js";

const SETUP_MESSAGE = "The Digital Literacy pilot-readiness migration is not deployed in this environment.";

function unavailable() {
  return { data: null, error: new Error(SETUP_MESSAGE), source: "unavailable" };
}

function configured() {
  return Boolean(isSupabaseConfigured && supabase);
}

function result(data, error) {
  if (!error) return { data, error: null, source: "cloud" };
  const message = String(error.message || "");
  if (["42P01", "42883", "PGRST202"].includes(String(error.code || "")) || /schema cache|does not exist|could not find.*function/iu.test(message)) {
    return unavailable();
  }
  return { data: null, error, source: "cloud" };
}

export async function loadProfessorDigitalLiteracyWorkspace(courseId) {
  if (!configured() || !courseId) return unavailable();
  const { data, error } = await supabase.rpc("get_digital_literacy_professor_workspace", { p_course_id: courseId });
  return result(data, error);
}

export async function createDigitalLiteracyAssignment({ courseId, title, dueAt, unitIds, studentIds, instructions }) {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc("create_digital_literacy_assignment", {
    p_course_id: courseId,
    p_title: title,
    p_due_at: dueAt,
    p_unit_ids: unitIds,
    p_student_ids: studentIds?.length ? studentIds : null,
    p_instructions: instructions || "",
  });
  return result(data, error);
}

export async function loadMyDigitalLiteracyAssignments(courseId = null) {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc("get_my_digital_literacy_assignments", { p_course_id: courseId });
  return result(data, error);
}

export async function syncDigitalLiteracyProgress({ path, completedNodeIds, stars }) {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc("sync_digital_literacy_assignment_progress", {
    p_path: path,
    p_completed_node_ids: completedNodeIds,
    p_stars: stars,
    p_catalog_release: DIGITAL_LITERACY_RELEASE_ID,
    p_evidence_source: "canonical_course_embed",
  });
  return result(data, error);
}

export async function loadMyActiveDigitalLiteracyResearch(courseId) {
  if (!configured() || !courseId) return unavailable();
  const { data, error } = await supabase.rpc("get_my_active_digital_literacy_research", { p_course_id: courseId });
  return result(data, error);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function recordDigitalLiteracyResearchChoice({ versionId, choice, noticeVersion }) {
  if (!configured()) return unavailable();
  const { data: authData } = await supabase.auth.getUser();
  const consentHash = choice === "consented"
    ? await sha256(`${versionId}:${authData?.user?.id || "unknown"}:${noticeVersion}:consented`)
    : null;
  const { data, error } = await supabase.rpc("record_research_participation_choice", {
    p_version_id: versionId,
    p_choice: choice,
    p_notice_version: noticeVersion,
    p_consent_record_hash: consentHash,
  });
  return result(data, error);
}

export async function submitDigitalLiteracyResearchResponse(instrumentId, response) {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc("submit_research_response", {
    p_instrument_id: instrumentId,
    p_response: response,
  });
  return result(data, error);
}

export async function requestDigitalLiteracyResearchAction(versionId, requestType) {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc("request_research_subject_action", {
    p_version_id: versionId,
    p_request_type: requestType,
  });
  return result(data, error);
}
