import { useMemo, useRef, useState } from "react";

import { extractSyllabusFile } from "../demo/syllabusFileExtractors.js";
import { environmentStorage, STORAGE_KEYS } from "../storage/environmentStorage.js";
import { interpretUncertainSyllabusSections } from "./learningAiService.js";
import { extractDeterministicSyllabus, mergeSyllabusExtraction } from "./syllabusExtractionContract.js";
import "./syllabus-to-course.css";

const LABELS = {
  courseTitle: "Course title",
  courseCode: "Course code",
  instructor: "Instructor",
  email: "Email",
  officeHours: "Office hours",
  term: "Term",
  learningObjectives: "Learning objectives",
  assignments: "Assignments",
  gradingStructure: "Grading structure",
  schedule: "Schedule",
  requiredMaterials: "Required materials",
  policies: "Policies",
};

function formatValue(value) {
  if (Array.isArray(value)) return value.join("\n");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

export default function SyllabusToCourse({ onBack, onContinue }) {
  const courseDraft = useMemo(() => environmentStorage.getJson(STORAGE_KEYS.courseDraft, {}) || {}, []);
  const fileInput = useRef(null);
  const [sourceText, setSourceText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Pasted syllabus text");
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("input");
  const [status, setStatus] = useState("Paste or upload a syllabus. EdNotebook extracts obvious fields before using AI.");
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);

  async function readFile(file) {
    if (!file) return;
    setPhase("reading");
    setError("");
    setStatus("Reading syllabus locally in your browser…");
    try {
      const extracted = await extractSyllabusFile(file, { onProgress: setStatus });
      setSourceText(extracted.text);
      setSourceLabel(`${file.name} · ${extracted.detail}`);
      setStatus("Syllabus text is ready. Review it, then begin deterministic extraction.");
      setPhase("input");
    } catch (readError) {
      setError(readError.message || "The syllabus could not be read.");
      setPhase("input");
    }
  }

  function runDeterministicExtraction() {
    setError("");
    try {
      const extracted = extractDeterministicSyllabus(sourceText);
      setResult(extracted);
      setApproved(false);
      setPhase("review");
      setStatus(extracted.uncertainSections.length
        ? `Deterministic extraction completed. ${extracted.uncertainSections.length} uncertain section${extracted.uncertainSections.length === 1 ? "" : "s"} can be interpreted by the governed router.`
        : "Deterministic extraction completed. No AI interpretation is required unless you choose to revise the source.");
    } catch (extractError) {
      setError(extractError.message || "The syllabus could not be extracted.");
    }
  }

  async function resolveUncertainty() {
    if (!result?.uncertainSections?.length) return;
    setPhase("ai");
    setError("");
    setStatus("TOS is interpreting only the uncertain syllabus sections…");
    try {
      const response = await interpretUncertainSyllabusSections({
        uncertainSections: result.uncertainSections,
        deterministicFields: result.fields,
      }, { courseId: courseDraft.id || "" });
      setResult(mergeSyllabusExtraction(result, response.artifact));
      setPhase("review");
      setStatus("AI uncertainty review returned as an unpublished draft. Compare every field with the source text.");
    } catch (aiError) {
      setPhase("review");
      setError(aiError.message || "The uncertain syllabus sections could not be interpreted.");
      setStatus("Your deterministic extraction remains available. No course was changed.");
    }
  }

  function updateField(key, value) {
    setResult((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [key]: {
          ...(current.fields[key] || {}),
          value,
          confidence: current.fields[key]?.confidence ?? 1,
          sourceExcerpt: current.fields[key]?.sourceExcerpt || "Professor-entered correction",
          method: "professor_edited",
        },
      },
    }));
  }

  function acceptExtraction() {
    if (!approved || !result) return;
    const record = {
      format: "EdNotebookProfessorSyllabusExtraction/1.0",
      reviewState: "professor_accepted",
      acceptedAt: new Date().toISOString(),
      sourceLabel,
      sourceText,
      extraction: result,
    };
    environmentStorage.setJson("ednotebook-professor-syllabus-extraction", record);
    environmentStorage.setItem(STORAGE_KEYS.courseStep, "3");
    setPhase("accepted");
    setStatus("Professor-approved extraction saved. It remains a draft until you convert or revise the course outline.");
  }

  const fields = result?.fields || {};

  return (
    <main className="syllabus-course-page">
      <header className="syllabus-course-hero">
        <div>
          <span>PHASE 3 · PROFESSOR SYLLABUS-TO-COURSE EXTRACTION</span>
          <h1>Extract first. Compare with the source. Approve only what is accurate.</h1>
          <p>EdNotebook reads obvious fields locally. Only uncertain sections go to the governed TOS router, and nothing changes the course without professor approval.</p>
        </div>
        <button type="button" onClick={onBack}>Back to course builder</button>
      </header>

      <section className="syllabus-course-status" role="status"><strong>Current status</strong><p>{status}</p></section>

      <section className="syllabus-course-input">
        <div className="syllabus-course-heading"><div><span>1 · SOURCE</span><h2>Paste or upload the syllabus</h2></div><small>{sourceLabel}</small></div>
        <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv" hidden onChange={(event) => readFile(event.target.files?.[0])} />
        <div className="syllabus-course-actions">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={phase === "reading"}>Upload PDF, DOCX, or text</button>
          <button type="button" className="primary" onClick={runDeterministicExtraction} disabled={!sourceText.trim() || phase === "reading"}>Extract syllabus fields</button>
        </div>
        <textarea rows={18} value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceLabel("Pasted syllabus text"); }} placeholder="Paste the complete syllabus here…" />
        {error ? <div className="syllabus-course-error" role="alert">{error}</div> : null}
      </section>

      {result ? (
        <section className="syllabus-course-review">
          <div className="syllabus-course-heading"><div><span>2 · SIDE-BY-SIDE REVIEW</span><h2>Compare extracted values with source evidence</h2></div><button type="button" onClick={resolveUncertainty} disabled={!result.uncertainSections.length || phase === "ai"}>{phase === "ai" ? "Interpreting uncertainty…" : "Interpret uncertain sections"}</button></div>
          <div className="syllabus-review-grid">
            <div className="source-pane"><h3>Source syllabus</h3><pre>{sourceText}</pre></div>
            <div className="field-pane"><h3>Extracted fields</h3>{Object.entries(fields).map(([key, item]) => <article key={key}><div><strong>{LABELS[key] || key}</strong><span>{Math.round(Number(item.confidence || 0) * 100)}% · {item.method || "AI"}</span></div><textarea rows={Array.isArray(item.value) ? 5 : 2} value={formatValue(item.value)} onChange={(event) => updateField(key, Array.isArray(item.value) ? event.target.value.split("\n").filter(Boolean) : event.target.value)} /><blockquote>{item.sourceExcerpt || "No source excerpt recorded"}</blockquote></article>)}</div>
          </div>

          <div className="syllabus-review-flags">
            <article><h3>Missing information</h3>{result.missingInformation.length ? <ul>{result.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None identified.</p>}</article>
            <article><h3>Conflicting information</h3>{result.conflictingInformation.length ? <ul>{result.conflictingInformation.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None identified.</p>}</article>
            <article><h3>Uncertain sections</h3><p>{result.uncertainSections.length} section{result.uncertainSections.length === 1 ? "" : "s"} held for governed interpretation.</p></article>
          </div>

          <label className="syllabus-course-confirm"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /><span>I compared the extracted fields, missing information, conflicts, and source excerpts with the syllabus.</span></label>
          <div className="syllabus-course-actions"><button type="button" className="primary" disabled={!approved || phase === "ai"} onClick={acceptExtraction}>Accept extraction as professor-reviewed draft</button>{phase === "accepted" ? <button type="button" onClick={onContinue}>Continue to course outline</button> : null}</div>
        </section>
      ) : null}
    </main>
  );
}