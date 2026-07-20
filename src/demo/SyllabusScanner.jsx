import { useEffect, useRef, useState } from "react";
import {
  MAX_SCAN_PAGES,
  MAX_SCAN_SESSION_BYTES,
  analyzeCanvas,
  buildScanPdf,
  captureVideoFrame,
  decodeImageFile,
  defaultScanCorners,
  loadScannerEngine,
  processScanPage,
  recognizeScanPages,
  releaseScanPage,
} from "./syllabusScannerPipeline.js";
import "./syllabus-scanner.css";

const INTRO_KEY = "ednotebook-syllabus-scanner-intro-v1";
const MAX_OCR_CHARACTERS = 250_000;
const MAX_RETAINED_PAGE_BYTES = MAX_SCAN_SESSION_BYTES;
const SAFE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const SAFE_PHOTO_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function nextPaint() {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function isAbort(error, signal) {
  return signal?.aborted || error?.name === "AbortError";
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error("The scan step was canceled.");
  error.name = "AbortError";
  throw error;
}

function isSafePhoto(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "");
  if (type && !SAFE_PHOTO_TYPES.has(type)) return false;
  return SAFE_PHOTO_TYPES.has(type) || /\.(jpe?g|png|webp)$/i.test(name);
}

function readIntroSeen() {
  try { return window.localStorage.getItem(INTRO_KEY) === "seen"; } catch { return false; }
}

function rememberIntro() {
  try { window.localStorage.setItem(INTRO_KEY, "seen"); } catch { /* A blocked preference store should never block scanning. */ }
}

function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function canvasPreview(canvas, quality = 0.72) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("The page preview could not be created."));
      else resolve({ blob, url: URL.createObjectURL(blob) });
    }, "image/jpeg", quality);
  });
}

function cornerList(value) {
  if (Array.isArray(value) && value.length === 4) return value;
  if (value?.topLeft && value?.topRight && value?.bottomRight && value?.bottomLeft) {
    return [value.topLeft, value.topRight, value.bottomRight, value.bottomLeft];
  }
  return [
    { x: 0.02, y: 0.02 },
    { x: 0.98, y: 0.02 },
    { x: 0.98, y: 0.98 },
    { x: 0.02, y: 0.98 },
  ];
}

function guidanceForAnalysis(analysis) {
  if (!analysis?.detected) return "Get the whole page in frame.";
  if (Number.isFinite(analysis.documentCoverage) && analysis.documentCoverage < 0.28) return "Move closer.";
  if (Number.isFinite(analysis.brightness) && analysis.brightness < 72) return "Find better light.";
  if (Number.isFinite(analysis.glareRatio) && analysis.glareRatio > 0.16) return "Tilt the page away from glare.";
  if (Number.isFinite(analysis.blurScore) && analysis.blurScore < 35) return "Hold steady.";
  return analysis.confidence >= 0.72 ? "Ready to capture." : "Get the whole page in frame.";
}

function scannerProgressText(update) {
  if (typeof update === "string") return update;
  if (!update || typeof update !== "object") return "Working on the syllabus…";
  const pageNumber = Number.isInteger(update.pageIndex) ? update.pageIndex + 1 : null;
  const pageLabel = pageNumber && update.pageCount ? ` page ${pageNumber} of ${update.pageCount}` : "";
  if (update.stage === "ocr") return update.status === "page complete" ? `Recognized${pageLabel}.` : `Recognizing text from${pageLabel}…`;
  if (update.stage === "pdf") return update.status === "reducing file size" ? `Reducing${pageLabel} to keep the PDF readable…` : `Combining${pageLabel} into the PDF…`;
  return String(update.status || "Working on the syllabus…");
}

function drawAnalysisOverlay(canvas, analysis) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const corners = cornerList(analysis?.corners || defaultScanCorners());
  context.beginPath();
  corners.forEach((corner, index) => {
    const x = corner.x * canvas.width;
    const y = corner.y * canvas.height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.lineWidth = Math.max(3, canvas.width / 130);
  context.strokeStyle = analysis?.confidence >= 0.72 ? "#7cf1bd" : "#ffd06f";
  context.shadowColor = "rgba(0,0,0,.65)";
  context.shadowBlur = 8;
  context.stroke();
  context.shadowBlur = 0;
}

function averageCornerDrift(previous, next) {
  const previousCorners = cornerList(previous);
  const nextCorners = cornerList(next);
  if (!previous || !next) return 1;
  return nextCorners.reduce((total, corner, index) => {
    const before = previousCorners[index] || corner;
    return total + Math.hypot(corner.x - before.x, corner.y - before.y);
  }, 0) / nextCorners.length;
}

function CornerEditor({ candidate, onCornersChange }) {
  const [dragIndex, setDragIndex] = useState(null);
  const frameRef = useRef(null);
  const sourceWidth = Math.max(1, Number(candidate.canvas?.width) || 1);
  const sourceHeight = Math.max(1, Number(candidate.canvas?.height) || 1);
  const pageRatio = sourceWidth / sourceHeight;

  function moveCorner(event) {
    if (dragIndex == null || !frameRef.current) return;
    const bounds = frameRef.current.getBoundingClientRect();
    const x = Math.max(0.015, Math.min(0.985, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0.015, Math.min(0.985, (event.clientY - bounds.top) / bounds.height));
    onCornersChange(candidate.corners.map((corner, index) => index === dragIndex ? { x, y } : corner));
  }

  function moveCornerWithKeyboard(event, index) {
    const step = event.shiftKey ? 0.025 : 0.0075;
    const movement = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    onCornersChange(candidate.corners.map((corner, cornerIndex) => cornerIndex === index ? {
      x: Math.max(0.015, Math.min(0.985, corner.x + movement.x)),
      y: Math.max(0.015, Math.min(0.985, corner.y + movement.y)),
    } : corner));
  }

  return (
    <div
      className="scanner-corner-editor"
      ref={frameRef}
      style={{ aspectRatio: `${sourceWidth} / ${sourceHeight}`, "--scanner-page-ratio": pageRatio }}
      onPointerMove={moveCorner}
      onPointerUp={() => setDragIndex(null)}
      onPointerCancel={() => setDragIndex(null)}
    >
      <img src={candidate.previewUrl} alt="Captured syllabus page ready for corner adjustment" />
      <div className="scanner-corner-guide" aria-hidden="true" />
      {candidate.corners.map((corner, index) => (
        <button
          className="scanner-corner-handle"
          key={index}
          type="button"
          aria-label={`Move page corner ${index + 1}. Use arrow keys, or hold Shift for larger steps. Current position ${Math.round(corner.x * 100)} percent from the left and ${Math.round(corner.y * 100)} percent from the top.`}
          style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }}
          onKeyDown={(event) => moveCornerWithKeyboard(event, index)}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setDragIndex(index);
          }}
        />
      ))}
    </div>
  );
}

function PageList({ pages, onMove, onRemove }) {
  return (
    <ol className="scanner-page-list" aria-label="Scanned syllabus pages">
      {pages.map((page, index) => (
        <li key={page.id}>
          <img src={page.previewUrl} alt={`Scanned syllabus page ${index + 1}`} />
          <div><strong>Page {index + 1}</strong><span>{page.width} × {page.height}</span></div>
          <div>
            <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move page ${index + 1} earlier`}>↑</button>
            <button type="button" disabled={index === pages.length - 1} onClick={() => onMove(index, 1)} aria-label={`Move page ${index + 1} later`}>↓</button>
            <button type="button" onClick={() => onRemove(index)} aria-label={`Remove page ${index + 1}`}>Remove page</button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function SyllabusScanner({ onClose, onComplete }) {
  const [stage, setStageState] = useState(() => readIntroSeen() ? "ready" : "intro");
  const [pages, setPages] = useState([]);
  const [candidate, setCandidate] = useState(null);
  const [guidance, setGuidance] = useState("Get the whole page in frame.");
  const [autoCapture, setAutoCapture] = useState(true);
  const [engineStatus, setEngineStatus] = useState("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [finalText, setFinalText] = useState("");
  const [finalArtifact, setFinalArtifact] = useState(null);
  const [finalWarnings, setFinalWarnings] = useState([]);
  const [artifactUrl, setArtifactUrl] = useState("");
  const [recognizedTextUrl, setRecognizedTextUrl] = useState("");

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const captureInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const streamRef = useRef(null);
  const scannerEngineRef = useRef(null);
  const analysisTimerRef = useRef(null);
  const analysisBusyRef = useRef(false);
  const captureBusyRef = useRef(false);
  const currentAnalysisRef = useRef(null);
  const previousCornersRef = useRef(null);
  const stableSamplesRef = useRef(0);
  const autoCaptureRef = useRef(autoCapture);
  const guidanceRef = useRef(guidance);
  const engineStatusRef = useRef(engineStatus);
  const stageRef = useRef(stage);
  const pagesRef = useRef(pages);
  const candidateRef = useRef(candidate);
  const pendingFilesRef = useRef([]);
  const sessionRef = useRef(0);
  const pageProcessingControllerRef = useRef(null);
  const pageProcessingReturnStageRef = useRef("ready");
  const processingControllerRef = useRef(null);
  const finishBusyRef = useRef(false);
  const ocrWorkerRef = useRef(null);
  const artifactUrlRef = useRef("");
  const recognizedTextUrlRef = useRef("");

  function setStage(next) {
    stageRef.current = next;
    setStageState(next);
  }

  useEffect(() => { autoCaptureRef.current = autoCapture; }, [autoCapture]);
  useEffect(() => { guidanceRef.current = guidance; }, [guidance]);
  useEffect(() => { engineStatusRef.current = engineStatus; }, [engineStatus]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { candidateRef.current = candidate; }, [candidate]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const heading = dialogRef.current?.querySelector("[data-scanner-stage] h2");
      if (!heading) return;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [stage]);

  function stopAnalysis() {
    if (analysisTimerRef.current) window.clearInterval(analysisTimerRef.current);
    analysisTimerRef.current = null;
    analysisBusyRef.current = false;
    stableSamplesRef.current = 0;
    previousCornersRef.current = null;
  }

  function stopCamera() {
    stopAnalysis();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause?.();
      videoRef.current.srcObject = null;
    }
  }

  function releaseCandidate() {
    const current = candidateRef.current;
    if (!current) return;
    if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
    if (current.canvas) {
      current.canvas.width = 0;
      current.canvas.height = 0;
    }
    candidateRef.current = null;
    setCandidate(null);
  }

  function cleanupSession() {
    sessionRef.current += 1;
    stopCamera();
    pageProcessingControllerRef.current?.abort();
    pageProcessingControllerRef.current = null;
    pendingFilesRef.current = [];
    processingControllerRef.current?.abort();
    processingControllerRef.current = null;
    ocrWorkerRef.current?.terminate?.();
    ocrWorkerRef.current = null;
    releaseCandidate();
    pagesRef.current.forEach(releaseScanPage);
    pagesRef.current = [];
    if (artifactUrlRef.current) URL.revokeObjectURL(artifactUrlRef.current);
    artifactUrlRef.current = "";
    if (recognizedTextUrlRef.current) URL.revokeObjectURL(recognizedTextUrlRef.current);
    recognizedTextUrlRef.current = "";
  }

  function requestClose() {
    cleanupSession();
    onClose();
  }

  useEffect(() => {
    const priorFocus = document.activeElement;
    closeButtonRef.current?.focus();
    function handleKeys(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    function handlePageHide(event) {
      if (!event.persisted) {
        cleanupSession();
        return;
      }
      sessionRef.current += 1;
      stopCamera();
      pendingFilesRef.current = [];
      pageProcessingControllerRef.current?.abort();
      processingControllerRef.current?.abort();
      ocrWorkerRef.current?.terminate?.();
      ocrWorkerRef.current = null;
    }
    function handlePageShow(event) {
      if (!event.persisted) return;
      setProgress("");
      const cachedStage = stageRef.current;
      if (cachedStage === "camera" || cachedStage === "requesting") {
        setStage(pagesRef.current.length ? "pages" : "ready");
      } else if (cachedStage === "processing-page") {
        if (pageProcessingControllerRef.current) setProgress("Canceling this page…");
        else setStage(candidateRef.current ? "review" : pagesRef.current.length ? "pages" : "ready");
      } else if (cachedStage === "processing") {
        if (processingControllerRef.current) setProgress("Canceling…");
        else setStage(pagesRef.current.length ? "pages" : "ready");
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden" && streamRef.current) {
        stopCamera();
        setGuidance("Camera paused. Start it again when you are ready.");
        if (stageRef.current === "camera") setStage("ready");
      }
    }
    document.addEventListener("keydown", handleKeys);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("keydown", handleKeys);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
      cleanupSession();
      priorFocus?.focus?.();
    };
  // Scanner teardown must run only at mount/unmount; mutable resources are kept in refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (artifactUrlRef.current) URL.revokeObjectURL(artifactUrlRef.current);
    artifactUrlRef.current = "";
    if (!finalArtifact) { setArtifactUrl(""); return undefined; }
    const nextUrl = URL.createObjectURL(finalArtifact);
    artifactUrlRef.current = nextUrl;
    setArtifactUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
      if (artifactUrlRef.current === nextUrl) artifactUrlRef.current = "";
    };
  }, [finalArtifact]);

  useEffect(() => {
    if (recognizedTextUrlRef.current) URL.revokeObjectURL(recognizedTextUrlRef.current);
    recognizedTextUrlRef.current = "";
    if (!finalText) { setRecognizedTextUrl(""); return undefined; }
    const nextUrl = URL.createObjectURL(new Blob([finalText], { type: "text/plain;charset=utf-8" }));
    recognizedTextUrlRef.current = nextUrl;
    setRecognizedTextUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
      if (recognizedTextUrlRef.current === nextUrl) recognizedTextUrlRef.current = "";
    };
  }, [finalText]);

  async function ensureEngine(session, signal) {
    if (scannerEngineRef.current) return scannerEngineRef.current;
    engineStatusRef.current = "loading";
    setEngineStatus("loading");
    try {
      const engine = await loadScannerEngine({ signal, timeoutMs: 15_000 });
      if (sessionRef.current !== session) return null;
      scannerEngineRef.current = engine;
      engineStatusRef.current = "ready";
      setEngineStatus("ready");
      return engine;
    } catch (engineError) {
      if (isAbort(engineError, signal)) return null;
      if (sessionRef.current === session) {
        engineStatusRef.current = "manual";
        setEngineStatus("manual");
        setGuidance("Automatic edges are unavailable. Use the guide, shutter, and corner handles.");
      }
      return null;
    }
  }

  function startAnalysis() {
    stopAnalysis();
    analysisTimerRef.current = window.setInterval(async () => {
      if (stageRef.current !== "camera" || analysisBusyRef.current || captureBusyRef.current) return;
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      if (engineStatusRef.current === "manual") {
        const overlay = overlayRef.current;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        if (overlay && (overlay.width !== width || overlay.height !== height)) { overlay.width = width; overlay.height = height; }
        drawAnalysisOverlay(overlay, { corners: defaultScanCorners(), confidence: 0 });
        return;
      }
      analysisBusyRef.current = true;
      try {
        const sourceWidth = video.videoWidth || 1280;
        const sourceHeight = video.videoHeight || 720;
        const scale = Math.min(1, 640 / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        canvas.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, width, height);
        const analysis = await analyzeCanvas(canvas, scannerEngineRef.current);
        const nextGuidance = analysis.guidance || guidanceForAnalysis(analysis);
        currentAnalysisRef.current = analysis;
        const overlay = overlayRef.current;
        if (overlay && (overlay.width !== width || overlay.height !== height)) { overlay.width = width; overlay.height = height; }
        drawAnalysisOverlay(overlay, analysis);
        if (nextGuidance !== guidanceRef.current) {
          guidanceRef.current = nextGuidance;
          setGuidance(nextGuidance);
        }
        const drift = averageCornerDrift(previousCornersRef.current, analysis.corners);
        previousCornersRef.current = cornerList(analysis.corners);
        const stable = analysis.confidence >= 0.72 && drift < 0.018 && nextGuidance === "Ready to capture.";
        stableSamplesRef.current = stable ? stableSamplesRef.current + 1 : 0;
        if (autoCaptureRef.current && stableSamplesRef.current >= 6) captureCurrentPage();
      } catch {
        if (engineStatusRef.current !== "manual") {
          engineStatusRef.current = "manual";
          setEngineStatus("manual");
        }
        setGuidance("Use the guide and shutter, then adjust the four corners.");
      } finally {
        analysisBusyRef.current = false;
      }
    }, 200);
  }

  async function startCamera() {
    setError("");
    if (pagesRef.current.length >= MAX_SCAN_PAGES) {
      setError(`A scan can contain up to ${MAX_SCAN_PAGES} pages. Finish this scan before starting another.`);
      setStage("pages");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open a live camera. Choose page photos instead.");
      setStage("ready");
      return;
    }
    stopCamera();
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setStage("requesting");
    setProgress("Waiting for camera permission…");
    const cameraPromise = navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920, max: 2560 },
        height: { ideal: 1080, max: 1920 },
      },
      audio: false,
    });
    let timeoutId;
    try {
      const stream = await Promise.race([
        cameraPromise,
        new Promise((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error("Camera request timed out.")), 15_000); }),
      ]);
      window.clearTimeout(timeoutId);
      if (sessionRef.current !== session) { stopMediaStream(stream); return; }
      streamRef.current = stream;
      currentAnalysisRef.current = null;
      setStage("camera");
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      if (sessionRef.current !== session) { stopMediaStream(stream); return; }
      const video = videoRef.current;
      if (!video) throw new Error("The camera preview could not open.");
      video.srcObject = stream;
      await video.play();
      setProgress("");
      setGuidance("Get the whole page in frame.");
      ensureEngine(session);
      startAnalysis();
    } catch (cameraError) {
      window.clearTimeout(timeoutId);
      cameraPromise.then((lateStream) => stopMediaStream(lateStream)).catch(() => {});
      if (sessionRef.current !== session) return;
      stopCamera();
      setStage("ready");
      setProgress("");
      setError(cameraError?.name === "NotAllowedError" ? "Camera access was not allowed. Choose page photos instead, or enable camera permission and try again." : "The camera could not start. Choose page photos or try the camera again.");
    }
  }

  async function captureCurrentPage() {
    if (captureBusyRef.current || stageRef.current !== "camera") return;
    captureBusyRef.current = true;
    const session = sessionRef.current;
    stopAnalysis();
    let canvas;
    let preview;
    let adopted = false;
    try {
      canvas = captureVideoFrame(videoRef.current);
      preview = await canvasPreview(canvas);
      if (sessionRef.current !== session || stageRef.current !== "camera") return;
      const corners = cornerList(currentAnalysisRef.current?.corners || defaultScanCorners());
      stopCamera();
      const nextCandidate = { canvas, previewUrl: preview.url, corners, source: "camera" };
      candidateRef.current = nextCandidate;
      setCandidate(nextCandidate);
      adopted = true;
      setStage("review");
      setGuidance("Drag a corner if the page edge needs correcting.");
    } catch (captureError) {
      if (sessionRef.current !== session) return;
      setError(captureError?.message || "The page could not be captured. Try the shutter again.");
      setStage("ready");
      stopCamera();
    } finally {
      if (!adopted) {
        if (preview?.url) URL.revokeObjectURL(preview.url);
        if (canvas) { canvas.width = 0; canvas.height = 0; }
      }
      window.setTimeout(() => { captureBusyRef.current = false; }, 1_500);
    }
  }

  async function preparePhotoCandidate(file) {
    if (!file) return;
    pageProcessingControllerRef.current?.abort();
    const controller = new AbortController();
    pageProcessingControllerRef.current = controller;
    pageProcessingReturnStageRef.current = pagesRef.current.length ? "pages" : "ready";
    const session = sessionRef.current;
    setStage("processing-page");
    setProgress(`Opening ${file.name || "page photo"}…`);
    setError("");
    let canvas;
    let preview;
    let adopted = false;
    let nextFile = null;
    try {
      await nextPaint();
      throwIfCancelled(controller.signal);
      canvas = await decodeImageFile(file, { signal: controller.signal });
      const engine = await ensureEngine(session, controller.signal);
      throwIfCancelled(controller.signal);
      const analysis = engine ? await analyzeCanvas(canvas, engine) : { corners: defaultScanCorners(), confidence: 0, detected: false };
      throwIfCancelled(controller.signal);
      preview = await canvasPreview(canvas);
      throwIfCancelled(controller.signal);
      if (sessionRef.current !== session) return;
      const nextCandidate = { canvas, previewUrl: preview.url, corners: cornerList(analysis.corners || defaultScanCorners()), source: "photo" };
      candidateRef.current = nextCandidate;
      setCandidate(nextCandidate);
      adopted = true;
      setGuidance(analysis.confidence >= 0.55 ? "Check the four page corners." : "Automatic edges were uncertain. Drag the four corners onto the paper.");
      setProgress("");
      setStage("review");
    } catch (photoError) {
      setProgress("");
      if (isAbort(photoError, controller.signal)) {
        setStage(pageProcessingReturnStageRef.current);
      } else {
        setError(photoError?.message || "That page photo could not be opened.");
        nextFile = pendingFilesRef.current.shift() || null;
        if (!nextFile) setStage(pagesRef.current.length ? "pages" : "ready");
      }
    } finally {
      if (!adopted) {
        if (preview?.url) URL.revokeObjectURL(preview.url);
        if (canvas) { canvas.width = 0; canvas.height = 0; }
      }
      if (pageProcessingControllerRef.current === controller) pageProcessingControllerRef.current = null;
    }
    if (nextFile) await preparePhotoCandidate(nextFile);
  }

  function handlePhotoFiles(fileList) {
    const allFiles = [...(fileList || [])];
    const selected = allFiles.filter(isSafePhoto);
    if (!selected.length) {
      pendingFilesRef.current = [];
      setError("Choose JPEG, PNG, or WebP page photos.");
      return;
    }
    if (selected.length !== allFiles.length) {
      pendingFilesRef.current = [];
      setError("Every selected page must be a JPEG, PNG, or WebP photo.");
      return;
    }
    if (pagesRef.current.length + selected.length > MAX_SCAN_PAGES) {
      pendingFilesRef.current = [];
      setError(`A scan can contain up to ${MAX_SCAN_PAGES} pages. Split a longer syllabus into two scans.`);
      return;
    }
    stopCamera();
    pendingFilesRef.current = selected.slice(1);
    preparePhotoCandidate(selected[0]);
  }

  async function acceptCandidate() {
    const current = candidateRef.current;
    if (!current) return;
    if (pagesRef.current.length >= MAX_SCAN_PAGES) {
      setError(`A scan can contain up to ${MAX_SCAN_PAGES} pages. Finish this scan before adding another page.`);
      releaseCandidate();
      setStage("pages");
      return;
    }
    pageProcessingControllerRef.current?.abort();
    const controller = new AbortController();
    pageProcessingControllerRef.current = controller;
    pageProcessingReturnStageRef.current = "review";
    setStage("processing-page");
    setProgress("Straightening and cleaning this page…");
    setError("");
    let page;
    let pageAdded = false;
    let nextFile = null;
    try {
      await nextPaint();
      throwIfCancelled(controller.signal);
      page = await processScanPage(current.canvas, current.corners, {
        cv: scannerEngineRef.current,
        signal: controller.signal,
        allowCanvasFallback: true,
        onProgress: (update) => setProgress(scannerProgressText(update)),
      });
      throwIfCancelled(controller.signal);
      const retainedBytes = pagesRef.current.reduce((total, savedPage) => total + (savedPage.byteLength || 0), 0);
      if (retainedBytes + page.byteLength > MAX_RETAINED_PAGE_BYTES) {
        releaseScanPage(page);
        page = null;
        throw new Error(`The cleaned pages have reached the ${Math.round(MAX_RETAINED_PAGE_BYTES / (1024 * 1024))} MB working limit. Use these pages now, then start a second scan for the rest.`);
      }
      setPages((existing) => {
        const next = [...existing, page];
        pagesRef.current = next;
        return next;
      });
      pageAdded = true;
      releaseCandidate();
      setProgress("");
      nextFile = pendingFilesRef.current.shift() || null;
    } catch (pageError) {
      setProgress("");
      if (isAbort(pageError, controller.signal)) {
        setStage(candidateRef.current ? pageProcessingReturnStageRef.current : pagesRef.current.length ? "pages" : "ready");
      } else {
        setError(pageError?.message || "The page could not be cleaned. Adjust the corners or retake it.");
        setStage("review");
      }
    } finally {
      if (page && !pageAdded) releaseScanPage(page);
      if (pageProcessingControllerRef.current === controller) pageProcessingControllerRef.current = null;
    }
    if (pageAdded && nextFile) await preparePhotoCandidate(nextFile);
    else if (pageAdded) setStage("pages");
  }

  function cancelPageProcessing() {
    pendingFilesRef.current = [];
    const controller = pageProcessingControllerRef.current;
    if (!controller || controller.signal.aborted) return;
    setProgress("Canceling this page…");
    controller.abort();
  }

  function retakeCandidate() {
    const source = candidateRef.current?.source;
    releaseCandidate();
    if (source === "camera") startCamera();
    else if (pendingFilesRef.current.length) preparePhotoCandidate(pendingFilesRef.current.shift());
    else setStage(pagesRef.current.length ? "pages" : "ready");
  }

  function movePage(index, direction) {
    setPages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      pagesRef.current = next;
      return next;
    });
  }

  function removePage(index) {
    setPages((current) => {
      releaseScanPage(current[index]);
      const next = current.filter((_, pageIndex) => pageIndex !== index);
      pagesRef.current = next;
      return next;
    });
  }

  async function finishScan() {
    if (!pagesRef.current.length || finishBusyRef.current) return;
    finishBusyRef.current = true;
    stopCamera();
    processingControllerRef.current?.abort();
    const controller = new AbortController();
    processingControllerRef.current = controller;
    const pagesToFinish = [...pagesRef.current];
    const warnings = [];
    const fallbackPages = pagesToFinish.filter((page) => page.usedFallback).length;
    if (fallbackPages) warnings.push(`${fallbackPages} page${fallbackPages === 1 ? " was" : "s were"} cropped without automatic perspective correction. Check the recognized text carefully.`);
    let text = "";
    let artifact = null;
    setError("");
    setStage("processing");
    setProgress("Preparing text recognition…");
    try {
      try {
        const recognition = await recognizeScanPages(pagesToFinish, {
          signal: controller.signal,
          detailed: true,
          onProgress: (update) => setProgress(scannerProgressText(update)),
          onWorker: (worker) => { ocrWorkerRef.current = worker; },
        });
        text = typeof recognition === "string" ? recognition : String(recognition?.text || "");
        const uncertainPages = Array.isArray(recognition?.pages) ? recognition.pages.filter((page) => page.confidence < 65).length : 0;
        if (uncertainPages) warnings.push(`${uncertainPages} page${uncertainPages === 1 ? " needs" : "s need"} an extra text check because recognition confidence was low.`);
      } catch (ocrError) {
        if (isAbort(ocrError, controller.signal)) throw ocrError;
        warnings.push("Automatic text recognition did not finish. Type or paste any missing text before using the syllabus.");
      } finally {
        ocrWorkerRef.current = null;
      }
      if (text.length > MAX_OCR_CHARACTERS) {
        text = text.slice(0, MAX_OCR_CHARACTERS);
        warnings.push("Recognized text was limited to 250,000 characters.");
      }
      try {
        setProgress("Combining cleaned pages into one PDF…");
        const pdfResult = await buildScanPdf(pagesToFinish, { signal: controller.signal, onProgress: (update) => setProgress(scannerProgressText(update)) });
        artifact = pdfResult.file || (pdfResult.blob ? new File([pdfResult.blob], pdfResult.fileName || "syllabus-scan.pdf", { type: "application/pdf", lastModified: Date.now() }) : null);
        if (pdfResult.recompressed || pdfResult.attempts > 1) warnings.push("Pages were compressed again to keep the PDF below the scanner size limit.");
      } catch (pdfError) {
        if (isAbort(pdfError, controller.signal)) throw pdfError;
        warnings.push(pdfError?.message || "The combined PDF could not be created, but recognized text can still be reviewed.");
      }
      throwIfCancelled(controller.signal);
      setFinalText(text.trim());
      setFinalArtifact(artifact);
      setFinalWarnings(warnings);
      setProgress("");
      setStage("complete");
    } catch (finishError) {
      setProgress("");
      if (isAbort(finishError, controller.signal)) {
        setStage(pagesRef.current.length ? "pages" : "ready");
      } else {
        setError(finishError?.message || "The scan could not be finished. Review the pages and try again.");
        setStage(pagesRef.current.length ? "pages" : "ready");
      }
    } finally {
      ocrWorkerRef.current = null;
      if (processingControllerRef.current === controller) processingControllerRef.current = null;
      finishBusyRef.current = false;
    }
  }

  function cancelProcessing() {
    const controller = processingControllerRef.current;
    if (!controller || controller.signal.aborted) return;
    setProgress("Canceling…");
    controller.abort();
    ocrWorkerRef.current?.terminate?.();
    ocrWorkerRef.current = null;
  }

  function useSyllabus() {
    const text = finalText.trim();
    if (!text) {
      setError("Add or correct the syllabus text before continuing.");
      return;
    }
    onComplete({
      text,
      name: finalArtifact?.name || "syllabus-scan.txt",
      detail: `${pagesRef.current.length} scanned page${pagesRef.current.length === 1 ? "" : "s"} with on-device text recognition`,
      warnings: finalWarnings,
      artifact: finalArtifact,
    });
  }

  return (
    <div className="syllabus-scanner-overlay">
      <section className="syllabus-scanner" role="dialog" aria-modal="true" aria-labelledby="scanner-title" ref={dialogRef}>
        <header className="scanner-header">
          <div><span>PAPER SYLLABUS SCANNER</span><h1 id="scanner-title">Turn paper pages into editable course text.</h1></div>
          <button ref={closeButtonRef} type="button" onClick={requestClose} aria-label="Close paper syllabus scanner">×</button>
        </header>

        {error && <div className="scanner-error" role="alert">{error}</div>}

        {stage === "intro" && <div className="scanner-intro" data-scanner-stage="intro">
          <div><span>ONE-TIME GUIDE</span><h2>Flat, bright, and fully inside the frame.</h2><p>Hold the phone above the page. Keep every corner visible, avoid shadows, and tilt slightly if a light creates glare.</p></div>
          <div className="scanner-example-grid" aria-label="Scanning examples">
            <article className="is-good"><div><span /><span /><span /></div><strong>Good scan</strong><p>Whole page, even light, phone held flat.</p></article>
            <article className="is-bad"><div><span /><span /><span /></div><strong>Try again</strong><p>Cut-off edge, hard shadow, or strong angle.</p></article>
          </div>
          <button className="scanner-primary" type="button" onClick={() => { rememberIntro(); setStage("ready"); }}>Got it</button>
        </div>}

        {stage === "ready" && <div className="scanner-ready" data-scanner-stage="ready">
          <div className="scanner-ready-copy"><span>START A SCAN</span><h2>Use the live camera or choose page photos.</h2><p>Pages are cleaned and read in this browser. You review the text before anything reaches the calendar.</p></div>
          <div className="scanner-start-options">
            <button className="scanner-primary" type="button" onClick={startCamera}>Open live camera</button>
            <button type="button" onClick={() => captureInputRef.current?.click()}>Take one photo</button>
            <button type="button" onClick={() => photoInputRef.current?.click()}>Choose saved photos</button>
          </div>
          {pages.length > 0 && <><PageList pages={pages} onMove={movePage} onRemove={removePage} /><button className="scanner-primary" type="button" onClick={finishScan}>Done — combine {pages.length} page{pages.length === 1 ? "" : "s"}</button></>}
        </div>}

        {stage === "requesting" && <div className="scanner-processing" data-scanner-stage="requesting" role="status" aria-live="polite" aria-atomic="true"><span className="scanner-spinner" aria-hidden="true" /><h2>{progress}</h2><p>If permission does not appear, choose page photos instead.</p><button type="button" onClick={() => { sessionRef.current += 1; stopCamera(); setStage("ready"); }}>Cancel camera request</button></div>}

        {stage === "camera" && <div className="scanner-camera-stage" data-scanner-stage="camera">
          <h2 className="sr-only">Capture a syllabus page.</h2>
          <div className="scanner-camera-frame">
            <video ref={videoRef} muted playsInline aria-label="Live rear camera preview" />
            <canvas ref={overlayRef} className="scanner-live-overlay" aria-hidden="true" />
            <div className="scanner-frame-corners" aria-hidden="true" />
          </div>
          <canvas ref={analysisCanvasRef} className="sr-only" aria-hidden="true" />
          <div className="scanner-guidance" aria-live="polite"><strong>{guidance}</strong><span>{engineStatus === "loading" ? "Loading automatic page edges…" : engineStatus === "manual" ? "Manual corner adjustment is ready." : autoCapture ? "Auto-capture is on." : "Use the shutter when ready."}</span></div>
          <div className="scanner-camera-controls">
            <label><input type="checkbox" checked={autoCapture} onChange={(event) => setAutoCapture(event.target.checked)} />Auto-capture</label>
            <button className="scanner-shutter" type="button" onClick={captureCurrentPage} aria-label="Capture syllabus page"><span /></button>
            <button type="button" onClick={() => photoInputRef.current?.click()}>Photos</button>
          </div>
        </div>}

        {stage === "review" && candidate && <div className="scanner-review-stage" data-scanner-stage="review">
          <div><span>CHECK PAGE {pages.length + 1}</span><h2>Put each handle on a paper corner.</h2><p>{guidance}</p></div>
          <CornerEditor candidate={candidate} onCornersChange={(corners) => setCandidate((current) => {
            const next = { ...current, corners };
            candidateRef.current = next;
            return next;
          })} />
          <div className="scanner-review-actions"><button type="button" onClick={retakeCandidate}>Retake or skip</button><button className="scanner-primary" type="button" onClick={acceptCandidate}>Looks good</button></div>
        </div>}

        {stage === "processing-page" && <div className="scanner-processing" data-scanner-stage="processing-page" role="status" aria-live="polite" aria-atomic="true"><span className="scanner-spinner" aria-hidden="true" /><h2>{progress || "Preparing page…"}</h2><p>The original camera frame stays only in memory during this step.</p><button type="button" onClick={cancelPageProcessing}>Stop page processing</button></div>}

        {stage === "pages" && <div className="scanner-pages-stage" data-scanner-stage="pages">
          <div><span>{pages.length} OF {MAX_SCAN_PAGES} PAGES</span><h2>Pages are ready in this order.</h2><p>Move, remove, or add pages before text recognition begins.</p></div>
          <PageList pages={pages} onMove={movePage} onRemove={removePage} />
          <div className="scanner-page-actions"><button type="button" onClick={startCamera}>Open live camera</button><button type="button" onClick={() => captureInputRef.current?.click()}>Take one photo</button><button type="button" onClick={() => photoInputRef.current?.click()}>Add saved photos</button><button className="scanner-primary" type="button" disabled={!pages.length} onClick={finishScan}>Done — combine pages</button></div>
        </div>}

        {stage === "processing" && <div className="scanner-processing" data-scanner-stage="processing" role="status" aria-live="polite" aria-atomic="true"><span className="scanner-spinner" aria-hidden="true" /><h2>{progress || "Finishing the syllabus…"}</h2><p>Text recognition runs one page at a time so older phones are not overloaded.</p><button type="button" onClick={cancelProcessing}>Stop syllabus processing</button></div>}

        {stage === "complete" && <div className="scanner-complete-stage" data-scanner-stage="complete">
          <div><span>FINAL TEXT CHECK</span><h2>Correct anything the scanner misread.</h2><p>The highlighted source review opens next. No date is added until you approve it.</p></div>
          {finalWarnings.length > 0 && <ul className="scanner-warning-list">{finalWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          <label>Recognized syllabus text<textarea spellCheck rows={18} value={finalText} maxLength={MAX_OCR_CHARACTERS} onChange={(event) => setFinalText(event.target.value)} placeholder="If recognition was unavailable, type or paste the syllabus text here." /></label>
          <div className="scanner-complete-actions">{artifactUrl && <a href={artifactUrl} download="syllabus-scan.pdf">Download image copy (PDF)</a>}{recognizedTextUrl && <a href={recognizedTextUrl} download="syllabus-recognized-text.txt">Download recognized text</a>}<button type="button" onClick={() => setStage("pages")}>Back to pages</button><button className="scanner-primary" type="button" onClick={useSyllabus}>Use this syllabus</button></div>
        </div>}

        <input ref={captureInputRef} className="sr-only" type="file" accept={SAFE_PHOTO_ACCEPT} capture="environment" tabIndex={-1} aria-label="Take one syllabus page photo" onChange={(event) => { const files = [...(event.target.files || [])]; event.target.value = ""; handlePhotoFiles(files); }} />
        <input ref={photoInputRef} className="sr-only" type="file" accept={SAFE_PHOTO_ACCEPT} multiple tabIndex={-1} aria-label="Choose saved syllabus page photos" onChange={(event) => { const files = [...(event.target.files || [])]; event.target.value = ""; handlePhotoFiles(files); }} />
      </section>
    </div>
  );
}
