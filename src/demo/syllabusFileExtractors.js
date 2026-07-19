import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

const TEXT_FILE_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const PDF_FILE_TYPE = "application/pdf";
const DOCX_FILE_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const MAX_DOCUMENT_FILE_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 250_000;
const MAX_PDF_PAGES = 60;
const MAX_DOCX_ENTRIES = 1_000;
const MAX_DOCX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_DOCX_COMPRESSION_RATIO = 250;
const PDF_EXTRACTION_TIMEOUT_MS = 60_000;
const DOCX_EXTRACTION_TIMEOUT_MS = 20_000;

class SyllabusFileError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "SyllabusFileError";
    this.code = code;
  }
}

function fileExtension(name = "") {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/u);
  return match?.[1] || "";
}

function getSyllabusFileKind(file) {
  const extension = fileExtension(file?.name);
  const type = String(file?.type || "").toLowerCase();
  if (type === PDF_FILE_TYPE || extension === "pdf") return "pdf";
  if (type === DOCX_FILE_TYPE || extension === "docx") return "docx";
  if (extension === "doc" || type === "application/msword") return "legacy-doc";
  if (TEXT_FILE_TYPES.has(type) || ["txt", "md", "csv"].includes(extension)) return "text";
  return "unknown";
}

function assertNotAborted(signal) {
  if (!signal?.aborted) return;
  throw new DOMException("Syllabus reading was canceled.", "AbortError");
}

function assertPdfSignature(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer, 0, Math.min(arrayBuffer.byteLength, 1_024));
  let header = "";
  for (const byte of bytes) header += String.fromCharCode(byte);
  if (!header.includes("%PDF-")) {
    throw new SyllabusFileError("invalid-pdf-signature", "This file does not contain a valid PDF header. Export a fresh PDF copy, then try again.");
  }
}

function findZipDirectoryEnd(view) {
  const signature = 0x06054b50;
  const earliest = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }
  return -1;
}

function validateDocxContainer(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) {
    throw new SyllabusFileError("invalid-docx-signature", "This file is not a valid Word DOCX document. Save a fresh .docx copy in Word, then try again.");
  }

  const directoryEnd = findZipDirectoryEnd(view);
  if (directoryEnd < 0) {
    throw new SyllabusFileError("invalid-docx-container", "The Word document is incomplete or damaged. Save a fresh .docx copy, then try again.");
  }

  const diskNumber = view.getUint16(directoryEnd + 4, true);
  const directoryDisk = view.getUint16(directoryEnd + 6, true);
  const entriesOnDisk = view.getUint16(directoryEnd + 8, true);
  const entryCount = view.getUint16(directoryEnd + 10, true);
  const directorySize = view.getUint32(directoryEnd + 12, true);
  const directoryOffset = view.getUint32(directoryEnd + 16, true);
  if (diskNumber !== 0 || directoryDisk !== 0 || entriesOnDisk !== entryCount || entryCount === 0xffff || directoryOffset === 0xffffffff) {
    throw new SyllabusFileError("unsupported-docx-container", "This Word document uses an unsupported archive format. Save a fresh standard .docx copy, then try again.");
  }
  if (entryCount > MAX_DOCX_ENTRIES) {
    throw new SyllabusFileError("docx-too-complex", "This Word document contains too many internal files. Remove embedded media or split the syllabus, then try again.");
  }
  if (directoryOffset + directorySize > directoryEnd || directoryOffset + directorySize > view.byteLength) {
    throw new SyllabusFileError("invalid-docx-container", "The Word document is incomplete or damaged. Save a fresh .docx copy, then try again.");
  }

  const decoder = new TextDecoder("utf-8");
  let cursor = directoryOffset;
  let totalCompressed = 0;
  let totalExpanded = 0;
  let hasContentTypes = false;
  let hasDocumentXml = false;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > view.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new SyllabusFileError("invalid-docx-container", "The Word document directory is damaged. Save a fresh .docx copy, then try again.");
    }
    const flags = view.getUint16(cursor + 8, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const expandedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const nextCursor = cursor + 46 + nameLength + extraLength + commentLength;
    if (nextCursor > view.byteLength || compressedSize === 0xffffffff || expandedSize === 0xffffffff) {
      throw new SyllabusFileError("unsupported-docx-container", "This Word document uses an unsupported archive format. Save a fresh standard .docx copy, then try again.");
    }
    if (flags & 0x0001) {
      throw new SyllabusFileError("encrypted-docx", "This Word document is encrypted. Remove its password from a copy, then upload that copy.");
    }
    const nameBytes = new Uint8Array(arrayBuffer, cursor + 46, nameLength);
    const entryName = decoder.decode(nameBytes).replaceAll("\\", "/");
    hasContentTypes ||= entryName === "[Content_Types].xml";
    hasDocumentXml ||= entryName === "word/document.xml";
    totalCompressed += compressedSize;
    totalExpanded += expandedSize;
    if (totalExpanded > MAX_DOCX_EXPANDED_BYTES) {
      throw new SyllabusFileError("docx-expanded-too-large", "This Word document expands beyond 50 MB. Remove embedded media or split the syllabus, then try again.");
    }
    cursor = nextCursor;
  }

  if (!hasContentTypes || !hasDocumentXml) {
    throw new SyllabusFileError("invalid-docx-structure", "This file does not contain a readable Word document. Save a fresh .docx copy, then try again.");
  }
  if (totalCompressed > 0 && totalExpanded / totalCompressed > MAX_DOCX_COMPRESSION_RATIO) {
    throw new SyllabusFileError("unsafe-docx-compression", "This Word document is compressed unusually heavily and cannot be opened safely. Save a fresh .docx copy, then try again.");
  }
}

function extractDocxInWorker(arrayBuffer, { signal }) {
  if (signal?.aborted) return Promise.reject(new DOMException("Syllabus reading was canceled.", "AbortError"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./syllabusDocxWorker.js", import.meta.url), { type: "module", name: "ednotebook-docx-reader" });
    let settled = false;
    let timeoutId;

    function settle(callback, value) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      callback(value);
    }

    function handleAbort() {
      settle(reject, new DOMException("Syllabus reading was canceled.", "AbortError"));
    }

    worker.onmessage = (event) => {
      if (event.data?.type === "complete") settle(resolve, event.data);
      else settle(reject, new Error(event.data?.message || "The Word document could not be read."));
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      settle(reject, new Error(event.message || "The Word document reader stopped unexpectedly."));
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    timeoutId = window.setTimeout(() => {
      settle(reject, new SyllabusFileError("docx-timeout", "The Word document took too long to read. Remove large embedded media or split it, then try again."));
    }, DOCX_EXTRACTION_TIMEOUT_MS);
    worker.postMessage({ arrayBuffer }, [arrayBuffer]);
  });
}

function normalizeExtractedText(value) {
  return String(value || "")
    .replaceAll("\u0000", "")
    .replaceAll("\u00a0", " ")
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

function validateExtractedText(text, kind) {
  const normalized = normalizeExtractedText(text);
  if (!normalized) {
    if (kind === "pdf") {
      throw new SyllabusFileError("no-selectable-text", "No selectable text was found in this PDF. Open Scan paper syllabus and choose its page photos so EdNotebook can read them here.");
    }
    if (kind === "text") throw new SyllabusFileError("empty-document", "This text syllabus is empty. Choose a file with course text or paste the syllabus into the editor.");
    throw new SyllabusFileError("empty-document", "No readable text was found in this Word document. Check the file, then save a fresh DOCX copy and try again.");
  }
  if (normalized.length > MAX_EXTRACTED_CHARACTERS) {
    throw new SyllabusFileError("too-much-text", "The extracted syllabus is longer than 250,000 characters. Split it into smaller files so the review screen stays responsive.");
  }
  return normalized;
}

function pdfPageToText(items) {
  let output = "";
  let previousY = null;
  for (const item of items) {
    if (typeof item?.str !== "string") continue;
    const currentY = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
    const changedLine = previousY != null && Number.isFinite(currentY) && Math.abs(currentY - previousY) > 2;
    if (changedLine && output && !output.endsWith("\n")) output += "\n";
    else if (output && !/[\s-]$/u.test(output) && item.str && !/^[,.;:!?)]/u.test(item.str)) output += " ";
    output += item.str;
    if (item.hasEOL && !output.endsWith("\n")) output += "\n";
    if (Number.isFinite(currentY)) previousY = currentY;
  }
  return normalizeExtractedText(output);
}

function validateFile(file, kind) {
  if (kind === "legacy-doc") {
    throw new SyllabusFileError("legacy-word", "Older .doc files cannot be read safely in the browser. Open the file in Word and choose Save As → Word Document (.docx), then upload that copy.");
  }
  if (kind === "unknown") {
    throw new SyllabusFileError("unsupported-type", "Upload a PDF, Word DOCX, TXT, Markdown, or CSV syllabus.");
  }
  const sizeLimit = kind === "text" ? MAX_TEXT_FILE_BYTES : MAX_DOCUMENT_FILE_BYTES;
  if (file.size > sizeLimit) {
    const limitLabel = kind === "text" ? "1 MB" : "15 MB";
    throw new SyllabusFileError("file-too-large", `This ${kind === "docx" ? "Word" : kind.toUpperCase()} file is larger than ${limitLabel}. Split or compress it, then try again.`);
  }
}

async function extractTextFile(file, { signal, onProgress }) {
  onProgress?.("Reading text syllabus…");
  assertNotAborted(signal);
  const value = await file.text();
  assertNotAborted(signal);
  return { text: validateExtractedText(value, "text"), detail: "Text syllabus" };
}

async function extractPdfFile(file, { signal, onProgress }) {
  onProgress?.("Opening PDF…");
  assertNotAborted(signal);
  const arrayBuffer = await file.arrayBuffer();
  assertNotAborted(signal);
  assertPdfSignature(arrayBuffer);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  assertNotAborted(signal);
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const appBase = import.meta.env.BASE_URL || "/";
  const standardFontDataUrl = new URL(`${appBase.endsWith("/") ? appBase : `${appBase}/`}pdfjs/standard_fonts/`, window.location.href).href;
  const data = new Uint8Array(arrayBuffer);
  let loadingTask;
  let document;
  let timeoutId;
  let timedOut = false;
  const interrupt = () => { void loadingTask?.destroy?.().catch(() => {}); };
  const handleAbort = () => interrupt();
  try {
    loadingTask = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, standardFontDataUrl });
    signal?.addEventListener("abort", handleAbort, { once: true });
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      interrupt();
    }, PDF_EXTRACTION_TIMEOUT_MS);
    document = await loadingTask.promise;
    if (document.numPages > MAX_PDF_PAGES) {
      throw new SyllabusFileError("too-many-pages", `This PDF has ${document.numPages} pages. Upload ${MAX_PDF_PAGES} pages or fewer, or split the syllabus into sections.`);
    }
    const pages = [];
    let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      assertNotAborted(signal);
      onProgress?.(`Reading PDF page ${pageNumber} of ${document.numPages}…`);
      const page = await document.getPage(pageNumber);
      let pageText = "";
      try {
        const content = await page.getTextContent({ includeMarkedContent: false });
        pageText = pdfPageToText(content.items);
      } finally {
        page.cleanup();
      }
      pages.push(pageText);
      characterCount += pageText.length;
      if (characterCount > MAX_EXTRACTED_CHARACTERS) {
        throw new SyllabusFileError("too-much-text", "The extracted syllabus is longer than 250,000 characters. Split the PDF so the review screen stays responsive.");
      }
    }
    return {
      text: validateExtractedText(pages.filter(Boolean).join("\n\n"), "pdf"),
      detail: `${document.numPages} PDF page${document.numPages === 1 ? "" : "s"}`,
    };
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Syllabus reading was canceled.", "AbortError");
    if (timedOut) {
      throw new SyllabusFileError("pdf-timeout", "The PDF took longer than one minute to read. Split it into smaller sections, then try again.", error);
    }
    if (error?.name === "AbortError" || error instanceof SyllabusFileError) throw error;
    if (error?.name === "PasswordException") {
      throw new SyllabusFileError("password-protected", "This PDF is password protected. Remove the password from a copy, then upload that copy.", error);
    }
    if (["InvalidPDFException", "MissingPDFException", "UnexpectedResponseException"].includes(error?.name)) {
      throw new SyllabusFileError("invalid-pdf", "The PDF could not be opened. Download or export a fresh PDF copy, then try again.", error);
    }
    throw new SyllabusFileError("pdf-read-failed", "The PDF text could not be read. Try a fresh exported PDF, or paste its text into the editor.", error);
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleAbort);
    try {
      if (document) await document.destroy();
      else await loadingTask?.destroy?.();
    } catch {
      // The worker may already be destroyed by a cancel or timeout.
    }
  }
}

async function extractDocxFile(file, { signal, onProgress }) {
  onProgress?.("Reading Word document…");
  assertNotAborted(signal);
  try {
    const arrayBuffer = await file.arrayBuffer();
    assertNotAborted(signal);
    validateDocxContainer(arrayBuffer);
    assertNotAborted(signal);
    const result = await extractDocxInWorker(arrayBuffer, { signal });
    assertNotAborted(signal);
    const warnings = (result.messages || []).filter((message) => message.type === "warning").map((message) => message.message);
    return {
      text: validateExtractedText(result.value, "docx"),
      detail: warnings.length ? `Word document · ${warnings.length} reading warning${warnings.length === 1 ? "" : "s"}` : "Word document",
      warnings,
    };
  } catch (error) {
    if (error?.name === "AbortError" || error instanceof SyllabusFileError) throw error;
    throw new SyllabusFileError("docx-read-failed", "The Word document could not be read. Save a fresh .docx copy in Word, then try again.", error);
  }
}

async function extractSyllabusFile(file, options = {}) {
  const kind = getSyllabusFileKind(file);
  validateFile(file, kind);
  if (kind === "pdf") return { ...(await extractPdfFile(file, options)), kind };
  if (kind === "docx") return { ...(await extractDocxFile(file, options)), kind };
  return { ...(await extractTextFile(file, options)), kind };
}

export {
  DOCX_FILE_TYPE,
  MAX_DOCUMENT_FILE_BYTES,
  MAX_EXTRACTED_CHARACTERS,
  MAX_PDF_PAGES,
  MAX_TEXT_FILE_BYTES,
  PDF_FILE_TYPE,
  SyllabusFileError,
  extractSyllabusFile,
  getSyllabusFileKind,
  normalizeExtractedText,
  pdfPageToText,
};
