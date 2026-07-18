import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import {
  buildDigitalLiteracyName,
  checksumFile,
  currentCourseId,
  deleteResourceRecord,
  downloadCloudFile,
  readCourseDraft,
  removeCloudFile,
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
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function SubmissionRow({ resource, onDownload, onDelete, review }) {
  const device = resource.storage_mode === "device";
  return (
    <article className={`studio-submission-row${device ? " is-device" : ""}`}>
      <span className="studio-submission-icon" aria-hidden="true">📎</span>
      <div>
        <strong>{resource.title || resource.originalName || resource.original_name}</strong>
        <p>{resource.description || resource.safeName || resource.safe_name || "Assignment attachment"}</p>
        <small>
          {device ? "This device only · not submitted" : `Private submission · ${formatBytes(resource.sizeBytes || resource.size_bytes)}`}
        </small>
      </div>
      <div className="studio-submission-actions">
        <button type="button" onClick={() => onDownload(resource)}>Download</button>
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
    let uploadedTarget = null;
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
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        uploadedTarget = await uploadCloudFile(file, {
          userId: userData.user.id,
          scope: "submission",
          courseId,
          assignmentId: assignment.id,
          safeName,
          checksumSha256,
          title: displayTitle,
          category: "submission",
          courseCode: course.code || "course",
        });

        try {
          await saveResourceRecord({
            course_id: courseId,
            assignment_id: assignment.id,
            resource_type: inferType(file),
            title: displayTitle,
            description: description.trim(),
            placement: "submission",
            storage_mode: "cloud",
            bucket_id: uploadedTarget.bucket,
            storage_path: uploadedTarget.path,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            original_name: file.name,
            safe_name: uploadedTarget.safeName,
            checksum_sha256: uploadedTarget.checksumSha256,
            visibility: "private",
            metadata: {
              format: "EdSubmissionAttachment/1.0",
              assignmentTitle: assignment.title,
              namingConvention: "digital-literacy-v1",
            },
          });
        } catch (recordError) {
          await removeCloudFile(uploadedTarget.bucket, uploadedTarget.path).catch(() => {});
          throw recordError;
        }
        setNotice("Attachment uploaded privately. It now appears in professor review for this assignment.");
      }

      setFile(null);
      setTitle("");
      setDescription("");
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
      else await downloadCloudFile(
        resource.bucket_id,
        resource.storage_path,
        resource.safe_name || resource.original_name
      );
    } catch (downloadError) {
      setError(downloadError.message || "The attachment could not be downloaded.");
    }
  }

  async function remove(resource) {
    try {
      if (resource.storage_mode === "device") await deleteDeviceFile(resource.id);
      else await deleteResourceRecord(resource);
      setNotice("Attachment removed.");
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
  const reviewRows = cloudFiles;

  return (
    <section className="studio-submission-panel" aria-labelledby="submission-attachment-title">
      <div className="studio-panel-heading">
        <div>
          <span className="studio-kicker">📎 SUBMISSION ATTACHMENTS</span>
          <h3 id="submission-attachment-title">The assignment uses the same secure file path as the writing sandbox.</h3>
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
              <small>Cloud files are private to the learner and assignment reviewers. Device-only files are never submitted.</small>
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
              <label>Storage<select value={storageMode} onChange={(event) => setStorageMode(event.target.value)}><option value="cloud">Private cloud submission</option><option value="device">This device only</option></select></label>
            </div>
            <label>Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what this file contains or how it supports the submission." /></label>
            <button className="studio-primary-button" type="submit" disabled={busy || !file || !assignment}>{busy ? "Saving attachment…" : storageMode === "cloud" ? "Upload and attach to assignment" : "Save on this device"}</button>
          </form>

          <div className="studio-submission-list">
            <span className="studio-kicker">LEARNER VIEW</span>
            <h4>Your current attachments</h4>
            {loading ? <div className="studio-tool-empty">Loading attachments…</div> : learnerRows.length === 0 ? <div className="studio-tool-empty">No files attached yet.</div> : learnerRows.map((resource) => <SubmissionRow key={`${resource.storage_mode}-${resource.id}`} resource={resource} onDownload={download} onDelete={remove} />)}
          </div>
        </div>
      ) : (
        <div className="studio-professor-file-review">
          <div className="studio-review-file-note"><span aria-hidden="true">✓</span><div><strong>Only cloud-submitted files appear here.</strong><p>Device-only work remains private and is deliberately excluded from professor review.</p></div></div>
          {loading ? <div className="studio-tool-empty">Loading professor-visible files…</div> : reviewRows.length === 0 ? <div className="studio-tool-empty">No cloud attachments have been submitted for this assignment.</div> : reviewRows.map((resource) => <SubmissionRow key={resource.id} resource={resource} onDownload={download} onDelete={remove} review />)}
        </div>
      )}
    </section>
  );
}
