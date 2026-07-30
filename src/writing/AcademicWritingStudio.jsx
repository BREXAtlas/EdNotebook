import { useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceWindowBar } from "../FullscreenSurface.jsx";
import {
  ACADEMIC_DESIGNS,
  academicDesignHtml,
  analyzeAcademicWriting,
  buildReferenceEntryHtml,
  ensurePagedDocument,
  hasMeaningfulDocumentContent,
} from "./academicWritingModel.js";
import "./academic-writing-studio.css";

const SAFE_TAGS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "FONT", "H1", "H2", "H3",
  "I", "LI", "MARK", "OL", "P", "SECTION", "SPAN", "STRONG", "U", "UL",
]);
const SAFE_CLASSES = new Set([
  "document-page",
  "numbered-page",
  "document-cover-page",
  "document-cover-block",
  "document-centered-title",
  "document-references-page",
  "hanging-indent",
]);
const SAFE_STYLE_PROPERTIES = new Set([
  "background-color", "color", "font-family", "font-size", "line-height",
  "margin-left", "padding-left", "text-align", "text-indent",
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sanitizeAcademicHtml(value) {
  const parsed = new DOMParser().parseFromString(String(value || ""), "text/html");
  [...parsed.body.querySelectorAll("*")].forEach((node) => {
    if (!SAFE_TAGS.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (
        node.tagName === "A" &&
        name === "href" &&
        /^(https?:|mailto:)/iu.test(attribute.value)
      ) return;
      if (node.tagName === "FONT" && ["color", "face", "size"].includes(name)) return;
      if (name === "class") {
        const safeClasses = attribute.value
          .split(/\s+/u)
          .filter((className) => SAFE_CLASSES.has(className));
        if (safeClasses.length) {
          node.setAttribute("class", safeClasses.join(" "));
          return;
        }
      }
      if (name === "style") {
        const safeStyle = attribute.value
          .split(";")
          .map((declaration) => declaration.trim())
          .filter(Boolean)
          .filter((declaration) =>
            SAFE_STYLE_PROPERTIES.has(
              declaration.split(":")[0]?.trim().toLowerCase(),
            ))
          .join("; ");
        if (safeStyle) {
          node.setAttribute("style", safeStyle);
          return;
        }
      }
      node.removeAttribute(attribute.name);
    });
  });
  return parsed.body.innerHTML;
}

function academicExportHtml(title, content) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:letter;margin:1in}body{margin:0;color:#111;font:12pt/2 "Times New Roman",serif}.document-page{box-sizing:border-box;min-height:9in;break-after:page;position:relative}.document-page:last-child{break-after:auto}.document-cover-block{display:grid;min-height:7in;place-content:center;text-align:center}.document-centered-title{text-align:center}.hanging-indent{padding-left:.5in;text-indent:-.5in}.numbered-page::after{position:absolute;right:0;top:-.45in;content:counter(page)}</style></head><body>${sanitizeAcademicHtml(ensurePagedDocument(content))}</body></html>`;
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadAcademicWord(title, content) {
  const filename = `${String(title || "document").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "document"}.doc`;
  downloadBlob(
    academicExportHtml(title, content),
    filename,
    "application/msword;charset=utf-8",
  );
}

export function openAcademicPdf(title, content) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Allow the print window, then choose Save as PDF.");
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(academicExportHtml(title, content));
  printWindow.document.close();
  printWindow.addEventListener("load", () => printWindow.print(), { once: true });
}

function countWords(value) {
  const text = String(value || "")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .trim();
  return text ? text.split(/\s+/u).length : 0;
}

function ToolButton({ children, label, onPress }) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onPress();
      }}
    >
      <span aria-hidden="true">{children}</span>
      <small>{label}</small>
    </button>
  );
}

function ToolDrawer({ label, summary, children, open = false }) {
  return (
    <details className="writing-tool-drawer" open={open}>
      <summary><strong>{label}</strong><span>{summary}</span></summary>
      <div>{children}</div>
    </details>
  );
}

export default function AcademicWritingStudio({
  title = "Untitled document",
  content,
  setContent,
  onClose,
  onSave,
  status = "draft",
  saving = false,
  spellCheck = true,
  wordLimit = 0,
  savedSources = [],
  feedback = [],
  secondaryLabel = "",
  secondaryContent = null,
  saveLabel = "Save document",
  onExportWord,
  onExportPdf,
}) {
  const editorRef = useRef(null);
  const workspaceRef = useRef(null);
  const selectionRef = useRef(null);
  const importRef = useRef(null);
  const [currentPage, setCurrentPage] = useState("writing");
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [showWritingReview, setShowWritingReview] = useState(false);
  const [reviewFindings, setReviewFindings] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const pages = useMemo(
    () => [
      { id: "writing", label: "Writing" },
      ...(secondaryLabel ? [{ id: "guided", label: secondaryLabel }] : []),
    ],
    [secondaryLabel],
  );

  useEffect(() => {
    if (currentPage !== "writing") return;
    const paged = sanitizeAcademicHtml(ensurePagedDocument(content));
    if (editorRef.current && editorRef.current.innerHTML !== paged) {
      editorRef.current.innerHTML = paged;
    }
  }, [currentPage, refreshKey]);

  function commitEditor() {
    const safe = sanitizeAcademicHtml(
      ensurePagedDocument(editorRef.current?.innerHTML || ""),
    );
    setContent(safe);
    return safe;
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      editorRef.current?.contains(selection.anchorNode)
    ) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
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
    commitEditor();
    rememberSelection();
  }

  function insertHtml(html) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("insertHTML", false, sanitizeAcademicHtml(html));
    commitEditor();
    rememberSelection();
  }

  function addLink() {
    const url = window.prompt("Paste an https:// link");
    if (url && /^https?:\/\//iu.test(url)) format("createLink", url);
  }

  function setParagraphLineHeight(value) {
    editorRef.current?.focus();
    restoreSelection();
    const selection = window.getSelection();
    let node = selection?.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const paragraph = node?.closest?.("p, blockquote, li");
    if (paragraph && editorRef.current?.contains(paragraph)) {
      paragraph.style.lineHeight = value;
      commitEditor();
      rememberSelection();
      setNotice(value === "2" ? "Double spacing applied to this paragraph." : "Standard spacing applied to this paragraph.");
    } else {
      setNotice("Place the cursor in a paragraph, then choose its spacing.");
    }
  }

  function addPage() {
    const pageHtml = '<section class="document-page numbered-page"><p><br></p></section>';
    const current = commitEditor();
    const next = `${current}${pageHtml}`;
    editorRef.current.innerHTML = next;
    setContent(next);
    setNotice("A new numbered page was added.");
  }

  function togglePageNumbers() {
    const pagesInEditor = editorRef.current?.querySelectorAll(".document-page") || [];
    const shouldNumber = [...pagesInEditor].some(
      (pageNode) => !pageNode.classList.contains("numbered-page"),
    );
    pagesInEditor.forEach((pageNode) =>
      pageNode.classList.toggle("numbered-page", shouldNumber));
    commitEditor();
    setNotice(shouldNumber ? "Page numbers are on." : "Page numbers are off.");
  }

  function applyDesign(designId) {
    const designHtml = academicDesignHtml(designId, { title });
    const current = sanitizeAcademicHtml(
      ensurePagedDocument(editorRef.current?.innerHTML || content),
    );
    const preservingExistingWork = hasMeaningfulDocumentContent(current);
    const next = preservingExistingWork ? `${current}${designHtml}` : designHtml;
    editorRef.current.innerHTML = next;
    setContent(next);
    const designName = ACADEMIC_DESIGNS.find((design) => design.id === designId)?.name ||
      "Academic design";
    setNotice(
      preservingExistingWork
        ? `${designName} was added after your existing pages. Nothing was replaced.`
        : `${designName} is ready to edit.`,
    );
  }

  function addReference(citation = "", url = "") {
    let text = citation;
    let link = url;
    if (!text) text = window.prompt("Paste the formatted APA or MLA reference") || "";
    if (!link) link = window.prompt("Optional: paste the source's https:// link") || "";
    if (!text.trim()) return;
    insertHtml(buildReferenceEntryHtml(text, link));
    setNotice("Reference added with a hanging indent.");
  }

  async function importWord(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.docx$/iu.test(file.name)) {
      setNotice("Choose a .docx Word file. Older .doc files can be saved as .docx in Word first.");
      return;
    }
    try {
      setNotice("Reading the Word document…");
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({
        arrayBuffer: await file.arrayBuffer(),
      });
      const imported = sanitizeAcademicHtml(result.value);
      const importedPages = ensurePagedDocument(imported);
      const current = sanitizeAcademicHtml(ensurePagedDocument(content));
      const next = hasMeaningfulDocumentContent(content)
        ? `${current}${importedPages}`
        : importedPages;
      editorRef.current.innerHTML = next;
      setContent(next);
      setNotice(`${file.name} was added as editable pages${result.messages.length ? ` with ${result.messages.length} conversion note${result.messages.length === 1 ? "" : "s"}` : ""}.`);
    } catch {
      setNotice("That Word file could not be imported. Save it as a standard .docx file and try again.");
    }
  }

  function runWritingReview() {
    const findings = analyzeAcademicWriting(editorRef.current?.innerHTML || content);
    setReviewFindings(findings);
    setShowWritingReview(true);
  }

  async function saveInsideEditor() {
    setSaveConfirmation("");
    const safeContent = commitEditor();
    const result = await onSave?.(safeContent);
    setSaveConfirmation(
      result?.message ||
      `Saved at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
    );
  }

  async function toggleBrowserFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await workspaceRef.current?.requestFullscreen?.();
  }

  async function closeEditor() {
    commitEditor();
    if (document.fullscreenElement) await document.exitFullscreen();
    onClose?.();
  }

  const words = countWords(content);
  const overLimit = wordLimit > 0 && words > wordLimit;
  const exportWord = onExportWord || (() => downloadAcademicWord(title, content));
  const exportPdf = onExportPdf || (() => openAcademicPdf(title, content));

  return (
    <div className="assignment-editor-overlay academic-writing-overlay" role="dialog" aria-modal="true" aria-labelledby="assignment-editor-title">
      <div className="assignment-full-editor academic-writing-studio" ref={workspaceRef}>
        <WorkspaceWindowBar
          title="EdNotebook academic writing studio"
          pages={pages}
          currentPage={currentPage}
          addressPrefix="ednotebook://writing"
          canBack={currentPage !== "writing"}
          canForward={currentPage === "writing" && Boolean(secondaryLabel)}
          onBack={() => setCurrentPage("writing")}
          onForward={() => secondaryLabel && setCurrentPage("guided")}
          onRefresh={() => setRefreshKey((value) => value + 1)}
          onNavigate={setCurrentPage}
          onClose={closeEditor}
        />
        {currentPage === "guided"
          ? <main className="assignment-editor-guided-page">{secondaryContent}</main>
          : (
            <>
              <header>
                <div>
                  <span className="portal-kicker">ACADEMIC WRITING STUDIO</span>
                  <h1 id="assignment-editor-title">{title}</h1>
                </div>
                <div className="assignment-editor-header-actions">
                  <span className={`editor-save-state is-${status}`}>
                    {saving ? "Saving…" : status === "submitted" ? "Submitted" : "Draft"}
                  </span>
                  <button type="button" onClick={toggleBrowserFullscreen}>Use device full screen</button>
                </div>
              </header>
              <nav className="academic-writing-ribbon" aria-label="Organized writing tools">
                <ToolDrawer label="Designs" summary="College paper starters" open>
                  <div className="academic-design-grid">
                    {ACADEMIC_DESIGNS.map((design) => (
                      <button type="button" key={design.id} onClick={() => applyDesign(design.id)}>
                        <strong>{design.name}</strong>
                        <span>{design.description}</span>
                      </button>
                    ))}
                  </div>
                </ToolDrawer>
                <ToolDrawer label="Text" summary="Bold, italic, underline">
                  <div className="writing-tool-row">
                    <label>Font<select aria-label="Font family" defaultValue="Arial" onChange={(event) => format("fontName", event.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option></select></label>
                    <label>Size<select aria-label="Font size" defaultValue="3" onChange={(event) => format("fontSize", event.target.value)}><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Extra large</option></select></label>
                    <ToolButton label="Bold" onPress={() => format("bold")}><strong>B</strong></ToolButton>
                    <ToolButton label="Italic" onPress={() => format("italic")}><em>I</em></ToolButton>
                    <ToolButton label="Underline" onPress={() => format("underline")}><u>U</u></ToolButton>
                    <label className="editor-color-tool">Text color<input type="color" defaultValue="#17233b" onFocus={rememberSelection} onChange={(event) => format("foreColor", event.target.value)} /></label>
                    <label className="editor-color-tool">Highlight<input type="color" defaultValue="#fff2a8" onFocus={rememberSelection} onChange={(event) => format("hiliteColor", event.target.value)} /></label>
                  </div>
                </ToolDrawer>
                <ToolDrawer label="Alignment" summary="Place text on the page">
                  <div className="writing-tool-row">
                    <ToolButton label="Align left" onPress={() => format("justifyLeft")}>≡</ToolButton>
                    <ToolButton label="Center" onPress={() => format("justifyCenter")}>≣</ToolButton>
                    <ToolButton label="Align right" onPress={() => format("justifyRight")}>☷</ToolButton>
                  </div>
                </ToolDrawer>
                <ToolDrawer label="Paragraph" summary="Headings, lists, spacing">
                  <div className="writing-tool-row">
                    <label>Style<select aria-label="Paragraph style" defaultValue="p" onChange={(event) => format("formatBlock", event.target.value)}><option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select></label>
                    <ToolButton label="Bullets" onPress={() => format("insertUnorderedList")}>•</ToolButton>
                    <ToolButton label="Numbered list" onPress={() => format("insertOrderedList")}>1.</ToolButton>
                    <ToolButton label="Indent" onPress={() => format("indent")}>→</ToolButton>
                    <ToolButton label="Outdent" onPress={() => format("outdent")}>←</ToolButton>
                    <ToolButton label="Double spacing" onPress={() => setParagraphLineHeight("2")}>2×</ToolButton>
                    <ToolButton label="Standard spacing" onPress={() => setParagraphLineHeight("1.5")}>1.5×</ToolButton>
                    <ToolButton label="Clear formatting" onPress={() => format("removeFormat")}>Tx</ToolButton>
                  </div>
                </ToolDrawer>
                <ToolDrawer label="Pages + sources" summary="Pages, references, links, Word">
                  <div className="writing-tool-row">
                    <button type="button" onClick={addPage}><span>▤</span><small>Add page</small></button>
                    <button type="button" onClick={togglePageNumbers}><span>#</span><small>Page numbers</small></button>
                    <button type="button" onMouseDown={(event) => { event.preventDefault(); addLink(); }}><span>🔗</span><small>Link</small></button>
                    <button type="button" onClick={() => addReference()}><span>¶</span><small>Add reference</small></button>
                    <button type="button" onClick={() => importRef.current?.click()}><span>W</span><small>Import .docx</small></button>
                    <input ref={importRef} hidden type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importWord} />
                  </div>
                  {savedSources.length > 0 && (
                    <div className="saved-source-insert-list">
                      <strong>Saved EdNotebook sources</strong>
                      {savedSources.slice(0, 8).map((source) => (
                        <button type="button" key={source.id || source.rootId} onClick={() => addReference(source.content?.citation || source.citation, source.content?.source?.url || source.url)}>
                          {source.title || "Saved source"}
                        </button>
                      ))}
                    </div>
                  )}
                </ToolDrawer>
                <ToolDrawer label="Review" summary="Spelling and grammar assist">
                  <div className="writing-tool-row">
                    <span className="spellcheck-indicator">✓ Browser spelling check {spellCheck ? "on" : "off"}</span>
                    <button type="button" onClick={runWritingReview}><span>✓</span><small>Writing review</small></button>
                    <ToolButton label="Undo" onPress={() => format("undo")}>↶</ToolButton>
                    <ToolButton label="Redo" onPress={() => format("redo")}>↷</ToolButton>
                  </div>
                </ToolDrawer>
              </nav>
              {notice && <div className="academic-writing-notice" role="status">{notice}</div>}
              <div className="academic-writing-body">
                <main className="assignment-editor-page">
                  <div
                    key={`writing-${refreshKey}`}
                    ref={editorRef}
                    className="assignment-content-editor academic-paged-editor"
                    role="textbox"
                    aria-label="Academic document"
                    aria-multiline="true"
                    contentEditable
                    suppressContentEditableWarning
                    lang="en"
                    spellCheck={spellCheck}
                    onMouseUp={rememberSelection}
                    onKeyUp={rememberSelection}
                    onInput={() => {
                      setSaveConfirmation("");
                      commitEditor();
                    }}
                  />
                </main>
                {showWritingReview && (
                  <aside className="academic-writing-review" aria-label="Writing review">
                    <header><strong>Writing review</strong><button type="button" onClick={() => setShowWritingReview(false)}>Close</button></header>
                    <p>Private browser-based pattern checks help you revise. They do not verify facts, citations, assignment fit, or correctness.</p>
                    <ul>{reviewFindings.map((finding) => <li className={`is-${finding.level}`} key={finding.id}><strong>{finding.title}</strong><span>{finding.detail}</span></li>)}</ul>
                  </aside>
                )}
                {!showWritingReview && feedback.length > 0 && (
                  <aside className="academic-writing-review academic-published-feedback" aria-label="Professor feedback">
                    <header><strong>Professor feedback</strong><span>{feedback.length}</span></header>
                    <p>These published comments and questions stay beside the same document version.</p>
                    <ul>{feedback.map((item) => <li key={item.id} className={item.feedback_type === "question" ? "is-warning" : ""}><strong>{item.feedback_type === "question" ? "Question" : "Comment"}</strong>{item.selected_text && <mark>{item.selected_text}</mark>}<span>{item.comment}</span></li>)}</ul>
                  </aside>
                )}
              </div>
              <footer>
                <span className={overLimit ? "is-over-limit" : ""}>{words} words{wordLimit ? ` · maximum ${wordLimit}` : ""}{overLimit ? " · shorten before submitting" : ""}</span>
                <div>
                  {saveConfirmation && <strong className="editor-save-confirmation" role="status">✓ {saveConfirmation}</strong>}
                  <button type="button" onClick={exportWord}>Export Word</button>
                  <button type="button" onClick={() => { try { setNotice(""); exportPdf(); } catch (error) { setNotice(error.message); } }}>Export PDF</button>
                  <button className="primary" type="button" disabled={saving} onClick={saveInsideEditor}>{saving ? "Saving…" : saveLabel}</button>
                </div>
              </footer>
            </>
          )}
      </div>
    </div>
  );
}
