import { emptyEduBookLearningLayer } from "./edubookLearningModel.js";

export const EDUBOOK_VERSION = "EduBook/1.0";

function cleanTitle(value, fallback) {
  return String(value || "").trim() || fallback;
}

export function textToEduBook({ title, author, sourceText, description = "", readingMode = "interactive" }) {
  const normalized = String(sourceText || "").replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const chapters = [];
  let current = { title: "Opening", blocks: [] };

  function commit() {
    if (current.blocks.length || chapters.length === 0) {
      chapters.push({
        id: crypto.randomUUID(),
        title: cleanTitle(current.title, `Chapter ${chapters.length + 1}`),
        blocks: current.blocks,
        knowledgeChecks: [],
        discussionPrompts: [],
      });
    }
  }

  let paragraph = [];
  function commitParagraph() {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) current.blocks.push({ id: crypto.randomUUID(), type: "paragraph", text });
    paragraph = [];
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    const markdownHeading = trimmed.match(/^#{1,3}\s+(.+)/);
    const numberedHeading = trimmed.match(/^(?:chapter|unit|part)\s+\d+[\s:.-]+(.+)/i);
    if (markdownHeading || numberedHeading) {
      commitParagraph();
      if (current.blocks.length) commit();
      current = { title: markdownHeading?.[1] || numberedHeading?.[1] || trimmed, blocks: [] };
      return;
    }
    if (!trimmed) {
      commitParagraph();
      return;
    }
    paragraph.push(trimmed);
  });
  commitParagraph();
  commit();

  const words = normalized ? normalized.split(/\s+/).length : 0;
  return {
    format: EDUBOOK_VERSION,
    title: cleanTitle(title, "Untitled interactive book"),
    author: cleanTitle(author, "Unknown author"),
    description,
    language: "en",
    source: { type: "text", importedAt: new Date().toISOString(), words },
    rights: { confirmed: false, statement: "" },
    learningDesign: {
      mode: readingMode === "read_only" ? "read-only" : "interactive-reading",
      annotations: true,
      bookmarks: true,
      progress: true,
      checks: readingMode !== "read_only",
      quizzes: readingMode !== "read_only",
      discussion: readingMode !== "read_only",
    },
    learningLayer: emptyEduBookLearningLayer(),
    chapters,
  };
}

export function readingProgress(chapterIndex, chapterCount) {
  if (!chapterCount) return 0;
  return Math.round(((chapterIndex + 1) / chapterCount) * 100);
}

export function eduBookDownload(manifest) {
  const content = JSON.stringify(manifest, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${String(manifest.title || "edubook").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.edubook.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
