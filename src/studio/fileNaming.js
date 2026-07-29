const EXTENSION_MAP = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/epub+zip": "epub",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "video/mp4": "mp4",
};

function slugify(value, fallback = "material") {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64);
  return cleaned || fallback;
}

function extensionFor(file) {
  const source = file?.name || "";
  const finalDot = source.lastIndexOf(".");
  if (finalDot > -1 && finalDot < source.length - 1) {
    return source
      .slice(finalDot + 1)
      .toLowerCase()
      .replace(/[^a-z0-9]/gu, "")
      .slice(0, 8);
  }
  return EXTENSION_MAP[file?.type] || "bin";
}

function buildDigitalLiteracyName({ file, courseCode, category, title, version = 1, date = new Date() }) {
  const datePart = (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10);
  const code = slugify(courseCode || "course", "course");
  const kind = slugify(category || "resource", "resource");
  const subject = slugify(title || file?.name || "material", "material");
  const revision = `v${String(Math.max(1, Number(version) || 1)).padStart(2, "0")}`;
  return `${datePart}_${code}_${kind}_${subject}_${revision}.${extensionFor(file)}`;
}

export { slugify, buildDigitalLiteracyName };
