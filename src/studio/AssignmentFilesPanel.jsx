import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import {
  buildDigitalLiteracyName,
  checksumFile,
  currentCourseId,
  deleteResourceRecord,
  downloadResource,
  readCourseDraft,
  saveResourceRecord,
  uploadCloudFile,
  validateFile,
} from "./storageService.js";
import {
  deleteDeviceFile,
  downloadDeviceFile,
  listDeviceFiles,
  saveDeviceFile,
} from "./localVault.js";

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.m4a,.mp4,.zip";

function inferType(file) {
  const type = file?.type || "";
  const name = file?.name?.toLowerCase() || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "slide_deck";
  if (name.endsWith(".csv") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "dataset";
  return "file";
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function securityLabel(resource) {
  if (resource.storage_mode === "device") return "This device only · not submitted";
  if (resource.security_status === "clean") return `Security cleared · private submission · ${formatBytes(resource.size_bytes)}`;
  if (resource.security_status === "blocked") return "Blocked by malware or archive inspection";
  return "Quarantined · professor access withheld until clean";
}

function SubmissionRow({ resource, onDownload, onDelete, review }) {
  const device = resource.storage_mode === "device";
  const available = device || resource.security_status === "clean";
  return (
    <article className={`studio-submission-row${device ? " is-device" : ""}`}>
      <span className="studio-submission-icon" aria-hidden="true">📎</span>
      <div>
        <strong>{resource.title || resource.originalName || resource.original_name}</strong>
        <p>{resource.description || resource.safeName || resource.safe_name || "Assignment attachment"}</p>
        <small className={`security-${resource.security_status || (device ? "device" : "scanning")}`}>
          {securityLabel(resource)}
        </small>
      </div>
      <div className="studio-submission-actions">
        {available && <button type="button" onClick={() => onDownload(resource)}>Download</button>}
        {!review && <button className="is-danger" type="button" onClick={() => onDelete(resource)}>Remove</button>}
      </div>
    </article>
  );
}

export default function AssignmentFilesPanel() {
  const course = useMemo(readCourseDraft, []);
  const courseId = currentCourseId();
  const [assignment, setAssignment] = useState(null);
  const [view, setView] = useState("learner");
  const [storageMode, setStorageMode] = useState("cloud");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cloudFiles, setCloudFiles] = useState([]);
  const [deviceFiles, setDeviceFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadController, setUploadController] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      if (!courseId) {
        setAssignment(null);
        setCloudFiles([]);
        setDeviceFiles([]);
        return;
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("assignments")
        .select("id,title,status")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData || null);

      if (!assignmentData) {
        setCloudFiles([]);
        setDeviceFiles([]);
        return;
      }

      const [{ data: resourceData, error: resourceError }, localFiles] = await Promise.all([
        supabase
          .from("learning_resources")
          .select("*")
          .eq("assignment_id", assignmentData.id)
          .eq("placement", "submission")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        listDeviceFiles(courseId),
      ]);
      if (resourceError) throw resourceError;
      setCloudFiles(resourceData || []);
      setDeviceFiles(
        localFiles.filter((record) => record.metadata?.assignmentId === assignmentData.id)
      );
    } catch (loadError) {
      setError(loadError.message || "Assignment attachments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [courseId]);

  async function attach(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    setUploadProgress(null);
    setUploadStatus("");
    try {
      if (!assignment?.id) throw new Error("Save the assignment before attaching submission files.");
      validateFile(file);
      const displayTitle = title.trim() || file.name;
      const safeName = buildDigitalLiteracyName({
        file,
        courseCode: course.code || "course",
        category: "submission",
        title: displayTitle,
        version: 1,
      });
      const checksumSha256 = await checksumFile(file);

      if (storageMode === "device") {
        await saveDeviceFile(file, {
          safeName,
          checksumSha256,
          title: displayTitle,
          description: description.trim(),
          placement: "submission",
          courseId,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
        });
        setNotice("Saved to this device only. It is not submitted and will not appear to the professor.");
      } else {
        const uploadedTarget = await uploadCloudFile(file, {
          scope: "submission",
          courseId,
          assignmentId: assignment.id,
          safeName,
          checksumSha256,
          title: displayTitle,
          category: "submission",
          courseCode: course.code || "course",
          onProgress: setUploadProgress,
          onStatus: setUploadStatus,
          onController: setUploadController,
        });

        await saveResourceRecord({
          course_id: courseId,
          assignment_id: assignment.id,
          secure_file_id: uploadedTarget.secureFileId,
          resource_type: inferType(file),
          title: displayTitle,
          description: description.trim(),
          placement: "submission",
          storage_mode: "cloud",
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          original_name: file.name,
          safe_name: uploadedTarget.safeName,
          checksum_sha256: uploadedTarget.checksumSha256,
          security_status: "quarantined",
          visibility: "private",
          metadata: {
            format: "EdSubmissionAttachment/1.0",
            assignmentTitle: assignment.title,
            namingConvention: "digital-literacy-v1",
          },
        });
        setNotice("Attachment uploaded to quarantine. Professor download remains disabled until scanning and archive inspection return clean.");
      }

      setFile(null);
      setTitle("");
      setDescription("");
      setUploadController(null);
      const input = document.getElementById("assignment-attachment-input");
      if (input) input.value = "";
      await refresh();
    } catch (attachError) {
      setError(attachError.message || "The assignment attachment could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function download(resource) {
    try {
      if (resource.storage_mode === "device") await downloadDeviceFile(resource.id);
      else await downloadResource(resource);
    } catch (downloadError) {
      setError(downloadError.message || "The attachment could not be downloaded.");
    }
  }

  async function remove(resource) {
    try {
      if (resource.storage_mode === "device") {
        await deleteDeviceFile(resource.id);
        setNotice("Device-only attachment removed.");
      } else {
        const result = await deleteResourceRecord(resource, "Learner removed an assignment attachment");
        if (result?.status === "blocked_legal_hold") {
          setNotice("Removal was recorded but paused by an administrator deletion lock.");
        } else if (result?.status === "deferred_retention") {
          setNotice(`Removal is deferred by retention policy until ${new Date(result.eligibleAt).toLocaleString()}.`);
        } else {
          setNotice("Attachment removal was completed or queued and added to the audit trail.");
        }
      }
      await refresh();
    } catch (removeError) {
      setError(removeError.message || "The attachment could not be removed.");
    }
  }

  const localRows = deviceFiles.map((record) => ({
    ...record,
    storage_mode: "device",
    title: record.title || record.originalName,
    description: record.description,
  }));
  const learnerRows = [...cloudFiles, ...localRows];
  const reviewRows = cloudFiles.filter((resource) => resource.security_status === "clean");

  return (
    <section className="studio-submission-panel" aria-labelledby="submission-attachment-title">
      <div className="studio-panel-heading">
        <div>
          <span className="studio-kicker">📎 SUBMISSION ATTACHMENTS</span>
          <h3 id="submission-attachment-title">Assignment files follow the same quarantine and retention rules as course materials.</h3>
          <p>
            {assignment
              ? `${assignment.title} · ${assignment.status}`
              : "Create and save an assignment above before adding learner files."}
          </p>
        </div>
        <div className="studio-preview-switch">
          <button type="button" className={view === "learner" ? "is-active" : ""} onClick={() => setView("learner")}>Learner upload</button>
          <button type="button" className={view === "review" ? "is-active" : ""} onClick={() => setView("review")}>Professor review</button>
        </div>
      </div>

      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}

      {view === "learner" ? (
        <div className="studio-submission-layout">
          <form className="studio-form studio-submission-form" onSubmit={attach}>
            <label className="studio-file-drop" htmlFor="assignment-attachment-input">
              <span aria-hidden="true">📎</span>
              <strong>{file ? file.name : "Attach a paper, image, slide deck, spreadsheet, audio, or video"}</strong>
              <small>Cloud files use resumable upload and remain quarantined until clean. Device-only files are never submitted.</small>
              <input
                id="assignment-attachment-input"
                type="file"
                accept={ACCEPT}
                onChange={(event) => {
                  const next = event.target.files?.[0] || null;
                  setFile(next);
                  if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, ""));
                }}
              />
            </label>
            <div className="studio-field-grid">
              <label>Attachment title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Learner-facing file label" /></label>
              <label>Storage<select value={storageMode} onChange={(event) => setStorageMode(event.target.value)}><option value="cloud">Quarantined cloud submission</option><option value="device">This device only</option></select></label>
            </div>
            <label>Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what this file contains or how it supports the submission." /></label>

            {uploadProgress && (
              <div className="studio-upload-progress">
                <div><strong>{uploadStatus || "uploading"}</strong><span>{uploadProgress.percentage.toFixed(1)}%</span></div>
                <div><span style={{ width: `${uploadProgress.percentage}%` }} /></div>
                <small>{formatBytes(uploadProgress.bytesUploaded)} of {formatBytes(uploadProgress.bytesTotal)}</small>
                {busy && uploadController && <div><button type="button" onClick={() => uploadController.pause()}>Pause</button><button type="button" onClick={() => uploadController.resume()}>Resume</button></div>}
              </div>
            )}

            <button className="studio-primary-button" type="submit" disabled={busy || !file || !assignment}>{busy ? "Uploading securely…" : storageMode === "cloud" ? "Upload to submission quarantine" : "Save on this device"}</button>
          </form>

          <div className="studio-submission-list">
            <span className="studio-kicker">LEARNER VIEW</span>
            <h4>Your current attachments</h4>
            {loading ? <div className="studio-tool-empty">Loading attachments…</div> : learnerRows.length === 0 ? <div className="studio-tool-empty">No files attached yet.</div> : learnerRows.map((resource) => <SubmissionRow key={`${resource.storage_mode}-${resource.id}`} resource={resource} onDownload={download} onDelete={remove} />)}
          </div>
        </div>
      ) : (
        <div className="studio-professor-file-review">
          <div className="studio-review-file-note"><span aria-hidden="true">✓</span><div><strong>Only security-cleared cloud files appear here.</strong><p>Quarantined, blocked, and device-only work is deliberately excluded from professor download.</p></div></div>
          {loading ? <div className="studio-tool-empty">Loading professor-visible files…</div> : reviewRows.length === 0 ? <div className="studio-tool-empty">No security-cleared cloud attachments are available for this assignment.</div> : reviewRows.map((resource) => <SubmissionRow key={resource.id} resource={resource} onDownload={download} onDelete={remove} review />)}
        </div>
      )}
    </section>
  );
}
