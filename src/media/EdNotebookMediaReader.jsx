import { useEffect, useMemo, useRef, useState } from "react";
import { downloadResource } from "../studio/storageService.js";
import { mediaKind, youtubePrivacyEmbedUrl } from "./courseMediaModel.js";
import { accessibilityLabel, boundedPlaybackEvidence, mediaProgressLabel, shouldReportPlayback } from "./mediaEvidenceModel.js";
import YouTubeEvidencePlayer from "./YouTubeEvidencePlayer.jsx";
import "./ednotebook-media.css";
import "./media-governance.css";

function SourceDetails({ resource }) {
  if (!resource.source_label && !resource.license_label) return null;
  return (
    <dl className="ed-media-source">
      {resource.source_label && <div><dt>Source</dt><dd>{resource.source_label}</dd></div>}
      {resource.license_label && <div><dt>Use</dt><dd>{resource.license_label}</dd></div>}
    </dl>
  );
}

export default function EdNotebookMediaReader({ resource, compact = false, personal = false, onRemove, onEvidence }) {
  const kind = mediaKind(resource);
  const [active, setActive] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [secureUrl, setSecureUrl] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(resource.viewing_progress || null);
  const [transcriptNotice, setTranscriptNotice] = useState("");
  const nativeMediaRef = useRef(null);
  const lastReportRef = useRef(null);
  const embedUrl = useMemo(
    () => kind === "youtube" ? youtubePrivacyEmbedUrl(resource.embed_key || resource.external_url) : null,
    [kind, resource.embed_key, resource.external_url],
  );

  useEffect(() => {
    setActive(false);
    setCaptionsEnabled(false);
    setSecureUrl("");
    setError("");
    setProgress(resource.viewing_progress || null);
    setTranscriptNotice("");
  }, [resource.id]);

  async function recordEvidence(event) {
    if (!onEvidence) return null;
    try {
      const next = await onEvidence(resource, event);
      if (next) setProgress(next);
      return next;
    } catch {
      setError("Playback continues, but viewing progress could not sync yet.");
      return null;
    }
  }

  function recordNativePlayback(type, event) {
    const media = event.currentTarget;
    const evidence = boundedPlaybackEvidence({
      type,
      positionSeconds: media.currentTime,
      durationSeconds: media.duration,
    });
    if (type === "progress") {
      const current = { playing: !media.paused, positionSeconds: evidence.positionSeconds };
      if (!shouldReportPlayback(lastReportRef.current, current)) return;
    }
    lastReportRef.current = {
      positionSeconds: evidence.positionSeconds,
      reportedAt: Date.now(),
    };
    recordEvidence(evidence);
  }

  function enableNativeCaptions() {
    const track = nativeMediaRef.current?.textTracks?.[0];
    if (track) track.mode = "showing";
    setCaptionsEnabled(true);
    recordEvidence({ type: "captions_enabled" });
  }

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(resource.transcript_text);
      setTranscriptNotice("Transcript copied.");
    } catch {
      setTranscriptNotice("Select the transcript text and copy it with your browser.");
    }
  }

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
        <div className="ed-media-poster">
          <img src={`https://i.ytimg.com/vi/${resource.embed_key || ""}/hqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" />
          <span aria-hidden="true">▶</span>
          <div className="ed-media-play-actions">
            <button type="button" onClick={() => setActive(true)}>Play here in EdNotebook</button>
            {resource.caption_mode === "provider_captions" && <button type="button" onClick={() => { setCaptionsEnabled(true); setActive(true); }}>Play with captions</button>}
          </div>
        </div>
      )}
      {kind === "youtube" && active && embedUrl && (
        <YouTubeEvidencePlayer
          videoId={resource.embed_key}
          title={resource.title}
          language={resource.caption_language}
          captionsEnabled={captionsEnabled}
          initialProgress={resource.viewing_progress}
          onEvidence={recordEvidence}
        />
      )}

      {isSecureMedia && !active && (
        <button type="button" className="ed-media-open" onClick={loadSecureMedia}>Open securely in EdNotebook</button>
      )}
      {kind === "video" && secureUrl && <video ref={nativeMediaRef} controls preload="metadata" src={secureUrl} crossOrigin={resource.caption_url ? "anonymous" : undefined} onPlay={(event) => recordNativePlayback("started", event)} onTimeUpdate={(event) => recordNativePlayback("progress", event)} onPause={(event) => recordNativePlayback("paused", event)} onEnded={(event) => recordNativePlayback("completed", event)}>{resource.caption_mode === "webvtt" && resource.caption_url && <track kind="captions" src={resource.caption_url} srcLang={resource.caption_language} label={`${resource.caption_language} captions`} />}Your browser cannot play this video.</video>}
      {kind === "audio" && secureUrl && <audio ref={nativeMediaRef} controls preload="metadata" src={secureUrl} onPlay={(event) => recordNativePlayback("started", event)} onTimeUpdate={(event) => recordNativePlayback("progress", event)} onPause={(event) => recordNativePlayback("paused", event)} onEnded={(event) => recordNativePlayback("completed", event)}>Your browser cannot play this audio.</audio>}
      {kind === "video" && secureUrl && resource.caption_mode === "webvtt" && <button type="button" className="ed-media-open" onClick={enableNativeCaptions}>{captionsEnabled ? "Captions on" : "Turn captions on"}</button>}
      {kind === "image" && secureUrl && <img className="ed-media-image" src={secureUrl} alt={resource.is_decorative ? "" : resource.alt_text || resource.title} />}

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
      {!personal && <div className="ed-media-accessibility"><strong>{accessibilityLabel(resource)}</strong>{resource.accessibility_notes && <span>{resource.accessibility_notes}</span>}</div>}
      {resource.transcript_text && (
        <details className="ed-media-transcript" onToggle={(event) => {
          if (event.currentTarget.open) recordEvidence({ type: "transcript_opened" });
        }}>
          <summary>Read searchable transcript</summary>
          <div>
            <button type="button" onClick={copyTranscript}>Copy transcript</button>
            <p>{resource.transcript_text}</p>
            {transcriptNotice && <small role="status">{transcriptNotice}</small>}
          </div>
        </details>
      )}
      {!personal && onEvidence && !(kind === "youtube" && active) && <small className="ed-media-progress">{mediaProgressLabel(progress)}</small>}
      <SourceDetails resource={resource} />
      {error && <p className="ed-media-error" role="alert">{error}</p>}
    </article>
  );
}
