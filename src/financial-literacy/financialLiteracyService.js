import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

const SETUP_MESSAGE =
  "The Early Prep Financial Literacy migration is not deployed in this environment.";

function unavailable() {
  return { data: null, error: new Error(SETUP_MESSAGE), source: "unavailable" };
}

function configured() {
  return Boolean(isSupabaseConfigured && supabase);
}

function isSetupError(error) {
  const message = String(error?.message || "");
  return (
    ["42P01", "42883", "PGRST202"].includes(String(error?.code || "")) ||
    /schema cache|does not exist|could not find.*function/iu.test(message)
  );
}

function result(data, error) {
  if (!error) return { data, error: null, source: "cloud" };
  if (isSetupError(error)) return unavailable();
  return { data: null, error, source: "cloud" };
}

export async function loadFinancialLiteracyCatalog() {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc("get_financial_literacy_catalog");
  return result(data, error);
}

export async function loadMyFinancialLiteracyCourse() {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc("get_my_financial_literacy_course");
  return result(data, error);
}

export async function recordMyFinancialLiteracyCompletion(unitId, catalogRelease) {
  if (!configured()) return unavailable();
  const { data, error } = await supabase.rpc(
    "record_my_financial_literacy_completion",
    { p_unit_id: unitId, p_catalog_release: catalogRelease },
  );
  return result(data, error);
}

export async function loadFinancialLiteracyTeacherProgress(courseId) {
  if (!configured() || !courseId) return unavailable();
  const { data, error } = await supabase.rpc(
    "get_financial_literacy_teacher_progress",
    { p_course_id: courseId },
  );
  return result(data, error);
}
