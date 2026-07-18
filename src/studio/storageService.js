import { supabase } from "../supabaseClient.js";

export const STORAGE_LIMIT_BYTES = 25 * 1024 * 1024;

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

export function slugify(value, fallback = "material") {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
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
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8);
  }
  return EXTENSION_MAP[file?.type] || "bin";
}

export function buildDigitalLiteracyName({ file, courseCode, category, title, version = 1 }) {
  const date = new Date().toISOString().slice(0, 10);
  const code = slugify(courseCode || "course", "course");
  const kind = slugify(category || "resource", "resource");
  const subject = slugify(title || file?.name || "material", "material");
  const revision = `v${String(Math.max(1, Number(version) || 1)).padStart(2, "0")}`;
  return `${date}_${code}_${kind}_${subject}_${revision}.${extensionFor(file)}`;
}

export async function checksumFile(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

export function validateFile(file) {
  if (!file) throw new Error("Choose a file first.");
  if (file.size > STORAGE_LIMIT_BYTES) {
    throw new Error(
      "For the free-tier launch, files are limited to 25 MB. Compress or split this file before uploading."
    );
  }
}

export function readCourseDraft() {
  try {
    return JSON.parse(window.localStorage.getItem("ednotebook-course-draft")) || {};
  } catch {
    return {};
  }
}

export function currentCourseId() {
  return readCourseDraft()?.id || window.localStorage.getItem("ednotebook-course-id") || null;
}

function cloudTarget({ scope, userId, courseId, assignmentId, publicationId, safeName }) {
  const objectId = crypto.randomUUID();
  if (scope === "course") {
    if (!courseId) {
      throw new Error("Create or select a course before adding shared course material.");
    }
    return {
      bucket: "ed-course-materials",
      path: `${courseId}/${userId}/${objectId}/${safeName}`,
    };
  }
  if (scope === "submission") {
    if (!courseId || !assignmentId) {
      throw new Error("An assignment is required for submission uploads.");
    }
    return {
      bucket: "ed-submissions",
      path: `${courseId}/${assignmentId}/${userId}/${objectId}/${safeName}`,
    };
  }
  if (scope === "publication") {
    const publicationFolder = publicationId || crypto.randomUUID();
    return {
      bucket: "ed-publications",
      path: `${userId}/${publicationFolder}/${objectId}/${safeName}`,
    };
  }
  return {
    bucket: "ed-private-vault",
    path: `${userId}/${objectId}/${safeName}`,
  };
}

export async function uploadCloudFile(file, options) {
  validateFile(file);
  const safeName = options.safeName || buildDigitalLiteracyName({ file, ...options });
  const checksumSha256 = options.checksumSha256 || (await checksumFile(file));
  const target = cloudTarget({ ...options, safeName });

  // Durable descriptive metadata lives in public.learning_resources. Keep the
  // object upload limited to the supported Storage upload options so a client
  // library change cannot silently discard or reject the educational metadata.
  const { error } = await supabase.storage.from(target.bucket).upload(target.path, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { ...target, safeName, checksumSha256 };
}

export async function downloadCloudFile(bucket, path, filename) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || path.split("/").pop() || "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function cloudPreviewUrl(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return URL.createObjectURL(data);
}

export async function removeCloudFile(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export async function saveResourceRecord(record) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in before saving materials.");

  const payload = {
    owner_id: authData.user.id,
    course_id: record.course_id || null,
    assignment_id: record.assignment_id || null,
    resource_type: record.resource_type,
    title: record.title,
    description: record.description || "",
    placement: record.placement || "course-library",
    storage_mode: record.storage_mode,
    bucket_id: record.bucket_id || null,
    storage_path: record.storage_path || null,
    external_url: record.external_url || null,
    mime_type: record.mime_type || null,
    size_bytes: record.size_bytes ?? null,
    original_name: record.original_name || null,
    safe_name: record.safe_name || null,
    checksum_sha256: record.checksum_sha256 || null,
    alt_text: record.alt_text || null,
    source_label: record.source_label || null,
    license_label: record.license_label || null,
    visibility: record.visibility || (record.course_id ? "course" : "private"),
    metadata: record.metadata || {},
  };

  const { data, error } = await supabase
    .from("learning_resources")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCloudResources(courseId) {
  let query = supabase
    .from("learning_resources")
    .select("*")
    .order("created_at", { ascending: false });

  // The Materials Studio is both the current course library and the signed-in
  // user's private vault. RLS still controls which null-course rows can return.
  query = courseId
    ? query.or(`course_id.eq.${courseId},course_id.is.null`)
    : query.is("course_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function deleteResourceRecord(resource) {
  if (resource.storage_mode === "cloud" && resource.bucket_id && resource.storage_path) {
    await removeCloudFile(resource.bucket_id, resource.storage_path);
  }
  const { error } = await supabase.from("learning_resources").delete().eq("id", resource.id);
  if (error) throw error;
}
