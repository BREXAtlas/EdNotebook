import { isSupabaseConfigured, supabase } from "../../supabaseClient.js";

function friendly(error, fallback) {
  const message = String(error?.message || "");
  if (/not found|schema cache|function/i.test(message)) return new Error("The LTI 1.3 database migration and Edge Functions have not been deployed yet.");
  return new Error(message || fallback);
}

export function ltiFunctionUrl(name) {
  const projectUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/u, "");
  return projectUrl ? `${projectUrl}/functions/v1/${name}` : "";
}

export async function loadLtiOwnerSetup() {
  if (!isSupabaseConfigured) throw new Error("Connect Supabase before configuring LTI 1.3.");
  const { data, error } = await supabase.rpc("get_lti_owner_setup");
  if (error) throw friendly(error, "LTI owner setup could not be loaded.");
  return data || { institutions: [], courses: [], registrations: [], deployments: [], contexts: [], grade_sync: [], roster_sync: [] };
}

export async function saveLtiRegistration(id, input) {
  const { data, error } = await supabase.rpc("save_lti_platform_registration", { p_registration_id: id || null, p_input: input });
  if (error) throw friendly(error, "The LTI registration could not be saved.");
  return data;
}

export async function saveLtiDeployment(id, input) {
  const { data, error } = await supabase.rpc("save_lti_deployment", { p_deployment_id: id || null, p_input: input });
  if (error) throw friendly(error, "The LTI deployment could not be saved.");
  return data;
}

export async function mapLtiContext(contextId, courseId) {
  const { data, error } = await supabase.rpc("map_lti_context", { p_context_mapping_id: contextId, p_course_id: courseId });
  if (error) throw friendly(error, "The Blackboard course could not be mapped.");
  return data;
}

export async function activateTestedLtiDeployment(deploymentId) {
  const { data, error } = await supabase.rpc("activate_tested_lti_deployment", { p_deployment_id: deploymentId });
  if (error) throw friendly(error, "The LTI deployment is not eligible for activation.");
  return data;
}

async function invoke(name, launchToken, body = {}) {
  if (!isSupabaseConfigured) throw new Error("The LTI service is not connected.");
  const { data, error } = await supabase.functions.invoke(name, { body, headers: { "x-ednotebook-lti-launch": launchToken } });
  if (error) {
    const response = error.context instanceof Response ? error.context.clone() : null;
    let details = null;
    try { details = response ? await response.json() : null; } catch { details = null; }
    if (details?.error) throw new Error(details.error);
    throw friendly(error, `The ${name} service could not complete the request.`);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const readLtiSession = (token) => invoke("lti-session?action=read", token);
export const linkLtiCurrentUser = (token) => invoke("lti-session?action=link-current-user", token);
export const syncLtiRoster = (token) => invoke("lti-nrps-sync", token);
export const runLtiAgs = (token, body) => invoke("lti-ags", token, body);
export const createDeepLinkResponse = (token, selections) => invoke("lti-deep-link-response", token, { selections });

export async function loadLtiCourseWorkspace(courseId) {
  const [{ data: context, error }, { data: publications }, { data: assignments }] = await Promise.all([
    supabase.rpc("get_blackboard_export_context", { p_course_id: courseId }),
    supabase.from("course_publications").select("id,course_id,status,display_mode,current_version,grade_item_id").eq("course_id", courseId).eq("status", "published"),
    supabase.from("assignments").select("id,course_id,title,status,due_at").eq("course_id", courseId).in("status", ["published", "review"]),
  ]);
  if (error) throw friendly(error, "The course workspace could not be loaded.");
  return { course: context?.course, learners: context?.learners || [], gradeItems: context?.grade_items || [], grades: context?.grades || [], publications: publications || [], assignments: assignments || [] };
}

export function submitDeepLinkForm({ returnUrl, formField, jwt }) {
  if (!/^https:\/\//u.test(returnUrl) || formField !== "JWT" || !jwt) throw new Error("The LMS return address is invalid.");
  const form = document.createElement("form");
  form.method = "post"; form.action = returnUrl; form.style.display = "none";
  const field = document.createElement("input"); field.type = "hidden"; field.name = formField; field.value = jwt;
  form.appendChild(field); document.body.appendChild(form); form.submit();
}
