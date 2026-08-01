import { useEffect, useMemo, useState } from "react";
import { downloadResource } from "../studio/storageService.js";
import { mediaKind, youtubePrivacyEmbedUrl } from "./courseMediaModel.js";
import "./ednotebook-media.css";

function SourceDetails({ resource }) {
  if (!resource.source_label && !resource.license_label) return null;
  return (
    <dl className="ed-media-source">
      {resource.source_label && <div><dt>Source</dt><dd>{resource.source_label}</dd></div>}
      {resource.license_label && <div><dt>Use</dt><dd>{resource.license_label}</dd></div>}
    </dl>
  );
}

export default function EdNotebookMediaReader({ resource, compact = false, personal = false, onRemove }) {
  const kind = mediaKind(resource);
  const [active, setActive] = useState(false);
  const [secureUrl, setSecureUrl] = useState("");
  const [error, setError] = useState("");
  const embedUrl = useMemo(
    () => kind === "youtube" ? youtubePrivacyEmbedUrl(resource.embed_key || resource.external_url) : null,
    [kind, resource.embed_key, resource.external_url],
  );

  useEffect(() => {
    setActive(false);
    setSecureUrl("");
    setError("");
  }, [resource.id]);

  async function loadSecureMedia() {
    setError("");
    try {
      setSecureUrl(await downloadResource(resource, { inline: true }));
      setActive(true);
    } catch (loadError) {
      setError(loadError.message || "This media could not be opened securely.");
    }
  }

  const isSecureMedia = ["video", "audio", "image"].includes(kind) && resource.secure_file_id;
  return (
    <article className={`ed-media-reader is-${kind}${compact ? " is-compact" : ""}`}>
      <header>
        <div>
          <span>{personal ? "MY PRIVATE RESOURCE" : kind === "youtube" ? "IN-PLATFORM VIDEO" : "COURSE RESOURCE"}</span>
          <h3>{resource.title}</h3>
        </div>
        {personal && onRemove && <button type="button" className="ed-media-remove" onClick={() => onRemove(resource)}>Remove</button>}
      </header>
      {resource.description && <p>{resource.description}</p>}

      {kind === "youtube" && !active && (
        <button type="button" className="ed-media-poster" onClick={() => setActive(true)}>
          <img src={`https://i.ytimg.com/vi/${resource.embed_key || ""}/hqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" />
          <span aria-hidden="true">▶</span>
          <strong>Play here in EdNotebook</strong>
        </button>
      )}
      {kind === "youtube" && active && embedUrl && (
        <div className="ed-media-frame">
          <iframe
            src={embedUrl}
            title={resource.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}

      {isSecureMedia && !active && (
        <button type="button" className="ed-media-open" onClick={loadSecureMedia}>Open securely in EdNotebook</button>
      )}
      {kind === "video" && secureUrl && <video controls preload="metadata" src={secureUrl}>Your browser cannot play this video.</video>}
      {kind === "audio" && secureUrl && <audio controls preload="metadata" src={secureUrl}>Your browser cannot play this audio.</audio>}
      {kind === "image" && secureUrl && <img className="ed-media-image" src={secureUrl} alt={resource.alt_text || resource.title} />}

      {kind === "quote" && <blockquote>{resource.description}</blockquote>}
      {kind === "web" && (
        <div className="ed-media-web-card">
          <span aria-hidden="true">↗</span>
          <div><strong>Inspected web resource</strong><small>{new URL(resource.external_url).hostname.replace(/^www\./, "")}</small></div>
          <a href={resource.external_url} target="_blank" rel="noopener noreferrer">Open original</a>
        </div>
      )}
      {kind === "file" && resource.secure_file_id && (
        <button type="button" className="ed-media-open" onClick={() => downloadResource(resource)}>Download professor file</button>
      )}
      <SourceDetails resource={resource} />
      {error && <p className="ed-media-error" role="alert">{error}</p>}
    </article>
  );
}
