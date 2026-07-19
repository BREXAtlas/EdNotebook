export const MAX_SCAN_PAGES = 25;
export const MAX_SCAN_IMAGE_PIXELS = 20_000_000;
export const MAX_SCAN_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_SCAN_OCR_CHARACTERS = 250_000;
export const MAX_SCAN_PDF_BYTES = 12 * 1024 * 1024;
export const MAX_SCAN_SESSION_BYTES = 18 * 1024 * 1024;

export const SCANNER_CAPS = Object.freeze({
  pages: MAX_SCAN_PAGES,
  pixelsPerPage: MAX_SCAN_IMAGE_PIXELS,
  sourceImageBytes: MAX_SCAN_SOURCE_IMAGE_BYTES,
  ocrCharacters: MAX_SCAN_OCR_CHARACTERS,
  pdfBytes: MAX_SCAN_PDF_BYTES,
  sessionBytes: MAX_SCAN_SESSION_BYTES,
});

const ANALYSIS_MAX_EDGE = 1_500;
const ANALYSIS_MAX_PIXELS = 2_250_000;
const PROCESSING_MAX_EDGE = 2_600;
const PROCESSING_MAX_PIXELS = 4_800_000;
const IMAGE_HEADER_BYTES = 256 * 1024;
const DEFAULT_OUTPUT_MAX_EDGE = 2_400;
const MIN_DOCUMENT_COVERAGE = 0.08;
const SCANNER_ENGINE_RETRY_DELAY_MS = 5_000;

const BASE_URL = import.meta.env?.BASE_URL || "/";
const OCR_ASSET_ROOT = `${BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`}ocr/tesseract/7.0.0/`;

export const DEFAULT_OCR_ASSET_PATHS = Object.freeze({
  workerPath: `${OCR_ASSET_ROOT}worker.min.js`,
  corePath: `${OCR_ASSET_ROOT}core/`,
  langPath: `${OCR_ASSET_ROOT}lang/`,
});

const PDF_COMPRESSION_CURVE = Object.freeze([
  { maxLongEdge: 2_400, quality: 0.84 },
  { maxLongEdge: 2_200, quality: 0.80 },
  { maxLongEdge: 2_000, quality: 0.76 },
  { maxLongEdge: 1_800, quality: 0.72 },
  { maxLongEdge: 1_600, quality: 0.68 },
]);

let scannerEnginePromise;
let scannerEngineRetryAfter = 0;
let scannerEngineLastError;

function abortError(message = "The scan operation was canceled.") {
  if (typeof DOMException === "function") return new DOMException(message, "AbortError");
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function timeoutError(message) {
  const error = new Error(message);
  error.name = "TimeoutError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : abortError();
}

function withAbort(promise, signal, onAbort) {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", handleAbort);
      callback(value);
    };
    const handleAbort = () => {
      try { onAbort?.(); } catch { /* best-effort cancellation */ }
      finish(reject, signal.reason instanceof Error ? signal.reason : abortError());
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );
  });
}

function withTimeout(promise, timeoutMs, onTimeout, message) {
  const duration = Number(timeoutMs);
  if (!Number.isFinite(duration) || duration <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { onTimeout?.(); } catch { /* timeout cleanup is best effort */ }
      reject(timeoutError(message || `The scanner engine did not load within ${Math.round(duration / 1_000)} seconds.`));
    }, duration);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function notify(callback, payload) {
  if (typeof callback !== "function") return;
  try { callback(payload); } catch { /* progress callbacks must not stop processing */ }
}

function progressValue(options, payload, message) {
  return options?.structuredProgress ? payload : message;
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createCanvas(width, height, { alpha = false } = {}) {
  if (typeof document === "undefined") throw new Error("The scanner requires a browser canvas.");
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { alpha, willReadFrequently: true });
  if (!context) throw new Error("This browser could not create a scan canvas.");
  if (!alpha) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, context };
}

function assertCanvas(canvas, label = "canvas") {
  const width = Number(canvas?.width);
  const height = Number(canvas?.height);
  if (!canvas || typeof canvas.getContext !== "function" || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new TypeError(`A readable ${label} is required.`);
  }
  return { width, height };
}

function fittedDimensions(width, height, { maxPixels = MAX_SCAN_IMAGE_PIXELS, maxLongEdge = Infinity } = {}) {
  if (!(width > 0) || !(height > 0)) throw new RangeError("Image dimensions must be positive.");
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  const edgeScale = Math.min(1, maxLongEdge / Math.max(width, height));
  const scale = Math.min(pixelScale, edgeScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

function cappedCanvas(sourceCanvas, limits = {}) {
  const { width, height } = assertCanvas(sourceCanvas, "source canvas");
  const fitted = fittedDimensions(width, height, limits);
  if (fitted.width === width && fitted.height === height) return { canvas: sourceCanvas, owned: false };
  const output = createCanvas(fitted.width, fitted.height);
  output.context.drawImage(sourceCanvas, 0, 0, fitted.width, fitted.height);
  return { canvas: output.canvas, owned: true };
}

function clearOwnedCanvas(entry) {
  if (!entry?.owned || !entry.canvas) return;
  entry.canvas.width = 1;
  entry.canvas.height = 1;
}

function canvasToBlob(canvas, type, quality, signal) {
  throwIfAborted(signal);
  return withAbort(new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("The browser could not encode the scanned page."));
      else resolve(blob);
    }, type, quality);
  }), signal);
}

function safeDelete(value) {
  if (!value || typeof value.delete !== "function") return;
  try { value.delete(); } catch { /* OpenCV objects may already be released */ }
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function orderCorners(points) {
  if (!Array.isArray(points) || points.length !== 4) throw new RangeError("Four scan corners are required.");
  const center = points.reduce((result, point) => ({ x: result.x + point.x / 4, y: result.y + point.y / 4 }), { x: 0, y: 0 });
  const aroundCenter = points
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
    .sort((first, second) => Math.atan2(first.y - center.y, first.x - center.x) - Math.atan2(second.y - center.y, second.x - center.x));
  const topLeftIndex = aroundCenter.reduce((bestIndex, point, index, all) => (
    point.x + point.y < all[bestIndex].x + all[bestIndex].y ? index : bestIndex
  ), 0);
  const ordered = Array.from({ length: 4 }, (_, offset) => aroundCenter[(topLeftIndex + offset) % 4]);
  if (ordered[1].x < ordered[3].x) ordered.splice(1, 3, ordered[3], ordered[2], ordered[1]);
  return {
    topLeft: ordered[0],
    topRight: ordered[1],
    bottomRight: ordered[2],
    bottomLeft: ordered[3],
  };
}

function cornerArray(corners) {
  return [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }));
}

function normalizedCornerObject(value) {
  const candidate = value || defaultScanCorners();
  const input = Array.isArray(candidate)
    ? { topLeft: candidate[0], topRight: candidate[1], bottomRight: candidate[2], bottomLeft: candidate[3] }
    : candidate;
  const result = {};
  for (const key of ["topLeft", "topRight", "bottomRight", "bottomLeft"]) {
    const point = input[key];
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) throw new RangeError(`The ${key} scan corner is invalid.`);
    result[key] = { x: clamp(Number(point.x), 0, 1), y: clamp(Number(point.y), 0, 1) };
  }
  if (polygonArea([result.topLeft, result.topRight, result.bottomRight, result.bottomLeft]) < 0.005) {
    throw new RangeError("The scan corners are too close together.");
  }
  return result;
}

function pointsFromContour(contour) {
  const data = contour?.data32S?.length >= 8 ? contour.data32S : contour?.data32F;
  if (!data || data.length < 8) return [];
  const points = [];
  for (let index = 0; index < 8; index += 2) points.push({ x: Number(data[index]), y: Number(data[index + 1]) });
  return points;
}

function normalizeDetectedCorners(corners, width, height) {
  return cornerArray({
    topLeft: { x: clamp(corners.topLeft.x / width, 0, 1), y: clamp(corners.topLeft.y / height, 0, 1) },
    topRight: { x: clamp(corners.topRight.x / width, 0, 1), y: clamp(corners.topRight.y / height, 0, 1) },
    bottomRight: { x: clamp(corners.bottomRight.x / width, 0, 1), y: clamp(corners.bottomRight.y / height, 0, 1) },
    bottomLeft: { x: clamp(corners.bottomLeft.x / width, 0, 1), y: clamp(corners.bottomLeft.y / height, 0, 1) },
  });
}

async function decodedBlob(blob, resize = null, signal) {
  throwIfAborted(signal);
  if (typeof createImageBitmap === "function") {
    try {
      const pendingBitmap = createImageBitmap(blob, { imageOrientation: "from-image", ...(resize || {}) });
      const bitmap = await withAbort(pendingBitmap, signal, () => {
        void pendingBitmap.then((lateBitmap) => lateBitmap.close?.(), () => {});
      });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close?.() };
    } catch (error) {
      if (error?.name === "AbortError" || signal?.aborted) throw error;
      try {
        const pendingBitmap = createImageBitmap(blob, resize || undefined);
        const bitmap = await withAbort(pendingBitmap, signal, () => {
          void pendingBitmap.then((lateBitmap) => lateBitmap.close?.(), () => {});
        });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close?.() };
      } catch (fallbackError) {
        if (fallbackError?.name === "AbortError" || signal?.aborted) throw fallbackError;
        /* fall through to an HTML image */
      }
    }
  }
  if (typeof Image === "undefined" || typeof URL === "undefined") throw new Error("This browser cannot decode the selected image.");
  const previewUrl = URL.createObjectURL(blob);
  const image = new Image();
  let released = false;
  const cleanup = () => {
    if (released) return;
    released = true;
    image.src = "";
    URL.revokeObjectURL(previewUrl);
  };
  image.decoding = "async";
  try {
    let pendingDecode;
    if (typeof image.decode === "function") {
      image.src = previewUrl;
      pendingDecode = image.decode();
    } else {
      pendingDecode = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("The selected image could not be decoded."));
      });
      image.src = previewUrl;
    }
    await withAbort(pendingDecode, signal, cleanup);
    throwIfAborted(signal);
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sizeMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { offset += 2; continue; }
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) break;
    if (sizeMarkers.has(marker)) {
      return { height: view.getUint16(offset + 5, false), width: view.getUint16(offset + 7, false) };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function webpDimensions(bytes) {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    const height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
    return { width, height };
  }
  return null;
}

async function inspectImageFile(file, signal) {
  throwIfAborted(signal);
  const bytes = new Uint8Array(await withAbort(file.slice(0, IMAGE_HEADER_BYTES).arrayBuffer(), signal));
  throwIfAborted(signal);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { kind: "png", width: view.getUint32(16, false), height: view.getUint32(20, false) };
  }
  const jpeg = jpegDimensions(bytes);
  if (jpeg) return { kind: "jpeg", ...jpeg };
  const riff = bytes.length >= 12 ? String.fromCharCode(...bytes.slice(0, 4)) : "";
  const webp = bytes.length >= 12 ? String.fromCharCode(...bytes.slice(8, 12)) : "";
  if (riff === "RIFF" && webp === "WEBP") {
    const dimensions = webpDimensions(bytes);
    if (!dimensions) throw new TypeError("This WebP page does not expose safe image dimensions. Save it as JPEG or PNG, then try again.");
    return { kind: "webp", ...dimensions };
  }
  throw new TypeError("Choose a JPEG, PNG, or WebP page photo. Other image formats cannot be opened safely here.");
}

function nextPaint() {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function validatePages(pages) {
  if (!Array.isArray(pages) || pages.length < 1) throw new RangeError("Add at least one scanned page first.");
  if (pages.length > MAX_SCAN_PAGES) throw new RangeError(`A scan can contain up to ${MAX_SCAN_PAGES} pages.`);
  pages.forEach((page, index) => {
    if (!(page?.blob instanceof Blob) || page.released) throw new TypeError(`Scanned page ${index + 1} is no longer available.`);
    if (!(page.width > 0) || !(page.height > 0) || page.width * page.height > MAX_SCAN_IMAGE_PIXELS) {
      throw new RangeError(`Scanned page ${index + 1} exceeds the ${MAX_SCAN_IMAGE_PIXELS.toLocaleString()} pixel limit.`);
    }
  });
}

function pageIdentifier() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function manualAnalysis(canvas, guidance = "Use the guide, shutter, and corner handles.") {
  const { width, height } = assertCanvas(canvas);
  return {
    detected: false,
    manual: true,
    confidence: 0,
    corners: defaultScanCorners(),
    guidance,
    documentCoverage: 0,
    brightness: 0.5,
    glareRatio: 0,
    blurScore: 0,
    sourceWidth: width,
    sourceHeight: height,
    analysisWidth: width,
    analysisHeight: height,
  };
}

function scanGuidance({ detected, documentCoverage, brightness, glareRatio, blurScore }) {
  if (!detected) return "Keep the full sheet inside the guide.";
  if (documentCoverage < 0.2) return "Move closer so the page fills more of the frame.";
  if (documentCoverage > 0.94) return "Move back so every page corner stays visible.";
  if (brightness < 0.18) return "Add more light, then hold the page steady.";
  if (brightness > 0.94 || glareRatio > 0.16) return "Tilt the page slightly to reduce glare.";
  if (blurScore < 0.08) return "Hold still so the page text looks sharp.";
  return "Ready to capture.";
}

export async function loadScannerEngine({ signal, timeoutMs } = {}) {
  throwIfAborted(signal);
  if (!scannerEnginePromise && scannerEngineRetryAfter > Date.now()) {
    throw scannerEngineLastError || new Error("Automatic page edges are temporarily unavailable.");
  }
  if (!scannerEnginePromise) {
    const pending = import("@opencvjs/web")
      .then((module) => module.loadOpenCV())
      .catch((error) => {
        if (scannerEnginePromise === pending) scannerEnginePromise = null;
        scannerEngineLastError = error;
        scannerEngineRetryAfter = Date.now() + SCANNER_ENGINE_RETRY_DELAY_MS;
        throw error;
      });
    scannerEnginePromise = pending;
  }
  const pending = scannerEnginePromise;
  try {
    const engine = await withAbort(withTimeout(pending, timeoutMs, () => {
      if (scannerEnginePromise === pending) scannerEnginePromise = null;
    }), signal);
    scannerEngineLastError = null;
    scannerEngineRetryAfter = 0;
    return engine;
  } catch (error) {
    if (error?.name === "TimeoutError") {
      scannerEngineLastError = error;
      scannerEngineRetryAfter = Date.now() + SCANNER_ENGINE_RETRY_DELAY_MS;
    }
    throw error;
  }
}

export function defaultScanCorners() {
  return cornerArray({
    topLeft: { x: 0.02, y: 0.02 },
    topRight: { x: 0.98, y: 0.02 },
    bottomRight: { x: 0.98, y: 0.98 },
    bottomLeft: { x: 0.02, y: 0.98 },
  });
}

export async function analyzeCanvas(canvas, cv) {
  assertCanvas(canvas);
  const explicitlyUnavailable = arguments.length >= 2 && !cv;
  if (explicitlyUnavailable) return manualAnalysis(canvas, "Automatic edges are unavailable. Use the guide and corner handles.");
  let engine = cv;
  if (!engine) {
    try {
      engine = await loadScannerEngine({ timeoutMs: 15_000 });
    } catch {
      return manualAnalysis(canvas, "Automatic edges are unavailable. Use the guide and corner handles.");
    }
  }
  const working = cappedCanvas(canvas, { maxPixels: ANALYSIS_MAX_PIXELS, maxLongEdge: ANALYSIS_MAX_EDGE });
  const width = working.canvas.width;
  const height = working.canvas.height;
  let source;
  let gray;
  let blurred;
  let edges;
  let glareMask;
  let contours;
  let hierarchy;
  let best;
  let brightness = 0.5;
  let glareRatio = 0;
  let blurScore = 0;
  try {
    source = engine.imread(working.canvas);
    gray = new engine.Mat();
    blurred = new engine.Mat();
    edges = new engine.Mat();
    contours = new engine.MatVector();
    hierarchy = new engine.Mat();
    engine.cvtColor(source, gray, engine.COLOR_RGBA2GRAY);
    engine.GaussianBlur(gray, blurred, new engine.Size(5, 5), 0, 0, engine.BORDER_DEFAULT);
    engine.Canny(blurred, edges, 60, 180);
    const mean = typeof engine.mean === "function" ? engine.mean(gray) : null;
    brightness = clamp(Number(mean?.[0]) / 255 || 0, 0, 1);
    if (typeof engine.threshold === "function" && typeof engine.countNonZero === "function") {
      glareMask = new engine.Mat();
      engine.threshold(gray, glareMask, 245, 255, engine.THRESH_BINARY);
      glareRatio = clamp(engine.countNonZero(glareMask) / (width * height), 0, 1);
      blurScore = clamp(engine.countNonZero(edges) / (width * height * 0.08), 0, 1);
    }
    engine.findContours(edges, contours, hierarchy, engine.RETR_LIST, engine.CHAIN_APPROX_SIMPLE);

    const frameArea = width * height;
    const minimumArea = frameArea * MIN_DOCUMENT_COVERAGE;
    for (let index = 0; index < contours.size(); index += 1) {
      let contour;
      try {
        contour = contours.get(index);
        const area = Math.abs(engine.contourArea(contour, false));
        if (area < minimumArea || (best && area <= best.area)) continue;
        const perimeter = engine.arcLength(contour, true);
        for (const epsilon of [0.018, 0.025, 0.035]) {
          let approximation;
          try {
            approximation = new engine.Mat();
            engine.approxPolyDP(contour, approximation, perimeter * epsilon, true);
            if (approximation.rows !== 4 || (typeof engine.isContourConvex === "function" && !engine.isContourConvex(approximation))) continue;
            const points = pointsFromContour(approximation);
            if (points.length !== 4) continue;
            const ordered = orderCorners(points);
            const orderedPoints = [ordered.topLeft, ordered.topRight, ordered.bottomRight, ordered.bottomLeft];
            const quadrilateralArea = polygonArea(orderedPoints);
            if (quadrilateralArea < minimumArea) continue;
            best = { area: quadrilateralArea, corners: ordered };
            break;
          } finally {
            safeDelete(approximation);
          }
        }
      } finally {
        safeDelete(contour);
      }
    }

    if (!best) {
      const result = {
        ...manualAnalysis(canvas, "Keep the full sheet inside the guide."),
        manual: false,
        brightness,
        glareRatio,
        blurScore,
        analysisWidth: width,
        analysisHeight: height,
      };
      result.guidance = scanGuidance(result);
      return result;
    }
    const documentCoverage = clamp(best.area / (width * height), 0, 1);
    const result = {
      detected: true,
      manual: false,
      confidence: clamp(0.62 + documentCoverage * 0.55 + blurScore * 0.08 - glareRatio * 0.3, 0, 0.99),
      corners: normalizeDetectedCorners(best.corners, width, height),
      documentCoverage,
      brightness,
      glareRatio,
      blurScore,
      sourceWidth: canvas.width,
      sourceHeight: canvas.height,
      analysisWidth: width,
      analysisHeight: height,
    };
    result.guidance = scanGuidance(result);
    return result;
  } catch {
    return manualAnalysis(canvas, "Automatic edges are unavailable. Use the guide and corner handles.");
  } finally {
    safeDelete(hierarchy);
    safeDelete(contours);
    safeDelete(glareMask);
    safeDelete(edges);
    safeDelete(blurred);
    safeDelete(gray);
    safeDelete(source);
    clearOwnedCanvas(working);
  }
}

export function captureVideoFrame(video) {
  const width = Number(video?.videoWidth);
  const height = Number(video?.videoHeight);
  if (!video || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error("Wait for the camera preview before taking the picture.");
  }
  const fitted = fittedDimensions(width, height, { maxPixels: PROCESSING_MAX_PIXELS, maxLongEdge: PROCESSING_MAX_EDGE });
  const output = createCanvas(fitted.width, fitted.height);
  output.context.drawImage(video, 0, 0, fitted.width, fitted.height);
  return output.canvas;
}

export async function decodeImageFile(file, options = {}) {
  if (!(file instanceof Blob) || !file.size) throw new TypeError("Choose an image file first.");
  const signal = options.signal;
  throwIfAborted(signal);
  if (file.size > MAX_SCAN_SOURCE_IMAGE_BYTES) {
    throw new RangeError(`Camera images must be ${Math.round(MAX_SCAN_SOURCE_IMAGE_BYTES / (1024 * 1024))} MB or smaller.`);
  }
  const fileName = String(file.name || "").toLowerCase();
  const declaredImage = ["image/jpeg", "image/png", "image/webp"].includes(String(file.type || "").toLowerCase());
  const imageExtension = /\.(jpe?g|png|webp)$/i.test(fileName);
  if (!declaredImage && !imageExtension) throw new TypeError("Choose a supported camera image.");
  const metadata = await inspectImageFile(file, signal);
  throwIfAborted(signal);
  if (!(metadata.width > 0) || !(metadata.height > 0) || metadata.width * metadata.height > MAX_SCAN_IMAGE_PIXELS) {
    throw new RangeError(`Page photos must contain no more than ${MAX_SCAN_IMAGE_PIXELS.toLocaleString()} pixels. Use a smaller photo or screenshot.`);
  }
  const fitted = fittedDimensions(metadata.width, metadata.height, { maxPixels: PROCESSING_MAX_PIXELS, maxLongEdge: PROCESSING_MAX_EDGE });
  const resize = fitted.scale < 1 ? { resizeWidth: fitted.width, resizeHeight: fitted.height, resizeQuality: "high" } : null;
  const decoded = await decodedBlob(file, resize, signal);
  let outputCanvas;
  try {
    throwIfAborted(signal);
    if (!(decoded.width > 0) || !(decoded.height > 0)) throw new Error("The selected image has no readable dimensions.");
    const outputSize = fittedDimensions(decoded.width, decoded.height, { maxPixels: PROCESSING_MAX_PIXELS, maxLongEdge: PROCESSING_MAX_EDGE });
    const output = createCanvas(outputSize.width, outputSize.height);
    outputCanvas = output.canvas;
    output.context.drawImage(decoded.source, 0, 0, outputSize.width, outputSize.height);
    throwIfAborted(signal);
    return outputCanvas;
  } catch (error) {
    if (outputCanvas) {
      outputCanvas.width = 1;
      outputCanvas.height = 1;
    }
    throw error;
  } finally {
    decoded.cleanup?.();
  }
}

async function processScanPageFallback(sourceCanvas, corners, options, sourceWidth, sourceHeight) {
  const signal = options.signal;
  throwIfAborted(signal);
  const working = cappedCanvas(sourceCanvas, { maxPixels: PROCESSING_MAX_PIXELS, maxLongEdge: PROCESSING_MAX_EDGE });
  let outputCanvas;
  let previewUrl;
  try {
    const width = working.canvas.width;
    const height = working.canvas.height;
    const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
    const left = clamp(Math.floor(Math.min(...points.map((point) => point.x)) * width), 0, width - 1);
    const top = clamp(Math.floor(Math.min(...points.map((point) => point.y)) * height), 0, height - 1);
    const right = clamp(Math.ceil(Math.max(...points.map((point) => point.x)) * width), left + 1, width);
    const bottom = clamp(Math.ceil(Math.max(...points.map((point) => point.y)) * height), top + 1, height);
    const cropWidth = right - left;
    const cropHeight = bottom - top;
    const requestedMaxEdge = clamp(finiteNumber(options.maxLongEdge, DEFAULT_OUTPUT_MAX_EDGE), 512, PROCESSING_MAX_EDGE);
    const fitted = fittedDimensions(cropWidth, cropHeight, { maxPixels: PROCESSING_MAX_PIXELS, maxLongEdge: requestedMaxEdge });
    if (fitted.width < 32 || fitted.height < 32) throw new RangeError("Move the scan corners farther apart.");

    notify(options.onProgress, "Cleaning page with manual crop…");
    const output = createCanvas(fitted.width, fitted.height);
    outputCanvas = output.canvas;
    const contrast = clamp(finiteNumber(options.contrast, 1.12), 0.5, 2.5);
    const brightness = clamp(finiteNumber(options.brightness, 3), -100, 100);
    if ("filter" in output.context) {
      const filters = [];
      if (options.grayscale !== false) filters.push("grayscale(1)");
      filters.push(`contrast(${contrast})`, `brightness(${Math.max(1, 100 + brightness)}%)`);
      output.context.filter = filters.join(" ");
    }
    output.context.drawImage(working.canvas, left, top, cropWidth, cropHeight, 0, 0, fitted.width, fitted.height);
    output.context.filter = "none";
    throwIfAborted(signal);

    const quality = clamp(finiteNumber(options.jpegQuality, 0.84), 0.68, 0.96);
    const blob = await canvasToBlob(outputCanvas, "image/jpeg", quality, signal);
    throwIfAborted(signal);
    previewUrl = URL.createObjectURL(blob);
    notify(options.onProgress, "Page cleaned and ready.");
    return {
      id: pageIdentifier(),
      blob,
      previewUrl,
      width: outputCanvas.width,
      height: outputCanvas.height,
      byteLength: blob.size,
      mimeType: "image/jpeg",
      quality,
      sourceWidth,
      sourceHeight,
      usedFallback: true,
      released: false,
    };
  } catch (error) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    throw error;
  } finally {
    clearOwnedCanvas(working);
    if (outputCanvas) {
      outputCanvas.width = 1;
      outputCanvas.height = 1;
    }
  }
}

export async function processScanPage(sourceCanvas, normalizedCorners, options = {}) {
  const { width: sourceWidth, height: sourceHeight } = assertCanvas(sourceCanvas, "scan source");
  const signal = options.signal;
  throwIfAborted(signal);
  const corners = normalizedCornerObject(normalizedCorners);
  const engineWasSpecified = Object.prototype.hasOwnProperty.call(options, "engine") || Object.prototype.hasOwnProperty.call(options, "cv");
  let engine = options.engine || options.cv;
  if (!engine && !engineWasSpecified) {
    try {
      engine = await loadScannerEngine({ signal, timeoutMs: finiteNumber(options.engineTimeoutMs, 15_000) });
    } catch (error) {
      if (error?.name === "AbortError" || signal?.aborted) throw error;
    }
  }
  if (!engine) return processScanPageFallback(sourceCanvas, corners, options, sourceWidth, sourceHeight);

  notify(options.onProgress, "Straightening and cleaning page…");
  const working = cappedCanvas(sourceCanvas, { maxPixels: PROCESSING_MAX_PIXELS, maxLongEdge: PROCESSING_MAX_EDGE });
  const pixelCorners = {
    topLeft: { x: corners.topLeft.x * working.canvas.width, y: corners.topLeft.y * working.canvas.height },
    topRight: { x: corners.topRight.x * working.canvas.width, y: corners.topRight.y * working.canvas.height },
    bottomRight: { x: corners.bottomRight.x * working.canvas.width, y: corners.bottomRight.y * working.canvas.height },
    bottomLeft: { x: corners.bottomLeft.x * working.canvas.width, y: corners.bottomLeft.y * working.canvas.height },
  };
  const rawWidth = Math.max(distance(pixelCorners.topLeft, pixelCorners.topRight), distance(pixelCorners.bottomLeft, pixelCorners.bottomRight));
  const rawHeight = Math.max(distance(pixelCorners.topLeft, pixelCorners.bottomLeft), distance(pixelCorners.topRight, pixelCorners.bottomRight));
  const requestedMaxEdge = clamp(finiteNumber(options.maxLongEdge, DEFAULT_OUTPUT_MAX_EDGE), 512, PROCESSING_MAX_EDGE);
  const fitted = fittedDimensions(rawWidth, rawHeight, { maxPixels: PROCESSING_MAX_PIXELS, maxLongEdge: requestedMaxEdge });
  if (fitted.width < 32 || fitted.height < 32) {
    clearOwnedCanvas(working);
    throw new RangeError("Move the scan corners farther apart.");
  }

  let source;
  let sourceTriangle;
  let destinationTriangle;
  let transform;
  let warped;
  let gray;
  let adjusted;
  let outputCanvas;
  let previewUrl;
  let processingError;
  try {
    throwIfAborted(signal);
    source = engine.imread(working.canvas);
    throwIfAborted(signal);
    sourceTriangle = engine.matFromArray(4, 1, engine.CV_32FC2, [
      pixelCorners.topLeft.x, pixelCorners.topLeft.y,
      pixelCorners.topRight.x, pixelCorners.topRight.y,
      pixelCorners.bottomRight.x, pixelCorners.bottomRight.y,
      pixelCorners.bottomLeft.x, pixelCorners.bottomLeft.y,
    ]);
    destinationTriangle = engine.matFromArray(4, 1, engine.CV_32FC2, [
      0, 0,
      fitted.width - 1, 0,
      fitted.width - 1, fitted.height - 1,
      0, fitted.height - 1,
    ]);
    transform = engine.getPerspectiveTransform(sourceTriangle, destinationTriangle);
    warped = new engine.Mat();
    engine.warpPerspective(
      source,
      warped,
      transform,
      new engine.Size(fitted.width, fitted.height),
      engine.INTER_LINEAR,
      engine.BORDER_CONSTANT,
      new engine.Scalar(255, 255, 255, 255),
    );
    throwIfAborted(signal);

    const grayscale = options.grayscale !== false;
    const contrast = clamp(finiteNumber(options.contrast, 1.12), 0.5, 2.5);
    const brightness = clamp(finiteNumber(options.brightness, 3), -100, 100);
    if (grayscale) {
      gray = new engine.Mat();
      engine.cvtColor(warped, gray, engine.COLOR_RGBA2GRAY);
      adjusted = new engine.Mat();
      gray.convertTo(adjusted, -1, contrast, brightness);
    } else {
      adjusted = new engine.Mat();
      warped.convertTo(adjusted, -1, contrast, brightness);
    }

    throwIfAborted(signal);
    const output = createCanvas(fitted.width, fitted.height);
    outputCanvas = output.canvas;
    engine.imshow(outputCanvas, adjusted);
    throwIfAborted(signal);
  } catch (error) {
    processingError = error;
  } finally {
    safeDelete(adjusted);
    safeDelete(gray);
    safeDelete(warped);
    safeDelete(transform);
    safeDelete(destinationTriangle);
    safeDelete(sourceTriangle);
    safeDelete(source);
    clearOwnedCanvas(working);
  }

  if (processingError) {
    if (processingError?.name === "AbortError" || signal?.aborted) throw processingError;
    return processScanPageFallback(sourceCanvas, corners, options, sourceWidth, sourceHeight);
  }

  try {
    throwIfAborted(signal);
    const quality = clamp(finiteNumber(options.jpegQuality, 0.84), 0.68, 0.96);
    const blob = await canvasToBlob(outputCanvas, "image/jpeg", quality, signal);
    throwIfAborted(signal);
    previewUrl = URL.createObjectURL(blob);
    return {
      id: pageIdentifier(),
      blob,
      previewUrl,
      width: outputCanvas.width,
      height: outputCanvas.height,
      byteLength: blob.size,
      mimeType: "image/jpeg",
      quality,
      sourceWidth,
      sourceHeight,
      usedFallback: false,
      released: false,
    };
  } catch (error) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    throw error;
  } finally {
    if (outputCanvas) {
      outputCanvas.width = 1;
      outputCanvas.height = 1;
    }
  }
}

async function resolvedOcrAssetPaths(options, signal) {
  throwIfAborted(signal);
  const configured = { ...DEFAULT_OCR_ASSET_PATHS, ...(options.assetPaths || {}) };
  const resolver = options.resolveAssetPath;
  const resolved = {};
  for (const key of ["workerPath", "corePath", "langPath"]) {
    const candidate = typeof resolver === "function"
      ? await withAbort(Promise.resolve().then(() => resolver(key, configured[key])), signal)
      : configured[key];
    throwIfAborted(signal);
    if (!candidate) throw new Error(`A same-origin ${key} is required for OCR.`);
    if (typeof window === "undefined") throw new Error("OCR requires a browser window.");
    const url = new URL(String(candidate), window.location.href);
    if (url.origin !== window.location.origin) throw new Error(`${key} must use the EdNotebook origin.`);
    if ((key === "corePath" || key === "langPath") && !url.pathname.endsWith("/")) url.pathname += "/";
    resolved[key] = url.href;
  }
  return resolved;
}

export async function recognizeScanPages(pages, options = {}) {
  validatePages(pages);
  const signal = options.signal;
  throwIfAborted(signal);
  const assetPaths = await resolvedOcrAssetPaths(options, signal);
  throwIfAborted(signal);
  const tesseractModule = await withAbort(import("tesseract.js"), signal);
  throwIfAborted(signal);
  const tesseract = tesseractModule.default || tesseractModule;
  const createWorker = tesseractModule.createWorker || tesseract.createWorker;
  const oem = (tesseractModule.OEM || tesseract.OEM)?.LSTM_ONLY ?? 1;
  if (typeof createWorker !== "function") throw new Error("The OCR worker could not be loaded.");

  let worker;
  let workerStartup;
  let currentPage = 0;
  const recognitionStartedAt = Date.now();
  const pageTimeoutMs = Math.max(5_000, finiteNumber(options.pageTimeoutMs, 45_000));
  const totalTimeoutMs = Math.max(pageTimeoutMs, finiteNumber(options.totalTimeoutMs, 180_000));
  const workerTimeoutMs = Math.min(totalTimeoutMs, Math.max(5_000, finiteNumber(options.workerTimeoutMs, 45_000)));
  let abortRequested = false;
  let startupAbandoned = false;
  const workerTerminations = new Map();
  const terminateWorkerInstance = (candidate) => {
    if (!candidate || typeof candidate.terminate !== "function") return Promise.resolve();
    if (workerTerminations.has(candidate)) return workerTerminations.get(candidate);
    const termination = Promise.resolve()
      .then(() => candidate.terminate())
      .catch(() => { /* worker may already be stopped */ });
    workerTerminations.set(candidate, termination);
    return termination;
  };
  const terminateWorker = async () => terminateWorkerInstance(worker);
  const terminateStartupWhenReady = () => {
    startupAbandoned = true;
    if (!workerStartup) return;
    void workerStartup.then(
      (lateWorker) => terminateWorkerInstance(lateWorker),
      () => {},
    );
  };
  const handleAbort = () => {
    abortRequested = true;
    terminateStartupWhenReady();
    void terminateWorker();
  };
  signal?.addEventListener("abort", handleAbort, { once: true });

  try {
    workerStartup = Promise.resolve().then(() => {
      throwIfAborted(signal);
      return createWorker(options.language || "eng", oem, {
      ...assetPaths,
        workerBlobURL: false,
        gzip: options.gzip !== false,
        logger: (message) => {
          if (startupAbandoned || abortRequested || signal?.aborted) return;
          const pageProgress = clamp(finiteNumber(message.progress, 0), 0, 1);
        const payload = {
          stage: "ocr",
          pageIndex: currentPage,
          pageCount: pages.length,
          status: message.status,
          pageProgress,
          progress: clamp((currentPage + pageProgress) / pages.length, 0, 1),
        };
        const percent = Math.round(pageProgress * 100);
        notify(options.onProgress, progressValue(
          options,
          payload,
          `Reading page ${Math.min(currentPage + 1, pages.length)} of ${pages.length}… ${percent}%`,
        ));
      },
      });
    });
    worker = await withAbort(
      withTimeout(
        workerStartup,
        workerTimeoutMs,
        terminateStartupWhenReady,
        `Text recognition could not start within ${Math.round(workerTimeoutMs / 1_000)} seconds. Try the scan again.`,
      ),
      signal,
      terminateStartupWhenReady,
    );
    if (startupAbandoned || abortRequested || signal?.aborted) {
      await terminateWorkerInstance(worker);
      throw signal?.reason instanceof Error ? signal.reason : abortError();
    }
    notify(options.onWorker, worker);
    throwIfAborted(signal);
    const parameterTimeoutMs = Math.min(15_000, totalTimeoutMs - (Date.now() - recognitionStartedAt));
    if (parameterTimeoutMs <= 0) throw timeoutError("Text recognition reached its startup limit. Try a smaller scan.");
    await withAbort(
      withTimeout(
        Promise.resolve().then(() => worker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" })),
        parameterTimeoutMs,
        () => { void terminateWorker(); },
        "Text recognition could not finish preparing. Try the scan again.",
      ),
      signal,
      () => { void terminateWorker(); },
    );
    throwIfAborted(signal);

    const recognizedPages = [];
    let characterCount = 0;
    for (let index = 0; index < pages.length; index += 1) {
      throwIfAborted(signal);
      currentPage = index;
      const startingPayload = { stage: "ocr", status: "recognizing text", pageIndex: index, pageCount: pages.length, pageProgress: 0, progress: index / pages.length };
      notify(options.onProgress, progressValue(options, startingPayload, `Reading page ${index + 1} of ${pages.length}…`));
      const remainingMs = totalTimeoutMs - (Date.now() - recognitionStartedAt);
      if (remainingMs <= 0) throw timeoutError("Text recognition reached its three-minute limit. Review the pages, then try a smaller scan.");
      const timeoutMs = Math.min(pageTimeoutMs, remainingMs);
      const result = await withAbort(
        withTimeout(
          Promise.resolve().then(() => worker.recognize(pages[index].blob, { rotateAuto: true })),
          timeoutMs,
          () => { void terminateWorker(); },
          `Text recognition took too long on page ${index + 1}. Retake that page more closely or use a smaller scan.`,
        ),
        signal,
        () => { void terminateWorker(); },
      );
      throwIfAborted(signal);
      const text = String(result?.data?.text || "").replace(/\r\n?/g, "\n").trim();
      characterCount += text.length + (recognizedPages.length ? 2 : 0);
      if (characterCount > MAX_SCAN_OCR_CHARACTERS) throw new RangeError(`OCR is limited to ${MAX_SCAN_OCR_CHARACTERS.toLocaleString()} characters.`);
      recognizedPages.push({
        pageId: pages[index].id || String(index + 1),
        pageNumber: index + 1,
        text,
        confidence: Number(result?.data?.confidence) || 0,
      });
      const completePayload = { stage: "ocr", status: "page complete", pageIndex: index, pageCount: pages.length, pageProgress: 1, progress: (index + 1) / pages.length };
      notify(options.onProgress, progressValue(options, completePayload, `Finished reading page ${index + 1} of ${pages.length}.`));
      await nextPaint();
      throwIfAborted(signal);
    }

    const text = recognizedPages.map((page) => page.text).filter(Boolean).join("\n\n");
    const detailedResult = { text, pages: recognizedPages, characters: text.length, language: options.language || "eng" };
    return options.detailed === true ? detailedResult : text;
  } catch (error) {
    if (abortRequested || signal?.aborted) throw signal?.reason instanceof Error ? signal.reason : abortError();
    throw error;
  } finally {
    signal?.removeEventListener("abort", handleAbort);
    await terminateWorker();
    notify(options.onWorker, null);
  }
}

async function recompressPage(page, settings, signal) {
  throwIfAborted(signal);
  const decoded = await decodedBlob(page.blob, null, signal);
  let outputCanvas;
  try {
    throwIfAborted(signal);
    const fitted = fittedDimensions(decoded.width, decoded.height, {
      maxPixels: PROCESSING_MAX_PIXELS,
      maxLongEdge: Math.min(PROCESSING_MAX_EDGE, settings.maxLongEdge),
    });
    const output = createCanvas(fitted.width, fitted.height);
    outputCanvas = output.canvas;
    output.context.drawImage(decoded.source, 0, 0, fitted.width, fitted.height);
    throwIfAborted(signal);
    const blob = await canvasToBlob(outputCanvas, "image/jpeg", settings.quality, signal);
    const bytes = new Uint8Array(await withAbort(blob.arrayBuffer(), signal));
    throwIfAborted(signal);
    return { bytes, width: fitted.width, height: fitted.height, byteLength: bytes.byteLength };
  } finally {
    decoded.cleanup?.();
    if (outputCanvas) {
      outputCanvas.width = 1;
      outputCanvas.height = 1;
    }
  }
}

function pdfPageSize(width, height) {
  const longEdge = 792;
  if (width >= height) return { width: longEdge, height: Math.max(72, longEdge * (height / width)), orientation: "landscape" };
  return { width: Math.max(72, longEdge * (width / height)), height: longEdge, orientation: "portrait" };
}

function makePdf(jsPDF, encodedPages, signal) {
  throwIfAborted(signal);
  const firstSize = pdfPageSize(encodedPages[0].width, encodedPages[0].height);
  const pdf = new jsPDF({
    orientation: firstSize.orientation,
    unit: "pt",
    format: [firstSize.width, firstSize.height],
    compress: true,
    putOnlyUsedFonts: true,
    precision: 2,
  });
  encodedPages.forEach((page, index) => {
    throwIfAborted(signal);
    const size = pdfPageSize(page.width, page.height);
    if (index > 0) pdf.addPage([size.width, size.height], size.orientation);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(page.bytes, "JPEG", 0, 0, pageWidth, pageHeight, `scan-page-${index}`, "FAST");
  });
  return pdf;
}

export async function buildScanPdf(pages, options = {}) {
  validatePages(pages);
  const signal = options.signal;
  throwIfAborted(signal);
  const jsPdfModule = await withAbort(import("jspdf"), signal);
  const jsPDF = jsPdfModule.jsPDF || jsPdfModule.default?.jsPDF;
  if (typeof jsPDF !== "function") throw new Error("The PDF creator could not be loaded.");
  const startedAt = Date.now();
  const timeoutMs = Math.max(10_000, finiteNumber(options.timeoutMs, 45_000));

  for (let attempt = 0; attempt < PDF_COMPRESSION_CURVE.length; attempt += 1) {
    const settings = PDF_COMPRESSION_CURVE[attempt];
    const encodedPages = [];
    let encodedBytes = 0;
    let tooLarge = false;
    try {
      for (let index = 0; index < pages.length; index += 1) {
        throwIfAborted(signal);
        if (Date.now() - startedAt > timeoutMs) throw timeoutError("Combining the scanned pages took too long. Remove a page or finish this scan in two parts.");
        notify(options.onProgress, {
          stage: "pdf",
          status: attempt ? "reducing file size" : "building PDF",
          attempt: attempt + 1,
          pageIndex: index,
          pageCount: pages.length,
          progress: index / pages.length,
          quality: settings.quality,
        });
        const encoded = await recompressPage(pages[index], settings, signal);
        encodedPages.push(encoded);
        encodedBytes += encoded.byteLength;
        if (encodedBytes > MAX_SCAN_PDF_BYTES * 1.08) {
          tooLarge = true;
          break;
        }
        await nextPaint();
      }
      if (tooLarge || encodedPages.length !== pages.length) continue;

      throwIfAborted(signal);
      const pdf = makePdf(jsPDF, encodedPages, signal);
      const arrayBuffer = pdf.output("arraybuffer");
      throwIfAborted(signal);
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      if (blob.size <= MAX_SCAN_PDF_BYTES) {
        const fileName = "syllabus-scan.pdf";
        const file = typeof File === "function" ? new File([blob], fileName, { type: "application/pdf", lastModified: Date.now() }) : null;
        notify(options.onProgress, {
          stage: "pdf",
          status: "complete",
          attempt: attempt + 1,
          pageIndex: pages.length - 1,
          pageCount: pages.length,
          progress: 1,
          quality: settings.quality,
        });
        return {
          blob,
          file,
          byteLength: blob.size,
          pageCount: pages.length,
          quality: settings.quality,
          maxLongEdge: settings.maxLongEdge,
          attempts: attempt + 1,
          recompressed: attempt > 0,
          fileName,
        };
      }
    } finally {
      encodedPages.length = 0;
    }
    await nextPaint();
  }

  throw new RangeError(`The scanned PDF could not be reduced below ${Math.round(MAX_SCAN_PDF_BYTES / (1024 * 1024))} MB. Remove a page or scan it again.`);
}

export function releaseScanPage(page) {
  if (!page || typeof page !== "object" || page.released) return;
  if (page.previewUrl && typeof URL !== "undefined") {
    try { URL.revokeObjectURL(page.previewUrl); } catch { /* ignore an already-revoked URL */ }
  }
  page.previewUrl = "";
  page.blob = null;
  page.byteLength = 0;
  page.released = true;
}
