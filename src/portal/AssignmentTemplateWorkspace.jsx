import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceWindowBar } from "../FullscreenSurface.jsx";
import AcademicWritingStudio, {
  sanitizeAcademicHtml,
} from "../writing/AcademicWritingStudio.jsx";
import { ensurePagedDocument } from "../writing/academicWritingModel.js";
import {
  listAssignmentFeedback,
  listAssignmentCourses,
  listAssignmentSubmissions,
  listAssignmentTemplates,
  loadAssignmentSubmission,
  publishAssignmentReview,
  saveAssignmentFeedback,
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
  };
}

function createTemplate(track, courseId, status = "draft", subjectId = null) {
  const k12 = track === "k12";
  return {
    id: `device-${crypto.randomUUID()}`,
    course_id: courseId,
    education_division: track,
    subject_id: k12 ? (subjectId || "other-approved-elective") : null,
    title: k12 ? "Evidence Paragraph Builder" : "Source Analysis Response",
    instructions: k12
      ? "Work through each section, then use the full-page editor to put the response together."
      : "Complete the guided sections, then develop the final response in the full-page writing workspace.",
    sections: [
      { ...createSection("short"), prompt: k12 ? "What is your main claim?" : "State the central claim you will evaluate." },
      { ...createSection("long"), prompt: k12 ? "Which evidence supports your claim?" : "Summarize the strongest evidence from the source.", wordTarget: 120 },
      { ...createSection("reflection"), prompt: k12 ? "Explain how the evidence connects to your claim." : "Explain the limits, context, or competing interpretation.", wordTarget: 150 },
    ],
    editor_config: { full_page_editor: true, spellcheck: true, allow_word_export: true, allow_pdf_export: true, word_limit: 0 },
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

function assignmentExportHtml(template, answers, documentContent) {
  const guided = template.sections
    .filter((section) => section.type !== "heading")
    .map((section) => `<section><h2>${escapeHtml(section.prompt)}</h2><p>${escapeHtml(answers[section.id] || "").replaceAll("\n", "<br>")}</p></section>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(template.title)}</title><style>body{font-family:Arial,sans-serif;max-width:780px;margin:48px auto;color:#17233b;line-height:1.6}h1{font-size:28px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #d8dee8;padding-bottom:6px}.final{margin-top:40px;padding-top:24px;border-top:2px solid #17233b}@media print{body{margin:0.65in;max-width:none}}</style></head><body><h1>${escapeHtml(template.title)}</h1><p>${escapeHtml(template.instructions)}</p>${guided}<section class="final"><h2>Full response</h2>${sanitizeRichHtml(documentContent) || "<p></p>"}</section></body></html>`;
}

function downloadWord(template, answers, documentContent) {
  const blob = new Blob([assignmentExportHtml(template, answers, documentContent)], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${template.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "assignment"}.doc`;
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

function TemplateBuilder({ template, setTemplate, onSave, onPreview, busy }) {
  const [newType, setNewType] = useState("long");

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

  return <div className="assignment-template-builder"><section className="dashboard-card template-details-card"><span className="portal-kicker">TEMPLATE DETAILS</span><h2>Build the assignment once.</h2><p>Students answer inside EdNotebook instead of downloading a blank document.</p><label>Template title<input spellCheck value={template.title} onChange={(event) => setTemplate({ ...template, title: event.target.value })} /></label><label>Student instructions<textarea spellCheck rows={4} value={template.instructions} onChange={(event) => setTemplate({ ...template, instructions: event.target.value })} /></label><label>Full response maximum words <small>Use 0 for no limit.</small><input type="number" min="0" max="50000" value={template.editor_config.word_limit || 0} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, word_limit: Number(event.target.value) } })} /></label><div className="template-option-grid"><label><input type="checkbox" checked={template.editor_config.full_page_editor} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, full_page_editor: event.target.checked } })} />Include full-page writing workspace</label><label><input type="checkbox" checked={template.editor_config.allow_word_export} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, allow_word_export: event.target.checked } })} />Allow Word export</label><label><input type="checkbox" checked={template.editor_config.allow_pdf_export} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, allow_pdf_export: event.target.checked } })} />Allow PDF export</label><label><input type="checkbox" checked={template.editor_config.spellcheck} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, spellcheck: event.target.checked } })} />Spelling check on</label></div></section><section className="dashboard-card template-section-builder"><div className="dashboard-card-heading"><div><span className="portal-kicker">CUSTOM SECTIONS</span><h2>Shape the response.</h2></div><div className="template-add-control"><select aria-label="New section type" value={newType} onChange={(event) => setNewType(event.target.value)}>{SECTION_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select><button type="button" onClick={() => setTemplate({ ...template, sections: [...template.sections, createSection(newType)] })}>Add section</button></div></div><div className="template-section-list">{template.sections.map((section, index) => <article key={section.id} className="template-section-card"><header><span>{String(index + 1).padStart(2, "0")} · {SECTION_TYPES.find((type) => type.id === section.type)?.label}</span><div><button type="button" aria-label="Move section up" disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button><button type="button" aria-label="Move section down" disabled={index === template.sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button><button type="button" onClick={() => setTemplate({ ...template, sections: template.sections.filter((item) => item.id !== section.id) })}>Remove</button></div></header><label>{section.type === "heading" ? "Heading" : "Prompt"}<input spellCheck value={section.prompt} onChange={(event) => updateSection(section.id, { prompt: event.target.value })} /></label><label>Student guidance<textarea spellCheck rows={2} value={section.helpText} onChange={(event) => updateSection(section.id, { helpText: event.target.value })} /></label>{section.type !== "heading" && <div className="template-section-options"><label><input type="checkbox" checked={section.required} onChange={(event) => updateSection(section.id, { required: event.target.checked })} />Required</label>{["long", "reflection"].includes(section.type) && <label>Word target<input type="number" min="0" max="5000" value={section.wordTarget || 0} onChange={(event) => updateSection(section.id, { wordTarget: Number(event.target.value) })} /></label>}<label>Maximum words<input type="number" min="0" max="5000" value={section.wordLimit || 0} onChange={(event) => updateSection(section.id, { wordLimit: Number(event.target.value) })} /></label></div>}</article>)}</div><footer className="template-builder-actions"><button type="button" onClick={onPreview}>Preview as student</button><button type="button" disabled={busy} onClick={() => onSave("draft")}>Save draft</button><button className="primary" type="button" disabled={busy} onClick={() => onSave("published")}>Publish template</button></footer></section></div>;
}

function GuidedAnswerFields({ template, answers, setAnswers }) {
  return <div className="guided-answer-fields">{template.sections.map((section, index) => {
    if (section.type === "heading") return <h2 key={section.id}>{section.prompt}</h2>;
    const value = answers[section.id] || "";
    const isShort = section.type === "short";
    const words = countWords(value);
    const overLimit = section.wordLimit > 0 && words > section.wordLimit;
    return <section key={section.id} className={overLimit ? "is-over-limit" : ""}><div><span>{String(index + 1).padStart(2, "0")}</span><h3>{section.prompt}{section.required && <sup>Required</sup>}</h3></div><p>{section.helpText}</p>{isShort ? <input lang="en" spellCheck={template.editor_config.spellcheck} value={value} onChange={(event) => setAnswers({ ...answers, [section.id]: event.target.value })} /> : <textarea lang="en" spellCheck={template.editor_config.spellcheck} rows={section.type === "checklist" ? 5 : 8} value={value} onChange={(event) => setAnswers({ ...answers, [section.id]: event.target.value })} />}<small>{words} words{section.wordTarget ? ` · target ${section.wordTarget}` : ""}{section.wordLimit ? ` · maximum ${section.wordLimit}` : ""}{overLimit ? " · shorten before submitting" : ""}</small></section>;
  })}</div>;
}

function TemplatePreview({ template, onClose }) {
  const [answers, setAnswers] = useState({});
  return <div className="template-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="template-preview-title"><div><header><strong id="template-preview-title">Student preview</strong><button type="button" onClick={onClose}>Close</button></header><div className="assignment-student-heading"><span className="portal-kicker">TEMPLATE ASSIGNMENT</span><h1>{template.title}</h1><p>{template.instructions}</p></div><GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} /></div></div>;
}

const EDITOR_PAGES = [{ id: "writing", label: "Writing" }, { id: "guided", label: "Guided answers" }];

function FullPageEditor({ template, answers, setAnswers, content, setContent, onClose, onSave, status, saving }) {
  const editorRef = useRef(null);
  const workspaceRef = useRef(null);
  const selectionRef = useRef(null);
  const [exportError, setExportError] = useState("");
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const [showApaGuide, setShowApaGuide] = useState(false);
  const [pageHistory, setPageHistory] = useState(["writing"]);
  const [pageIndex, setPageIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const currentPage = pageHistory[pageIndex] || "writing";

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

  const words = countWords(content);
  const wordLimit = template.editor_config.word_limit || 0;
  const overLimit = wordLimit > 0 && words > wordLimit;
  const toolButton = (label, title, command, value = null) => <button type="button" title={title} onMouseDown={(event) => { event.preventDefault(); format(command, value); }}>{label}<span>{title}</span></button>;

  return <div className="assignment-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="assignment-editor-title"><div className="assignment-full-editor" ref={workspaceRef}>
    <WorkspaceWindowBar title="EdNotebook writing workspace" pages={EDITOR_PAGES} currentPage={currentPage} addressPrefix="ednotebook://assignment" canBack={pageIndex > 0} canForward={pageIndex < pageHistory.length - 1} onBack={() => setPageIndex((index) => Math.max(0, index - 1))} onForward={() => setPageIndex((index) => Math.min(pageHistory.length - 1, index + 1))} onRefresh={() => setRefreshKey((value) => value + 1)} onNavigate={navigate} onClose={closeEditor} />
    {currentPage === "guided" ? <main className="assignment-editor-guided-page" key={`guided-${refreshKey}`}><div className="assignment-student-heading"><span className="portal-kicker">GUIDED ANSWERS</span><h1 id="assignment-editor-title">{template.title}</h1><p>Review or update each section without leaving the full-screen workspace.</p></div><GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} /></main> : <>
      <header><div><span className="portal-kicker">EDNOTEBOOK WRITING WORKSPACE</span><h1 id="assignment-editor-title">{template.title}</h1></div><div className="assignment-editor-header-actions"><span className={`editor-save-state is-${status}`}>{saving ? "Saving…" : status === "submitted" ? "Submitted" : "Draft"}</span><button type="button" onClick={toggleBrowserFullscreen}>Use device full screen</button></div></header>
      <div className="assignment-editor-toolbar" role="toolbar" aria-label="Writing tools"><label>Style<select aria-label="Paragraph style" defaultValue="p" onChange={(event) => format("formatBlock", event.target.value)}><option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select></label><label>Font<select aria-label="Font family" defaultValue="Arial" onChange={(event) => format("fontName", event.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option></select></label><label>Size<select aria-label="Font size" defaultValue="3" onChange={(event) => format("fontSize", event.target.value)}><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Extra large</option></select></label>{toolButton(<strong>B</strong>, "Bold", "bold")}{toolButton(<em>I</em>, "Italic", "italic")}{toolButton(<u>U</u>, "Underline", "underline")}{toolButton("•", "Bullets", "insertUnorderedList")}{toolButton("1.", "Numbered list", "insertOrderedList")}{toolButton("≡", "Align left", "justifyLeft")}{toolButton("≣", "Align center", "justifyCenter")}{toolButton("☷", "Align right", "justifyRight")}{toolButton("→", "Indent", "indent")}{toolButton("←", "Outdent", "outdent")}<button type="button" title="Add link" onMouseDown={(event) => { event.preventDefault(); addLink(); }}>🔗<span>Link</span></button><label className="editor-color-tool">Text<input type="color" defaultValue="#17233b" onFocus={rememberSelection} onChange={(event) => format("foreColor", event.target.value)} /></label><label className="editor-color-tool">Highlight<input type="color" defaultValue="#fff2a8" onFocus={rememberSelection} onChange={(event) => format("hiliteColor", event.target.value)} /></label>{toolButton("Tx", "Clear formatting", "removeFormat")}{toolButton("↶", "Undo", "undo")}{toolButton("↷", "Redo", "redo")}<button type="button" onClick={() => setShowApaGuide(!showApaGuide)}>APA<span>Format guide</span></button><span className="spellcheck-indicator">✓ Browser spelling check {template.editor_config.spellcheck ? "on" : "off"}</span></div>
      {showApaGuide && <aside className="apa-format-guide"><div><strong>APA writing setup</strong><p>Use a readable approved font, double spacing, 1-inch margins, page numbers, and the title information your educator requests. Confirm the assignment's edition and source rules.</p></div><button type="button" onClick={applyApaPage}>Apply 12 pt Times New Roman + double spacing</button></aside>}
      <main className="assignment-editor-page"><div key={`writing-${refreshKey}`} ref={editorRef} className="assignment-content-editor" role="textbox" aria-label="Full assignment response" aria-multiline="true" contentEditable suppressContentEditableWarning lang="en" spellCheck={template.editor_config.spellcheck} data-placeholder="Start writing your full response here…" onMouseUp={rememberSelection} onKeyUp={rememberSelection} onInput={(event) => { setSaveConfirmation(""); setContent(sanitizeRichHtml(event.currentTarget.innerHTML)); }} /></main>
      <footer><span className={overLimit ? "is-over-limit" : ""}>{words} words{wordLimit ? ` · maximum ${wordLimit}` : ""}{overLimit ? " · shorten before submitting" : ""}</span><div>{saveConfirmation && <strong className="editor-save-confirmation" role="status">✓ {saveConfirmation}</strong>}{exportError && <strong className="editor-export-error">{exportError}</strong>}<button type="button" disabled={!template.editor_config.allow_word_export} onClick={() => downloadWord(template, answers, content)}>Export Word</button><button type="button" disabled={!template.editor_config.allow_pdf_export} onClick={() => { try { setExportError(""); openPdfExport(template, answers, content); } catch (error) { setExportError(error.message); } }}>Export PDF</button><button className="primary" type="button" disabled={saving} onClick={saveInsideEditor}>{saving ? "Saving…" : "Save to assignment"}</button></div></footer>
    </>}
  </div></div>;
}

function highlightReviewAnchors(root, feedback) {
  if (!root || typeof NodeFilter === "undefined") return;
  (feedback || []).filter((item) => item.is_highlight && item.selected_text).forEach((item) => {
    const target = String(item.selected_text).trim();
    if (!target) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      const index = textNode.nodeValue?.indexOf(target) ?? -1;
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + target.length);
        const mark = document.createElement("mark");
        mark.className = "professor-feedback-highlight";
        mark.title = item.feedback_type === "question" ? "Professor question" : "Professor comment";
        range.surroundContents(mark);
        break;
      }
      textNode = walker.nextNode();
    }
  });
}

function ProfessorReviewWorkspace({ courseId, session }) {
  const documentRef = useRef(null);
  const [submissions, setSubmissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [draft, setDraft] = useState({ feedbackType: "comment", selectedText: "", comment: "" });
  const [graded, setGraded] = useState(false);
  const [gradeLabel, setGradeLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listAssignmentSubmissions(courseId).then((result) => {
      if (!active) return;
      setSubmissions(result.data || []);
      setSelected((current) => {
        if (current && (result.data || []).some((item) => item.id === current.id)) return current;
        return result.data?.[0] || null;
      });
    });
    return () => { active = false; };
  }, [courseId]);

  useEffect(() => {
    if (!selected?.id) {
      setFeedback([]);
      return undefined;
    }
    let active = true;
    setGradeLabel(selected.grade_label || "");
    setGraded(selected.review_state === "graded");
    listAssignmentFeedback(selected.id).then((result) => {
      if (active) setFeedback(result.data || []);
    });
    return () => { active = false; };
  }, [selected?.id]);

  useEffect(() => {
    highlightReviewAnchors(documentRef.current, feedback);
  }, [feedback, selected?.id]);

  function captureSelection() {
    const selection = window.getSelection();
    if (
      selection &&
      !selection.isCollapsed &&
      documentRef.current?.contains(selection.anchorNode)
    ) {
      setDraft((current) => ({
        ...current,
        selectedText: selection.toString().trim().slice(0, 5000),
      }));
    }
  }

  async function addFeedback(event) {
    event.preventDefault();
    if (!selected || !draft.comment.trim()) return;
    setBusy(true);
    const result = await saveAssignmentFeedback({
      submission_id: selected.id,
      course_id: selected.course_id,
      student_id: selected.student_id,
      feedback_type: draft.feedbackType,
      selected_text: draft.selectedText,
      comment: draft.comment.trim(),
      is_highlight: Boolean(draft.selectedText),
    }, session?.user?.id);
    if (result.error) {
      setNotice(`Feedback was not saved: ${result.error.message}`);
    } else {
      setFeedback((current) => [...current, result.data]);
      setDraft({ feedbackType: "comment", selectedText: "", comment: "" });
      setNotice("Feedback saved as a private review draft.");
    }
    setBusy(false);
  }

  async function publishReview() {
    if (!selected) return;
    setBusy(true);
    const result = await publishAssignmentReview({
      submissionId: selected.id,
      feedbackIds: feedback.filter((item) => !item.published_at).map((item) => item.id),
      graded,
      gradeLabel,
    });
    if (result.error) {
      setNotice(`Review was not published: ${result.error.message}`);
    } else {
      const publishedAt = result.data?.feedback_published_at || new Date().toISOString();
      setFeedback((current) => current.map((item) => ({ ...item, published_at: item.published_at || publishedAt })));
      setSelected((current) => ({
        ...current,
        ...result.data,
        review_state: graded ? "graded" : "feedback_ready",
      }));
      setNotice(graded ? "Grade and feedback published. The student notification is ready." : "Feedback published. The student notification is ready.");
    }
    setBusy(false);
  }

  const studentName = selected?.profiles?.full_name || selected?.profiles?.email || "Student";
  const assignmentTitle = selected?.assignment_form_templates?.title || "Assignment";
  const reviewKey = `${selected?.id || "none"}-${feedback.map((item) => `${item.id}:${item.published_at || "draft"}`).join("|")}`;

  return (
    <section className="assignment-review-workspace">
      <header className="dashboard-card-heading">
        <div><span className="portal-kicker">STUDENT WRITING REVIEW</span><h2>Highlight, ask, respond, then publish once.</h2></div>
        <span>{submissions.length} submitted</span>
      </header>
      {!submissions.length
        ? <section className="dashboard-card"><h3>No submitted writing yet.</h3><p>Student documents will appear here after submission. Drafts remain private to the student.</p></section>
        : (
          <div className="assignment-review-layout">
            <aside className="dashboard-card assignment-review-queue">
              <h3>Review queue</h3>
              {submissions.map((submission) => (
                <button type="button" className={selected?.id === submission.id ? "is-active" : ""} key={submission.id} onClick={() => setSelected(submission)}>
                  <span>{submission.review_state?.replace("_", " ") || "not reviewed"}</span>
                  <strong>{submission.assignment_form_templates?.title || "Assignment"}</strong>
                  <small>{submission.profiles?.full_name || submission.profiles?.email || "Student"} · {submission.word_count} words</small>
                </button>
              ))}
            </aside>
            <main className="assignment-review-document-shell">
              <header><div><span>{studentName}</span><strong>{assignmentTitle}</strong></div><small>Select text in the paper, then capture it in a comment or question.</small></header>
              <div
                key={reviewKey}
                ref={documentRef}
                className="academic-paged-editor professor-review-document"
                onMouseUp={captureSelection}
                dangerouslySetInnerHTML={{ __html: sanitizeAcademicHtml(ensurePagedDocument(selected?.document_content || "")) }}
              />
            </main>
            <aside className="dashboard-card assignment-feedback-panel">
              <span className="portal-kicker">ANCHORED FEEDBACK</span>
              <h3>{draft.selectedText ? "Selection captured" : "Select text or leave a document note"}</h3>
              <form onSubmit={addFeedback}>
                <label>Feedback type<select value={draft.feedbackType} onChange={(event) => setDraft({ ...draft, feedbackType: event.target.value })}><option value="comment">Comment</option><option value="question">Question</option></select></label>
                <label>Highlighted text<textarea rows={3} value={draft.selectedText} onChange={(event) => setDraft({ ...draft, selectedText: event.target.value })} placeholder="Select text in the document or paste a short excerpt" /></label>
                <label>Professor note<textarea rows={5} value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} placeholder="Explain, encourage, or ask a revision question" required /></label>
                <button type="submit" disabled={busy}>Save private draft</button>
              </form>
              <div className="assignment-feedback-list">
                {feedback.map((item) => <article key={item.id}><span>{item.feedback_type} · {item.published_at ? "published" : "private draft"}</span>{item.selected_text && <mark>{item.selected_text}</mark>}<p>{item.comment}</p></article>)}
              </div>
              <fieldset>
                <legend>Finish the review</legend>
                <label><input type="checkbox" checked={graded} onChange={(event) => setGraded(event.target.checked)} />Mark assignment graded</label>
                {graded && <label>Grade or score<input value={gradeLabel} maxLength={40} onChange={(event) => setGradeLabel(event.target.value)} placeholder="92 / 100 or A-" /></label>}
                <button className="primary" type="button" disabled={busy || !feedback.length} onClick={publishReview}>{graded ? "Publish grade + feedback" : "Publish feedback"}</button>
              </fieldset>
              {notice && <p className="portal-form-notice" role="status">{notice}</p>}
            </aside>
          </div>
        )}
    </section>
  );
}

function StudentAssignment({ template, session, onClose }) {
  const storageKey = `ednotebook-assignment-${session?.user?.id || "sample"}-${template.id}`;
  const stored = loadJson(storageKey, {});
  const [answers, setAnswers] = useState(stored.answers || {});
  const [documentContent, setDocumentContent] = useState(stored.document_content || "");
  const [status, setStatus] = useState(stored.status || "draft");
  const [submissionId, setSubmissionId] = useState(stored.id || null);
  const [reviewState, setReviewState] = useState(stored.review_state || "not_reviewed");
  const [gradeLabel, setGradeLabel] = useState(stored.grade_label || "");
  const [publishedFeedback, setPublishedFeedback] = useState([]);
  const [fullEditor, setFullEditor] = useState(false);
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
        setSubmissionId(result.data.id);
        setReviewState(result.data.review_state || "not_reviewed");
        setGradeLabel(result.data.grade_label || "");
      }
    }
    loadCloudDraft();
    return () => { active = false; };
  }, [template.id, session?.user?.id]);

  useEffect(() => {
    if (!submissionId) return undefined;
    let active = true;
    listAssignmentFeedback(submissionId).then((result) => {
      if (active) {
        setPublishedFeedback(
          (result.data || []).filter((item) => item.published_at),
        );
      }
    });
    return () => { active = false; };
  }, [submissionId, reviewState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveJson(storageKey, { answers, document_content: documentContent, status, saved_at: new Date().toISOString() });
      setNotice("Draft saved on this device");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [answers, documentContent, status, storageKey]);

  const missing = template.sections.filter((section) => section.required && !String(answers[section.id] || "").trim());
  const overLimitSections = template.sections.filter((section) => section.wordLimit > 0 && countWords(answers[section.id]) > section.wordLimit);
  const fullResponseOverLimit = template.editor_config.word_limit > 0 && countWords(documentContent) > template.editor_config.word_limit;

  async function persist(nextStatus = status, contentOverride = documentContent) {
    setSaving(true); setNotice("");
    const safeContent = sanitizeAcademicHtml(contentOverride);
    const submission = { template_id: template.id, course_id: template.course_id, answers, document_content: safeContent, word_count: countWords(safeContent), status: nextStatus };
    const result = await saveAssignmentSubmission(submission, session?.user?.id);
    let nextNotice;
    if (result.error) nextNotice = `Saved on this device. Cloud save will retry later: ${result.error.message}`;
    else if (result.source === "device") nextNotice = nextStatus === "submitted" ? "Assignment marked submitted on this device" : "Draft saved on this device";
    else nextNotice = nextStatus === "submitted" ? "Assignment submitted" : "Draft saved to your assignment";
    if (result.data?.id) setSubmissionId(result.data.id);
    setNotice(nextNotice);
    setStatus(nextStatus); saveJson(storageKey, { ...submission, status: nextStatus, saved_at: new Date().toISOString() }); setSaving(false);
    return { message: `${nextNotice} at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` };
  }

  const submitBlocked = missing.length > 0 || overLimitSections.length > 0 || fullResponseOverLimit;
  const submitLabel = missing.length ? `Complete ${missing.length} required section${missing.length === 1 ? "" : "s"}` : overLimitSections.length || fullResponseOverLimit ? "Shorten responses to submit" : "Submit assignment";
  return <section className="student-assignment-workspace"><header><button type="button" onClick={onClose}>← All assignments</button><div><span>{status}</span><strong>{notice || "Changes save as you work"}</strong></div></header><div className="assignment-student-heading"><span className="portal-kicker">TEMPLATE ASSIGNMENT</span><h1>{template.title}</h1><p>{template.instructions}</p><div><span>✓ Browser spelling check {template.editor_config.spellcheck ? "on" : "off"}</span><span>✓ Draft saves to this page</span><span>✓ No document upload needed</span></div></div>{publishedFeedback.length > 0 && <section className="dashboard-card student-published-feedback"><div><span className="portal-kicker">{reviewState === "graded" ? "ASSIGNMENT GRADED" : "PROFESSOR FEEDBACK"}</span><h2>{reviewState === "graded" && gradeLabel ? gradeLabel : "Your professor finished this review."}</h2><p>Comments and questions are grouped here and remain available beside the same saved document.</p></div><div>{publishedFeedback.map((item) => <article key={item.id}><span>{item.feedback_type}</span>{item.selected_text && <mark>{item.selected_text}</mark>}<p>{item.comment}</p></article>)}</div></section>}<div className="assignment-response-layout"><main className="dashboard-card"><GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} /></main><aside><section className="dashboard-card"><span className="portal-kicker">FULL RESPONSE</span><h2>Write without leaving EdNotebook.</h2><p>Open the academic writing studio for editable pages, college-paper designs, sources, Word import, and writing review. Your guided answers stay beside it.</p><button className="primary" type="button" disabled={!template.editor_config.full_page_editor} onClick={() => setFullEditor(true)}>Open academic writing studio</button><small className={fullResponseOverLimit ? "is-over-limit" : ""}>{countWords(documentContent)} words saved{template.editor_config.word_limit ? ` · maximum ${template.editor_config.word_limit}` : ""}</small></section><section className="dashboard-card assignment-export-card"><span className="portal-kicker">EXPORT</span><h2>Use your work anywhere.</h2><button type="button" disabled={!template.editor_config.allow_word_export} onClick={() => downloadWord(template, answers, documentContent)}>Export Word</button><button type="button" disabled={!template.editor_config.allow_pdf_export} onClick={() => { try { openPdfExport(template, answers, documentContent); } catch (error) { setNotice(error.message); } }}>Export PDF</button></section></aside></div><footer className="student-assignment-actions"><button type="button" disabled={saving} onClick={() => persist("draft")}>Save draft</button><button className="primary" type="button" disabled={saving || submitBlocked} onClick={() => persist("submitted")}>{submitLabel}</button></footer>{fullEditor && <AcademicWritingStudio title={template.title} content={documentContent} setContent={setDocumentContent} onClose={() => setFullEditor(false)} onSave={(safeContent) => persist("draft", safeContent)} status={status} saving={saving} spellCheck={template.editor_config.spellcheck} wordLimit={template.editor_config.word_limit || 0} feedback={publishedFeedback} secondaryLabel="Guided answers" secondaryContent={<><div className="assignment-student-heading"><span className="portal-kicker">GUIDED ANSWERS</span><h1>{template.title}</h1><p>Review or update each section without leaving the writing studio.</p></div><GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} /></>} saveLabel="Save to assignment" />}</section>;
}

export default function AssignmentTemplateWorkspace({ mode, session, track = "university", classes = [], initialTemplateId = null }) {
  const fallbackClasses = classes.length ? classes : [{ id: track === "k12" ? "eng10-stories" : "sci-101-cell", code: track === "k12" ? "ENG 10" : "SCI 101", title: track === "k12" ? "Stories and Evidence" : "What Is a Cell?", division: track, subjectId: track === "k12" ? "english-language-arts" : null }];
  const storageKey = "ednotebook-assignment-templates";
  const initialTemplates = loadJson(storageKey, [createTemplate(track, fallbackClasses[0].id, "published", fallbackClasses[0].subjectId)]);
  const [templates, setTemplates] = useState(initialTemplates);
  const [availableClasses, setAvailableClasses] = useState(fallbackClasses);
  const [courseId, setCourseId] = useState(fallbackClasses[0].id);
  const [draft, setDraft] = useState(() => createTemplate(track, fallbackClasses[0].id, "draft", fallbackClasses[0].subjectId));
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
      setDraft((current) => result.data.some((course) => course.id === current.course_id) ? current : createTemplate(firstCourse.division || track, firstCourse.id, "draft", firstCourse.subjectId));
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

  useEffect(() => {
    if (mode !== "student" || !initialTemplateId) return;
    const requested = templates.find(
      (template) => String(template.id) === String(initialTemplateId),
    );
    if (requested) {
      setCourseId(requested.course_id);
      setSelectedTemplate(requested);
    }
  }, [initialTemplateId, mode, templates]);

  function selectCourse(nextCourseId) {
    setCourseId(nextCourseId);
    const selectedCourse = availableClasses.find((course) => course.id === nextCourseId);
    setDraft(createTemplate(selectedCourse?.division || track, nextCourseId, "draft", selectedCourse?.subjectId));
    setSelectedTemplate(null);
    setNotice("");
  }

  async function persistTemplate(status) {
    if (!draft.title.trim()) { setNotice("Add a template title."); return; }
    if (!draft.sections.length || draft.sections.some((section) => !section.prompt.trim())) { setNotice("Add at least one section and complete every prompt."); return; }
    setBusy(true); setNotice("");
    const candidate = { ...draft, course_id: courseId, status, updated_at: new Date().toISOString() };
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

  return <div className="assignment-template-workspace"><section className="dashboard-card assignment-template-hero"><div><span className="portal-kicker">{mode === "professor" ? "ASSIGNMENT TEMPLATE STUDIO" : "ASSIGNMENTS"}</span><h1>{mode === "professor" ? "Build the work right into the class." : "Read, write, and submit in one place."}</h1><p>{mode === "professor" ? "Create reusable form-style assignments with custom sections and an optional full-page writing workspace. Students never need a blank Word document just to begin." : "Open a guided template, write in a full-size page, save your draft, and export when you need a copy."}</p></div><label>Class<select value={courseId} onChange={(event) => selectCourse(event.target.value)}>{availableClasses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label></section>{notice && <div className="portal-form-notice" role="status">{notice}</div>}{mode === "professor" ? <><section className="template-library"><div className="dashboard-card-heading"><div><span className="portal-kicker">TEMPLATE LIBRARY</span><h2>Reuse or revise.</h2></div><button type="button" onClick={() => { const selectedCourse = availableClasses.find((course) => course.id === courseId); setDraft(createTemplate(selectedCourse?.division || track, courseId)); }}>New template</button></div><div>{visibleTemplates.length ? visibleTemplates.map((template) => <button type="button" className={draft.id === template.id ? "is-active" : ""} key={template.id} onClick={() => setDraft(template)}><span>{template.status}</span><strong>{template.title}</strong><small>{template.sections.length} sections · {template.editor_config.full_page_editor ? "full-page editor" : "guided form"}</small></button>) : <p>No templates for this class yet.</p>}</div></section><TemplateBuilder template={draft} setTemplate={setDraft} onSave={persistTemplate} onPreview={() => setSelectedTemplate(draft)} busy={busy} /><ProfessorReviewWorkspace courseId={courseId} session={session} />{selectedTemplate && <TemplatePreview template={selectedTemplate} onClose={() => setSelectedTemplate(null)} />}</> : <section className="student-assignment-list"><div className="dashboard-card-heading"><div><span className="portal-kicker">READY TO WORK</span><h2>Your template assignments</h2></div><span>{visibleTemplates.length} available</span></div>{visibleTemplates.length ? visibleTemplates.map((template) => <article className="dashboard-card" key={template.id}><div><span>{availableClasses.find((course) => course.id === template.course_id)?.code || "CLASS"}</span><strong>{template.title}</strong><p>{template.instructions}</p></div><ul><li>{template.sections.length} guided sections</li><li>{template.editor_config.full_page_editor ? "Full-page editor included" : "Guided answers"}</li><li>Spelling check on</li></ul><button className="primary" type="button" onClick={() => setSelectedTemplate(template)}>Open assignment</button></article>) : <div className="dashboard-card"><h2>No published templates yet.</h2><p>Your educator's published assignments will appear here.</p></div>}</section>}</div>;
}
