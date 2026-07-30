import test from "node:test";
import assert from "node:assert/strict";
import {
  CITATION_STYLE_METADATA,
  checkCitationFormat,
  formatCitationOutput,
  formatInTextCitation,
} from "./citationTools.js";

const journal = {
  citationStyle: "APA",
  sourceType: "Journal article",
  authors: [
    { kind: "person", given: "Jordan M.", family: "Rivera" },
    { kind: "person", given: "Alex", family: "Chen" },
  ],
  publishedDate: "2024-06-01",
  title: "Evaluating information before sharing",
  containerTitle: "Journal of Digital Literacy",
  volume: "12",
  issue: "3",
  pages: "41–58",
  doi: "10.1000/example",
};

test("style metadata pins the official APA 7 and MLA 9 editions", () => {
  assert.equal(CITATION_STYLE_METADATA.APA.edition, 7);
  assert.equal(CITATION_STYLE_METADATA.MLA.edition, 9);
  assert.match(CITATION_STYLE_METADATA.APA.manualUrl, /^https:\/\/www\.apa\.org\//u);
  assert.match(CITATION_STYLE_METADATA.MLA.manualUrl, /^https:\/\/style\.mla\.org\//u);
});

test("APA output supports multiple authors, DOI normalization, rich italics, and in-text form", () => {
  const output = formatCitationOutput(journal);
  assert.match(output.plain, /^Rivera, J\. M\., & Chen, A\. \(2024\)\./u);
  assert.match(output.plain, /https:\/\/doi\.org\/10\.1000\/example$/u);
  assert.match(output.html, /<em>Journal of Digital Literacy, 12<\/em>/u);
  assert.equal(formatInTextCitation(journal), "(Rivera & Chen, 2024)");
  assert.equal(formatInTextCitation(journal, { narrative: true }), "Rivera & Chen (2024)");
});

test("MLA output uses et al. for three authors and preserves container emphasis", () => {
  const output = formatCitationOutput({
    ...journal,
    citationStyle: "MLA",
    authors: [
      { kind: "person", given: "Jordan", family: "Rivera" },
      { kind: "person", given: "Alex", family: "Chen" },
      { kind: "person", given: "Taylor", family: "Morgan" },
    ],
  });
  assert.match(output.plain, /^Rivera, Jordan, et al\./u);
  assert.match(output.plain, /“Evaluating information before sharing\.”/u);
  assert.match(output.html, /<em>Journal of Digital Literacy,<\/em>/u);
  assert.equal(formatInTextCitation({ ...journal, citationStyle: "MLA", authors: [{ kind: "person", given: "Jordan", family: "Rivera" }] }, { page: "42" }), "(Rivera 42)");
});

test("common APA webpage and book details use APA 7 date and edition order", () => {
  const webpage = formatCitationOutput({
    citationStyle: "APA",
    sourceType: "Website",
    authors: [{ kind: "organization", literal: "Example Library" }],
    title: "How to check a source",
    publishedDate: "2024-06-01",
    containerTitle: "Example Library",
    url: "https://example.edu/check",
  });
  assert.match(webpage.plain, /Example Library\. \(2024, June 1\)\./u);

  const book = formatCitationOutput({
    citationStyle: "APA",
    sourceType: "Book",
    authors: [{ kind: "person", given: "Jordan", family: "Rivera" }],
    title: "Digital literacy in practice",
    publishedDate: "2024",
    edition: "3rd",
    publisher: "Example Press",
    contributors: [{ kind: "person", given: "Alex", family: "Chen", role: "translator" }],
  });
  assert.match(book.plain, /Digital literacy in practice \(A\. Chen, Trans\.; 3rd ed\.\)\. Example Press\./u);
});

test("format checker teaches without claiming authoritative validation", () => {
  const result = checkCitationFormat("Rivera, Jordan. Digital literacy. 2024.", "APA");
  assert.equal(result.status, "review-required");
  assert.ok(result.diagnostics.some((item) => item.code === "apa-date"));
  assert.match(result.disclaimer, /format check, not authoritative proof/iu);
});

test("rich citation output escapes student-entered markup", () => {
  const output = formatCitationOutput({
    citationStyle: "APA",
    sourceType: "Website",
    authors: [{ kind: "organization", literal: "<img src=x onerror=alert(1)>" }],
    title: "<script>alert(1)</script>",
    publishedDate: "2024-01-01",
    url: "https://example.edu",
  });
  assert.doesNotMatch(output.html, /<script>|<img/iu);
  assert.match(output.html, /&lt;script&gt;/u);
});
