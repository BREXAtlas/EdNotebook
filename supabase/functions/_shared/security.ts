import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const encoder = new TextEncoder();

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value: string | Uint8Array): Promise<string> {
  const source = typeof value === "string" ? encoder.encode(value) : value;
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer)));
}

export function randomToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function headerHash(value: string | null): Promise<string | null> {
  if (!value) return null;
  const salt = Deno.env.get("AUDIT_HASH_SALT") || "ednotebook-audit-v1";
  return sha256(`${salt}|${value}`);
}

export interface AuditInput {
  actorId?: string | null;
  institutionId?: string | null;
  courseId?: string | null;
  assignmentId?: string | null;
  secureFileId?: string | null;
  resourceId?: string | null;
  eventType: string;
  targetType: string;
  targetId?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAudit(
  admin: SupabaseClient,
  req: Request | null,
  input: AuditInput,
): Promise<void> {
  const forwarded = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req?.headers.get("user-agent") || null;
  const requestId = input.requestId || req?.headers.get("x-request-id") || crypto.randomUUID();
  const { error } = await admin.from("audit_events").insert({
    actor_id: input.actorId || null,
    institution_id: input.institutionId || null,
    course_id: input.courseId || null,
    assignment_id: input.assignmentId || null,
    secure_file_id: input.secureFileId || null,
    resource_id: input.resourceId || null,
    event_type: input.eventType,
    target_type: input.targetType,
    target_id: input.targetId || null,
    request_id: requestId,
    ip_hash: await headerHash(forwarded),
    user_agent_hash: await headerHash(userAgent),
    details: input.details || {},
    event_hash: "",
  });
  if (error) console.error("audit insert failed", error);
}

export function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
