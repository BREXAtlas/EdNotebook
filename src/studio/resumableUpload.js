import * as tus from "tus-js-client";
import { supabase } from "../supabaseClient.js";

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

async function functionError(error, fallback) {
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const body = await response.clone().json();
      if (body?.error) return new Error(body.error);
    } catch {
      // Ignore non-JSON function errors.
    }
  }
  return new Error(error?.message || fallback);
}

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw await functionError(error, `${name} failed.`);
  if (data?.error) throw new Error(data.error);
  return data;
}

function projectRef() {
  const hostname = new URL(import.meta.env.VITE_SUPABASE_URL).hostname;
  const ref = hostname.split(".")[0];
  if (!ref) throw new Error("The Supabase project reference could not be determined.");
  return ref;
}

export async function getStorageUsage() {
  const { data, error } = await supabase.rpc("get_my_storage_usage");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function uploadToSecureQuarantine(file, options) {
  if (!tus.isSupported) {
    throw new Error("This browser cannot perform resumable uploads. Use a current browser or device-only storage.");
  }

  const reservation = await invoke("secure-upload-session", {
    purpose: options.purpose,
    originalName: file.name,
    safeName: options.safeName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    courseId: options.courseId || null,
    assignmentId: options.assignmentId || null,
    publicationId: options.publicationId || null,
    metadata: options.metadata || {},
  });

  const secureFileId = reservation.upload.id;
  const endpoint = `https://${projectRef()}.storage.supabase.co/storage/v1/upload/resumable`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        "x-signature": reservation.upload.signature,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: true,
      chunkSize: TUS_CHUNK_SIZE,
      addRequestId: true,
      fingerprint: async () => [
        "ednotebook-secure-upload-v1",
        secureFileId,
        file.name,
        file.type,
        file.size,
        file.lastModified,
      ].join("-"),
      metadata: {
        bucketName: reservation.upload.bucket,
        objectName: reservation.upload.path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        metadata: JSON.stringify({
          secureFileId,
          safeName: options.safeName,
          purpose: options.purpose,
        }),
      },
      onUploadUrlAvailable() {
        options.onStatus?.("uploading", { secureFileId, uploadUrl: upload.url });
      },
      onProgress(bytesUploaded, bytesTotal) {
        options.onProgress?.({
          bytesUploaded,
          bytesTotal,
          percentage: bytesTotal ? (bytesUploaded / bytesTotal) * 100 : 0,
        });
      },
      async onSuccess() {
        if (settled) return;
        settled = true;
        try {
          options.onStatus?.("quarantined", { secureFileId });
          const completion = await invoke("secure-upload-complete", {
            secureFileId,
            checksumSha256: options.checksumSha256 || null,
          });
          options.onStatus?.("scanning", completion);
          resolve({ reservation, completion, secureFileId });
        } catch (error) {
          reject(error);
        }
      },
      onError(error) {
        if (settled) return;
        settled = true;
        reject(error);
      },
    });

    options.onController?.({
      pause: () => upload.abort(false),
      resume: () => upload.start(),
      cancel: () => upload.abort(true),
      upload,
    });

    upload.findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
          options.onStatus?.("resuming", { secureFileId });
        }
        upload.start();
      })
      .catch(reject);
  });
}

export async function getSecureDownload(secureFileId, options = {}) {
  return invoke("secure-file-download", {
    secureFileId,
    disposition: options.disposition || "download",
  });
}

export async function getSecurePreview(previewId) {
  return invoke("secure-file-download", { previewId, disposition: "inline" });
}

export async function requestSecureDeletion(secureFileId, reason = "") {
  return invoke("secure-file-delete", { secureFileId, reason });
}

export async function fetchServerLinkPreview(url, refresh = false) {
  return invoke("link-preview", { url, refresh });
}
