import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

const SETUP_MESSAGE = "The research-governance database migration is not deployed in this environment.";

export function isResearchGateConfigured() {
  return Boolean(isSupabaseConfigured && supabase);
}

export async function getResearchPilotGateStatus({ institutionId = null, courseId = null } = {}) {
  if (!isResearchGateConfigured()) {
    return {
      mode: "research",
      default_status: "not_activated",
      ordinary_feedback_unchanged: true,
      projects: [],
      setup_message: SETUP_MESSAGE,
    };
  }

  const { data, error } = await supabase.rpc("get_research_pilot_gate_status", {
    p_institution_id: institutionId,
    p_course_id: courseId,
  });
  if (error) {
    const message = String(error.message || "");
    if (["42P01", "42883", "PGRST202"].includes(String(error.code || ""))
      || /schema cache|does not exist|could not find.*function/iu.test(message)) {
      return {
        mode: "research",
        default_status: "not_activated",
        ordinary_feedback_unchanged: true,
        projects: [],
        setup_message: SETUP_MESSAGE,
      };
    }
    throw new Error("Research pilot status is unavailable. No research controls were enabled.");
  }
  return data;
}
