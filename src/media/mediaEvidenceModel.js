export function boundedPlaybackEvidence(event = {}) {
  const type = String(event.type || "progress");
  const duration = Number(event.durationSeconds);
  const position = Number(event.positionSeconds);
  const durationSeconds = Number.isFinite(duration) && duration >= 1
    ? Math.min(172800, duration)
    : null;
  const positionSeconds = Number.isFinite(position)
    ? Math.min(172800, Math.max(0, position))
    : null;
  return { type, positionSeconds, durationSeconds };
}

export function shouldReportPlayback(previous, current, now = Date.now()) {
  if (!current?.playing) return false;
  if (!previous) return true;
  const advanced = Math.abs((current.positionSeconds || 0) - (previous.positionSeconds || 0));
  return advanced >= 10 || now - previous.reportedAt >= 15000;
}

export function mediaProgressLabel(progress) {
  if (!progress) return "Viewing progress begins when you play.";
  if (progress.status === "completed") return "Viewed to completion";
  const percent = Math.max(0, Math.min(100, Number(progress.percent_complete) || 0));
  if (percent > 0) return `${Math.round(percent)}% viewed · saved`;
  if (progress.status === "started") return "Started · saved";
  return "Viewing progress begins when you play.";
}

export function accessibilityLabel(resource) {
  if (resource?.accessibility_status === "ready") {
    if (resource.caption_mode === "provider_captions") return "Verified provider captions";
    if (resource.caption_mode === "transcript") return "Reviewed transcript";
    if (resource.caption_mode === "webvtt") return "WebVTT captions";
    if (resource.is_decorative) return "Decorative image";
    return "Accessibility reviewed";
  }
  return "Accessibility review required";
}
