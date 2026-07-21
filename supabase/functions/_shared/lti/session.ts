import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { HttpError } from "../runtime.ts";
import { sha256 } from "./crypto.ts";

export function launchTokenFromRequest(req: Request): string {
  const token = req.headers.get("x-ednotebook-lti-launch")?.trim() || "";
  if (token.length < 32 || token.length > 500) throw new HttpError(401, "A valid LTI launch session is required.");
  return token;
}

export async function requireLaunchSession(admin: SupabaseClient, req: Request) {
  const tokenHash = await sha256(launchTokenFromRequest(req));
  const { data: session, error } = await admin.from("lti_launch_sessions").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) throw new HttpError(401, "LTI launch session is expired or invalid.");
  await admin.from("lti_launch_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);
  const [deploymentResult, contextResult, userResult, resourceResult, serviceResult] = await Promise.all([
    admin.from("lti_deployments").select("*").eq("id", session.deployment_id).single(),
    session.context_mapping_id ? admin.from("lti_context_mappings").select("*").eq("id", session.context_mapping_id).single() : Promise.resolve({ data: null, error: null }),
    admin.from("lti_user_mappings").select("*").eq("id", session.user_mapping_id).single(),
    session.resource_link_id ? admin.from("lti_resource_links").select("*").eq("id", session.resource_link_id).single() : Promise.resolve({ data: null, error: null }),
    session.service_endpoint_id ? admin.from("lti_service_endpoints").select("*").eq("id", session.service_endpoint_id).single() : Promise.resolve({ data: null, error: null }),
  ]);
  const firstError = [deploymentResult, contextResult, userResult, resourceResult, serviceResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  const { data: registration, error: registrationError } = await admin.from("lti_platform_registrations").select("*").eq("id", deploymentResult.data.registration_id).single();
  if (registrationError) throw registrationError;
  if (!["testing", "active"].includes(deploymentResult.data.status) || !["testing", "active"].includes(registration.status)) throw new HttpError(403, "This LTI connection is not enabled.");
  return { session, deployment: deploymentResult.data, registration, context: contextResult.data, user: userResult.data, resource: resourceResult.data, service: serviceResult.data };
}
