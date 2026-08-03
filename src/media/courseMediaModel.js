const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function normalizeHttpsUrl(value) {
  const input = String(value || "").trim();
  if (!input) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function youtubeVideoId(value) {
  if (YOUTUBE_ID_PATTERN.test(String(value || ""))) return String(value);
  const url = value instanceof URL ? value : normalizeHttpsUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = null;
  if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0];
  if (host === "youtube.com" && url.pathname === "/watch") candidate = url.searchParams.get("v");
  if (["youtube.com", "youtube-nocookie.com"].includes(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(parts[0])) candidate = parts[1];
  }
  return YOUTUBE_ID_PATTERN.test(candidate || "") ? candidate : null;
}

export function youtubePrivacyEmbedUrl(value) {
  const id = youtubeVideoId(value);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: "0",
    enablejsapi: "0",
    modestbranding: "1",
    rel: "0",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function resourceTargetForPlacement(placement, targetKey = null) {
  if (placement === "lesson") {
    return { target_kind: "lesson", target_key: targetKey || null };
  }
  if (placement === "assignment") {
    return { target_kind: "assignment", target_key: targetKey || null };
  }
  if (placement === "private-vault") {
    return { target_kind: "personal", target_key: null };
  }
  return { target_kind: "course", target_key: null };
}

export function resourcesForTarget(resources, targetKind, targetKey = null) {
  return (resources || []).filter((resource) => {
    if (resource.target_kind === targetKind) {
      return targetKind === "course" || String(resource.target_key) === String(targetKey);
    }
    return targetKind === "course" && !resource.target_kind;
  });
}

export function mediaKind(resource) {
  const provider = resource?.embed_provider;
  if (provider === "youtube" || resource?.resource_type === "youtube") return "youtube";
  if (provider === "secure_video" || resource?.resource_type === "video") return "video";
  if (provider === "secure_audio" || resource?.resource_type === "audio") return "audio";
  if (provider === "secure_image" || resource?.resource_type === "image") return "image";
  if (provider === "quote" || resource?.resource_type === "quote") return "quote";
  if (provider === "web" || resource?.resource_type === "link") return "web";
  return "file";
}
