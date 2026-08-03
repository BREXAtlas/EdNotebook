import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { STUDENT_DATA_LIFECYCLE_DOMAINS } from "./studentDataSafetyModel.js";

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

const rows = parseCsv(workbookText);
const allowedCandidateStatuses = new Set(["candidate_ready", "blocked_pending_review"]);
const allowedCandidateDispositions = new Set(["delete", "anonymize", "retain", "block"]);
const allowedOfficialCopyRoles = new Set([
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
]);
const allowedReviewerDecisions = new Set(["approve_candidate", "approve_amended", "block"]);
const decisionFields = [
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
const requiredDecisionFields = decisionFields.filter((field) => field !== "approved_retention_days");
const calendarDayTranslations = new Set(["365", "730", "1095", "1460", "1825", "3650"]);

test("privacy/records workbook covers the canonical 61 domains exactly once", () => {
  const actual = rows.map((row) => row.domain_key).sort();
  const expected = [...STUDENT_DATA_LIFECYCLE_DOMAINS].sort();
  assert.equal(rows.length, 61);
  assert.equal(new Set(actual).size, 61);
  assert.deepEqual(actual, expected);
});

test("privacy/records candidates preserve the reviewed proposal shape", () => {
  assert.equal(rows.filter((row) => row.candidate_status === "candidate_ready").length, 45);
  assert.equal(rows.filter((row) => row.candidate_status === "blocked_pending_review").length, 16);
  assert.equal(rows.filter((row) => row.calendar_semantics_review_required === "true").length, 35);

  for (const row of rows) {
    assert.ok(allowedCandidateStatuses.has(row.candidate_status), `${row.domain_key} has an invalid candidate status.`);
    assert.ok(allowedCandidateDispositions.has(row.candidate_disposition), `${row.domain_key} has an invalid disposition.`);
    assert.ok(row.candidate_trigger.trim(), `${row.domain_key} has no candidate trigger.`);
    assert.ok(row.candidate_record_series.trim(), `${row.domain_key} has no record series.`);
    assert.ok(row.candidate_accountable_owner.trim(), `${row.domain_key} has no accountable owner.`);
    assert.ok(row.candidate_dependency.trim(), `${row.domain_key} has no dependency statement.`);
    assert.equal(
      row.calendar_semantics_review_required,
      String(calendarDayTranslations.has(row.candidate_retention_days)),
      `${row.domain_key} has an incorrect calendar-semantics flag.`,
    );

    if (row.candidate_status === "blocked_pending_review") {
      assert.equal(row.candidate_disposition, "block");
      assert.equal(row.candidate_retention_days, "");
    } else {
      assert.notEqual(row.candidate_disposition, "block");
      assert.match(row.candidate_retention_days, /^\d+$/u);
    }
  }
});

test("institution decisions are either wholly blank or mechanically complete", () => {
  for (const row of rows) {
    const populated = decisionFields.filter((field) => row[field].trim());
    if (populated.length === 0) continue;

    for (const field of requiredDecisionFields) {
      assert.ok(row[field].trim(), `${row.domain_key} is missing ${field}.`);
    }
    assert.ok(allowedOfficialCopyRoles.has(row.official_copy_role), `${row.domain_key} has an invalid copy role.`);
    assert.ok(
      allowedPrivacyClassifications.has(row.privacy_classification),
      `${row.domain_key} has an invalid privacy classification.`,
    );
    assert.ok(allowedReviewerDecisions.has(row.reviewer_decision), `${row.domain_key} has an invalid decision.`);
    assert.doesNotMatch(row.reviewer_unit_role, /@/u, `${row.domain_key} must not store reviewer contact details.`);
    assert.match(row.decision_date, /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(Number.isFinite(Date.parse(row.review_due_at)), `${row.domain_key} has an invalid review date.`);
    assert.ok(
      Date.parse(row.review_due_at) > Date.parse(`${row.decision_date}T00:00:00Z`),
      `${row.domain_key} review date must follow the decision date.`,
    );

    const unresolved = row.official_copy_role === "mixed_unresolved"
      || row.privacy_classification === "mixed_unresolved";
    if (unresolved || row.reviewer_decision === "block") {
      assert.equal(row.reviewer_decision, "block");
      assert.equal(row.approved_disposition, "block");
      assert.equal(row.approved_retention_days, "");
      continue;
    }

    assert.ok(["delete", "anonymize", "retain"].includes(row.approved_disposition));
    assert.match(row.approved_retention_days, /^\d+$/u);
    const retentionDays = Number(row.approved_retention_days);
    assert.ok(retentionDays >= 0 && retentionDays <= 36500);
    if (row.approved_disposition === "retain") assert.ok(retentionDays >= 1);

    if (row.reviewer_decision === "approve_candidate") {
      assert.equal(row.approved_disposition, row.candidate_disposition);
      assert.equal(row.approved_retention_days, row.candidate_retention_days);
      assert.equal(row.approved_trigger, row.candidate_trigger);
    }
  }
});

test("the preparation workbook contains no inferred institution decisions", () => {
  assert.equal(
    rows.filter((row) => decisionFields.some((field) => row[field].trim())).length,
    0,
  );
});
