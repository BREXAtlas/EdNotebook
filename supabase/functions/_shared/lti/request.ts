import { HttpError } from "../runtime.ts";

export async function parseLtiRequest(req: Request, maxBytes = 100_000): Promise<Record<string, string>> {
  const length = Number(req.headers.get("content-length") || "0");
  if (length > maxBytes) throw new HttpError(413, "LTI request is too large.");
  if (req.method === "GET") return Object.fromEntries(new URL(req.url).searchParams.entries());
  if (req.method !== "POST") throw new HttpError(405, "GET or POST is required.");
  const type = req.headers.get("content-type")?.split(";")[0].trim();
  if (type !== "application/x-www-form-urlencoded") throw new HttpError(415, "LTI requests must be form encoded.");
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413, "LTI request is too large.");
  return Object.fromEntries(new URLSearchParams(text).entries());
}

export function edgeFunctionUrl(name: string): string {
  const project = Deno.env.get("SUPABASE_URL");
  if (!project) throw new HttpError(503, "Supabase project URL is unavailable.");
  return `${project.replace(/\/$/u, "")}/functions/v1/${name}`;
}

export function siteUrl(): string {
  return (Deno.env.get("LTI_SITE_URL") || "https://ednotebook.com").replace(/\/$/u, "");
}

export function safeErrorHtml(correlationId: string): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LTI launch unavailable</title><body style="font-family:system-ui;max-width:42rem;margin:4rem auto;padding:1rem"><h1>EdNotebook could not open this course link.</h1><p>Ask your instructor or LMS administrator to check the LTI setup.</p><p>Reference: <code>${correlationId}</code></p></body></html>`;
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action https:; frame-ancestors *", "Referrer-Policy": "no-referrer" } });
}
