import { supabase } from "../supabaseClient.js";
import {
  fetchServerLinkPreview,
  getSecureDownload,
  getSecurePreview,
  getStorageUsage,
  requestSecureDeletion,
  uploadToSecureQuarantine,
} from "./resumableUpload.js";
import { buildDigitalLiteracyName, slugify } from "./fileNaming.js";

export { buildDigitalLiteracyName, slugify } from "./fileNaming.js";

export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;

export async function checksumFile(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

export function validateFile(file, maxBytes = STORAGE_LIMIT_BYTES) {
  if (!file) throw new Error("Choose a file first.");
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("The selected file is empty or unreadable.");
  if (file.size > maxBytes) {
    throw new Error(`This file exceeds the current ${Math.round(maxBytes / 1024 / 1024)} MB browser limit.`);
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

function purposeForScope(scope) {
  if (scope === "course") return "course";
  if (scope === "submission") return "submission";
  if (scope === "publication") return "publication";
  return "private";
}

export async function uploadCloudFile(file, options) {
  validateFile(file);
  const safeName = options.safeName || buildDigitalLiteracyName({ file, ...options });
  const checksumSha256 = options.checksumSha256 || (await checksumFile(file));
  const result = await uploadToSecureQuarantine(file, {
    purpose: purposeForScope(options.scope),
    safeName,
    checksumSha256,
    courseId: options.courseId || null,
    assignmentId: options.assignmentId || null,
    publicationId: options.publicationId || null,
    metadata: {
      title: options.title || file.name,
      category: options.category || "resource",
      courseCode: options.courseCode || null,
      originalName: file.name,
      ...options.metadata,
    },
    onProgress: options.onProgress,
    onStatus: options.onStatus,
    onController: options.onController,
  });
  return {
    secureFileId: result.secureFileId,
    safeName,
    checksumSha256,
    securityStatus: result.completion?.status || "scanning",
    reservation: result.reservation,
    completion: result.completion,
  };
}

function triggerBrowserDownload(url, filename) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "download";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadResource(resource, options = {}) {
  if (resource.secure_file_id) {
    const signed = await getSecureDownload(resource.secure_file_id, {
      disposition: options.inline ? "inline" : "download",
    });
    if (options.inline) return signed.url;
    triggerBrowserDownload(signed.url, signed.filename || resource.safe_name || resource.original_name);
    return signed;
  }
  if (resource.storage_mode === "external" && resource.external_url) {
    window.open(resource.external_url, "_blank", "noopener,noreferrer");
    return { external: true };
  }
  throw new Error("This legacy file has no secure delivery record.");
}

export async function openPreview(previewId) {
  const signed = await getSecurePreview(previewId);
  return signed.url;
}

// Retained only so older imports fail clearly instead of bypassing audited delivery.
export async function downloadCloudFile() {
  throw new Error("Direct bucket downloads are disabled. Use downloadResource with a secure file record.");
}

export async function cloudPreviewUrl() {
  throw new Error("Direct preview downloads are disabled. Use openPreview with a preview record.");
}

export async function removeCloudFile() {
  throw new Error("Direct object deletion is disabled. Use the retention-aware deletion service.");
}

export async function saveResourceRecord(record) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in before saving materials.");

  const payload = {
    owner_id: authData.user.id,
    course_id: record.course_id || null,
    assignment_id: record.assignment_id || null,
    secure_file_id: record.secure_file_id || null,
    link_preview_id: record.link_preview_id || null,
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
    security_status: record.secure_file_id ? (record.security_status || "quarantined") : "not_applicable",
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
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  query = courseId
    ? query.or(`course_id.eq.${courseId},course_id.is.null`)
    : query.is("course_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listSecurePreviews(secureFileId) {
  const { data, error } = await supabase
    .from("file_previews")
    .select("*")
    .eq("secure_file_id", secureFileId)
    .order("page_number", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function deleteResourceRecord(resource, reason = "Removed from the learning materials studio") {
  if (resource.secure_file_id) {
    return requestSecureDeletion(resource.secure_file_id, reason);
  }
  const { error } = await supabase.from("learning_resources").delete().eq("id", resource.id);
  if (error) throw error;
  return { deleted: true, status: "metadata_removed" };
}

export async function getCurrentStorageUsage() {
  return getStorageUsage();
}

export async function getLinkPreview(url, refresh = false) {
  const response = await fetchServerLinkPreview(url, refresh);
  return response.preview;
}
