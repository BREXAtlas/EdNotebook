from pathlib import Path
import re

jsx_path = Path("src/ai/SyllabusToCourse.jsx")
text = jsx_path.read_text()

if "aiRequestInFlightRef" in text and "operationNotice.scope" in text:
    print("Phase 3 inline status fix already applied")
    raise SystemExit(0)


def replace_once(source, old, new, label):
    if old not in source:
        raise RuntimeError(f"Missing expected snippet: {label}")
    return source.replace(old, new, 1)


text = replace_once(
    text,
    '''function scrollToElement(ref) {
  requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
''',
    '''function scrollToElement(ref) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      ref.current?.focus?.({ preventScroll: true });
    });
  });
}
''',
    "stable scroll helper",
)

text = replace_once(
    text,
    '  const reviewRef = useRef(null);\n',
    '  const reviewRef = useRef(null);\n  const aiRequestInFlightRef = useRef(false);\n',
    "AI in-flight ref",
)

text = text.replace('type: "progress",\n      title: "Extraction in progress",', 'scope: "input",\n      type: "progress",\n      title: "Extraction in progress",', 1)
text = text.replace('type: "success",\n        title: "Extraction complete",', 'scope: "review",\n        type: "success",\n        title: "Extraction complete",', 1)
text = text.replace('type: "error",\n        title: "Extraction did not finish",', 'scope: "input",\n        type: "error",\n        title: "Extraction did not finish",', 1)
text = text.replace('type: "progress",\n      title: "Governed AI review in progress",', 'scope: "review",\n      type: "progress",\n      title: "Governed AI review in progress",', 1)
text = text.replace('type: "success",\n        title: "Governed AI uncertainty review complete",', 'scope: "review",\n        type: "success",\n        title: "Governed AI uncertainty review complete",', 1)
text = text.replace('type: "error",\n        title: "Governed AI review did not finish",', 'scope: "review",\n        type: "error",\n        title: "Governed AI review did not finish",', 1)

old_ai_start = '''  async function resolveUncertainty() {
    if (!AI_UNCERTAINTY_ENABLED) {
      setError(
        "Governed AI uncertainty extraction remains disabled until the ASU profile prompt, model, and task are approved in TOS.",
      );
      return;
    }
    if (!result?.uncertainSections?.length) return;
    setPhase("ai");
'''
new_ai_start = '''  async function resolveUncertainty() {
    if (!AI_UNCERTAINTY_ENABLED) {
      setError(
        "Governed AI uncertainty extraction remains disabled until the ASU profile prompt, model, and task are approved in TOS.",
      );
      return;
    }
    if (!result?.uncertainSections?.length) return;
    if (aiRequestInFlightRef.current) {
      setOperationNotice({
        scope: "review",
        type: "progress",
        title: "Governed AI review already running",
        message: "EdNotebook is keeping the first request active instead of sending a duplicate. Stay on this review section while it finishes.",
      });
      scrollToElement(reviewRef);
      return;
    }
    aiRequestInFlightRef.current = true;
    setPhase("ai");
'''
text = replace_once(text, old_ai_start, new_ai_start, "AI duplicate guard")

old_call = '''      const response = await interpretUncertainSyllabusSections({
        uncertainSections: result.uncertainSections,
        deterministicFields: {
          ...result.fields,
          _requirementProfile: {
            profileKey: ANGELO_STATE_2026_PROFILE.profileKey,
            version: ANGELO_STATE_2026_PROFILE.version,
            fields: definitions.map(({
              key,
              label,
              required,
              managedBy,
              sectionTitle,
            }) => ({ key, label, required, managedBy, sectionTitle })),
          },
        },
      }, { courseId: courseDraft.id || "" });
'''
new_call = '''      const compactContextKeys = new Set([
        "courseTitle",
        "courseCode",
        "sectionNumber",
        "term",
        "creditHours",
        "deliveryModality",
        "finalAssessmentType",
        "aiUsePolicy",
      ]);
      const compactDeterministicFields = Object.fromEntries(
        Object.entries(result.fields)
          .filter(([key]) => compactContextKeys.has(key))
          .map(([key, field]) => [key, {
            value: field?.value,
            confidence: field?.confidence,
          }]),
      );
      const response = await interpretUncertainSyllabusSections({
        uncertainSections: result.uncertainSections,
        deterministicFields: {
          ...compactDeterministicFields,
          _requirementProfile: {
            profileKey: ANGELO_STATE_2026_PROFILE.profileKey,
            version: ANGELO_STATE_2026_PROFILE.version,
            fields: definitions.map(({
              key,
              label,
              required,
              managedBy,
              sectionTitle,
            }) => ({ key, label, required, managedBy, sectionTitle })),
          },
        },
      }, { courseId: courseDraft.id || "" });
'''
text = replace_once(text, old_call, new_call, "compact AI request")

old_catch_end = '''      setOperationNotice({
        scope: "review",
        type: "error",
        title: "Governed AI review did not finish",
        message: aiError.message || "The uncertain syllabus sections could not be interpreted.",
      });
      scrollToElement(reviewRef);
    }
  }
'''
new_catch_end = '''      setOperationNotice({
        scope: "review",
        type: "error",
        title: "Governed AI review did not finish",
        message: `${aiError.message || "The uncertain syllabus sections could not be interpreted."} Your deterministic work is preserved. Select Retry governed review when you are ready.`,
      });
      scrollToElement(reviewRef);
    } finally {
      aiRequestInFlightRef.current = false;
    }
  }
'''
text = replace_once(text, old_catch_end, new_catch_end, "AI finally guard")

# Remove global operation notice above the profile summary.
text = replace_once(
    text,
    '''      {operationNotice ? (
        <section
          className={`syllabus-operation-notice is-${operationNotice.type}`}
          role={operationNotice.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <strong>{operationNotice.title}</strong>
          <p>{operationNotice.message}</p>
        </section>
      ) : null}

''',
    '',
    "global notice removal",
)

# Add input-scoped notice directly beneath the source actions.
text = replace_once(
    text,
    '''        </div>
        <textarea
          rows={14}
''',
    '''        </div>
        {operationNotice?.scope === "input" ? (
          <div
            className={`syllabus-operation-notice is-${operationNotice.type}`}
            role={operationNotice.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            <strong>{operationNotice.title}</strong>
            <p>{operationNotice.message}</p>
          </div>
        ) : null}
        <textarea
          rows={14}
''',
    "input notice placement",
)

# Add review-scoped notice inside section 2, directly below its heading/button.
text = replace_once(
    text,
    '''          </div>

          <div className={`syllabus-ai-availability ${AI_UNCERTAINTY_ENABLED ? "is-ready" : "is-disabled"}`}>
''',
    '''          </div>

          {operationNotice?.scope === "review" ? (
            <div
              className={`syllabus-operation-notice is-${operationNotice.type}`}
              role={operationNotice.type === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              <strong>{operationNotice.title}</strong>
              <p>{operationNotice.message}</p>
            </div>
          ) : null}

          <div className={`syllabus-ai-availability ${AI_UNCERTAINTY_ENABLED ? "is-ready" : "is-disabled"}`}>
''',
    "review notice placement",
)

# Make retry language explicit after failure.
text = replace_once(
    text,
    '''                  : result.uncertainSections?.length
                    ? "Interpret uncertain sections"
                    : "No uncertain sections found")
''',
    '''                  : result.uncertainSections?.length
                    ? (operationNotice?.type === "error"
                      ? "Retry governed review"
                      : "Interpret uncertain sections")
                    : "No uncertain sections found")
''',
    "retry button label",
)

jsx_path.write_text(text)

# Add scoped layout rules.
css_path = Path("src/ai/syllabus-to-course-fixes.css")
css = css_path.read_text()
marker = "/* Keep operation feedback beside the action that produced it. */"
if marker not in css:
    css += '''

/* Keep operation feedback beside the action that produced it. */
.syllabus-course-input .syllabus-operation-notice,
.syllabus-course-review .syllabus-operation-notice {
  max-width: none;
  margin: 0 0 20px;
  box-shadow: none;
}

.syllabus-course-review:focus {
  outline: none;
}
'''
css_path.write_text(css)

# Extend static tests.
test_path = Path("src/ai/syllabusExtractionUx.static.test.js")
test = test_path.read_text()
if "keeps operation feedback beside its source action" not in test:
    test += '''

test("keeps operation feedback beside its source action and prevents duplicate AI calls", () => {
  assert.match(source, /operationNotice\?\.scope === "input"/);
  assert.match(source, /operationNotice\?\.scope === "review"/);
  assert.match(source, /aiRequestInFlightRef/);
  assert.match(source, /Governed AI review already running/);
  assert.match(source, /Retry governed review/);
  assert.doesNotMatch(source, /\.\.\.result\.fields/);
});
'''
test_path.write_text(test)

print("Applied Phase 3 inline status and AI lock fix")
