from pathlib import Path

path = Path('src/ai/SyllabusToCourse.jsx')
text = path.read_text()


def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing {label}')
    text = text.replace(old, new, 1)


replace_once(
    '  const [aiProvenance, setAiProvenance] = useState(null);\n',
    '  const [aiProvenance, setAiProvenance] = useState(null);\n  const [aiReview, setAiReview] = useState(null);\n',
    'aiReview state',
)
replace_once(
    '      setOperationNotice(null);\n      setAiProvenance(null);\n',
    '      setOperationNotice(null);\n      setAiProvenance(null);\n      setAiReview(null);\n',
    'file reset',
)
replace_once(
    '    setAiProvenance(null);\n    setPhase("extracting");\n',
    '    setAiProvenance(null);\n    setAiReview(null);\n    setPhase("extracting");\n',
    'extraction reset',
)

old_success = '''      setResult(
        mergeSyllabusExtraction(
          result,
          response.artifact,
          ANGELO_STATE_2026_PROFILE,
        ),
      );
      setAiProvenance(response.provenance || null);
      setPhase("review");
      setStatus(
        "AI uncertainty review returned as an unpublished draft. Compare every field with the source text.",
      );
      setOperationNotice({
        scope: "review",
        type: "success",
        title: "Governed AI uncertainty review complete",
        message: "The returned draft is source-grounded and still requires professor review. It has not been saved, approved, mapped, or published.",
      });
      scrollToElement(reviewRef);
'''
new_success = '''      const knownDefinitionByKey = new Map(
        definitions.map((definition) => [definition.key, definition]),
      );
      const acceptedAiFields = Object.entries(response.artifact?.fields || {})
        .filter(([key, value]) => (
          knownDefinitionByKey.has(key)
          && value
          && typeof value === "object"
          && String(value.sourceExcerpt || "").trim()
        ));
      if (!acceptedAiFields.length) {
        throw new Error(
          "The AI provider returned no usable source-grounded syllabus fields. No draft was applied.",
        );
      }
      const merged = mergeSyllabusExtraction(
        result,
        response.artifact,
        ANGELO_STATE_2026_PROFILE,
      );
      const appliedFields = acceptedAiFields
        .filter(([key]) => merged.fields?.[key]?.method === "ai_uncertainty_resolution")
        .map(([key, value]) => ({
          key,
          label: knownDefinitionByKey.get(key)?.label || key,
          value: value.value,
          confidence: Number(value.confidence || 0),
          sourceExcerpt: value.sourceExcerpt,
        }));
      if (!appliedFields.length) {
        throw new Error(
          "The AI provider returned fields, but none could be safely applied to the structured syllabus. No draft was changed.",
        );
      }
      setResult({ ...merged, uncertainSections: [] });
      setAiReview({
        fields: appliedFields,
        missingInformation: response.artifact?.missingInformation || [],
        conflictingInformation: response.artifact?.conflictingInformation || [],
      });
      setAiProvenance(response.provenance || null);
      setPhase("review");
      setStatus(
        `AI uncertainty review returned ${appliedFields.length} source-grounded field${appliedFields.length === 1 ? "" : "s"} as an unpublished draft.`,
      );
      setOperationNotice({
        scope: "review",
        type: "success",
        title: "Governed AI uncertainty review complete",
        message: `Gemini returned ${appliedFields.length} source-grounded field${appliedFields.length === 1 ? "" : "s"}. Review the values and evidence below. Nothing has been saved, approved, mapped, or published.`,
      });
      scrollToElement(reviewRef);
'''
replace_once(old_success, new_success, 'AI success block')

old_availability = '''              {AI_UNCERTAINTY_ENABLED
                ? result.uncertainSections?.length
                  ? `${result.uncertainSections.length} uncertain section${result.uncertainSections.length === 1 ? " is" : "s are"} ready. Select Interpret uncertain sections to run the source-grounded review.`
                  : "The deterministic extractor did not identify an uncertain section that needs AI interpretation."
                : "Production remains disabled. Use the permanent staging environment for governed testing."}
'''
new_availability = '''              {AI_UNCERTAINTY_ENABLED
                ? aiReview
                  ? "Uncertainty review completed. The returned fields are listed below and marked inside the structured syllabus."
                  : result.uncertainSections?.length
                    ? `${result.uncertainSections.length} uncertain section${result.uncertainSections.length === 1 ? " is" : "s are"} ready. Select Interpret uncertain sections to run the source-grounded review.`
                    : "The deterministic extractor did not identify an uncertain section that needs AI interpretation."
                : "Production remains disabled. Use the permanent staging environment for governed testing."}
'''
replace_once(old_availability, new_availability, 'availability text')

marker = '''          </div>

          <div className="syllabus-review-grid">
'''
panel = '''          </div>

          {aiReview ? (
            <section className="syllabus-ai-returned-draft" aria-label="Returned governed AI draft">
              <div className="syllabus-ai-returned-draft-heading">
                <div>
                  <span>RETURNED GOVERNED DRAFT</span>
                  <h3>{aiReview.fields.length} source-grounded field{aiReview.fields.length === 1 ? "" : "s"}</h3>
                </div>
                <strong>Professor review required</strong>
              </div>
              <div className="syllabus-ai-returned-field-list">
                {aiReview.fields.map((field) => (
                  <article key={field.key}>
                    <header>
                      <strong>{field.label}</strong>
                      <span>{Math.round(field.confidence * 100)}% confidence</span>
                    </header>
                    <p>{formatValue(field.value)}</p>
                    <blockquote>{field.sourceExcerpt}</blockquote>
                  </article>
                ))}
              </div>
              {aiReview.missingInformation.length ? (
                <p><strong>Still unresolved:</strong> {aiReview.missingInformation.join(" · ")}</p>
              ) : null}
              {aiReview.conflictingInformation.length ? (
                <p><strong>Conflicts:</strong> {aiReview.conflictingInformation.join(" · ")}</p>
              ) : null}
            </section>
          ) : null}

          <div className="syllabus-review-grid">
'''
replace_once(marker, panel, 'returned draft panel')

old_status = '''                            <span className={fieldStatusClass(item)}>
                              {statusLabel(item)}
                            </span>
'''
new_status = '''                            <div className="syllabus-field-status-stack">
                              {field?.method === "ai_uncertainty_resolution" ? (
                                <span className="syllabus-ai-field-badge">
                                  AI interpreted · {Math.round(Number(field.confidence || 0) * 100)}%
                                </span>
                              ) : null}
                              <span className={fieldStatusClass(item)}>
                                {statusLabel(item)}
                              </span>
                            </div>
'''
replace_once(old_status, new_status, 'field AI badge')
path.write_text(text)

css_path = Path('src/ai/syllabus-to-course-fixes.css')
css = css_path.read_text()
marker_css = '/* Visible governed AI returned draft. */'
if marker_css not in css:
    css += '''

/* Visible governed AI returned draft. */
.syllabus-ai-returned-draft {
  margin: 0 0 22px;
  border: 1px solid #88cfa7;
  border-radius: 18px;
  padding: 20px;
  background: #f0fbf5;
}
.syllabus-ai-returned-draft-heading,
.syllabus-ai-returned-field-list article header,
.syllabus-field-status-stack {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.syllabus-ai-returned-draft-heading span {
  color: #167044;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.syllabus-ai-returned-draft-heading h3 { margin: 4px 0 0; }
.syllabus-ai-returned-draft-heading > strong {
  border-radius: 999px;
  padding: 7px 11px;
  background: #d9f4e5;
  color: #135e3a;
  white-space: nowrap;
}
.syllabus-ai-returned-field-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}
.syllabus-ai-returned-field-list article {
  border: 1px solid #c9e8d7;
  border-radius: 14px;
  padding: 14px;
  background: #ffffff;
}
.syllabus-ai-returned-field-list article header span,
.syllabus-ai-field-badge {
  border-radius: 999px;
  padding: 5px 9px;
  background: #e2f1ff;
  color: #174f85;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}
.syllabus-ai-returned-field-list p {
  margin: 10px 0;
  white-space: pre-wrap;
}
.syllabus-ai-returned-field-list blockquote {
  margin: 0;
  border-left: 3px solid #2a7d55;
  padding: 9px 12px;
  background: #f7fbf9;
  overflow-wrap: anywhere;
}
.syllabus-field-status-stack {
  flex-direction: column;
  align-items: flex-end;
}
@media (max-width: 720px) {
  .syllabus-ai-returned-draft-heading,
  .syllabus-ai-returned-field-list article header { flex-direction: column; }
}
'''
css_path.write_text(css)

test_path = Path('src/ai/syllabusAiReturnedDraft.static.test.js')
test_path.write_text('''import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport test from "node:test";\n\nconst source = readFileSync(new URL("./SyllabusToCourse.jsx", import.meta.url), "utf8");\n\ntest("governed syllabus review rejects empty or unusable AI drafts", () => {\n  assert.match(source, /returned no usable source-grounded syllabus fields/);\n  assert.match(source, /none could be safely applied/);\n});\n\ntest("governed syllabus review visibly lists returned fields and confidence", () => {\n  assert.match(source, /RETURNED GOVERNED DRAFT/);\n  assert.match(source, /source-grounded field/);\n  assert.match(source, /AI interpreted/);\n  assert.match(source, /uncertainSections: \[\]/);\n});\n''')

package_path = Path('package.json')
package = package_path.read_text()
old = 'src/ai/syllabusExtractionUx.static.test.js src/syllabus/syllabusMigration.test.js'
new = 'src/ai/syllabusExtractionUx.static.test.js src/ai/syllabusAiReturnedDraft.static.test.js src/syllabus/syllabusMigration.test.js'
if old not in package:
    raise SystemExit('missing syllabus test script')
package_path.write_text(package.replace(old, new, 1))
