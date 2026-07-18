import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const DEFAULT_ORIGINS = [
  "https://brexatlas.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function jsonSecret(name: string): Record<string, string> {
  try {
    return JSON.parse(Deno.env.get(name) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function projectUrl(): string {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new Error("SUPABASE_URL is unavailable");
  return value;
}

export function publishableKey(): string {
  const keys = jsonSecret("SUPABASE_PUBLISHABLE_KEYS");
  const value = keys.default || Deno.env.get("SUPABASE_ANON_KEY");
  if (!value) throw new Error("Supabase publishable key is unavailable");
  return value;
}

export function secretKey(): string {
  const keys = jsonSecret("SUPABASE_SECRET_KEYS");
  const value = keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) throw new Error("Supabase secret key is unavailable");
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(projectUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get("authorization") || "";
  return createClient(projectUrl(), publishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request) {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, "A valid EdNotebook session is required.");
  }
  return { user: data.user, client };
}

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...configured]);
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, stripe-signature, x-ednotebook-worker-token",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function errorResponse(req: Request, error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(req, { error: error.message, details: error.details }, error.status);
  }
  console.error(error);
  return jsonResponse(req, { error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
}

export async function parseJson<T>(req: Request, maxBytes = 1_000_000): Promise<T> {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > maxBytes) throw new HttpError(413, "Request body is too large.");
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "Request body is too large.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function requirePost(req: Request): void {
  if (req.method !== "POST") throw new HttpError(405, "POST is required.");
}
