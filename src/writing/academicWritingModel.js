const ACADEMIC_DESIGNS = Object.freeze([
  {
    id: "blank-college-paper",
    name: "Blank college paper",
    description: "A clean, numbered page with familiar academic margins.",
  },
  {
    id: "apa-student-paper",
    name: "APA student paper",
    description: "Title page, double-spaced body, and hanging-indent references.",
  },
  {
    id: "mla-college-paper",
    name: "MLA college paper",
    description: "Student heading, centered title, body, and Works Cited page.",
  },
  {
    id: "research-paper",
    name: "Research paper",
    description: "Cover page, abstract, body sections, and references.",
  },
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function page(content, className = "") {
  const classes = ["document-page", "numbered-page", className]
    .filter(Boolean)
    .join(" ");
  return `<section class="${classes}">${content}</section>`;
}

function academicDesignHtml(designId, {
  studentName = "Student Name",
  courseName = "Course Name",
  instructorName = "Instructor Name",
  dueDate = "Due Date",
  title = "Paper Title",
} = {}) {
  const safe = {
    studentName: escapeHtml(studentName),
    courseName: escapeHtml(courseName),
    instructorName: escapeHtml(instructorName),
    dueDate: escapeHtml(dueDate),
    title: escapeHtml(title),
  };
  if (designId === "apa-student-paper") {
    return [
      page(`<div class="document-cover-block"><h1>${safe.title}</h1><p>${safe.studentName}</p><p>${safe.courseName}</p><p>${safe.instructorName}</p><p>${safe.dueDate}</p></div>`, "document-cover-page"),
      page(`<h1 class="document-centered-title">${safe.title}</h1><p>Begin the paper here. Introduce the topic, establish the purpose, and guide the reader into the first section.</p><h2>First section</h2><p>Develop the claim with evidence and explanation.</p>`),
      page('<h1 class="document-centered-title">References</h1><p class="hanging-indent">Author, A. A. (Year). <em>Title of work</em>. Publisher or Site. https://example.com</p>', "document-references-page"),
    ].join("");
  }
  if (designId === "mla-college-paper") {
    return [
      page(`<p>${safe.studentName}<br>${safe.instructorName}<br>${safe.courseName}<br>${safe.dueDate}</p><h1 class="document-centered-title">${safe.title}</h1><p>Begin the paper here. Use evidence, introduce quotations, and explain how each source supports the argument.</p>`),
      page('<h1 class="document-centered-title">Works Cited</h1><p class="hanging-indent">Author Last, First. <em>Title of Work</em>. Publisher, Year. URL.</p>', "document-references-page"),
    ].join("");
  }
  if (designId === "research-paper") {
    return [
      page(`<div class="document-cover-block"><h1>${safe.title}</h1><p>${safe.studentName}</p><p>${safe.courseName}</p><p>${safe.instructorName}</p><p>${safe.dueDate}</p></div>`, "document-cover-page"),
      page('<h1 class="document-centered-title">Abstract</h1><p>Briefly state the problem, approach, major finding, and significance.</p><p><strong>Keywords:</strong> keyword one, keyword two, keyword three</p>'),
      page(`<h1 class="document-centered-title">${safe.title}</h1><h2>Introduction</h2><p>Define the research problem and explain why it matters.</p><h2>Evidence and analysis</h2><p>Organize evidence into clear sections and connect every source to the research question.</p><h2>Conclusion</h2><p>Answer the research question and identify the implications or next steps.</p>`),
      page('<h1 class="document-centered-title">References</h1><p class="hanging-indent">Author, A. A. (Year). <em>Title of work</em>. Publisher or Site. https://example.com</p>', "document-references-page"),
    ].join("");
  }
  return page("<p><br></p>");
}

function hasMeaningfulDocumentContent(value) {
  return String(value || "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .trim().length > 0;
}

function ensurePagedDocument(value) {
  const html = String(value || "").trim();
  if (!html) return academicDesignHtml("blank-college-paper");
  return /class=(["'])[^"']*\bdocument-page\b/iu.test(html)
    ? html
    : page(html);
}

function buildReferenceEntryHtml(citation, url = "") {
  const safeCitation = escapeHtml(citation || "Add the formatted reference here.");
  const safeUrl = /^https?:\/\//iu.test(String(url || "")) ? escapeHtml(url) : "";
  return `<p class="hanging-indent">${safeCitation}${safeUrl ? ` <a href="${safeUrl}">${safeUrl}</a>` : ""}</p>`;
}

function analyzeAcademicWriting(value) {
  const text = String(value || "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) {
    return [{
      id: "empty",
      level: "info",
      title: "Start with one clear sentence",
      detail: "EdNotebook will check organization and common writing patterns as the draft grows.",
    }];
  }
  const findings = [];
  if (/\b(\p{L}+)\s+\1\b/iu.test(text)) {
    findings.push({
      id: "repeated-word",
      level: "warning",
      title: "Possible repeated word",
      detail: "Read the highlighted area aloud and remove an accidental duplicate.",
    });
  }
  if (/\s{2,}/u.test(String(value || "").replace(/<[^>]+>/gu, " "))) {
    findings.push({
      id: "double-space",
      level: "suggestion",
      title: "Extra spacing found",
      detail: "Use paragraph spacing controls instead of repeated spaces.",
    });
  }
  const sentences = text.split(/(?<=[.!?])\s+/u).filter(Boolean);
  const longSentence = sentences.find((sentence) => sentence.split(/\s+/u).length > 35);
  if (longSentence) {
    findings.push({
      id: "long-sentence",
      level: "suggestion",
      title: "A sentence may be doing too much",
      detail: "One sentence is longer than 35 words. Check whether it contains two ideas that deserve separate sentences.",
    });
  }
  const paragraphs = String(value || "")
    .split(/<\/p>|<br\s*\/?>\s*<br\s*\/?>/iu)
    .map((paragraph) => paragraph.replace(/<[^>]+>/gu, " ").trim())
    .filter(Boolean);
  if (paragraphs.some((paragraph) => paragraph.split(/\s+/u).length > 220)) {
    findings.push({
      id: "long-paragraph",
      level: "suggestion",
      title: "Long paragraph",
      detail: "A paragraph exceeds 220 words. Check for a natural topic shift or a second claim.",
    });
  }
  if (!findings.length) {
    findings.push({
      id: "clear-pass",
      level: "success",
      title: "No common pattern issue found",
      detail: "This is a writing aid, not a correctness guarantee. Keep checking evidence, meaning, and assignment requirements.",
    });
  }
  return findings;
}

export {
  ACADEMIC_DESIGNS,
  academicDesignHtml,
  analyzeAcademicWriting,
  buildReferenceEntryHtml,
  ensurePagedDocument,
  hasMeaningfulDocumentContent,
};
