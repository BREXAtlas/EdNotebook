import assert from "node:assert/strict";
import test from "node:test";
import {
  ACADEMIC_DESIGNS,
  academicDesignHtml,
  analyzeAcademicWriting,
  buildReferenceEntryHtml,
  ensurePagedDocument,
} from "./academicWritingModel.js";

test("academic designs include familiar first-year college paper structures", () => {
  assert.deepEqual(
    ACADEMIC_DESIGNS.map((design) => design.id),
    [
      "blank-college-paper",
      "apa-student-paper",
      "mla-college-paper",
      "research-paper",
    ],
  );
  const research = academicDesignHtml("research-paper", {
    title: "Information Literacy",
  });
  assert.match(research, /document-cover-page/u);
  assert.match(research, />Abstract</u);
  assert.match(research, />References</u);
  assert.match(research, /hanging-indent/u);
});

test("legacy one-page editor content is preserved inside a numbered page", () => {
  const legacy = "<p>Existing work must stay.</p>";
  const paged = ensurePagedDocument(legacy);
  assert.match(paged, /document-page numbered-page/u);
  assert.match(paged, /Existing work must stay/u);
  assert.equal(ensurePagedDocument(paged), paged);
});

test("reference entries use hanging indents and permit only safe web links", () => {
  assert.match(
    buildReferenceEntryHtml("Author. (2026). Title.", "https://example.com"),
    /class="hanging-indent"[\s\S]*href="https:\/\/example\.com"/u,
  );
  assert.doesNotMatch(
    buildReferenceEntryHtml("Unsafe", "javascript:alert(1)"),
    /href=/u,
  );
});

test("writing review reports repeated words and long sentences without claiming correctness", () => {
  const findings = analyzeAcademicWriting(
    "This this sentence contains a repeated word. " +
      `${"word ".repeat(38)}ends here.`,
  );
  assert.ok(findings.some((finding) => finding.id === "repeated-word"));
  assert.ok(findings.some((finding) => finding.id === "long-sentence"));
  assert.doesNotMatch(JSON.stringify(findings), /guaranteed correct/iu);
});
