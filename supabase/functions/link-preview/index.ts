import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  requirePost,
  requireUser,
} from "../_shared/runtime.ts";
import { recordAudit, sha256 } from "../_shared/security.ts";

interface PreviewRequest {
  url: string;
  refresh?: boolean;
}

interface DnsAnswer {
  data?: string;
  type?: number;
}

function normalizeUrl(input: string): URL {
  const value = String(input || "").trim();
  if (!value || value.length > 2048) throw new HttpError(400, "URL is missing or too long.");
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new HttpError(400, "URL is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new HttpError(400, "Only HTTP and HTTPS URLs are supported.");
  if (url.username || url.password) throw new HttpError(400, "URLs containing credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new HttpError(400, "Only standard web ports are allowed.");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  return url;
}

function ipv4Number(value: string): number | null {
  const pieces = value.split(".");
  if (pieces.length !== 4) return null;
  const bytes = pieces.map(Number);
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) return null;
  return (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) >>> 0;
}

function inIpv4Range(value: number, base: number, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function isBlockedIp(value: string): boolean {
  const ipv4 = ipv4Number(value);
  if (ipv4 !== null) {
    const ranges: Array<[string, number]> = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ];
    return ranges.some(([base, prefix]) => inIpv4Range(ipv4, ipv4Number(base)!, prefix));
  }

  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("2001:db8")) return true;
  const embedded = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return embedded ? isBlockedIp(embedded) : false;
}

async function dnsAnswers(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const endpoint = new URL("https://cloudflare-dns.com/dns-query");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", type);
  const response = await fetch(endpoint, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new HttpError(502, "DNS validation failed.");
  const body = await response.json() as { Answer?: DnsAnswer[] };
  const expected = type === "A" ? 1 : 28;
  return (body.Answer || [])
    .filter((answer) => answer.type === expected && answer.data)
    .map((answer) => String(answer.data));
}

async function assertPublicUrl(url: URL): Promise<void> {
  const host = url.hostname;
  if (["localhost", "localhost.localdomain"].includes(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new HttpError(403, "Local-network URLs are blocked.");
  }
  if (isBlockedIp(host)) throw new HttpError(403, "Private or reserved IP addresses are blocked.");
  const addresses = [...await dnsAnswers(host, "A"), ...await dnsAnswers(host, "AAAA")];
  if (!addresses.length) throw new HttpError(422, "The hostname does not resolve to a public address.");
  if (addresses.some(isBlockedIp)) throw new HttpError(403, "The hostname resolves to a private or reserved network.");
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > maxBytes) throw new HttpError(413, "The remote page is too large to preview.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "The remote page is too large to preview.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function fetchPublicPage(initial: URL): Promise<{ response: Response; body: string; finalUrl: URL }> {
  let url = initial;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5",
        "User-Agent": "EdNotebook-LinkPreview/1.0 (+https://brexatlas.github.io/EdNotebook/)",
      },
      signal: AbortSignal.timeout(9000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError(502, "The remote server returned an invalid redirect.");
      url = normalizeUrl(new URL(location, url).href);
      continue;
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok) throw new HttpError(422, `Remote page returned HTTP ${response.status}.`);
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
      throw new HttpError(415, "The URL does not point to an HTML page.");
    }
    return { response, body: await readLimited(response, 1_000_000), finalUrl: url };
  }
  throw new HttpError(508, "Too many redirects.");
}

function decodeEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  const result = decodeEntities(value.replace(/<[^>]+>/g, " ")).slice(0, max).trim();
  return result || null;
}

function metaContent(html: string, names: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
    }
    const key = (attributes.property || attributes.name || "").toLowerCase();
    if (names.includes(key) && attributes.content) return attributes.content;
  }
  return null;
}

function linkHref(html: string, relName: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = tag.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
    const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
    const relValue = (rel?.[1] ?? rel?.[2] ?? rel?.[3] ?? "").toLowerCase().split(/\s+/);
    if (relValue.includes(relName) && href) return href[1] ?? href[2] ?? href[3] ?? null;
  }
  return null;
}

async function safeRelatedUrl(value: string | null, base: URL): Promise<string | null> {
  if (!value) return null;
  try {
    const url = normalizeUrl(new URL(value, base).href);
    await assertPublicUrl(url);
    return url.href;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const { user } = await requireUser(req);
    const input = await parseJson<PreviewRequest>(req);
    const requested = normalizeUrl(input.url);
    await assertPublicUrl(requested);
    const normalizedUrl = requested.href;
    const urlHash = await sha256(normalizedUrl);
    const admin = adminClient();

    if (!input.refresh) {
      const { data: cached } = await admin
        .from("link_previews")
        .select("*")
        .eq("url_hash", urlHash)
        .eq("status", "ready")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached) return jsonResponse(req, { preview: cached, cached: true });
    }

    await admin.from("link_previews").upsert({
      normalized_url: normalizedUrl,
      url_hash: urlHash,
      status: "pending",
      error_code: null,
    }, { onConflict: "normalized_url" });

    try {
      const { response, body, finalUrl } = await fetchPublicPage(requested);
      const title = clean(
        metaContent(body, ["og:title", "twitter:title"])
          || body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1],
        220,
      ) || finalUrl.hostname;
      const description = clean(
        metaContent(body, ["og:description", "twitter:description", "description"]),
        600,
      );
      const siteName = clean(metaContent(body, ["og:site_name"]), 160) || finalUrl.hostname;
      const canonicalCandidate = metaContent(body, ["og:url"]) || linkHref(body, "canonical");
      const imageCandidate = metaContent(body, ["og:image:secure_url", "og:image", "twitter:image"]);
      const faviconCandidate = linkHref(body, "icon") || linkHref(body, "shortcut") || "/favicon.ico";
      const [canonicalUrl, imageUrl, faviconUrl] = await Promise.all([
        safeRelatedUrl(canonicalCandidate, finalUrl),
        safeRelatedUrl(imageCandidate, finalUrl),
        safeRelatedUrl(faviconCandidate, finalUrl),
      ]);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: preview, error: saveError } = await admin
        .from("link_previews")
        .upsert({
          normalized_url: normalizedUrl,
          url_hash: urlHash,
          status: "ready",
          title,
          description,
          site_name: siteName,
          image_url: imageUrl,
          favicon_url: faviconUrl,
          canonical_url: canonicalUrl || finalUrl.href,
          content_type: response.headers.get("content-type"),
          http_status: response.status,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt,
          error_code: null,
          metadata: {
            finalUrl: finalUrl.href,
            redirected: finalUrl.href !== normalizedUrl,
          },
        }, { onConflict: "normalized_url" })
        .select()
        .single();
      if (saveError) throw saveError;
      await recordAudit(admin, req, {
        actorId: user.id,
        eventType: "link.preview_fetched",
        targetType: "link_preview",
        targetId: preview.id,
        details: { hostname: finalUrl.hostname, cached: false },
      });
      return jsonResponse(req, { preview, cached: false });
    } catch (fetchError) {
      const code = fetchError instanceof HttpError ? `http_${fetchError.status}` : "fetch_error";
      await admin.from("link_previews").upsert({
        normalized_url: normalizedUrl,
        url_hash: urlHash,
        status: fetchError instanceof HttpError && fetchError.status === 403 ? "blocked" : "error",
        error_code: code,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        metadata: { message: fetchError instanceof Error ? fetchError.message : String(fetchError) },
      }, { onConflict: "normalized_url" });
      throw fetchError;
    }
  } catch (error) {
    return errorResponse(req, error);
  }
});
