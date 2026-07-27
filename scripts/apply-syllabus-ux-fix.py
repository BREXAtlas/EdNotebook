from pathlib import Path
import re

jsx_path = Path("src/ai/SyllabusToCourse.jsx")
text = jsx_path.read_text()

if "Extraction in progress" in text and "syllabus-operation-notice" in text:
    print("Syllabus UX fix already applied")
    raise SystemExit(0)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"Missing expected snippet for {label}")
    return source.replace(old, new, 1)


def regex_once(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected one regex match for {label}, found {count}")
    return updated


text = replace_once(
    text,
    'const AI_UNCERTAINTY_ENABLED = import.meta.env.VITE_SYLLABUS_AI_ENABLED === "true";\n',
    'const IS_STAGING = import.meta.env.VITE_APP_ENVIRONMENT === "staging";\n'
    'const AI_UNCERTAINTY_ENABLED =\n'
    '  IS_STAGING && import.meta.env.VITE_SYLLABUS_AI_ENABLED !== "false";\n\n'
    'function scrollToElement(ref) {\n'
    '  requestAnimationFrame(() => {\n'
    '    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });\n'
    '  });\n'
    '}\n\n'
    'function allowStatusPaint() {\n'
    '  return new Promise((resolve) => setTimeout(resolve, 40));\n'
    '}\n',
    "staging AI boundary",
)

text = replace_once(
    text,
    '  const fileInput = useRef(null);\n',
    '  const fileInput = useRef(null);\n'
    '  const statusRef = useRef(null);\n'
    '  const reviewRef = useRef(null);\n',
    "status and review refs",
)

text = replace_once(
    text,
    '  const [cloudRecord, setCloudRecord] = useState(null);\n',
    '  const [cloudRecord, setCloudRecord] = useState(null);\n'
    '  const [operationNotice, setOperationNotice] = useState(null);\n'
    '  const [aiProvenance, setAiProvenance] = useState(null);\n',
    "operation state",
)

text = replace_once(
    text,
    '      setResult(null);\n      setApproved(false);\n      setCloudRecord(null);\n',
    '      setResult(null);\n'
    '      setApproved(false);\n'
    '      setCloudRecord(null);\n'
    '      setOperationNotice(null);\n'
    '      setAiProvenance(null);\n',
    "file reset state",
)

new_extraction_function = '''  async function runDeterministicExtraction() {
    setError("");
    setApproved(false);
    setCloudRecord(null);
    setAiProvenance(null);
    setPhase("extracting");
    setStatus("Extracting syllabus fields and checking the institutional requirement profile…");
    setOperationNotice({
      type: "progress",
      title: "Extraction in progress",
      message: "EdNotebook is reading the source, matching structured fields, and checking required and conditional items.",
    });
    scrollToElement(statusRef);
    await allowStatusPaint();

    try {
      const extracted = extractDeterministicSyllabus(
        sourceText,
        ANGELO_STATE_2026_PROFILE,
      );
      setSourceText(extracted.sourceText);
      setResult(extracted);
      setPhase("review");
      const detectedInstitutionBlocks = institutionManagedDefinitions.filter(
        (definition) => extracted.requirementReview.items.find(
          (item) => item.key === definition.key,
        )?.present,
      ).length;
      const summary =
        `${extracted.requirementReview.requiredComplete} of ${extracted.requirementReview.requiredTotal} professor-managed required fields were found. `
        + `${institutionManagedDefinitions.length} institution-managed blocks remain locked; ${detectedInstitutionBlocks} were found in the source for institutional review.`;
      setStatus(summary);
      setOperationNotice({
        type: "success",
        title: "Extraction complete",
        message: extracted.uncertainSections?.length
          ? `${summary} ${extracted.uncertainSections.length} uncertain section${extracted.uncertainSections.length === 1 ? " is" : "s are"} ready for governed TOS interpretation.`
          : `${summary} No uncertain sections require AI interpretation.`,
      });
      scrollToElement(reviewRef);
    } catch (extractError) {
      setPhase("input");
      const message = extractError.message || "The syllabus could not be extracted.";
      setError(message);
      setOperationNotice({
        type: "error",
        title: "Extraction did not finish",
        message,
      });
      scrollToElement(statusRef);
    }
  }
'''

text = regex_once(
    text,
    r"  function runDeterministicExtraction\(\) \{.*?\n  \}\n\n  async function resolveUncertainty\(\) \{",
    new_extraction_function + "\n  async function resolveUncertainty() {",
    "deterministic extraction function",
)

text = replace_once(
    text,
    '    setPhase("ai");\n    setError("");\n',
    '    setPhase("ai");\n'
    '    setError("");\n'
    '    setOperationNotice({\n'
    '      type: "progress",\n'
    '      title: "Governed AI review in progress",\n'
    '      message: "Only uncertain syllabus sections are being sent through the approved TOS router. Nothing will be saved or published automatically.",\n'
    '    });\n'
    '    scrollToElement(reviewRef);\n',
    "AI progress notice",
)

text = regex_once(
    text,
    r'''      setResult\(\n        mergeSyllabusExtraction\(\n          result,\n          response\.artifact,\n          ANGELO_STATE_2026_PROFILE,\n        \),\n      \);\n      setPhase\("review"\);\n      setStatus\(\n        "AI uncertainty review returned as an unpublished draft\. Compare every field with the source text\.",\n      \);''',
    '''      setResult(
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
        type: "success",
        title: "Governed AI uncertainty review complete",
        message: "The returned draft is source-grounded and still requires professor review. It has not been saved, approved, mapped, or published.",
      });
      scrollToElement(reviewRef);''',
    "AI success state",
)

text = replace_once(
    text,
    '      setStatus(\n        "Your deterministic extraction and structured shell remain available. No course was changed.",\n      );\n',
    '      setStatus(\n'
    '        "Your deterministic extraction and structured shell remain available. No course was changed.",\n'
    '      );\n'
    '      setOperationNotice({\n'
    '        type: "error",\n'
    '        title: "Governed AI review did not finish",\n'
    '        message: aiError.message || "The uncertain syllabus sections could not be interpreted.",\n'
    '      });\n'
    '      scrollToElement(reviewRef);\n',
    "AI error state",
)

text = replace_once(
    text,
    '<section className="syllabus-course-status" role="status">\n',
    '<section ref={statusRef} className="syllabus-course-status" role="status" aria-live="polite">\n',
    "status section ref",
)

text = replace_once(
    text,
    '''      </section>

      <section
        className="syllabus-profile-summary"
''',
    '''      </section>

      {operationNotice ? (
        <section
          className={`syllabus-operation-notice is-${operationNotice.type}`}
          role={operationNotice.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <strong>{operationNotice.title}</strong>
          <p>{operationNotice.message}</p>
        </section>
      ) : null}

      <section
        className="syllabus-profile-summary"
''',
    "operation notice render",
)

text = replace_once(
    text,
    '            disabled={!sourceText.trim() || phase === "reading"}\n          >\n            Extract and check requirements\n',
    '            disabled={!sourceText.trim() || phase === "reading" || phase === "extracting"}\n'
    '          >\n'
    '            {phase === "extracting" ? "Extracting requirements…" : "Extract and check requirements"}\n',
    "extract button progress",
)

text = replace_once(
    text,
    '<section className="syllabus-course-review">\n',
    '<section ref={reviewRef} className="syllabus-course-review" tabIndex={-1}>\n',
    "review section ref",
)

text = replace_once(
    text,
    '''              {AI_UNCERTAINTY_ENABLED
                ? (phase === "ai"
                  ? "Interpreting uncertainty…"
                  : "Interpret uncertain sections")
                : "AI review pending TOS approval"}
''',
    '''              {AI_UNCERTAINTY_ENABLED
                ? (phase === "ai"
                  ? "Interpreting uncertainty…"
                  : result.uncertainSections?.length
                    ? "Interpret uncertain sections"
                    : "No uncertain sections found")
                : "AI review unavailable outside staging"}
''',
    "AI button label",
)

text = replace_once(
    text,
    '''          </div>

          <div className="syllabus-review-grid">
''',
    '''          </div>

          <div className={`syllabus-ai-availability ${AI_UNCERTAINTY_ENABLED ? "is-ready" : "is-disabled"}`}>
            <strong>
              {AI_UNCERTAINTY_ENABLED
                ? "Governed TOS uncertainty review is available"
                : "Governed TOS uncertainty review is not active in this environment"}
            </strong>
            <p>
              {AI_UNCERTAINTY_ENABLED
                ? result.uncertainSections?.length
                  ? `${result.uncertainSections.length} uncertain section${result.uncertainSections.length === 1 ? " is" : "s are"} ready. Select Interpret uncertain sections to run the source-grounded review.`
                  : "The deterministic extractor did not identify an uncertain section that needs AI interpretation."
                : "Production remains disabled. Use the permanent staging environment for governed testing."}
            </p>
            {aiProvenance ? (
              <small>
                Provider: {aiProvenance.provider} · Model: {aiProvenance.model} · Tier: {aiProvenance.tier} · Prompt: {aiProvenance.promptVersion} · Policy: {aiProvenance.policyVersion} · Human review required
              </small>
            ) : null}
          </div>

          <div className="syllabus-review-grid">
''',
    "AI availability panel",
)

text = regex_once(
    text,
    r'''                \{institutionManagedDefinitions\.length\} required policy or handbook\n                blocks are always locked for institutional versioning\. \{institutionDetectedCount\}\n                were detected in this source for institutional comparison\.''',
    '''                {`${institutionManagedDefinitions.length} required policy or handbook blocks are always locked for institutional versioning. ${institutionDetectedCount} were detected in this source for institutional comparison.`}''',
    "institution summary spacing",
)

jsx_path.write_text(text)

css_path = Path("src/ai/syllabus-to-course-fixes.css")
css = css_path.read_text()
marker = "/* Extraction progress, completion, and governed-AI visibility. */"
if marker not in css:
    css += '''

/* Extraction progress, completion, and governed-AI visibility. */
.syllabus-course-status,
.syllabus-course-review {
  scroll-margin-top: 24px;
}

.syllabus-operation-notice {
  max-width: 1400px;
  margin: 0 auto 24px;
  border: 1px solid #cfd9eb;
  border-radius: 18px;
  padding: 18px 20px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(16, 33, 67, 0.08);
}

.syllabus-operation-notice strong {
  display: block;
  font-size: 1.05rem;
}

.syllabus-operation-notice p {
  margin: 6px 0 0;
  color: #43516d;
  line-height: 1.45;
}

.syllabus-operation-notice.is-progress {
  border-color: #9bb4f5;
  background: #eef3ff;
}

.syllabus-operation-notice.is-success {
  border-color: #83d4a8;
  background: #ecfbf3;
}

.syllabus-operation-notice.is-success strong {
  color: #12653a;
}

.syllabus-operation-notice.is-error {
  border-color: #efaca4;
  background: #fff0f0;
}

.syllabus-operation-notice.is-error strong {
  color: #9b1c1c;
}

.syllabus-ai-availability {
  margin: 0 0 20px;
  border: 1px solid #cfd9eb;
  border-radius: 16px;
  padding: 16px 18px;
  background: #f8faff;
}

.syllabus-ai-availability.is-ready {
  border-color: #9bb4f5;
  background: #eef3ff;
}

.syllabus-ai-availability.is-disabled {
  border-color: #d9dee8;
  background: #f4f5f8;
}

.syllabus-ai-availability strong,
.syllabus-ai-availability small {
  display: block;
}

.syllabus-ai-availability p {
  margin: 6px 0;
  color: #43516d;
}

.syllabus-ai-availability small {
  color: #526078;
  overflow-wrap: anywhere;
}

.syllabus-review-flags {
  align-items: start;
}
'''
css_path.write_text(css)

test_path = Path("src/ai/syllabusExtractionUx.static.test.js")
test_path.write_text('''import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport test from "node:test";\n\nconst source = readFileSync(new URL("./SyllabusToCourse.jsx", import.meta.url), "utf8");\n\ntest("syllabus extraction gives visible progress and scrolls to review", () => {\n  assert.match(source, /Extraction in progress/);\n  assert.match(source, /Extraction complete/);\n  assert.match(source, /scrollIntoView/);\n  assert.match(source, /ref=\\{reviewRef\\}/);\n});\n\ntest("staging exposes governed uncertainty review without enabling production", () => {\n  assert.match(source, /VITE_APP_ENVIRONMENT === "staging"/);\n  assert.match(source, /Interpret uncertain sections/);\n  assert.match(source, /Human review required/);\n  assert.match(source, /AI review unavailable outside staging/);\n});\n''')

package_path = Path("package.json")
package = package_path.read_text()
old_script = '"test:syllabus-extraction": "node --test src/ai/syllabusExtractionContract.test.js src/syllabus/syllabusMigration.test.js"'
new_script = '"test:syllabus-extraction": "node --test src/ai/syllabusExtractionContract.test.js src/ai/syllabusExtractionUx.static.test.js src/syllabus/syllabusMigration.test.js"'
if old_script not in package:
    raise RuntimeError("Missing syllabus extraction test script")
package_path.write_text(package.replace(old_script, new_script, 1))

print("Syllabus UX fix applied")
