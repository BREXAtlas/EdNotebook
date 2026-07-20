import { useEffect, useMemo, useState } from "react";
import {
  buildDigitalLiteracyName,
  checksumFile,
  currentCourseId,
  deleteResourceRecord,
  downloadResource as downloadStoredResource,
  getCurrentStorageUsage,
  getLinkPreview,
  listCloudResources,
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
import { detectResourceKind, linkPreview } from "./urlPreview.js";

const PLACEMENTS = [
  ["course-overview", "Course overview"],
  ["lesson", "Inside a lesson"],
  ["assignment", "Assignment panel"],
  ["reading-list", "Reading list"],
  ["course-library", "Course library"],
  ["private-vault", "Private vault"],
];

const ACCEPT = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".epub", ".txt", ".md", ".csv",
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".wav", ".m4a", ".mp4", ".zip",
].join(",");

function inferResourceType(file) {
  const type = file?.type || "";
  const name = file?.name?.toLowerCase() || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type === "application/epub+zip" || name.endsWith(".epub")) return "book";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "slide_deck";
  if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) return "dataset";
  return "file";
}

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) return "";
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function resourceStatus(resource) {
  if (resource.storage_mode === "device") return { label: "Device only", tone: "device" };
  if (resource.storage_mode !== "cloud") return { label: resource.resource_type === "youtube" ? "Embedded YouTube" : "External / metadata", tone: "external" };
  const value = resource.security_status || "quarantined";
  if (value === "clean") return { label: `Security cleared · ${formatBytes(resource.size_bytes)}`, tone: "clean" };
  if (value === "blocked") return { label: "Blocked by security review", tone: "blocked" };
  if (value === "deleted") return { label: "Deleted", tone: "blocked" };
  return { label: value === "quarantined" ? "Quarantined · scan pending" : value, tone: "scanning" };
}

function learnerAvailable(resource) {
  if (resource.storage_mode === "device") return false;
  if (resource.storage_mode === "cloud") return resource.security_status === "clean";
  return true;
}

function ResourceIcon({ resource }) {
  const map = {
    file: "📄", image: "🖼", link: "↗", youtube: "▶", quote: "❝", book: "📖",
    slide_deck: "▤", audio: "♫", video: "▶", dataset: "▦", other: "📎",
  };
  return <span className="studio-resource-icon" aria-hidden="true">{map[resource.resource_type] || "📎"}</span>;
}

function mapServerPreview(preview, fallback) {
  if (!preview) return fallback;
  const url = preview.canonical_url || preview.normalized_url;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { host = fallback?.host || "web"; }
  return {
    href: preview.normalized_url,
    host,
    provider: preview.site_name || host,
    icon: "↗",
    tone: "web",
    title: preview.title || fallback?.title || host,
    description: preview.description || fallback?.description || "External learning resource.",
    imageUrl: preview.image_url || null,
    faviconUrl: preview.favicon_url || null,
    isYouTube: false,
    serverId: preview.id,
  };
}

function ExternalPreview({ preview, description, loading }) {
  if (loading) return <div className="studio-empty-preview">Inspecting the public page safely on the server…</div>;
  if (!preview) return <div className="studio-empty-preview">Paste a URL to see where the resource will appear.</div>;
  return (
    <article className={`studio-link-preview is-${preview.tone}`}>
      {preview.isYouTube && (
        <div className="studio-youtube-frame">
          <iframe
            src={preview.embedUrl}
            title={preview.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
      {!preview.isYouTube && preview.imageUrl && (
        <img className="studio-og-image" src={preview.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <div className="studio-link-body">
        {preview.faviconUrl ? (
          <img className="studio-provider-favicon" src={preview.faviconUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="studio-provider-icon" aria-hidden="true">{preview.icon}</span>
        )}
        <div>
          <small>{preview.provider} · {preview.host}</small>
          <strong>{preview.title}</strong>
          <p>{description || preview.description}</p>
        </div>
      </div>
    </article>
  );
}

function PlacementPreview({ resources, selectedPlacement }) {
  const visible = resources.filter((resource) => resource.placement === selectedPlacement && learnerAvailable(resource));
  const withheld = resources.filter((resource) => resource.placement === selectedPlacement && !learnerAvailable(resource));
  const label = PLACEMENTS.find(([value]) => value === selectedPlacement)?.[1] || "Page panel";
  return (
    <div className="studio-page-preview">
      <div className="studio-page-preview-heading">
        <div>
          <small>LIVE PAGE PLACEMENT</small>
          <h3>{label}</h3>
        </div>
        <span>{visible.length} available</span>
      </div>
      <div className="studio-page-copy">
        <div className="studio-copy-line is-wide" />
        <div className="studio-copy-line" />
        <div className="studio-copy-line is-short" />
      </div>
      <aside className="studio-attached-panel" aria-label={`${label} attachments`}>
        <div className="studio-panel-title"><span aria-hidden="true">📎</span> Materials & links</div>
        {visible.length === 0 ? (
          <p className="studio-panel-empty">Nothing learner-visible is attached here yet. Quarantined and device-only files remain withheld.</p>
        ) : visible.map((resource) => (
          <div className="studio-attached-row" key={`${resource.storage_mode}-${resource.id}`}>
            <ResourceIcon resource={resource} />
            <div><strong>{resource.title}</strong><small>{resource.description || resource.safe_name || resource.external_url}</small></div>
          </div>
        ))}
        {withheld.length > 0 && <p className="studio-panel-withheld">{withheld.length} item{withheld.length === 1 ? " is" : "s are"} withheld from learners until security or storage requirements are satisfied.</p>}
      </aside>
    </div>
  );
}

export default function MaterialsWorkspace() {
  const course = useMemo(readCourseDraft, []);
  const courseId = currentCourseId();
  const [addMode, setAddMode] = useState("file");
  const [cloudResources, setCloudResources] = useState([]);
  const [deviceResources, setDeviceResources] = useState([]);
  const [storageUsage, setStorageUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadController, setUploadController] = useState(null);

  const [file, setFile] = useState(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [filePlacement, setFilePlacement] = useState("course-library");
  const [storageMode, setStorageMode] = useState("cloud");
  const [fileVersion, setFileVersion] = useState(1);
  const [altText, setAltText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [licenseLabel, setLicenseLabel] = useState("");

  const [linkValue, setLinkValue] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkPlacement, setLinkPlacement] = useState("lesson");
  const [serverPreview, setServerPreview] = useState(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [linkPreviewError, setLinkPreviewError] = useState("");

  const [quoteText, setQuoteText] = useState("");
  const [quoteAttribution, setQuoteAttribution] = useState("");
  const [quoteSource, setQuoteSource] = useState("");
  const [quotePlacement, setQuotePlacement] = useState("lesson");

  const activePlacement = addMode === "file" ? filePlacement : addMode === "link" ? linkPlacement : quotePlacement;
  const localPreview = useMemo(() => linkPreview(linkValue, linkTitle), [linkValue, linkTitle]);
  const preview = useMemo(
    () => localPreview?.isYouTube ? localPreview : mapServerPreview(serverPreview, localPreview),
    [serverPreview, localPreview]
  );
  const safeName = useMemo(() => {
    if (!file) return "";
    return buildDigitalLiteracyName({
      file,
      courseCode: course.code,
      category: inferResourceType(file),
      title: fileTitle || file.name,
      version: fileVersion,
    });
  }, [file, fileTitle, fileVersion, course.code]);

  const combinedResources = useMemo(
    () => [
      ...cloudResources,
      ...deviceResources.map((resource) => ({
        ...resource,
        resource_type: inferResourceType({ name: resource.originalName, type: resource.mimeType }),
        storage_mode: "device",
        description: resource.description,
        placement: resource.placement,
      })),
    ],
    [cloudResources, deviceResources]
  );

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [cloud, device, usage] = await Promise.all([
        listCloudResources(courseId),
        listDeviceFiles(courseId),
        getCurrentStorageUsage().catch(() => null),
      ]);
      setCloudResources(cloud);
      setDeviceResources(device);
      setStorageUsage(usage);
    } catch (loadError) {
      setError(loadError.message || "Unable to load the resource library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [courseId]);

  useEffect(() => {
    setServerPreview(null);
    setLinkPreviewError("");
    if (!linkValue.trim() || localPreview?.isYouTube || !localPreview?.href) return undefined;
    const timeout = window.setTimeout(async () => {
      setLinkPreviewLoading(true);
      try {
        const result = await getLinkPreview(localPreview.href);
        setServerPreview(result);
      } catch (previewError) {
        setLinkPreviewError(previewError.message || "The server could not preview this page.");
      } finally {
        setLinkPreviewLoading(false);
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [linkValue, localPreview?.href, localPreview?.isYouTube]);

  function clearMessages() {
    setNotice("");
    setError("");
  }

  async function addFile(event) {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    setUploadProgress(null);
    setUploadStatus("");
    try {
      validateFile(file);
      const checksumSha256 = await checksumFile(file);
      const title = fileTitle.trim() || file.name;
      const description = fileDescription.trim();
      const metadata = {
        safeName,
        checksumSha256,
        title,
        description,
        placement: filePlacement,
        courseId,
        courseCode: course.code,
        category: inferResourceType(file),
        version: fileVersion,
        altText: altText.trim(),
        sourceLabel: sourceLabel.trim(),
        licenseLabel: licenseLabel.trim(),
      };

      if (storageMode === "device") {
        await saveDeviceFile(file, metadata);
        setNotice("Saved to this device only. It will not appear on another browser or device.");
      } else {
        if (filePlacement !== "private-vault" && !courseId) {
          throw new Error("Save the course shell again before adding shared course materials.");
        }
        const target = await uploadCloudFile(file, {
          ...metadata,
          scope: filePlacement === "private-vault" ? "private" : "course",
          onProgress: setUploadProgress,
          onStatus: (status) => setUploadStatus(status),
          onController: setUploadController,
        });
        await saveResourceRecord({
          course_id: filePlacement === "private-vault" ? null : courseId,
          secure_file_id: target.secureFileId,
          resource_type: inferResourceType(file),
          title,
          description,
          placement: filePlacement,
          storage_mode: "cloud",
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          original_name: file.name,
          safe_name: target.safeName,
          checksum_sha256: target.checksumSha256,
          security_status: "quarantined",
          alt_text: altText.trim() || null,
          source_label: sourceLabel.trim() || null,
          license_label: licenseLabel.trim() || null,
          visibility: filePlacement === "private-vault" ? "private" : "course",
          metadata: { version: fileVersion, namingConvention: "digital-literacy-v1" },
        });
        setNotice("Upload finished and entered quarantine. It will appear to learners only after malware and archive checks return clean.");
      }

      setFile(null);
      setFileTitle("");
      setFileDescription("");
      setAltText("");
      setSourceLabel("");
      setLicenseLabel("");
      setUploadController(null);
      const input = document.getElementById("studio-file-input");
      if (input) input.value = "";
      await refresh();
    } catch (uploadError) {
      setError(uploadError.message || "The material could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function addLink(event) {
    event.preventDefault();
    clearMessages();
    if (!preview) {
      setError("Enter a complete public web address.");
      return;
    }
    setBusy(true);
    try {
      await saveResourceRecord({
        course_id: courseId,
        link_preview_id: serverPreview?.id || null,
        resource_type: detectResourceKind(preview.href),
        title: linkTitle.trim() || preview.title,
        description: linkDescription.trim() || preview.description,
        placement: linkPlacement,
        storage_mode: "external",
        external_url: preview.href,
        visibility: courseId ? "course" : "private",
        metadata: {
          provider: preview.provider,
          host: preview.host,
          youtubeId: preview.youtubeId,
          embedUrl: preview.embedUrl,
          thumbnailUrl: preview.thumbnailUrl || preview.imageUrl,
          serverPreviewId: serverPreview?.id || null,
        },
      });
      setLinkValue("");
      setLinkTitle("");
      setLinkDescription("");
      setServerPreview(null);
      setNotice(`${preview.provider} resource added to ${PLACEMENTS.find(([value]) => value === linkPlacement)?.[1]}.`);
      await refresh();
    } catch (linkError) {
      setError(linkError.message || "The link could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function addQuote(event) {
    event.preventDefault();
    clearMessages();
    if (!quoteText.trim()) {
      setError("Add the quotation or excerpt first.");
      return;
    }
    setBusy(true);
    try {
      await saveResourceRecord({
        course_id: courseId,
        resource_type: "quote",
        title: quoteAttribution.trim() || "Course quotation",
        description: quoteText.trim().slice(0, 320),
        placement: quotePlacement,
        storage_mode: "metadata",
        external_url: quoteSource.trim() || null,
        visibility: courseId ? "course" : "private",
        source_label: quoteAttribution.trim() || null,
        metadata: { quote: quoteText.trim(), attribution: quoteAttribution.trim(), sourceUrl: quoteSource.trim() },
      });
      setQuoteText("");
      setQuoteAttribution("");
      setQuoteSource("");
      setNotice("Quotation added with a visible source field so attribution is reinforced by design.");
      await refresh();
    } catch (quoteError) {
      setError(quoteError.message || "The quotation could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function removeResource(resource) {
    clearMessages();
    try {
      if (resource.storage_mode === "device") {
        await deleteDeviceFile(resource.id);
        setNotice("Device-only resource removed.");
      } else {
        const result = await deleteResourceRecord(resource);
        if (result?.deleted || result?.status === "completed" || result?.status === "metadata_removed") {
          setNotice("Resource removed and audited.");
        } else if (result?.status === "blocked_legal_hold") {
          setNotice("Deletion was recorded but paused by an administrator deletion lock.");
        } else if (result?.status === "deferred_retention") {
          setNotice(`Deletion was recorded and deferred until ${new Date(result.eligibleAt).toLocaleString()}.`);
        } else {
          setNotice("Deletion request recorded.");
        }
      }
      await refresh();
    } catch (removeError) {
      setError(removeError.message || "The resource could not be removed.");
    }
  }

  async function downloadResource(resource) {
    clearMessages();
    try {
      if (resource.storage_mode === "device") await downloadDeviceFile(resource.id);
      else await downloadStoredResource(resource);
    } catch (downloadError) {
      setError(downloadError.message || "The resource could not be opened.");
    }
  }

  const quotaPercent = storageUsage?.quota_bytes
    ? Math.min(100, ((Number(storageUsage.used_bytes) + Number(storageUsage.reserved_bytes)) / Number(storageUsage.quota_bytes)) * 100)
    : 0;

  return (
    <section className="studio-workspace" aria-labelledby="materials-title">
      <div className="studio-section-heading">
        <div>
          <span className="studio-kicker">MATERIALS STUDIO</span>
          <h2 id="materials-title">Attach it to a real place—not a floating upload tray.</h2>
          <p>Files enter quarantine first. Links are inspected server-side. Only clean, released materials appear to learners.</p>
        </div>
        <div className="studio-storage-badge"><span>●</span> Quarantine + private delivery + device-only vault</div>
      </div>

      {storageUsage && (
        <div className="studio-quota-panel">
          <div><strong>{storageUsage.plan_key} storage</strong><span>{formatBytes(Number(storageUsage.used_bytes) + Number(storageUsage.reserved_bytes))} of {formatBytes(storageUsage.quota_bytes)}</span></div>
          <div className="studio-quota-track"><span style={{ width: `${quotaPercent}%` }} /></div>
          <small>Maximum file: {formatBytes(storageUsage.max_file_bytes)} · reservations count until an upload completes or expires.</small>
        </div>
      )}

      {!courseId && (
        <div className="studio-warning">This browser has an older local course shell. Open <strong>Course setup</strong> and save it once to create its secure database record.</div>
      )}
      {error && <div className="studio-alert is-error" role="alert">{error}</div>}
      {notice && <div className="studio-alert is-success" role="status">{notice}</div>}

      <div className="studio-materials-layout">
        <div className="studio-builder-panel">
          <div className="studio-mode-tabs" role="tablist" aria-label="Material type">
            <button className={addMode === "file" ? "is-active" : ""} onClick={() => setAddMode("file")} type="button" role="tab"><span aria-hidden="true">📎</span> File or image</button>
            <button className={addMode === "link" ? "is-active" : ""} onClick={() => setAddMode("link")} type="button" role="tab"><span aria-hidden="true">↗</span> Link or YouTube</button>
            <button className={addMode === "quote" ? "is-active" : ""} onClick={() => setAddMode("quote")} type="button" role="tab"><span aria-hidden="true">❝</span> Quote</button>
          </div>

          {addMode === "file" && (
            <form className="studio-form" onSubmit={addFile}>
              <label className="studio-file-drop" htmlFor="studio-file-input">
                <span aria-hidden="true">📎</span>
                <strong>{file ? file.name : "Choose a document, image, book, slide deck, or media file"}</strong>
                <small>{file ? `${formatBytes(file.size)} · ${file.type || "unknown type"}` : "PDF, Word, PowerPoint, EPUB, image, audio, video, spreadsheet, text, or ZIP · plan quota enforced server-side"}</small>
                <input id="studio-file-input" type="file" accept={ACCEPT} onChange={(event) => {
                  const next = event.target.files?.[0] || null;
                  setFile(next);
                  if (next && !fileTitle) setFileTitle(next.name.replace(/\.[^.]+$/, ""));
                }} />
              </label>

              <div className="studio-field-grid">
                <label>Display title<input value={fileTitle} onChange={(event) => setFileTitle(event.target.value)} placeholder="What learners will see" /></label>
                <label>Panel placement<select value={filePlacement} onChange={(event) => setFilePlacement(event.target.value)}>{PLACEMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              <label>Description<textarea value={fileDescription} onChange={(event) => setFileDescription(event.target.value)} placeholder="Why is this attached, and what should the learner do with it?" rows={3} /></label>

              <div className="studio-storage-choice" role="group" aria-label="File storage choice">
                <button type="button" className={storageMode === "cloud" ? "is-active" : ""} onClick={() => setStorageMode("cloud")}>
                  <strong>Secure cloud</strong><small>Resumable upload → quarantine → scan → private release</small>
                </button>
                <button type="button" className={storageMode === "device" ? "is-active" : ""} onClick={() => setStorageMode("device")}>
                  <strong>This device only</strong><small>Never uploads; browser-local IndexedDB</small>
                </button>
              </div>

              <details className="studio-metadata-details">
                <summary>Digital literacy metadata and naming</summary>
                <div className="studio-field-grid">
                  <label>Version<input type="number" min="1" max="99" value={fileVersion} onChange={(event) => setFileVersion(event.target.value)} /></label>
                  <label>Image alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe meaningful visual content" /></label>
                  <label>Source / creator<input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Author, organization, photographer" /></label>
                  <label>License / permission<input value={licenseLabel} onChange={(event) => setLicenseLabel(event.target.value)} placeholder="Owned, CC BY, public domain…" /></label>
                </div>
                <div className="studio-name-preview"><small>SAFE FILE NAME</small><code>{safeName || "Select a file to generate the name."}</code><p>Date · course code · material type · subject · version. A SHA-256 checksum is verified after upload.</p></div>
              </details>

              {uploadProgress && (
                <div className="studio-upload-progress">
                  <div><strong>{uploadStatus || "uploading"}</strong><span>{uploadProgress.percentage.toFixed(1)}%</span></div>
                  <div><span style={{ width: `${uploadProgress.percentage}%` }} /></div>
                  <small>{formatBytes(uploadProgress.bytesUploaded)} of {formatBytes(uploadProgress.bytesTotal)}</small>
                  {busy && uploadController && <div><button type="button" onClick={() => uploadController.pause()}>Pause</button><button type="button" onClick={() => uploadController.resume()}>Resume</button></div>}
                </div>
              )}

              <button className="studio-primary-button" type="submit" disabled={busy || !file}>{busy ? (storageMode === "cloud" ? "Uploading securely…" : "Saving…") : storageMode === "device" ? "Save to this device" : "Upload to quarantine"}</button>
            </form>
          )}

          {addMode === "link" && (
            <form className="studio-form" onSubmit={addLink}>
              <label>URL<input value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="Paste a YouTube, Canva, Word, Cengage, article, or other public link" /></label>
              <div className="studio-field-grid">
                <label>Link title<input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder="Learner-facing label" /></label>
                <label>Panel placement<select value={linkPlacement} onChange={(event) => setLinkPlacement(event.target.value)}>{PLACEMENTS.filter(([value]) => value !== "private-vault").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              <label>Description<textarea value={linkDescription} onChange={(event) => setLinkDescription(event.target.value)} placeholder="Explain why this link is here instead of making students guess." rows={3} /></label>
              {linkPreviewError && <div className="studio-alert is-error">{linkPreviewError}</div>}
              <ExternalPreview preview={preview} description={linkDescription} loading={linkPreviewLoading} />
              <button className="studio-primary-button" type="submit" disabled={busy || !preview}>{busy ? "Saving…" : preview?.isYouTube ? "Embed video in this panel" : "Add inspected link to this panel"}</button>
            </form>
          )}

          {addMode === "quote" && (
            <form className="studio-form" onSubmit={addQuote}>
              <label>Quotation or excerpt<textarea value={quoteText} onChange={(event) => setQuoteText(event.target.value)} placeholder="Paste the passage. Keep quotations short enough for your educational use and record the source." rows={6} /></label>
              <div className="studio-field-grid">
                <label>Attribution<input value={quoteAttribution} onChange={(event) => setQuoteAttribution(event.target.value)} placeholder="Author, work, page or timestamp" /></label>
                <label>Panel placement<select value={quotePlacement} onChange={(event) => setQuotePlacement(event.target.value)}>{PLACEMENTS.filter(([value]) => value !== "private-vault").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              <label>Source URL (optional)<input value={quoteSource} onChange={(event) => setQuoteSource(event.target.value)} placeholder="https://…" /></label>
              <blockquote className="studio-quote-preview"><span aria-hidden="true">“</span>{quoteText || "The quotation will be shown here with its attribution."}<footer>{quoteAttribution || "Source required before publication"}</footer></blockquote>
              <button className="studio-primary-button" type="submit" disabled={busy || !quoteText.trim()}>{busy ? "Saving…" : "Add quotation to this panel"}</button>
            </form>
          )}
        </div>

        <PlacementPreview resources={combinedResources} selectedPlacement={activePlacement} />
      </div>

      <section className="studio-library" aria-labelledby="resource-library-title">
        <div className="studio-library-heading"><div><span className="studio-kicker">COURSE RESOURCE LIBRARY</span><h3 id="resource-library-title">Everything has an owner, location, security state, and storage mode.</h3></div><button type="button" onClick={refresh}>Refresh resource library</button></div>
        {loading ? <div className="studio-library-empty">Loading secure materials…</div> : combinedResources.length === 0 ? <div className="studio-library-empty">No materials yet. Use the panel above to attach the first resource.</div> : (
          <div className="studio-resource-table">
            {combinedResources.map((resource) => {
              const status = resourceStatus(resource);
              const canOpen = resource.storage_mode === "device" || resource.storage_mode === "external" || (resource.storage_mode === "cloud" && resource.security_status === "clean");
              return (
                <article key={`${resource.storage_mode}-${resource.id}`}>
                  <ResourceIcon resource={resource} />
                  <div className="studio-resource-main"><strong>{resource.title}</strong><p>{resource.description || resource.safe_name || resource.external_url || "No description"}</p><small>{PLACEMENTS.find(([value]) => value === resource.placement)?.[1] || resource.placement} · <em className={`security-${status.tone}`}>{status.label}</em></small></div>
                  <div className="studio-resource-actions">
                    {canOpen && <button type="button" onClick={() => downloadResource(resource)}>{resource.storage_mode === "external" ? "Open" : "Download"}</button>}
                    <button className="is-danger" type="button" onClick={() => removeResource(resource)}>Remove resource</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
