import { useMemo, useRef, useState } from "react";

import { extractSyllabusFile } from "../demo/syllabusFileExtractors.js";
import { environmentStorage, STORAGE_KEYS } from "../storage/environmentStorage.js";
import {
  ANGELO_STATE_2026_PROFILE,
  evaluateSyllabusRequirements,
  syllabusFieldDefinitions,
} from "../syllabus/angeloState2026Profile.js";
import {
  saveCourseSyllabusDraft,
  sourceTypeForSyllabus,
} from "../syllabus/syllabusService.js";
import { interpretUncertainSyllabusSections } from "./learningAiService.js";
import { extractDeterministicSyllabus, mergeSyllabusExtraction } from "./syllabusExtractionContract.js";
import "./syllabus-to-course.css";

const SYLLABUS_RECORD_KEY = "ednotebook-professor-syllabus-extraction";
const AI_UNCERTAINTY_ENABLED = import.meta.env.VITE_SYLLABUS_AI_ENABLED === "true";

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (item && typeof item === "object" ? JSON.stringify(item) : String(item))).join("\n");
  }
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

function parseValue(value, definition) {
  if (["list", "structured_list"].includes(definition.valueKind)) {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }
  if (definition.valueKind === "structured") {
    const lines = value.split("\n").map((item) => item.trim()).filter(Boolean);
    return lines.map((line) => {
      const match = line.match(/^(.+?)\s*[:\-]\s*(.+)$/);
      return match ? { label: match[1].trim(), value: match[2].trim() } : line;
    });
  }
  return value;
}

function fieldRows(definitions, fields) {
  return definitions.map((definition) => ({
    definition,
    field: fields[definition.key] || null,
  }));
}

function groupDefinitions(definitions) {
  const groups = [];
  for (const definition of definitions) {
    let group = groups.find((item) => item.sectionId === definition.sectionId);
    if (!group) {
      group = {
        sectionId: definition.sectionId,
        sectionTitle: definition.sectionTitle,
        sectionRequirement: definition.sectionRequirement,
        managedBy: definition.managedBy,
        definitions: [],
      };
      groups.push(group);
    }
    group.definitions.push(definition);
  }
  return groups;
}

function statusLabel(item) {
  return {
    present: "Found",
    missing: "Required · missing",
    institution_managed: "Institution-managed",
    optional: "Optional",
    conditional_review: "Conditional review",
    operational_missing: "Mapping metadata",
  }[item?.status] || "Review";
}

function fieldStatusClass(item) {
  return `syllabus-field-status is-${item?.status || "review"}`;
}

export default function SyllabusToCourse({ onBack, onContinue }) {
  const courseDraft = useMemo(() => environmentStorage.getJson(STORAGE_KEYS.courseDraft, {}) || {}, []);
  const definitions = useMemo(() => syllabusFieldDefinitions(ANGELO_STATE_2026_PROFILE), []);
  const groups = useMemo(() => groupDefinitions(definitions), [definitions]);
  const fileInput = useRef(null);
  const [sourceText, setSourceText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("Pasted syllabus text");
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("input");
  const [status, setStatus] = useState("Paste or upload a syllabus. EdNotebook checks it against the Angelo State 2026 requirement profile before using AI.");
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [cloudRecord, setCloudRecord] = useState(null);

  const fields = result?.fields || {};
  const requirementReview = result?.requirementReview || evaluateSyllabusRequirements(fields, ANGELO_STATE_2026_PROFILE);
  const requirementByKey = new Map(requirementReview.items.map((item) => [item.key, item]));

  async function readFile(file) {
    if (!file) return;
    setPhase("reading");
    setError("");
    setStatus("Reading syllabus locally in your browser…");
    try {
      const extracted = await extractSyllabusFile(file, { onProgress: setStatus });
      setSourceText(extracted.text);
      setSourceLabel(`${file.name} · ${extracted.detail}`);
      setStatus("Syllabus text is ready. Review it, then run the institutional requirement extraction.");
      setPhase("input");
    } catch (readError) {
      setError(readError.message || "The syllabus could not be read.");
      setPhase("input");
    }
  }

  function runDeterministicExtraction() {
    setError("");
    try {
      const extracted = extractDeterministicSyllabus(sourceText, ANGELO_STATE_2026_PROFILE);
      setResult(extracted);
      setApproved(false);
      setCloudRecord(null);
      setPhase("review");
      setStatus(
        `${extracted.requirementReview.requiredComplete} of ${extracted.requirementReview.requiredTotal} professor-managed required fields were found. ` +
        `${extracted.requirementReview.institutionManaged.length} institution-managed fields remain attached to the template.`,
      );
    } catch (extractError) {
      setError(extractError.message || "The syllabus could not be extracted.");
    }
  }

  async function resolveUncertainty() {
    if (!AI_UNCERTAINTY_ENABLED) {
      setError("Governed AI uncertainty extraction remains disabled until the ASU profile prompt, model, and task are approved in TOS.");
      return;
    }
    if (!result?.uncertainSections?.length) return;
    setPhase("ai");
    setError("");
    setStatus("TOS is interpreting only the uncertain syllabus sections against the approved requirement profile…");
    try {
      const response = await interpretUncertainSyllabusSections({
        uncertainSections: result.uncertainSections,
        deterministicFields: {
          ...result.fields,
          _requirementProfile: {
            profileKey: ANGELO_STATE_2026_PROFILE.profileKey,
            version: ANGELO_STATE_2026_PROFILE.version,
            fields: definitions.map(({ key, label, required, managedBy, sectionTitle }) => ({ key, label, required, managedBy, sectionTitle })),
          },
        },
      }, { courseId: courseDraft.id || "" });
      setResult(mergeSyllabusExtraction(result, response.artifact, ANGELO_STATE_2026_PROFILE));
      setPhase("review");
      setStatus("AI uncertainty review returned as an unpublished draft. Compare every field with the source text.");
    } catch (aiError) {
      setPhase("review");
      setError(aiError.message || "The uncertain syllabus sections could not be interpreted.");
      setStatus("Your deterministic extraction and structured shell remain available. No course was changed.");
    }
  }

  function updateField(definition, value) {
    setResult((current) => {
      const nextFields = {
        ...(current?.fields || {}),
        [definition.key]: {
          ...(current?.fields?.[definition.key] || {}),
          value: parseValue(value, definition),
          confidence: 1,
          sourceExcerpt: current?.fields?.[definition.key]?.sourceExcerpt || "Professor-entered structured syllabus content",
          method: "professor_edited",
        },
      };
      return {
        ...(current || {
          sourceText,
          profile: {
            profileKey: ANGELO_STATE_2026_PROFILE.profileKey,
            version: ANGELO_STATE_2026_PROFILE.version,
            title: ANGELO_STATE_2026_PROFILE.title,
          },
          missingInformation: [],
          conflictingInformation: [],
          uncertainSections: [],
          proposedCourseOutline: null,
        }),
        fields: nextFields,
        requirementReview: evaluateSyllabusRequirements(nextFields, ANGELO_STATE_2026_PROFILE),
      };
    });
    setApproved(false);
    setCloudRecord(null);
  }

  async function acceptExtraction() {
    if (!approved || !result) return;
    const compliance = evaluateSyllabusRequirements(result.fields, ANGELO_STATE_2026_PROFILE);
    const record = {
      format: "EdNotebookStructuredSyllabus/1.0",
      reviewState: "professor_reviewed_draft",
      acceptedAt: new Date().toISOString(),
      sourceLabel,
      sourceText,
      profile: {
        profileKey: ANGELO_STATE_2026_PROFILE.profileKey,
        version: ANGELO_STATE_2026_PROFILE.version,
        title: ANGELO_STATE_2026_PROFILE.title,
      },
      structuredContent: result.fields,
      compliance: {
        requiredComplete: compliance.requiredComplete,
        requiredTotal: compliance.requiredTotal,
        missingRequiredKeys: compliance.missingRequired.map((item) => item.key),
        conditionalReviewKeys: compliance.conditionalReview.map((item) => item.key),
        institutionManagedKeys: compliance.institutionManaged.map((item) => item.key),
        readyForApproval: compliance.readyForApproval,
      },
      lmsMapping: {
        platform: "blackboard",
        courseId: result.fields.blackboardCourseId?.value || null,
        status: result.fields.blackboardCourseId?.value ? "mapped_draft" : "not_mapped",
      },
      extraction: result,
    };

    environmentStorage.setJson(SYLLABUS_RECORD_KEY, record);
    environmentStorage.setItem(STORAGE_KEYS.courseStep, "3");
    setPhase("saving");
    setError("");
    setStatus("Saving the professor-reviewed syllabus draft and immutable version record…");

    const courseId = courseDraft.id || environmentStorage.getItem(STORAGE_KEYS.courseId) || "";
    try {
      const saved = await saveCourseSyllabusDraft(courseId, record, {
        sourceType: sourceTypeForSyllabus(sourceLabel, Boolean(sourceText.trim())),
        sourceName: sourceLabel.split(" · ")[0],
        changeSummary: "Professor reviewed the ASU 2026 requirement extraction and structured syllabus shell.",
      });
      setCloudRecord(saved);
      setPhase("accepted");
      setStatus(
        compliance.readyForApproval
          ? `Cloud syllabus version ${saved.current_version} saved. All professor-managed required fields are present; institutional blocks and final approval remain governed separately.`
          : `Cloud syllabus version ${saved.current_version} saved with ${compliance.missingRequired.length} required field${compliance.missingRequired.length === 1 ? "" : "s"} still needing attention.`,
      );
    } catch (saveError) {
      setPhase("review");
      setError(saveError.message || "The structured syllabus draft could not be saved to the course.");
      setStatus("A local recovery copy remains on this device. The cloud version was not created, and no syllabus was published.");
    }
  }

  return (
    <main className="syllabus-course-page">
      <header className="syllabus-course-hero">
        <div>
          <span>PHASE 3 · INSTITUTIONAL SYLLABUS SHELL</span>
          <h1>Extract, create, validate, and map the syllabus before it reaches Blackboard.</h1>
          <p>EdNotebook uses the Angelo State 2026 checklist as a versioned requirement profile. Professor content, institution-managed policy blocks, optional program content, and Blackboard mapping remain distinct.</p>
        </div>
        <button type="button" onClick={onBack}>Back to course builder</button>
      </header>

      <section className="syllabus-course-status" role="status">
        <strong>Current status</strong>
        <p>{status}</p>
      </section>

      <section className="syllabus-profile-summary" aria-labelledby="syllabus-profile-title">
        <div>
          <span>REQUIREMENT PROFILE</span>
          <h2 id="syllabus-profile-title">{ANGELO_STATE_2026_PROFILE.title}</h2>
          <p>Version {ANGELO_STATE_2026_PROFILE.version} · effective {ANGELO_STATE_2026_PROFILE.effectiveFrom} through {ANGELO_STATE_2026_PROFILE.effectiveTo}</p>
        </div>
        <dl>
          <div><dt>Professor-managed required</dt><dd>{requirementReview.requiredComplete}/{requirementReview.requiredTotal}</dd></div>
          <div><dt>Institution-managed blocks</dt><dd>{requirementReview.institutionManaged.length}</dd></div>
          <div><dt>Conditional review</dt><dd>{requirementReview.conditionalReview.length}</dd></div>
          <div><dt>Blackboard mapping</dt><dd>{fields.blackboardCourseId?.value ? "Draft mapped" : "Not mapped"}</dd></div>
          <div><dt>Cloud version</dt><dd>{cloudRecord?.current_version || "Not saved"}</dd></div>
          <div><dt>Publication</dt><dd>Not published</dd></div>
        </dl>
      </section>

      <section className="syllabus-course-input">
        <div className="syllabus-course-heading">
          <div><span>1 · SOURCE OR NEW SHELL</span><h2>Upload an existing syllabus or start completing the structured fields</h2></div>
          <small>{sourceLabel}</small>
        </div>
        <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv" hidden onChange={(event) => readFile(event.target.files?.[0])} />
        <div className="syllabus-course-actions">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={phase === "reading"}>Upload PDF, DOCX, or text</button>
          <button type="button" className="primary" onClick={runDeterministicExtraction} disabled={!sourceText.trim() || phase === "reading"}>Extract and check requirements</button>
          <button type="button" onClick={() => { setResult({ sourceText: "", fields: {}, requirementReview: evaluateSyllabusRequirements({}, ANGELO_STATE_2026_PROFILE), missingInformation: [], conflictingInformation: [], uncertainSections: [], proposedCourseOutline: null }); setPhase("review"); setCloudRecord(null); setStatus("Blank institutional syllabus shell opened. Complete required professor fields; institution-managed blocks remain locked."); }}>Start blank structured syllabus</button>
        </div>
        <textarea rows={14} value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceLabel("Pasted syllabus text"); }} placeholder="Paste the complete syllabus here…" />
        {error ? <div className="syllabus-course-error" role="alert">{error}</div> : null}
      </section>

      {result ? (
        <section className="syllabus-course-review">
          <div className="syllabus-course-heading">
            <div><span>2 · STRUCTURED REVIEW</span><h2>Compare source evidence and complete the requirement shell</h2></div>
            <button type="button" onClick={resolveUncertainty} disabled={!AI_UNCERTAINTY_ENABLED || !result.uncertainSections?.length || phase === "ai"}>
              {AI_UNCERTAINTY_ENABLED ? (phase === "ai" ? "Interpreting uncertainty…" : "Interpret uncertain sections") : "AI review pending TOS approval"}
            </button>
          </div>

          <div className="syllabus-review-grid">
            <div className="source-pane"><h3>Source syllabus</h3><pre>{sourceText || "No source document was supplied. This syllabus began as a blank structured shell."}</pre></div>
            <div className="field-pane syllabus-shell-pane">
              <h3>Structured syllabus sections</h3>
              {groups.map((group) => {
                const rows = fieldRows(group.definitions, fields);
                const presentCount = rows.filter(({ definition }) => requirementByKey.get(definition.key)?.present).length;
                return (
                  <section className="syllabus-shell-section" key={group.sectionId}>
                    <header>
                      <div><strong>{group.sectionTitle}</strong><small>{group.sectionRequirement.replaceAll("_", " ")}</small></div>
                      <span>{presentCount}/{rows.length}</span>
                    </header>
                    {rows.map(({ definition, field }) => {
                      const item = requirementByKey.get(definition.key);
                      const institutionManaged = definition.managedBy === "institution";
                      return (
                        <article key={definition.key}>
                          <div className="syllabus-field-heading">
                            <div><strong>{definition.label}</strong>{definition.guidance ? <small>{definition.guidance}</small> : null}</div>
                            <span className={fieldStatusClass(item)}>{statusLabel(item)}</span>
                          </div>
                          <textarea
                            rows={["long_text", "structured_list"].includes(definition.valueKind) ? 5 : 2}
                            value={formatValue(field?.value)}
                            placeholder={institutionManaged ? "Supplied and versioned by the institution template" : `Enter ${definition.label.toLowerCase()}`}
                            readOnly={institutionManaged}
                            onChange={(event) => updateField(definition, event.target.value)}
                          />
                          {definition.condition ? <p className="syllabus-field-condition">{definition.condition}</p> : null}
                          {definition.references?.length ? <p className="syllabus-field-references">Authority: {definition.references.join(" · ")}</p> : null}
                          <blockquote>{field?.sourceExcerpt || (institutionManaged ? "Institution template source will be recorded here." : "No source excerpt recorded. Professor entry or review is required.")}</blockquote>
                        </article>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </div>

          <div className="syllabus-review-flags">
            <article><h3>Required fields needing attention</h3>{requirementReview.missingRequired.length ? <ul>{requirementReview.missingRequired.map((item) => <li key={item.key}>{item.sectionTitle}: {item.label}</li>)}</ul> : <p>All professor-managed required fields are present.</p>}</article>
            <article><h3>Conditional checks</h3>{requirementReview.conditionalReview.length ? <ul>{requirementReview.conditionalReview.map((item) => <li key={item.key}>{item.label}{item.condition ? ` — ${item.condition}` : ""}</li>)}</ul> : <p>No conditional fields need review.</p>}</article>
            <article><h3>Institution-managed controls</h3><p>{requirementReview.institutionManaged.length} required policy or handbook blocks are locked for institutional versioning rather than professor editing.</p></article>
            <article><h3>Conflicting information</h3>{result.conflictingInformation?.length ? <ul>{result.conflictingInformation.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None identified.</p>}</article>
          </div>

          <label className="syllabus-course-confirm"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /><span>I compared the structured fields, missing requirements, conditional items, conflicts, source excerpts, institution-managed blocks, and Blackboard mapping status.</span></label>
          <div className="syllabus-course-actions">
            <button type="button" className="primary" disabled={!approved || phase === "ai" || phase === "saving"} onClick={acceptExtraction}>{phase === "saving" ? "Saving versioned syllabus…" : "Save professor-reviewed structured syllabus draft"}</button>
            {phase === "accepted" ? <button type="button" onClick={onContinue}>Continue to course outline</button> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
