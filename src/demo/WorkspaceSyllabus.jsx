import { useEffect, useRef, useState } from "react";
import { dateKey, formatDateTime, NotebookLabel } from "./demoShared.jsx";

function defaultSyllabusText(persona) {
  if (persona.id === "k12") return `ACCOUNTING I\nRequired text: Introduction to Accounting course packet\nLearning objectives:\n- Explain the accounting cycle\n- Prepare journals, ledgers, and a trial balance\n- Discuss ethics and accounting careers\nAssignments:\nJournal entries case due September 22, 2026 at 3:30 PM\nCareer interview due October 6, 2026 at 8:00 AM`;
  if (persona.id === "professor") return `TRANSFORMATIVE TEACHING — EDUC 5302\nRequired reading: Teaching for Transformation\nLearning objectives:\n- Design learner-centered experiences\n- Evaluate inclusive teaching strategies\n- Use AI responsibly in course preparation\nAssignments:\nTeaching philosophy statement due August 21, 2026 at 5:00 PM\nLearning design prototype due September 11, 2026 at 11:59 PM`;
  return `PRINCIPLES OF MARKETING — MKTG 2301\nRequired book: Principles of Marketing, 19th edition\nLearning objectives:\n- Analyze customer value and market segments\n- Explain positioning and ethical promotion\n- Build a basic marketing plan\nAssignments:\nMarketing reflection draft due August 21, 2026 at 11:59 PM\nAudience analysis due September 4, 2026 at 5:00 PM`;
}

function extractSyllabus(text, persona) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = lines[0] || `${persona.classes[0].title} syllabus`;
  const bookLine = lines.find((line) => /required (book|text|reading)|textbook/i.test(line));
  const objectiveLines = lines.filter((line) => /^[-•]/.test(line)).map((line) => line.replace(/^[-•]\s*/, "")).slice(0, 5);
  const datePattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2026(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?/i;
  const assignmentLines = lines.filter((line) => /due|deadline/i.test(line));
  const extractedAssignments = assignmentLines.map((line, index) => {
    const dateMatch = line.match(datePattern);
    const titlePart = line.split(/\s+due\s+/i)[0] || `Extracted assignment ${index + 1}`;
    let due = persona.assignments[index]?.due || "2026-09-15T23:59:00-05:00";
    if (dateMatch) {
      const parsed = new Date(`${dateMatch[0].replace(/\s+at\s+/i, " ")} CDT`);
      if (!Number.isNaN(parsed.getTime())) due = parsed.toISOString();
    }
    return { id: `extract-${index}-${Date.now()}`, course: persona.classes[0].code, title: titlePart, due, hours: index === 0 ? 2.5 : 1.5, status: "not-started", priority: index === 0 ? "high" : "medium", description: "Extracted from the uploaded syllabus and waiting for human approval." };
  });
  return {
    title,
    themes: persona.id === "professor" ? ["Transformative leadership", "Inclusive teaching", "Responsible AI"] : persona.id === "k12" ? ["Accounting cycle", "Financial statements", "Career readiness"] : ["Customer value", "Market segments", "Ethical promotion"],
    objectives: objectiveLines.length ? objectiveLines : ["Identify the course’s central concepts", "Apply learning to a realistic task", "Use evidence and source material responsibly"],
    books: [bookLine ? bookLine.replace(/^Required (book|text|reading):\s*/i, "") : "No required book confidently detected"],
    assignments: extractedAssignments.length ? extractedAssignments : persona.assignments.slice(0, 2).map((item) => ({ ...item, id: `extract-${item.id}` })),
  };
}

function SyllabusPanel({ persona, assignments, setAssignments }) {
  const [text, setText] = useState(() => defaultSyllabusText(persona));
  const [fileName, setFileName] = useState("");
  const [extraction, setExtraction] = useState(null);
  const [approved, setApproved] = useState([]);
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { setText(defaultSyllabusText(persona)); setExtraction(null); setApproved([]); setNotice(""); }, [persona.id]);
  function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result || ""));
      reader.readAsText(file);
    } else {
      setNotice("PDF/DOCX parsing is represented with sample extraction in this front-end demo. Production extraction runs in a protected document service.");
    }
  }
  function runExtraction() {
    const next = extractSyllabus(text, persona);
    setExtraction(next);
    setApproved(next.assignments.map((item) => item.id));
    setNotice(`Extracted ${next.assignments.length} assignment dates, ${next.objectives.length} learning objectives, and ${next.books.length} required-book entry.`);
  }
  function addApproved() {
    if (!extraction) return;
    const selected = extraction.assignments.filter((item) => approved.includes(item.id));
    const existing = new Set(assignments.map((item) => `${item.course}-${item.title}-${dateKey(item.due)}`));
    const merged = [...assignments, ...selected.filter((item) => !existing.has(`${item.course}-${item.title}-${dateKey(item.due)}`))];
    setAssignments(merged);
    setNotice(`${selected.length} approved dates added to the shared calendar and reminder plan.`);
  }
  return (
    <div className="workspace-panel-stack">
      <section className="paper-card syllabus-upload-card">
        <div className="dashboard-card-heading"><div><NotebookLabel>SYLLABUS INTELLIGENCE</NotebookLabel><h1>Upload the document. Review the semester it contains.</h1><p>This workflow is available in independent student mode; a teacher account is not required.</p></div><button className="primary-paper-button" type="button" onClick={() => inputRef.current?.click()}>Choose syllabus</button></div>
        <input ref={inputRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => handleFile(event.target.files?.[0])} />
        <div className="syllabus-editor-grid">
          <div><label>Course text<textarea value={text} rows={14} onChange={(event) => setText(event.target.value)} /></label><div className="file-summary"><span>{fileName || "Sample syllabus text loaded"}</span><small>PDF · DOCX · TXT · MD</small></div><button type="button" onClick={runExtraction}>Extract course details</button></div>
          <aside><strong>What EdNotebook looks for</strong><ul><li>Course title, code, term, and instructor</li><li>Themes and key learning objectives</li><li>Required books, readings, tools, and materials</li><li>Assignment titles, descriptions, dates, and times</li><li>Estimated project effort and reminder windows</li><li>Late-work, attendance, and grading policies</li></ul><p>Every result is a draft until a human approves it.</p></aside>
        </div>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </section>
      {extraction && <section className="paper-card extraction-result-card"><div className="dashboard-card-heading"><div><NotebookLabel>EXTRACTION REVIEW</NotebookLabel><h2>{extraction.title}</h2></div><button type="button" onClick={addApproved}>Add approved dates to calendar</button></div><div className="extraction-summary-grid"><article><strong>Themes</strong>{extraction.themes.map((item) => <span key={item}>{item}</span>)}</article><article><strong>Learning objectives</strong>{extraction.objectives.map((item) => <span key={item}>{item}</span>)}</article><article><strong>Required books & materials</strong>{extraction.books.map((item) => <span key={item}>{item}</span>)}</article></div><div className="extracted-assignment-list"><div className="extracted-head"><span>Include</span><span>Assignment</span><span>Due</span><span>Effort</span></div>{extraction.assignments.map((item) => <label key={item.id}><input type="checkbox" checked={approved.includes(item.id)} onChange={() => setApproved(approved.includes(item.id) ? approved.filter((id) => id !== item.id) : [...approved, item.id])} /><span><strong>{item.title}</strong><small>{item.course}</small></span><span>{formatDateTime(item.due)}</span><span>{item.hours}h</span></label>)}</div></section>}
    </div>
  );
}

export { SyllabusPanel };
