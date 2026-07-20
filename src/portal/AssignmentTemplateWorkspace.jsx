import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceWindowBar } from "../FullscreenSurface.jsx";
import {
  listAssignmentCourses,
  listAssignmentTemplates,
  loadAssignmentSubmission,
  saveAssignmentSubmission,
  saveAssignmentTemplate,
} from "./assignmentTemplateService.js";

const SECTION_TYPES = [
  { id: "short", label: "Short answer", description: "A focused one- or two-sentence response." },
  { id: "long", label: "Long response", description: "A larger writing area with an optional word target." },
  { id: "reflection", label: "Reflection", description: "A prompt for evidence, reasoning, or self-review." },
  { id: "checklist", label: "Checklist response", description: "A structured list students can complete in their own words." },
  { id: "heading", label: "Section heading", description: "Organize the template without asking for an answer." },
];

const PAPER_FORMATS = [
  { id: "general", label: "General academic paper" },
  { id: "apa", label: "APA-style layout" },
  { id: "mla", label: "MLA-style layout" },
];

const DEFAULT_COVER_FIELDS = [
  { id: "paper_title", label: "Paper title", required: true },
  { id: "student_name", label: "Student name", required: true },
  { id: "course", label: "Course", required: true },
  { id: "professor", label: "Professor or teacher", required: false },
  { id: "due_date", label: "Due date", required: false },
];

function defaultPaperStructure() {
  return {
    enabled: true,
    format: "general",
    allow_freestyle: true,
    cover_page: false,
    cover_fields: DEFAULT_COVER_FIELDS.map((field) => ({ ...field })),
    naming_convention: "{last-name}_{assignment}_{date}",
    page_numbers: "top-right",
    header_text: "",
    footer_text: "",
    include_references: false,
    references_required: false,
    references_title: "References",
    include_appendix: false,
    appendix_required: false,
    appendix_title: "Appendix",
  };
}

function paperStructureFor(template) {
  const saved = template?.editor_config?.paper_structure || {};
  return {
    ...defaultPaperStructure(),
    ...saved,
    cover_fields: Array.isArray(saved.cover_fields) && saved.cover_fields.length
      ? saved.cover_fields
      : DEFAULT_COVER_FIELDS.map((field) => ({ ...field })),
  };
}

function paperAnswersFor(answers) {
  const saved = answers?.__paper;
  return {
    mode: saved?.mode === "freestyle" ? "freestyle" : "structured",
    cover: saved?.cover && typeof saved.cover === "object" ? saved.cover : {},
    transitions: saved?.transitions && typeof saved.transitions === "object" ? saved.transitions : {},
    references: String(saved?.references || ""),
    appendix: String(saved?.appendix || ""),
  };
}

function writingModeFor(template, answers) {
  const config = paperStructureFor(template);
  if (!config.enabled) return "guided";
  const freeStyleAvailable = config.allow_freestyle && template?.editor_config?.full_page_editor !== false;
  return paperAnswersFor(answers).mode === "freestyle" && freeStyleAvailable ? "freestyle" : "structured";
}

function updatePaperAnswers(setAnswers, patch) {
  setAnswers((current) => ({
    ...current,
    __paper: { ...paperAnswersFor(current), ...patch },
  }));
}

function createSection(type = "long") {
  const definition = SECTION_TYPES.find((item) => item.id === type) || SECTION_TYPES[1];
  return {
    id: crypto.randomUUID(),
    type,
    prompt: type === "heading" ? "New section" : definition.label,
    helpText: definition.description,
    required: type !== "heading",
    wordTarget: type === "long" || type === "reflection" ? 150 : 0,
    wordLimit: 0,
    headingLevel: type === "heading" ? 1 : 2,
    includeInPaper: true,
    transitionPrompt: "Connect this section to the next idea.",
  };
}

function createTemplate(track, courseId, status = "draft") {
  const k12 = track === "k12";
  return {
    id: `device-${crypto.randomUUID()}`,
    course_id: courseId,
    title: k12 ? "Evidence Paragraph Builder" : "Source Analysis Response",
    instructions: k12
      ? "Work through each section, then use the full-page editor to put the response together."
      : "Complete the guided sections, then develop the final response in the full-page writing workspace.",
    sections: [
      { ...createSection("short"), prompt: k12 ? "What is your main claim?" : "State the central claim you will evaluate." },
      { ...createSection("long"), prompt: k12 ? "Which evidence supports your claim?" : "Summarize the strongest evidence from the source.", wordTarget: 120 },
      { ...createSection("reflection"), prompt: k12 ? "Explain how the evidence connects to your claim." : "Explain the limits, context, or competing interpretation.", wordTarget: 150 },
    ],
    editor_config: {
      full_page_editor: true,
      spellcheck: true,
      allow_word_export: true,
      allow_pdf_export: true,
      word_limit: 0,
      paper_structure: defaultPaperStructure(),
    },
    status,
    updated_at: new Date().toISOString(),
  };
}

function loadJson(key, fallback) {
  try { return JSON.parse(window.localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function saveJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function countWords(value) {
  const text = String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeRichHtml(value) {
  const parsed = new DOMParser().parseFromString(String(value || ""), "text/html");
  const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "DIV", "SPAN", "FONT", "A"]);
  const safeStyleProperties = new Set(["color", "background-color", "font-family", "font-size", "text-align", "margin-left", "line-height"]);
  [...parsed.body.querySelectorAll("*")].forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (node.tagName === "A" && name === "href" && /^(https?:|mailto:)/i.test(attribute.value)) return;
      if (node.tagName === "FONT" && ["color", "face", "size"].includes(name)) return;
      if (name === "style") {
        const safeStyle = attribute.value.split(";").map((declaration) => declaration.trim()).filter(Boolean).filter((declaration) => safeStyleProperties.has(declaration.split(":")[0]?.trim().toLowerCase())).join("; ");
        if (safeStyle) { node.setAttribute("style", safeStyle); return; }
      }
      node.removeAttribute(attribute.name);
    });
  });
  return parsed.body.innerHTML;
}

function plainTextToHtml(value) {
  const text = String(value || "").trim();
  if (!text) return "<p></p>";
  return text.split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
}

function structuredWordCount(template, answers) {
  const paper = paperAnswersFor(answers);
  const includedSections = template.sections.filter((section) => section.type !== "heading" && section.includeInPaper !== false);
  const sectionText = includedSections.map((section) => answers[section.id] || "").join(" ");
  const transitions = includedSections.map((section) => paper.transitions[section.id] || "").join(" ");
  return countWords(`${sectionText} ${transitions} ${paper.references} ${paper.appendix}`);
}

function localDateStamp() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function exportFileBaseName(template, answers) {
  const config = paperStructureFor(template);
  const paper = paperAnswersFor(answers);
  const studentName = String(paper.cover.student_name || "").trim();
  const nameParts = studentName.split(/\s+/).filter(Boolean);
  const values = {
    "first-name": nameParts[0] || "student",
    "last-name": nameParts.at(-1) || "student",
    assignment: paper.cover.paper_title || template.title || "assignment",
    course: paper.cover.course || "course",
    date: localDateStamp(),
  };
  const pattern = config.naming_convention || "{last-name}_{assignment}_{date}";
  const named = pattern.replace(/\{(first-name|last-name|assignment|course|date)\}/g, (_, token) => values[token]);
  return named.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "") || "assignment";
}

function assignmentExportHtml(template, answers, documentContent) {
  const config = paperStructureFor(template);
  const paper = paperAnswersFor(answers);
  const writingMode = writingModeFor(template, answers);
  const format = PAPER_FORMATS.some((item) => item.id === config.format) ? config.format : "general";
  const coverFields = config.cover_fields.map((field) => {
    const fallback = field.id === "paper_title" ? template.title : "";
    const value = String(paper.cover[field.id] || fallback).trim();
    if (!value && !field.required) return "";
    return `<p class="cover-field"><span>${escapeHtml(field.label)}</span>${escapeHtml(value)}</p>`;
  }).join("");
  const cover = config.cover_page ? `<section class="cover-page">${coverFields}</section>` : "";
  const orderedSections = template.sections.filter((section) => section.includeInPaper !== false).map((section) => {
    const headingLevel = Math.min(3, Math.max(1, Number(section.headingLevel) || (section.type === "heading" ? 1 : 2)));
    const heading = `<h${headingLevel}>${escapeHtml(section.prompt)}</h${headingLevel}>`;
    if (section.type === "heading") return `<section class="paper-section paper-heading">${heading}</section>`;
    const transition = String(paper.transitions[section.id] || "").trim();
    return `<section class="paper-section">${heading}${plainTextToHtml(answers[section.id])}${transition ? `<p class="paper-transition">${escapeHtml(transition)}</p>` : ""}</section>`;
  }).join("");
  const references = config.include_references
    ? `<section class="paper-section paper-references"><h1>${escapeHtml(config.references_title || "References")}</h1>${plainTextToHtml(paper.references)}</section>`
    : "";
  const appendix = config.include_appendix
    ? `<section class="paper-section paper-appendix"><h1>${escapeHtml(config.appendix_title || "Appendix")}</h1>${plainTextToHtml(paper.appendix)}</section>`
    : "";
  const freeStyle = sanitizeRichHtml(documentContent) || "<p></p>";
  const legacyGuided = `${orderedSections}<section class="paper-section legacy-full-response"><h1>Full response</h1>${freeStyle}</section>`;
  const paperTitle = paper.cover.paper_title || template.title;
  const title = config.cover_page ? "" : `<h1 class="paper-title">${escapeHtml(paperTitle)}</h1>`;
  const pageNumber = config.page_numbers === "none" ? "" : `<span class="page-number" aria-label="Page number"></span>`;
  const header = (config.header_text || config.page_numbers === "top-right") ? `<header class="paper-running-header"><span>${escapeHtml(config.header_text || "")}</span>${config.page_numbers === "top-right" ? pageNumber : ""}</header>` : "";
  const footer = (config.footer_text || config.page_numbers === "bottom-center") ? `<footer class="paper-running-footer"><span>${escapeHtml(config.footer_text || "")}</span>${config.page_numbers === "bottom-center" ? pageNumber : ""}</footer>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(paperTitle)}</title><style>
    @page{size:auto;margin:1in}.paper-document{max-width:7.25in;margin:0 auto;color:#17233b}.paper-document.is-general{font:12pt/1.6 Georgia,serif}.paper-document.is-apa,.paper-document.is-mla{font:12pt/2 "Times New Roman",serif}.paper-title{text-align:center;margin:0 0 2rem}.paper-section h1,.paper-section h2,.paper-section h3{margin:1.4rem 0 .45rem;line-height:1.25}.paper-section h1{text-align:center;font-size:12pt}.paper-section h2{font-size:12pt}.paper-section h3{font-size:12pt;font-style:italic}.paper-section p{margin:0 0 .8rem}.paper-transition{font-style:normal}.cover-page{min-height:8.4in;display:flex;flex-direction:column;justify-content:center;text-align:center;break-after:page;page-break-after:always}.cover-field{margin:.35rem 0}.cover-field span{display:none}.paper-references,.paper-appendix{break-before:page;page-break-before:always}.paper-running-header,.paper-running-footer{display:flex;justify-content:space-between;gap:1rem;font:10pt/1.2 Arial,sans-serif}.paper-running-footer{justify-content:center}.page-number::after{content:counter(page)}
    .paper-references p{padding-left:.5in;text-indent:-.5in}.legacy-full-response{margin-top:2rem;padding-top:1rem;border-top:1px solid #ccd3df}
    @media print{body{margin:0}.paper-document{max-width:none}.paper-running-header{position:fixed;top:-.55in;left:0;right:0}.paper-running-footer{position:fixed;bottom:-.55in;left:0;right:0}}
  </style></head><body><article class="paper-document is-${format}">${header}${footer}${cover}${title}${writingMode === "structured" ? orderedSections : writingMode === "freestyle" ? freeStyle : legacyGuided}${references}${appendix}</article></body></html>`;
}

function downloadWord(template, answers, documentContent) {
  const blob = new Blob([assignmentExportHtml(template, answers, documentContent)], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${exportFileBaseName(template, answers)}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openPdfExport(template, answers, documentContent) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Allow the print window, then choose Save as PDF.");
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(assignmentExportHtml(template, answers, documentContent));
  printWindow.document.close();
  printWindow.addEventListener("load", () => printWindow.print(), { once: true });
}

function PaperStructureDrawer({ template, setTemplate, answers, setAnswers, mode, onClose, onSelectSection, onModeChange }) {
  const config = paperStructureFor(template);
  const paper = paperAnswersFor(answers || {});
  const [draggedId, setDraggedId] = useState("");
  const responseSections = template.sections.filter((section) => section.type !== "heading" && section.includeInPaper !== false);
  const completedSections = responseSections.filter((section) => String(answers?.[section.id] || "").trim()).length;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function updateConfig(patch) {
    setTemplate?.({
      ...template,
      editor_config: {
        ...template.editor_config,
        paper_structure: { ...config, ...patch },
      },
    });
  }

  function updateSection(sectionId, patch) {
    setTemplate?.({ ...template, sections: template.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) });
  }

  function moveSection(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= template.sections.length) return;
    const next = [...template.sections];
    [next[index], next[target]] = [next[target], next[index]];
    setTemplate?.({ ...template, sections: next });
  }

  function dropSection(targetId) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...template.sections];
    const from = next.findIndex((section) => section.id === draggedId);
    const to = next.findIndex((section) => section.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTemplate?.({ ...template, sections: next });
    setDraggedId("");
  }

  function updateCoverField(fieldId, patch) {
    updateConfig({ cover_fields: config.cover_fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) });
  }

  function openStudentSection(sectionId) {
    if (["references", "appendix"].includes(sectionId)) {
      document.getElementById(`paper-meta-${sectionId}`)?.focus();
      return;
    }
    if (config.enabled && writingModeFor(template, answers) === "freestyle") {
      updatePaperAnswers(setAnswers, { mode: "structured" });
      onModeChange?.("structured");
    }
    onSelectSection?.(sectionId);
  }

  return <div className="paper-structure-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="paper-structure-drawer" role="dialog" aria-modal="true" aria-labelledby="paper-structure-title">
      <header><div><span className="portal-kicker">PAPER WORKSPACE</span><h2 id="paper-structure-title">{mode === "professor" ? "Design the paper structure" : "Paper structure and outline"}</h2></div><button type="button" autoFocus aria-label="Close paper structure" onClick={onClose}>Close paper structure</button></header>
      {mode === "professor" ? <div className="paper-structure-body">
        <section className="paper-structure-settings"><h3>Paper setup</h3><p>These choices save with this template and shape the student's ordered export.</p>
          <label className="paper-structure-switch"><input type="checkbox" checked={config.enabled} onChange={(event) => updateConfig({ enabled: event.target.checked })} />Build the final paper from completed sections</label>
          <label>Paper format<select value={config.format} onChange={(event) => updateConfig({ format: event.target.value })}>{PAPER_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select></label>
          <label className="paper-structure-switch"><input type="checkbox" checked={config.allow_freestyle} onChange={(event) => updateConfig({ allow_freestyle: event.target.checked })} />Allow a free-style writing page</label>
          <label className="paper-structure-switch"><input type="checkbox" checked={config.cover_page} onChange={(event) => updateConfig({ cover_page: event.target.checked })} />Include a cover page</label>
          {config.cover_page && <div className="paper-cover-field-builder"><strong>Cover-page fields</strong>{config.cover_fields.map((field) => <div key={field.id}><input aria-label="Cover field label" spellCheck value={field.label} onChange={(event) => updateCoverField(field.id, { label: event.target.value })} /><label><input type="checkbox" checked={field.required} onChange={(event) => updateCoverField(field.id, { required: event.target.checked })} />Required</label><button type="button" onClick={() => updateConfig({ cover_fields: config.cover_fields.filter((item) => item.id !== field.id) })}>Remove cover field</button></div>)}<button type="button" onClick={() => updateConfig({ cover_fields: [...config.cover_fields, { id: `field_${crypto.randomUUID()}`, label: "New cover field", required: false }] })}>Add cover field</button></div>}
          <label>Downloaded file name pattern<input spellCheck={false} value={config.naming_convention} onChange={(event) => updateConfig({ naming_convention: event.target.value })} /><small>Available: {"{first-name}"}, {"{last-name}"}, {"{course}"}, {"{assignment}"}, {"{date}"}</small></label>
          <label>Page numbers<select value={config.page_numbers} onChange={(event) => updateConfig({ page_numbers: event.target.value })}><option value="none">No page numbers</option><option value="top-right">Top right</option><option value="bottom-center">Bottom center</option></select></label>
          <label>Running header<input spellCheck value={config.header_text} onChange={(event) => updateConfig({ header_text: event.target.value })} placeholder="Optional header text" /></label>
          <label>Running footer<input spellCheck value={config.footer_text} onChange={(event) => updateConfig({ footer_text: event.target.value })} placeholder="Optional footer text" /></label>
          <div className="paper-structure-paired"><label><input type="checkbox" checked={config.include_references} onChange={(event) => updateConfig({ include_references: event.target.checked })} />Include references page</label>{config.include_references && <><input aria-label="References heading" spellCheck value={config.references_title} onChange={(event) => updateConfig({ references_title: event.target.value })} /><label><input type="checkbox" checked={config.references_required} onChange={(event) => updateConfig({ references_required: event.target.checked })} />References required</label></>}</div>
          <div className="paper-structure-paired"><label><input type="checkbox" checked={config.include_appendix} onChange={(event) => updateConfig({ include_appendix: event.target.checked })} />Include appendix</label>{config.include_appendix && <><input aria-label="Appendix heading" spellCheck value={config.appendix_title} onChange={(event) => updateConfig({ appendix_title: event.target.value })} /><label><input type="checkbox" checked={config.appendix_required} onChange={(event) => updateConfig({ appendix_required: event.target.checked })} />Appendix required</label></>}</div>
          <small className="paper-export-note">The selected layout, section order, headers, footers, and page-number placement are written into the Word-compatible .doc and print/PDF outputs. Always review the final pagination before submission.</small>
        </section>
        <section className="paper-outline-builder"><div><h3>Paper outline</h3><button type="button" onClick={() => setTemplate({ ...template, sections: [...template.sections, createSection("long")] })}>Add paper section</button></div><p>Drag a section or use the move buttons. Heading levels control the exported outline.</p>
          <ol>{template.sections.map((section, index) => <li key={section.id} onDragOver={(event) => event.preventDefault()} onDrop={() => dropSection(section.id)}><button type="button" className="paper-drag-handle" draggable onDragStart={() => setDraggedId(section.id)} onDragEnd={() => setDraggedId("")} aria-label={`Drag ${section.prompt} to reorder`}>Drag section</button><div><input aria-label={`Section ${index + 1} heading`} spellCheck value={section.prompt} onChange={(event) => updateSection(section.id, { prompt: event.target.value })} /><div><label>Heading level<select value={section.headingLevel || (section.type === "heading" ? 1 : 2)} onChange={(event) => updateSection(section.id, { headingLevel: Number(event.target.value) })}><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select></label>{section.type !== "heading" && <label><input type="checkbox" checked={section.required} onChange={(event) => updateSection(section.id, { required: event.target.checked })} />Required</label>}<label><input type="checkbox" checked={section.includeInPaper !== false} onChange={(event) => updateSection(section.id, { includeInPaper: event.target.checked })} />Include in export</label></div></div><div className="paper-outline-actions"><button type="button" disabled={index === 0} onClick={() => moveSection(index, -1)}>Move section up</button><button type="button" disabled={index === template.sections.length - 1} onClick={() => moveSection(index, 1)}>Move section down</button><button type="button" onClick={() => setTemplate({ ...template, sections: template.sections.filter((item) => item.id !== section.id) })}>Remove section</button></div></li>)}</ol>
        </section>
      </div> : <div className="paper-structure-body is-student">
        <section className="paper-writing-mode"><h3>{config.enabled ? "Choose how to write" : "Guided assignment format"}</h3>{config.enabled ? <><div><button type="button" className={writingModeFor(template, answers) === "structured" ? "is-active" : ""} onClick={() => { updatePaperAnswers(setAnswers, { mode: "structured" }); onModeChange?.("structured"); }}>Write by paper section</button><button type="button" disabled={!config.allow_freestyle || template.editor_config.full_page_editor === false} className={writingModeFor(template, answers) === "freestyle" ? "is-active" : ""} onClick={() => { updatePaperAnswers(setAnswers, { mode: "freestyle" }); onModeChange?.("freestyle"); }}>Use free-style page</button></div><p>{writingModeFor(template, answers) === "structured" ? "Your completed sections are assembled in this outline order when you save or export." : "Your free-style writing page is used as the paper body when you export."}</p></> : <p>Your guided answers and full response are both kept in the exported assignment. The professor can turn on structured paper assembly in the template.</p>}</section>
        {config.cover_page && <section className="paper-cover-fields"><h3>Cover-page details</h3>{config.cover_fields.map((field) => <label key={field.id}>{field.label}{field.required && <sup>Required</sup>}<input spellCheck value={paper.cover[field.id] || ""} placeholder={field.id === "paper_title" ? template.title : ""} onChange={(event) => updatePaperAnswers(setAnswers, { cover: { ...paper.cover, [field.id]: event.target.value } })} /></label>)}</section>}
        {(config.include_references || config.include_appendix) && <section className="paper-end-matter-fields"><h3>References and appendix</h3><p>These saved pages follow the paper body in both structured and free-style exports.</p>{config.include_references && <label>{config.references_title || "References"}{config.references_required && <sup>Required</sup>}<textarea id="paper-meta-references" spellCheck={template.editor_config.spellcheck} rows={7} value={paper.references} onChange={(event) => updatePaperAnswers(setAnswers, { references: event.target.value })} /></label>}{config.include_appendix && <label>{config.appendix_title || "Appendix"}{config.appendix_required && <sup>Required</sup>}<textarea id="paper-meta-appendix" spellCheck={template.editor_config.spellcheck} rows={7} value={paper.appendix} onChange={(event) => updatePaperAnswers(setAnswers, { appendix: event.target.value })} /></label>}</section>}
        <section className="paper-student-outline"><div><h3>Outline and completion</h3><strong>{completedSections} of {responseSections.length} sections started</strong></div><progress max={Math.max(1, responseSections.length)} value={completedSections}>{completedSections} of {responseSections.length}</progress><ol>{template.sections.filter((section) => section.includeInPaper !== false).map((section, index) => { const complete = section.type === "heading" || Boolean(String(answers?.[section.id] || "").trim()); return <li key={section.id}><button type="button" onClick={() => openStudentSection(section.id)}><span>{complete ? "Complete" : section.required ? "Required" : "Optional"}</span><strong>{index + 1}. {section.prompt}</strong><small>Heading {section.headingLevel || (section.type === "heading" ? 1 : 2)}</small></button></li>; })}{config.include_references && <li><button type="button" onClick={() => openStudentSection("references")}><span>{paper.references.trim() ? "Complete" : config.references_required ? "Required" : "Optional"}</span><strong>{config.references_title || "References"}</strong><small>Final page</small></button></li>}{config.include_appendix && <li><button type="button" onClick={() => openStudentSection("appendix")}><span>{paper.appendix.trim() ? "Complete" : config.appendix_required ? "Required" : "Optional"}</span><strong>{config.appendix_title || "Appendix"}</strong><small>Final page</small></button></li>}</ol></section>
        <section className="paper-export-summary"><h3>Saved export setup</h3><dl><div><dt>Format</dt><dd>{PAPER_FORMATS.find((item) => item.id === config.format)?.label || "General academic paper"}</dd></div><div><dt>File name</dt><dd>{exportFileBaseName(template, answers)}.doc</dd></div><div><dt>Page numbers</dt><dd>{config.page_numbers === "none" ? "Off" : config.page_numbers === "top-right" ? "Top right" : "Bottom center"}</dd></div><div><dt>Final pages</dt><dd>{[config.include_references && config.references_title, config.include_appendix && config.appendix_title].filter(Boolean).join(", ") || "None added"}</dd></div></dl></section>
      </div>}
    </aside>
  </div>;
}

function TemplateBuilder({ template, setTemplate, onSave, onPreview, busy }) {
  const [newType, setNewType] = useState("long");
  const [showPaperStructure, setShowPaperStructure] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState("");

  function updateSection(sectionId, patch) {
    setTemplate({ ...template, sections: template.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) });
  }

  function moveSection(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= template.sections.length) return;
    const next = [...template.sections];
    [next[index], next[target]] = [next[target], next[index]];
    setTemplate({ ...template, sections: next });
  }

  function dropSection(targetId) {
    if (!draggedSectionId || draggedSectionId === targetId) return;
    const next = [...template.sections];
    const from = next.findIndex((section) => section.id === draggedSectionId);
    const to = next.findIndex((section) => section.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTemplate({ ...template, sections: next });
    setDraggedSectionId("");
  }

  return <>
    <div className="assignment-template-builder">
      <section className="dashboard-card template-details-card">
        <span className="portal-kicker">TEMPLATE DETAILS</span><h2>Build the assignment once.</h2><p>Students answer inside EdNotebook instead of downloading a blank document.</p>
        <button className="paper-structure-launch" type="button" onClick={() => setShowPaperStructure(true)}>Customize paper structure</button>
        <small className="paper-structure-status">{paperStructureFor(template).enabled ? "Structured paper export on" : "Guided form export"} · cover, headings, file name, headers, footers, references, and appendix</small>
        <label>Template title<input spellCheck value={template.title} onChange={(event) => setTemplate({ ...template, title: event.target.value })} /></label>
        <label>Student instructions<textarea spellCheck rows={4} value={template.instructions} onChange={(event) => setTemplate({ ...template, instructions: event.target.value })} /></label>
        <label>Full response maximum words <small>Use 0 for no limit.</small><input type="number" min="0" max="50000" value={template.editor_config.word_limit || 0} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, word_limit: Number(event.target.value) } })} /></label>
        <div className="template-option-grid"><label><input type="checkbox" checked={template.editor_config.full_page_editor} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, full_page_editor: event.target.checked } })} />Include full-page writing workspace</label><label><input type="checkbox" checked={template.editor_config.allow_word_export} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, allow_word_export: event.target.checked } })} />Allow Word-compatible .doc export</label><label><input type="checkbox" checked={template.editor_config.allow_pdf_export} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, allow_pdf_export: event.target.checked } })} />Allow PDF print preview</label><label><input type="checkbox" checked={template.editor_config.spellcheck} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, spellcheck: event.target.checked } })} />Spelling check on</label></div>
      </section>
      <section className="dashboard-card template-section-builder">
        <div className="dashboard-card-heading"><div><span className="portal-kicker">CUSTOM SECTIONS</span><h2>Shape the response.</h2></div><div className="template-add-control"><select aria-label="New section type" value={newType} onChange={(event) => setNewType(event.target.value)}>{SECTION_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select><button type="button" onClick={() => setTemplate({ ...template, sections: [...template.sections, createSection(newType)] })}>Add assignment section</button></div></div>
        <div className="template-section-list">{template.sections.map((section, index) => <article key={section.id} className="template-section-card" onDragOver={(event) => event.preventDefault()} onDrop={() => dropSection(section.id)}><header><span>{String(index + 1).padStart(2, "0")} · {SECTION_TYPES.find((type) => type.id === section.type)?.label}</span><div><button className="template-section-drag" type="button" draggable onDragStart={() => setDraggedSectionId(section.id)} onDragEnd={() => setDraggedSectionId("")} aria-label={`Drag ${section.prompt} to reorder`}>Drag section</button><button type="button" aria-label="Move section up" disabled={index === 0} onClick={() => moveSection(index, -1)}>Move up</button><button type="button" aria-label="Move section down" disabled={index === template.sections.length - 1} onClick={() => moveSection(index, 1)}>Move down</button><button type="button" onClick={() => setTemplate({ ...template, sections: template.sections.filter((item) => item.id !== section.id) })}>Remove section</button></div></header><label>{section.type === "heading" ? "Heading" : "Prompt"}<input spellCheck value={section.prompt} onChange={(event) => updateSection(section.id, { prompt: event.target.value })} /></label><label>Student guidance<textarea spellCheck rows={2} value={section.helpText} onChange={(event) => updateSection(section.id, { helpText: event.target.value })} /></label>{section.type !== "heading" && <><label>Transition guidance<input spellCheck value={section.transitionPrompt || ""} onChange={(event) => updateSection(section.id, { transitionPrompt: event.target.value })} /></label><div className="template-section-options"><label><input type="checkbox" checked={section.required} onChange={(event) => updateSection(section.id, { required: event.target.checked })} />Required</label>{["long", "reflection"].includes(section.type) && <label>Word target<input type="number" min="0" max="5000" value={section.wordTarget || 0} onChange={(event) => updateSection(section.id, { wordTarget: Number(event.target.value) })} /></label>}<label>Maximum words<input type="number" min="0" max="5000" value={section.wordLimit || 0} onChange={(event) => updateSection(section.id, { wordLimit: Number(event.target.value) })} /></label></div></>}</article>)}</div>
        <footer className="template-builder-actions"><button type="button" onClick={onPreview}>Preview template as student</button><button type="button" disabled={busy} onClick={() => onSave("draft")}>Save template draft</button><button className="primary" type="button" disabled={busy} onClick={() => onSave("published")}>Publish template to class</button></footer>
      </section>
    </div>
    {showPaperStructure && <PaperStructureDrawer template={template} setTemplate={setTemplate} mode="professor" onClose={() => setShowPaperStructure(false)} />}
  </>;
}

function GuidedAnswerFields({ template, answers, setAnswers, includePaperTools = true, idPrefix = "paper-section" }) {
  const config = paperStructureFor(template);
  const paper = paperAnswersFor(answers);
  const structured = includePaperTools && writingModeFor(template, answers) === "structured";
  const responseSectionIds = template.sections.filter((section) => section.type !== "heading" && section.includeInPaper !== false).map((section) => section.id);
  const lastResponseId = responseSectionIds.at(-1);
  return <div className="guided-answer-fields">{template.sections.map((section, index) => {
    if (section.type === "heading") return <h2 id={`${idPrefix}-${section.id}`} key={section.id}>{section.prompt}</h2>;
    const value = answers[section.id] || "";
    const isShort = section.type === "short";
    const words = countWords(value);
    const overLimit = section.wordLimit > 0 && words > section.wordLimit;
    return <section id={`${idPrefix}-${section.id}`} key={section.id} className={overLimit ? "is-over-limit" : ""}><div><span>{String(index + 1).padStart(2, "0")}</span><h3>{section.prompt}{section.required && <sup>Required</sup>}</h3></div><p>{section.helpText}</p>{isShort ? <input lang="en" spellCheck={template.editor_config.spellcheck} value={value} onChange={(event) => setAnswers((current) => ({ ...current, [section.id]: event.target.value }))} /> : <textarea lang="en" spellCheck={template.editor_config.spellcheck} rows={section.type === "checklist" ? 5 : 8} value={value} onChange={(event) => setAnswers((current) => ({ ...current, [section.id]: event.target.value }))} />}<small>{words} words{section.wordTarget ? ` · target ${section.wordTarget}` : ""}{section.wordLimit ? ` · maximum ${section.wordLimit}` : ""}{overLimit ? " · shorten before submitting" : ""}</small>{structured && section.includeInPaper !== false && section.id !== lastResponseId && <label className="paper-transition-field">Transition into the next section<textarea lang="en" spellCheck={template.editor_config.spellcheck} rows={3} value={paper.transitions[section.id] || ""} placeholder={section.transitionPrompt || "Connect this section to the next idea."} onChange={(event) => updatePaperAnswers(setAnswers, { transitions: { ...paper.transitions, [section.id]: event.target.value } })} /><small>This text is placed after this section in the final paper.</small></label>}</section>;
  })}{structured && config.include_references && <section id={`${idPrefix}-references`} className="paper-final-section"><div><span>END</span><h3>{config.references_title || "References"}{config.references_required && <sup>Required</sup>}</h3></div><p>Add each source on its own line or paragraph. The saved paper format controls the page layout.</p><textarea lang="en" spellCheck={template.editor_config.spellcheck} rows={8} value={paper.references} onChange={(event) => updatePaperAnswers(setAnswers, { references: event.target.value })} /></section>}{structured && config.include_appendix && <section id={`${idPrefix}-appendix`} className="paper-final-section"><div><span>END</span><h3>{config.appendix_title || "Appendix"}{config.appendix_required && <sup>Required</sup>}</h3></div><p>Add the appendix content that should follow the references or final paper section.</p><textarea lang="en" spellCheck={template.editor_config.spellcheck} rows={8} value={paper.appendix} onChange={(event) => updatePaperAnswers(setAnswers, { appendix: event.target.value })} /></section>}</div>;
}

function TemplatePreview({ template, onClose }) {
  const [answers, setAnswers] = useState({});
  return <div className="template-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="template-preview-title"><div><header><strong id="template-preview-title">Student preview</strong><button type="button" onClick={onClose}>Close student preview</button></header><div className="assignment-student-heading"><span className="portal-kicker">TEMPLATE ASSIGNMENT</span><h1>{template.title}</h1><p>{template.instructions}</p></div><GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} /></div></div>;
}

const EDITOR_PAGES = [{ id: "writing", label: "Free-style page" }, { id: "guided", label: "Paper sections" }];

function FullPageEditor({ template, answers, setAnswers, content, setContent, onClose, onSave, status, saving }) {
  const initialConfig = paperStructureFor(template);
  const initialPage = initialConfig.enabled && (paperAnswersFor(answers).mode !== "freestyle" || !initialConfig.allow_freestyle) ? "guided" : "writing";
  const editorRef = useRef(null);
  const workspaceRef = useRef(null);
  const selectionRef = useRef(null);
  const [exportError, setExportError] = useState("");
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const [showApaGuide, setShowApaGuide] = useState(false);
  const [showPaperStructure, setShowPaperStructure] = useState(false);
  const [pageHistory, setPageHistory] = useState([initialPage]);
  const [pageIndex, setPageIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const currentPage = pageHistory[pageIndex] || initialPage;

  useEffect(() => {
    if (currentPage !== "writing") return;
    const savedContent = sanitizeRichHtml(content);
    if (editorRef.current && editorRef.current.innerHTML !== savedContent) {
      editorRef.current.innerHTML = savedContent;
    }
  }, [currentPage, refreshKey]);

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    if (!selectionRef.current) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }

  function format(command, value = null) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    setContent(sanitizeRichHtml(editorRef.current?.innerHTML || ""));
    rememberSelection();
  }

  function addLink() {
    const url = window.prompt("Paste an https:// link");
    if (url && /^https?:\/\//i.test(url)) format("createLink", url);
  }

  function applyApaPage() {
    const body = sanitizeRichHtml(editorRef.current?.innerHTML || "") || "<p><br></p>";
    const apa = `<div style="font-family: Times New Roman; font-size: 12pt; line-height: 2">${body}</div>`;
    editorRef.current.innerHTML = apa;
    setContent(sanitizeRichHtml(apa));
    setShowApaGuide(true);
  }

  async function saveInsideEditor() {
    setSaveConfirmation("");
    const result = await onSave();
    setSaveConfirmation(result?.message || `Saved at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
  }

  async function toggleBrowserFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await workspaceRef.current?.requestFullscreen?.();
  }

  async function closeEditor() {
    if (document.fullscreenElement) await document.exitFullscreen();
    onClose();
  }

  function navigate(pageId) {
    if (pageId === currentPage) return;
    const nextHistory = [...pageHistory.slice(0, pageIndex + 1), pageId];
    setPageHistory(nextHistory);
    setPageIndex(nextHistory.length - 1);
  }

  function selectPaperSection(sectionId) {
    if (currentPage !== "guided") navigate("guided");
    setShowPaperStructure(false);
    window.setTimeout(() => document.getElementById(`editor-paper-section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  const editorWritingMode = writingModeFor(template, answers);
  const structuredMode = editorWritingMode === "structured";
  const words = structuredMode ? structuredWordCount(template, answers) : editorWritingMode === "guided" ? structuredWordCount(template, answers) + countWords(content) : countWords(content);
  const wordLimit = template.editor_config.word_limit || 0;
  const overLimit = wordLimit > 0 && words > wordLimit;
  const toolButton = (label, title, command, value = null) => <button type="button" title={title} onMouseDown={(event) => { event.preventDefault(); format(command, value); }}>{label}<span>{title}</span></button>;

  return <div className="assignment-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="assignment-editor-title"><div className="assignment-full-editor" ref={workspaceRef}>
    <WorkspaceWindowBar title="EdNotebook writing workspace" pages={EDITOR_PAGES} currentPage={currentPage} addressPrefix="ednotebook://assignment" canBack={pageIndex > 0} canForward={pageIndex < pageHistory.length - 1} onBack={() => setPageIndex((index) => Math.max(0, index - 1))} onForward={() => setPageIndex((index) => Math.min(pageHistory.length - 1, index + 1))} onRefresh={() => setRefreshKey((value) => value + 1)} onNavigate={navigate} onClose={closeEditor} />
    {currentPage === "guided" ? <main className="assignment-editor-guided-page" key={`guided-${refreshKey}`}><div className="assignment-student-heading"><span className="portal-kicker">PAPER SECTIONS</span><h1 id="assignment-editor-title">{template.title}</h1><p>Write each part in order. Your headings, transitions, references, and appendix assemble into one paper when you export.</p><div><button type="button" className="paper-heading-action" onClick={() => setShowPaperStructure(true)}>Open paper outline and setup</button></div></div><GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} idPrefix="editor-paper-section" /></main> : <>
      <header><div><span className="portal-kicker">EDNOTEBOOK WRITING WORKSPACE</span><h1 id="assignment-editor-title">{template.title}</h1></div><div className="assignment-editor-header-actions"><span className={`editor-save-state is-${status}`}>{saving ? "Saving…" : status === "submitted" ? "Submitted" : "Draft"}</span><button type="button" onClick={toggleBrowserFullscreen}>Use device full screen</button></div></header>
      <div className="assignment-editor-toolbar" role="toolbar" aria-label="Writing tools"><label>Style<select aria-label="Paragraph style" defaultValue="p" onChange={(event) => format("formatBlock", event.target.value)}><option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select></label><label>Font<select aria-label="Font family" defaultValue="Arial" onChange={(event) => format("fontName", event.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option></select></label><label>Size<select aria-label="Font size" defaultValue="3" onChange={(event) => format("fontSize", event.target.value)}><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Extra large</option></select></label>{toolButton(<strong>B</strong>, "Bold", "bold")}{toolButton(<em>I</em>, "Italic", "italic")}{toolButton(<u>U</u>, "Underline", "underline")}{toolButton("•", "Bullets", "insertUnorderedList")}{toolButton("1.", "Numbered list", "insertOrderedList")}{toolButton("≡", "Align left", "justifyLeft")}{toolButton("≣", "Align center", "justifyCenter")}{toolButton("☷", "Align right", "justifyRight")}{toolButton("→", "Indent", "indent")}{toolButton("←", "Outdent", "outdent")}<button type="button" title="Add link" onMouseDown={(event) => { event.preventDefault(); addLink(); }}>🔗<span>Link</span></button><label className="editor-color-tool">Text<input type="color" defaultValue="#17233b" onFocus={rememberSelection} onChange={(event) => format("foreColor", event.target.value)} /></label><label className="editor-color-tool">Highlight<input type="color" defaultValue="#fff2a8" onFocus={rememberSelection} onChange={(event) => format("hiliteColor", event.target.value)} /></label>{toolButton("Tx", "Clear formatting", "removeFormat")}{toolButton("↶", "Undo", "undo")}{toolButton("↷", "Redo", "redo")}<button type="button" onClick={() => setShowApaGuide(!showApaGuide)}>APA<span>Format guide</span></button><span className="spellcheck-indicator">✓ Browser spelling check {template.editor_config.spellcheck ? "on" : "off"}</span></div>
      <div className="paper-editor-quickbar"><button type="button" onClick={() => setShowPaperStructure(true)}>Open paper structure and outline</button><span>{editorWritingMode === "structured" ? "Export builds from paper sections" : editorWritingMode === "guided" ? "Export combines guided answers and the full response" : "Export uses the free-style page"}</span></div>
      {showApaGuide && <aside className="apa-format-guide"><div><strong>APA writing setup</strong><p>Use a readable approved font, double spacing, 1-inch margins, page numbers, and the title information your educator requests. Confirm the assignment's edition and source rules.</p></div><button type="button" onClick={applyApaPage}>Apply 12 pt Times New Roman + double spacing</button></aside>}
      <main className="assignment-editor-page"><div key={`writing-${refreshKey}`} ref={editorRef} className="assignment-content-editor" role="textbox" aria-label="Full assignment response" aria-multiline="true" contentEditable suppressContentEditableWarning lang="en" spellCheck={template.editor_config.spellcheck} data-placeholder="Start writing your full response here…" onMouseUp={rememberSelection} onKeyUp={rememberSelection} onInput={(event) => { setSaveConfirmation(""); setContent(sanitizeRichHtml(event.currentTarget.innerHTML)); }} /></main>
      <footer><span className={overLimit ? "is-over-limit" : ""}>{words} {editorWritingMode === "structured" ? "structured" : editorWritingMode === "guided" ? "combined" : "free-style"} words{wordLimit ? ` · maximum ${wordLimit}` : ""}{overLimit ? " · shorten before submitting" : ""}</span><div>{saveConfirmation && <strong className="editor-save-confirmation" role="status">✓ {saveConfirmation}</strong>}{exportError && <strong className="editor-export-error">{exportError}</strong>}<button type="button" disabled={!template.editor_config.allow_word_export} onClick={() => downloadWord(template, answers, content)}>Export Word-compatible .doc</button><button type="button" disabled={!template.editor_config.allow_pdf_export} onClick={() => { try { setExportError(""); openPdfExport(template, answers, content); } catch (error) { setExportError(error.message); } }}>Open PDF print preview</button><button className="primary" type="button" disabled={saving} onClick={saveInsideEditor}>{saving ? "Saving…" : "Save assignment draft"}</button></div></footer>
    </>}
    {showPaperStructure && <PaperStructureDrawer template={template} answers={answers} setAnswers={setAnswers} mode="student" onSelectSection={selectPaperSection} onModeChange={(nextMode) => navigate(nextMode === "structured" ? "guided" : "writing")} onClose={() => setShowPaperStructure(false)} />}
  </div></div>;
}

function StudentAssignment({ template, session, onClose }) {
  const storageKey = `ednotebook-assignment-${session?.user?.id || "sample"}-${template.id}`;
  const stored = loadJson(storageKey, {});
  const [answers, setAnswers] = useState(stored.answers || {});
  const [documentContent, setDocumentContent] = useState(stored.document_content || "");
  const [status, setStatus] = useState(stored.status || "draft");
  const [fullEditor, setFullEditor] = useState(false);
  const [showPaperStructure, setShowPaperStructure] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCloudDraft() {
      const result = await loadAssignmentSubmission(template.id, session?.user?.id);
      if (active && result.data) {
        setAnswers(result.data.answers || {});
        setDocumentContent(result.data.document_content || "");
        setStatus(result.data.status || "draft");
      }
    }
    loadCloudDraft();
    return () => { active = false; };
  }, [template.id, session?.user?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveJson(storageKey, { answers, document_content: documentContent, status, saved_at: new Date().toISOString() });
      setNotice("Draft saved on this device");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [answers, documentContent, status, storageKey]);

  const paperConfig = paperStructureFor(template);
  const paper = paperAnswersFor(answers);
  const writingMode = writingModeFor(template, answers);
  const structuredMode = writingMode === "structured";
  const guidedMode = writingMode !== "freestyle";
  const requiredSections = structuredMode ? template.sections.filter((section) => section.includeInPaper !== false) : template.sections;
  const missing = guidedMode ? requiredSections.filter((section) => section.required && !String(answers[section.id] || "").trim()) : [];
  const missingCoverFields = paperConfig.cover_page ? paperConfig.cover_fields.filter((field) => field.required && !String(paper.cover[field.id] || (field.id === "paper_title" ? template.title : "")).trim()) : [];
  const referencesMissing = paperConfig.include_references && paperConfig.references_required && !String(paper.references).trim();
  const appendixMissing = paperConfig.include_appendix && paperConfig.appendix_required && !String(paper.appendix).trim();
  const overLimitSections = guidedMode ? requiredSections.filter((section) => section.wordLimit > 0 && countWords(answers[section.id]) > section.wordLimit) : [];
  const activeWordCount = structuredMode ? structuredWordCount(template, answers) : writingMode === "guided" ? structuredWordCount(template, answers) + countWords(documentContent) : countWords(documentContent);
  const fullResponseOverLimit = template.editor_config.word_limit > 0 && activeWordCount > template.editor_config.word_limit;

  async function persist(nextStatus = status) {
    setSaving(true); setNotice("");
    const submission = { template_id: template.id, course_id: template.course_id, answers, document_content: sanitizeRichHtml(documentContent), word_count: activeWordCount, status: nextStatus };
    const result = await saveAssignmentSubmission(submission, session?.user?.id);
    let nextNotice;
    if (result.error) nextNotice = `Saved on this device. Cloud save will retry later: ${result.error.message}`;
    else if (result.source === "device") nextNotice = nextStatus === "submitted" ? "Assignment marked submitted on this device" : "Draft saved on this device";
    else nextNotice = nextStatus === "submitted" ? "Assignment submitted" : "Draft saved to your assignment";
    setNotice(nextNotice);
    setStatus(nextStatus); saveJson(storageKey, { ...submission, status: nextStatus, saved_at: new Date().toISOString() }); setSaving(false);
    return { message: `${nextNotice} at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` };
  }

  const requiredItemsMissing = missing.length + missingCoverFields.length + Number(referencesMissing) + Number(appendixMissing);
  const submitBlocked = requiredItemsMissing > 0 || overLimitSections.length > 0 || fullResponseOverLimit;
  const submitLabel = requiredItemsMissing ? `Complete ${requiredItemsMissing} required paper item${requiredItemsMissing === 1 ? "" : "s"}` : overLimitSections.length || fullResponseOverLimit ? "Shorten responses to submit" : "Submit assignment";

  function selectPaperSection(sectionId) {
    setShowPaperStructure(false);
    window.setTimeout(() => document.getElementById(`paper-section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  return <section className="student-assignment-workspace">
    <header><button type="button" onClick={onClose}>Back to all assignments</button><div><span>{status}</span><strong>{notice || "Changes save as you work"}</strong></div></header>
    <div className="assignment-student-heading"><span className="portal-kicker">TEMPLATE ASSIGNMENT</span><h1>{template.title}</h1><p>{template.instructions}</p><div><span>Browser spelling check {template.editor_config.spellcheck ? "on" : "off"}</span><span>Draft saves to this page</span><span>{writingMode === "structured" ? "Sections assemble into one paper" : writingMode === "guided" ? "Guided answers and full response export together" : "Free-style page exports as the paper"}</span></div></div>
    <div className="assignment-response-layout"><main className="dashboard-card">{guidedMode ? <GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} /> : <div className="paper-freestyle-prompt"><span className="portal-kicker">FREE-STYLE PAPER</span><h2>Write on the full page.</h2><p>The section answers stay saved if you switch back. Your free-style page becomes the paper body when you export.</p><button className="primary" type="button" disabled={!template.editor_config.full_page_editor} onClick={() => setFullEditor(true)}>Open free-style writing page</button></div>}</main><aside>
      <section className="dashboard-card paper-outline-card"><span className="portal-kicker">PAPER STRUCTURE</span><h2>{guidedMode ? "See what is complete." : "Switch writing modes."}</h2><p>Open the outline, cover-page fields, saved format, and file-name setup without leaving this assignment.</p><button className="primary" type="button" onClick={() => setShowPaperStructure(true)}>Open paper structure and outline</button><small>{guidedMode ? `${template.sections.filter((section) => section.type !== "heading" && String(answers[section.id] || "").trim()).length} sections started` : "Free-style writing selected"}</small></section>
      <section className="dashboard-card"><span className="portal-kicker">WRITING WORKSPACE</span><h2>Write without leaving EdNotebook.</h2><p>Use the full-size page for free-style writing or switch to paper sections from its workspace bar.</p><button type="button" disabled={!template.editor_config.full_page_editor} onClick={() => setFullEditor(true)}>Open full writing workspace</button><small className={fullResponseOverLimit ? "is-over-limit" : ""}>{activeWordCount} {writingMode === "structured" ? "structured" : writingMode === "guided" ? "combined" : "free-style"} words saved{template.editor_config.word_limit ? ` · maximum ${template.editor_config.word_limit}` : ""}</small></section>
      <section className="dashboard-card assignment-export-card"><span className="portal-kicker">EXPORT</span><h2>Build the complete paper.</h2><p>Exports follow the saved cover, outline, headings, references, appendix, and file-name pattern.</p><button type="button" disabled={!template.editor_config.allow_word_export} onClick={() => downloadWord(template, answers, documentContent)}>Export Word-compatible .doc</button><button type="button" disabled={!template.editor_config.allow_pdf_export} onClick={() => { try { openPdfExport(template, answers, documentContent); } catch (error) { setNotice(error.message); } }}>Open PDF print preview</button></section>
    </aside></div>
    <footer className="student-assignment-actions"><button type="button" disabled={saving} onClick={() => persist("draft")}>Save assignment draft</button><button className="primary" type="button" disabled={saving || submitBlocked} onClick={() => persist("submitted")}>{submitLabel}</button></footer>
    {showPaperStructure && <PaperStructureDrawer template={template} answers={answers} setAnswers={setAnswers} mode="student" onSelectSection={selectPaperSection} onClose={() => setShowPaperStructure(false)} />}
    {fullEditor && <FullPageEditor template={template} answers={answers} setAnswers={setAnswers} content={documentContent} setContent={setDocumentContent} onClose={() => setFullEditor(false)} onSave={() => persist("draft")} status={status} saving={saving} />}
  </section>;
}

export default function AssignmentTemplateWorkspace({ mode, session, track = "university", classes = [] }) {
  const fallbackClasses = classes.length ? classes : [{ id: track === "k12" ? "eng10-stories" : "sci-101-cell", code: track === "k12" ? "ENG 10" : "SCI 101", title: track === "k12" ? "Stories and Evidence" : "What Is a Cell?", division: track }];
  const storageKey = "ednotebook-assignment-templates";
  const initialTemplates = loadJson(storageKey, [createTemplate(track, fallbackClasses[0].id, "published")]);
  const [templates, setTemplates] = useState(initialTemplates);
  const [availableClasses, setAvailableClasses] = useState(fallbackClasses);
  const [courseId, setCourseId] = useState(fallbackClasses[0].id);
  const [draft, setDraft] = useState(() => createTemplate(track, fallbackClasses[0].id));
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const visibleTemplates = useMemo(() => templates.filter((template) => template.course_id === courseId && (mode === "professor" || template.status === "published")), [courseId, mode, templates]);

  useEffect(() => {
    let active = true;
    async function loadCloudCourses() {
      const result = await listAssignmentCourses();
      if (!active || !result.data?.length) return;
      setAvailableClasses(result.data);
      const firstCourse = result.data[0];
      setCourseId((current) => result.data.some((course) => course.id === current) ? current : firstCourse.id);
      setDraft((current) => result.data.some((course) => course.id === current.course_id) ? current : createTemplate(firstCourse.division || track, firstCourse.id));
    }
    loadCloudCourses();
    return () => { active = false; };
  }, [session?.user?.id, track]);

  useEffect(() => {
    let active = true;
    async function loadCloudTemplates() {
      const result = await listAssignmentTemplates(courseId, mode === "professor");
      if (active && result.data?.length) {
        setTemplates((current) => {
          const otherCourses = current.filter((template) => template.course_id !== courseId);
          const next = [...otherCourses, ...result.data];
          saveJson(storageKey, next);
          return next;
        });
      }
    }
    loadCloudTemplates();
    return () => { active = false; };
  }, [courseId, mode, storageKey]);

  function selectCourse(nextCourseId) {
    setCourseId(nextCourseId);
    const selectedCourse = availableClasses.find((course) => course.id === nextCourseId);
    setDraft(createTemplate(selectedCourse?.division || track, nextCourseId));
    setSelectedTemplate(null);
    setNotice("");
  }

  async function persistTemplate(status) {
    if (!draft.title.trim()) { setNotice("Add a template title."); return; }
    if (!draft.sections.length || draft.sections.some((section) => !section.prompt.trim())) { setNotice("Add at least one section and complete every prompt."); return; }
    setBusy(true); setNotice("");
    const candidate = {
      ...draft,
      course_id: courseId,
      sections: draft.sections.map((section) => ({
        headingLevel: section.type === "heading" ? 1 : 2,
        includeInPaper: true,
        transitionPrompt: "Connect this section to the next idea.",
        ...section,
      })),
      editor_config: { ...draft.editor_config, paper_structure: paperStructureFor(draft) },
      status,
      updated_at: new Date().toISOString(),
    };
    const result = await saveAssignmentTemplate(candidate, session?.user?.id);
    const saved = result.data || candidate;
    const next = [saved, ...templates.filter((template) => template.id !== draft.id && template.id !== saved.id)];
    setTemplates(next); saveJson(storageKey, next); setDraft(saved);
    if (result.error) setNotice(`Saved on this device. Cloud save will retry later: ${result.error.message}`);
    else if (result.source === "device") setNotice(status === "published" ? "Template published in this sample workspace on this device." : "Template draft saved on this device.");
    else setNotice(status === "published" ? "Template published for enrolled students." : "Template draft saved.");
    setBusy(false);
  }

  if (mode === "student" && selectedTemplate) return <StudentAssignment template={selectedTemplate} session={session} onClose={() => setSelectedTemplate(null)} />;

  return <div className="assignment-template-workspace"><section className="dashboard-card assignment-template-hero"><div><span className="portal-kicker">{mode === "professor" ? "ASSIGNMENT TEMPLATE STUDIO" : "ASSIGNMENTS"}</span><h1>{mode === "professor" ? "Build the work right into the class." : "Read, write, and submit in one place."}</h1><p>{mode === "professor" ? "Create reusable form-style assignments with custom sections and an optional full-page writing workspace. Students never need a blank Word document just to begin." : "Open a guided template, write in a full-size page, save your draft, and export when you need a copy."}</p></div><label>Class<select value={courseId} onChange={(event) => selectCourse(event.target.value)}>{availableClasses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label></section>{notice && <div className="portal-form-notice" role="status">{notice}</div>}{mode === "professor" ? <><section className="template-library"><div className="dashboard-card-heading"><div><span className="portal-kicker">TEMPLATE LIBRARY</span><h2>Reuse or revise.</h2></div><button type="button" onClick={() => { const selectedCourse = availableClasses.find((course) => course.id === courseId); setDraft(createTemplate(selectedCourse?.division || track, courseId)); }}>New template</button></div><div>{visibleTemplates.length ? visibleTemplates.map((template) => <button type="button" className={draft.id === template.id ? "is-active" : ""} key={template.id} onClick={() => setDraft(template)}><span>{template.status}</span><strong>{template.title}</strong><small>{template.sections.length} sections · {template.editor_config.full_page_editor ? "full-page editor" : "guided form"}</small></button>) : <p>No templates for this class yet.</p>}</div></section><TemplateBuilder template={draft} setTemplate={setDraft} onSave={persistTemplate} onPreview={() => setSelectedTemplate(draft)} busy={busy} />{selectedTemplate && <TemplatePreview template={selectedTemplate} onClose={() => setSelectedTemplate(null)} />}</> : <section className="student-assignment-list"><div className="dashboard-card-heading"><div><span className="portal-kicker">READY TO WORK</span><h2>Your template assignments</h2></div><span>{visibleTemplates.length} available</span></div>{visibleTemplates.length ? visibleTemplates.map((template) => <article className="dashboard-card" key={template.id}><div><span>{availableClasses.find((course) => course.id === template.course_id)?.code || "CLASS"}</span><strong>{template.title}</strong><p>{template.instructions}</p></div><ul><li>{template.sections.length} guided sections</li><li>{template.editor_config.full_page_editor ? "Full-page editor included" : "Guided answers"}</li><li>Spelling check on</li></ul><button className="primary" type="button" onClick={() => setSelectedTemplate(template)}>Open assignment</button></article>) : <div className="dashboard-card"><h2>No published templates yet.</h2><p>Your educator's published assignments will appear here.</p></div>}</section>}</div>;
}
