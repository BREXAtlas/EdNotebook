import { useEffect, useMemo, useRef, useState } from "react";
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

function createSection(type = "long") {
  const definition = SECTION_TYPES.find((item) => item.id === type) || SECTION_TYPES[1];
  return {
    id: crypto.randomUUID(),
    type,
    prompt: type === "heading" ? "New section" : definition.label,
    helpText: definition.description,
    required: type !== "heading",
    wordTarget: type === "long" || type === "reflection" ? 150 : 0,
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
    editor_config: { full_page_editor: true, spellcheck: true, allow_word_export: true, allow_pdf_export: true },
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
  const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "DIV"]);
  [...parsed.body.querySelectorAll("*")].forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
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

  return <div className="assignment-template-builder"><section className="dashboard-card template-details-card"><span className="portal-kicker">TEMPLATE DETAILS</span><h2>Build the assignment once.</h2><p>Students answer inside EdNotebook instead of downloading a blank document.</p><label>Template title<input spellCheck value={template.title} onChange={(event) => setTemplate({ ...template, title: event.target.value })} /></label><label>Student instructions<textarea spellCheck rows={4} value={template.instructions} onChange={(event) => setTemplate({ ...template, instructions: event.target.value })} /></label><div className="template-option-grid"><label><input type="checkbox" checked={template.editor_config.full_page_editor} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, full_page_editor: event.target.checked } })} />Include full-page writing workspace</label><label><input type="checkbox" checked={template.editor_config.allow_word_export} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, allow_word_export: event.target.checked } })} />Allow Word export</label><label><input type="checkbox" checked={template.editor_config.allow_pdf_export} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, allow_pdf_export: event.target.checked } })} />Allow PDF export</label><label><input type="checkbox" checked={template.editor_config.spellcheck} onChange={(event) => setTemplate({ ...template, editor_config: { ...template.editor_config, spellcheck: event.target.checked } })} />Spelling check on</label></div></section><section className="dashboard-card template-section-builder"><div className="dashboard-card-heading"><div><span className="portal-kicker">CUSTOM SECTIONS</span><h2>Shape the response.</h2></div><div className="template-add-control"><select aria-label="New section type" value={newType} onChange={(event) => setNewType(event.target.value)}>{SECTION_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select><button type="button" onClick={() => setTemplate({ ...template, sections: [...template.sections, createSection(newType)] })}>Add section</button></div></div><div className="template-section-list">{template.sections.map((section, index) => <article key={section.id} className="template-section-card"><header><span>{String(index + 1).padStart(2, "0")} · {SECTION_TYPES.find((type) => type.id === section.type)?.label}</span><div><button type="button" aria-label="Move section up" disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button><button type="button" aria-label="Move section down" disabled={index === template.sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button><button type="button" onClick={() => setTemplate({ ...template, sections: template.sections.filter((item) => item.id !== section.id) })}>Remove</button></div></header><label>{section.type === "heading" ? "Heading" : "Prompt"}<input spellCheck value={section.prompt} onChange={(event) => updateSection(section.id, { prompt: event.target.value })} /></label><label>Student guidance<textarea spellCheck rows={2} value={section.helpText} onChange={(event) => updateSection(section.id, { helpText: event.target.value })} /></label>{section.type !== "heading" && <div className="template-section-options"><label><input type="checkbox" checked={section.required} onChange={(event) => updateSection(section.id, { required: event.target.checked })} />Required</label>{["long", "reflection"].includes(section.type) && <label>Word target<input type="number" min="0" max="5000" value={section.wordTarget} onChange={(event) => updateSection(section.id, { wordTarget: Number(event.target.value) })} /></label>}</div>}</article>)}</div><footer className="template-builder-actions"><button type="button" onClick={onPreview}>Preview as student</button><button type="button" disabled={busy} onClick={() => onSave("draft")}>Save draft</button><button className="primary" type="button" disabled={busy} onClick={() => onSave("published")}>Publish template</button></footer></section></div>;
}

function GuidedAnswerFields({ template, answers, setAnswers }) {
  return <div className="guided-answer-fields">{template.sections.map((section, index) => {
    if (section.type === "heading") return <h2 key={section.id}>{section.prompt}</h2>;
    const value = answers[section.id] || "";
    const isShort = section.type === "short";
    return <section key={section.id}><div><span>{String(index + 1).padStart(2, "0")}</span><h3>{section.prompt}{section.required && <sup>Required</sup>}</h3></div><p>{section.helpText}</p>{isShort ? <input spellCheck={template.editor_config.spellcheck} value={value} onChange={(event) => setAnswers({ ...answers, [section.id]: event.target.value })} /> : <textarea spellCheck={template.editor_config.spellcheck} rows={section.type === "checklist" ? 5 : 8} value={value} onChange={(event) => setAnswers({ ...answers, [section.id]: event.target.value })} />}<small>{countWords(value)} words{section.wordTarget ? ` · target ${section.wordTarget}` : ""}</small></section>;
  })}</div>;
}

function FullPageEditor({ template, answers, content, setContent, onClose, onSave, status, saving }) {
  const editorRef = useRef(null);
  const workspaceRef = useRef(null);
  const initialContentRef = useRef(content);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const initialContent = sanitizeRichHtml(initialContentRef.current);
    if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
      editorRef.current.innerHTML = initialContent;
    }
  }, []);

  function format(command, value = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setContent(sanitizeRichHtml(editorRef.current?.innerHTML || ""));
  }

  async function toggleBrowserFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await workspaceRef.current?.requestFullscreen?.();
  }

  async function closeEditor() {
    if (document.fullscreenElement) await document.exitFullscreen();
    onClose();
  }

  return <div className="assignment-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="assignment-editor-title"><div className="assignment-full-editor" ref={workspaceRef}><header><div><span className="portal-kicker">EDNOTEBOOK WRITING WORKSPACE</span><h1 id="assignment-editor-title">{template.title}</h1></div><div className="assignment-editor-header-actions"><span className={`editor-save-state is-${status}`}>{saving ? "Saving…" : status === "submitted" ? "Submitted" : "Draft saved"}</span><button type="button" onClick={toggleBrowserFullscreen}>Full screen</button><button type="button" onClick={closeEditor}>Close</button></div></header><div className="assignment-editor-toolbar" role="toolbar" aria-label="Writing tools"><button type="button" onMouseDown={(event) => { event.preventDefault(); format("bold"); }}><strong>B</strong><span>Bold</span></button><button type="button" onMouseDown={(event) => { event.preventDefault(); format("italic"); }}><em>I</em><span>Italic</span></button><button type="button" onMouseDown={(event) => { event.preventDefault(); format("formatBlock", "h2"); }}>H2<span>Heading</span></button><button type="button" onMouseDown={(event) => { event.preventDefault(); format("insertUnorderedList"); }}>• List<span>Bullets</span></button><button type="button" onMouseDown={(event) => { event.preventDefault(); format("undo"); }}>↶<span>Undo</span></button><button type="button" onMouseDown={(event) => { event.preventDefault(); format("redo"); }}>↷<span>Redo</span></button><span className="spellcheck-indicator">✓ Spelling check {template.editor_config.spellcheck ? "on" : "off"}</span></div><main className="assignment-editor-page"><div ref={editorRef} className="assignment-content-editor" role="textbox" aria-label="Full assignment response" aria-multiline="true" contentEditable suppressContentEditableWarning spellCheck={template.editor_config.spellcheck} data-placeholder="Start writing your full response here…" onInput={(event) => setContent(sanitizeRichHtml(event.currentTarget.innerHTML))} /></main><footer><span>{countWords(content)} words</span><div>{exportError && <strong className="editor-export-error">{exportError}</strong>}<button type="button" disabled={!template.editor_config.allow_word_export} onClick={() => downloadWord(template, answers, content)}>Export Word</button><button type="button" disabled={!template.editor_config.allow_pdf_export} onClick={() => { try { setExportError(""); openPdfExport(template, answers, content); } catch (error) { setExportError(error.message); } }}>Export PDF</button><button className="primary" type="button" onClick={onSave}>Save to assignment</button></div></footer></div></div>;
}

function StudentAssignment({ template, session, onClose }) {
  const storageKey = `ednotebook-assignment-${session?.user?.id || "sample"}-${template.id}`;
  const stored = loadJson(storageKey, {});
  const [answers, setAnswers] = useState(stored.answers || {});
  const [documentContent, setDocumentContent] = useState(stored.document_content || "");
  const [status, setStatus] = useState(stored.status || "draft");
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

  const missing = template.sections.filter((section) => section.required && !String(answers[section.id] || "").trim());

  async function persist(nextStatus = status) {
    setSaving(true); setNotice("");
    const submission = { template_id: template.id, course_id: template.course_id, answers, document_content: sanitizeRichHtml(documentContent), word_count: countWords(documentContent), status: nextStatus };
    const result = await saveAssignmentSubmission(submission, session?.user?.id);
    if (result.error) setNotice(`Saved on this device. Cloud save will retry later: ${result.error.message}`);
    else if (result.source === "device") setNotice(nextStatus === "submitted" ? "Assignment marked submitted on this device" : "Draft saved on this device");
    else setNotice(nextStatus === "submitted" ? "Assignment submitted" : "Draft saved to your assignment");
    setStatus(nextStatus); saveJson(storageKey, { ...submission, status: nextStatus, saved_at: new Date().toISOString() }); setSaving(false);
  }

  return <section className="student-assignment-workspace"><header><button type="button" onClick={onClose}>← All assignments</button><div><span>{status}</span><strong>{notice || "Changes save as you work"}</strong></div></header><div className="assignment-student-heading"><span className="portal-kicker">TEMPLATE ASSIGNMENT</span><h1>{template.title}</h1><p>{template.instructions}</p><div><span>✓ Spelling check on</span><span>✓ Draft saves to this page</span><span>✓ No document upload needed</span></div></div><div className="assignment-response-layout"><main className="dashboard-card"><GuidedAnswerFields template={template} answers={answers} setAnswers={setAnswers} /></main><aside><section className="dashboard-card"><span className="portal-kicker">FULL RESPONSE</span><h2>Write without leaving EdNotebook.</h2><p>Open a clean, full-size page for the complete assignment. Your guided answers stay beside it when you return.</p><button className="primary" type="button" disabled={!template.editor_config.full_page_editor} onClick={() => setFullEditor(true)}>Open full writing workspace</button><small>{countWords(documentContent)} words saved</small></section><section className="dashboard-card"><span className="portal-kicker">EXPORT</span><h2>Use your work anywhere.</h2><button type="button" disabled={!template.editor_config.allow_word_export} onClick={() => downloadWord(template, answers, documentContent)}>Export Word</button><button type="button" disabled={!template.editor_config.allow_pdf_export} onClick={() => { try { openPdfExport(template, answers, documentContent); } catch (error) { setNotice(error.message); } }}>Export PDF</button></section></aside></div><footer className="student-assignment-actions"><button type="button" disabled={saving} onClick={() => persist("draft")}>Save draft</button><button className="primary" type="button" disabled={saving || missing.length > 0} onClick={() => persist("submitted")}>{missing.length ? `Complete ${missing.length} required section${missing.length === 1 ? "" : "s"}` : "Submit assignment"}</button></footer>{fullEditor && <FullPageEditor template={template} answers={answers} content={documentContent} setContent={setDocumentContent} onClose={() => setFullEditor(false)} onSave={() => { persist("draft"); setFullEditor(false); }} status={status} saving={saving} />}</section>;
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

  return <div className="assignment-template-workspace"><section className="dashboard-card assignment-template-hero"><div><span className="portal-kicker">{mode === "professor" ? "ASSIGNMENT TEMPLATE STUDIO" : "ASSIGNMENTS"}</span><h1>{mode === "professor" ? "Build the work right into the class." : "Read, write, and submit in one place."}</h1><p>{mode === "professor" ? "Create reusable form-style assignments with custom sections and an optional full-page writing workspace. Students never need a blank Word document just to begin." : "Open a guided template, write in a full-size page, save your draft, and export when you need a copy."}</p></div><label>Class<select value={courseId} onChange={(event) => selectCourse(event.target.value)}>{availableClasses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}</select></label></section>{notice && <div className="portal-form-notice" role="status">{notice}</div>}{mode === "professor" ? <><section className="template-library"><div className="dashboard-card-heading"><div><span className="portal-kicker">TEMPLATE LIBRARY</span><h2>Reuse or revise.</h2></div><button type="button" onClick={() => { const selectedCourse = availableClasses.find((course) => course.id === courseId); setDraft(createTemplate(selectedCourse?.division || track, courseId)); }}>New template</button></div><div>{visibleTemplates.length ? visibleTemplates.map((template) => <button type="button" className={draft.id === template.id ? "is-active" : ""} key={template.id} onClick={() => setDraft(template)}><span>{template.status}</span><strong>{template.title}</strong><small>{template.sections.length} sections · {template.editor_config.full_page_editor ? "full-page editor" : "guided form"}</small></button>) : <p>No templates for this class yet.</p>}</div></section><TemplateBuilder template={draft} setTemplate={setDraft} onSave={persistTemplate} onPreview={() => setSelectedTemplate(draft)} busy={busy} />{selectedTemplate && <div className="template-preview-overlay" role="dialog" aria-modal="true"><div><header><strong>Student preview</strong><button type="button" onClick={() => setSelectedTemplate(null)}>Close</button></header><div className="assignment-student-heading"><span className="portal-kicker">TEMPLATE ASSIGNMENT</span><h1>{selectedTemplate.title}</h1><p>{selectedTemplate.instructions}</p></div><GuidedAnswerFields template={selectedTemplate} answers={{}} setAnswers={() => {}} /></div></div>}</> : <section className="student-assignment-list"><div className="dashboard-card-heading"><div><span className="portal-kicker">READY TO WORK</span><h2>Your template assignments</h2></div><span>{visibleTemplates.length} available</span></div>{visibleTemplates.length ? visibleTemplates.map((template) => <article className="dashboard-card" key={template.id}><div><span>{availableClasses.find((course) => course.id === template.course_id)?.code || "CLASS"}</span><strong>{template.title}</strong><p>{template.instructions}</p></div><ul><li>{template.sections.length} guided sections</li><li>{template.editor_config.full_page_editor ? "Full-page editor included" : "Guided answers"}</li><li>Spelling check on</li></ul><button className="primary" type="button" onClick={() => setSelectedTemplate(template)}>Open assignment</button></article>) : <div className="dashboard-card"><h2>No published templates yet.</h2><p>Your educator's published assignments will appear here.</p></div>}</section>}</div>;
}
