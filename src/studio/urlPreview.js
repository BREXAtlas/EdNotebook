const PROVIDERS = [
  { test: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, name: "YouTube", icon: "▶", tone: "video" },
  { test: /(^|\.)canva\.com$/, name: "Canva", icon: "C", tone: "design" },
  { test: /(^|\.)microsoft\.com$|(^|\.)office\.com$|(^|\.)sharepoint\.com$|(^|\.)onedrive\.live\.com$/, name: "Microsoft 365", icon: "W", tone: "document" },
  { test: /(^|\.)docs\.google\.com$|(^|\.)drive\.google\.com$/, name: "Google Workspace", icon: "G", tone: "document" },
  { test: /(^|\.)cengage\.com$|(^|\.)ngl\.cengage\.com$/, name: "Cengage", icon: "C", tone: "publisher" },
  { test: /(^|\.)vimeo\.com$/, name: "Vimeo", icon: "▶", tone: "video" },
  { test: /(^|\.)github\.com$/, name: "GitHub", icon: "⌘", tone: "code" },
  { test: /(^|\.)wikipedia\.org$/, name: "Wikipedia", icon: "W", tone: "reference" },
];

export function normalizeUrl(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  try {
    return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
}

export function extractFirstUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s<>"']+|(?:www\.)[^\s<>"']+/i);
  return match ? normalizeUrl(match[0])?.href || null : null;
}

export function youtubeId(value) {
  const url = value instanceof URL ? value : normalizeUrl(value);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || null;
  if (!/(^|\.)youtube\.com$/.test(host)) return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const parts = url.pathname.split("/").filter(Boolean);
  if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || null;
  return null;
}

export function linkPreview(value, suppliedTitle = "") {
  const url = value instanceof URL ? value : normalizeUrl(value);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  const provider = PROVIDERS.find((candidate) => candidate.test.test(host)) || {
    name: host,
    icon: "↗",
    tone: "web",
  };
  const videoId = youtubeId(url);
  const pathLabel = decodeURIComponent(url.pathname)
    .replace(/[-_]+/g, " ")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .slice(-2)
    .join(" · ");

  return {
    href: url.href,
    host,
    provider: provider.name,
    icon: provider.icon,
    tone: provider.tone,
    title: suppliedTitle.trim() || (videoId ? "YouTube learning video" : pathLabel || provider.name),
    description: videoId
      ? "Privacy-enhanced YouTube preview. Playback stays attached to this resource panel."
      : `External learning resource from ${provider.name}. Add a description so learners know why it matters.`,
    isYouTube: Boolean(videoId),
    youtubeId: videoId,
    embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null,
    thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
  };
}

export function detectResourceKind(value) {
  const preview = linkPreview(value);
  if (!preview) return "link";
  return preview.isYouTube ? "youtube" : "link";
}
