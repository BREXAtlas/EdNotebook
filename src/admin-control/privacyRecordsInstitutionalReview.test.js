import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { STUDENT_DATA_LIFECYCLE_DOMAINS } from "./studentDataSafetyModel.js";

const review = JSON.parse(await readFile(
  new URL("../../docs/privacy-records-institutional-review-recommendations.json", import.meta.url),
  "utf8",
));
const workbookText = await readFile(
  new URL("../../docs/privacy-records-lifecycle-decision-workbook.csv", import.meta.url),
  "utf8",
);

function parseCsv(text) {
  const table = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      table.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }

  if (quoted) throw new TypeError("Privacy/records workbook has an unterminated CSV field.");
  if (value || row.length) {
    row.push(value);
    table.push(row);
  }

  const [headers, ...dataRows] = table;
  return dataRows.map((cells, rowIndex) => {
    assert.equal(cells.length, headers.length, `Workbook row ${rowIndex + 2} has the wrong field count.`);
    return Object.fromEntries(headers.map((header, columnIndex) => [header, cells[columnIndex]]));
  });
}

const workbookRows = parseCsv(workbookText);
const workbookByDomain = new Map(workbookRows.map((row) => [row.domain_key, row]));
const reviewEntries = Object.entries(review.domains);
const allowedCopyRoles = new Set([
  "institution_record_copy",
  "governed_convenience_copy",
  "processor_copy",
  "transitory_derivative",
  "provider_external_copy",
  "mixed_unresolved",
]);
const allowedPrivacyClassifications = new Set([
  "ferpa_education_record",
  "directory_opt_out",
  "financial_transaction",
  "security_authentication",
  "research_irb",
  "public_non_education",
  "mixed_unresolved",
  ...review.classification_taxonomy_additions,
]);
const allowedRecommendations = new Set([
  "accept_candidate",
  "accept_amended_guardrail",
  "hold",
]);
const originalDecisionFields = [
  "official_copy_role",
  "privacy_classification",
  "reviewer_decision",
  "approved_disposition",
  "approved_retention_days",
  "approved_trigger",
  "approved_authority_reference",
  "conditions_and_exceptions",
  "reviewer_unit_role",
  "decision_date",
  "review_due_at",
];
const addedHolds = new Set([
  "assignmentDocumentFeedback",
  "assignmentFormSubmissions",
  "blackboardGradeExportSnapshots",
  "institutionAffiliations",
  "institutionMemberships",
  "ltiGradeSyncEvents",
  "publicationEntitlements",
  "readingAnnotations",
  "studentEducationPath",
  "studentGroupMemberships",
  "studentGroups",
  "studentPosts",
]);

test("institutional review recommendations cover all 61 governed domains", () => {
  assert.equal(reviewEntries.length, 61);
  assert.deepEqual(
    reviewEntries.map(([domain]) => domain).sort(),
    [...STUDENT_DATA_LIFECYCLE_DOMAINS].sort(),
  );
  assert.equal(new Set(reviewEntries.map(([domain]) => domain)).size, 61);
});

test("institutional review is explicitly non-signatory and staging-bound", () => {
  assert.equal(review.review_type, "codex_evidence_based_institutional_review_recommendation");
  assert.equal(review.review_status, "platform_baseline_complete_institution_adoption_pending");
  assert.equal(review.institution_id, "22222222-2222-4222-8222-222222222222");
  assert.equal(review.staging_project, "gfalgonektwdylsxsgzc");
  assert.equal(review.production_project_unchanged, "didwxihufueqbpfnfdmm");
  assert.match(review.protected_staging_commit, /^[0-9a-f]{40}$/u);
  assert.equal("reviewer_identity" in review, false);
  assert.equal("institutional_attestation" in review, false);
  assert.equal("approval" in review, false);
});

test("review recommendations use governed classifications and complete conditions", () => {
  assert.deepEqual(
    [...review.classification_taxonomy_additions].sort(),
    [
      "inherited_from_source",
      "intellectual_property_commercial",
      "operational_system",
      "personal_information_non_education",
      "records_governance",
    ],
  );

  for (const [domain, recommendation] of reviewEntries) {
    assert.ok(allowedCopyRoles.has(recommendation.official_copy_role), `${domain} has an invalid copy role.`);
    assert.ok(
      allowedPrivacyClassifications.has(recommendation.privacy_classification),
      `${domain} has an invalid privacy classification.`,
    );
    assert.ok(allowedRecommendations.has(recommendation.recommendation), `${domain} has an invalid recommendation.`);
    assert.ok(recommendation.condition.length >= 40, `${domain} lacks a substantive review condition.`);
    if (recommendation.recommendation !== "hold") {
      assert.notEqual(recommendation.official_copy_role, "mixed_unresolved");
      assert.notEqual(recommendation.privacy_classification, "mixed_unresolved");
    }
  }
});

test("review outcome is 10 candidate accepts, 23 amended accepts, and 28 holds", () => {
  const count = (outcome) => reviewEntries.filter(([, item]) => item.recommendation === outcome).length;
  assert.equal(count("accept_candidate"), 10);
  assert.equal(count("accept_amended_guardrail"), 23);
  assert.equal(count("hold"), 28);
});

test("every original hold remains held and the substantive review adds exactly 12 holds", () => {
  const originalHolds = new Set(
    workbookRows
      .filter((row) => row.candidate_status === "blocked_pending_review")
      .map((row) => row.domain_key),
  );
  assert.equal(originalHolds.size, 16);
  for (const domain of originalHolds) {
    assert.equal(review.domains[domain].recommendation, "hold", `${domain} was unsafely unblocked.`);
  }

  const actualAddedHolds = new Set(
    reviewEntries
      .filter(([domain, item]) => item.recommendation === "hold" && !originalHolds.has(domain))
      .map(([domain]) => domain),
  );
  assert.deepEqual([...actualAddedHolds].sort(), [...addedHolds].sort());
});

test("calendar recommendations lengthen the fixed-day proposal and never infer a trigger", () => {
  for (const [domain, recommendation] of reviewEntries) {
    const candidate = workbookByDomain.get(domain);
    if (recommendation.recommendation === "accept_amended_guardrail") {
      assert.equal(candidate.calendar_semantics_review_required, "true");
      const guardrail = review.calendar_guardrail_days[candidate.candidate_retention_days];
      assert.ok(Number.isInteger(guardrail), `${domain} has no calendar guardrail.`);
      assert.ok(guardrail > Number(candidate.candidate_retention_days), `${domain} can expire early.`);
      assert.ok(candidate.candidate_trigger.trim(), `${domain} has no authoritative trigger.`);
    }
    if (recommendation.recommendation === "accept_candidate") {
      assert.equal(candidate.calendar_semantics_review_required, "false");
      assert.equal(candidate.candidate_status, "candidate_ready");
    }
  }
});

test("the recommendation review leaves every institution decision field blank", () => {
  for (const row of workbookRows) {
    for (const field of originalDecisionFields) {
      assert.equal(row[field], "", `${row.domain_key} improperly populated institution field ${field}.`);
    }
  }
});
