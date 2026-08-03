import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workbookUrl = new URL("docs/privacy-records-lifecycle-decision-workbook.csv", root);
const recommendationsUrl = new URL("docs/privacy-records-institutional-review-recommendations.json", root);
const manifestUrl = new URL("public/governance/tos-staging-lifecycle-final-decisions.json", root);
const reviewCsvUrl = new URL("docs/tos-staging-lifecycle-final-decisions.csv", root);

const calendarGuardrailDays = Object.freeze({
  365: 366,
  730: 731,
  1095: 1096,
  1460: 1461,
  1825: 1827,
  3650: 3653,
});

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((candidate) => candidate.some((value) => value !== ""));
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function approvedRetentionDays(row, recommendation) {
  const candidate = row.candidate_retention_days === "" ? null : Number(row.candidate_retention_days);
  if (recommendation !== "accept_amended_guardrail" || candidate === null) return candidate;
  return calendarGuardrailDays[candidate] ?? candidate;
}

const workbook = parseCsv(await readFile(workbookUrl, "utf8"));
const institutionalReview = JSON.parse(await readFile(recommendationsUrl, "utf8"));
const domainKeys = Object.keys(institutionalReview.domains).sort((left, right) => left.localeCompare(right));
const workbookByDomain = new Map(workbook.map((row) => [row.domain_key, row]));

if (workbook.length !== 61 || domainKeys.length !== 61 || new Set(domainKeys).size !== 61) {
  throw new Error("The final lifecycle decision set must contain exactly 61 unique domains.");
}
if (workbook.some((row) => !institutionalReview.domains[row.domain_key])) {
  throw new Error("The review recommendations do not cover every workbook domain.");
}

const policies = domainKeys.map((domainKey) => {
  const row = workbookByDomain.get(domainKey);
  const review = institutionalReview.domains[domainKey];
  if (!row) throw new Error(`Workbook row missing for ${domainKey}.`);

  const blocked = review.recommendation === "hold";
  if (!blocked && !["accept_candidate", "accept_amended_guardrail"].includes(review.recommendation)) {
    throw new Error(`Unsupported recommendation for ${domainKey}.`);
  }

  return {
    domain_key: domainKey,
    status: blocked ? "blocked" : "approved",
    disposition: blocked ? "block" : row.candidate_disposition,
    retention_days: blocked ? null : approvedRetentionDays(row, review.recommendation),
    trigger: blocked ? "No automatic trigger while the documented decision remains unresolved." : row.candidate_trigger,
    record_series: row.candidate_record_series,
    accountable_owner: row.candidate_accountable_owner,
    purpose: `Govern ${domainKey} for the TOS synthetic-staging baseline without enabling production intake or automatic lifecycle execution.`,
    evidence_reference: "github:BREXAtlas/EdNotebook;path:docs/PRIVACY_RECORDS_TOS_STAGING_DECISION_PACKET.md",
    official_copy_role: review.official_copy_role,
    privacy_classification: review.privacy_classification,
    decision_basis: review.recommendation,
    condition: review.condition,
    dependency: row.candidate_dependency,
    authority_reference: "TOS staging baseline informed by the cited official sources; institution-specific adoption remains pending.",
    review_due_at: "2026-10-30T23:59:59.000Z",
    automatic_execution_enabled: false,
  };
});

const approvedCount = policies.filter((policy) => policy.status === "approved").length;
const blockedCount = policies.filter((policy) => policy.status === "blocked").length;
if (approvedCount !== 33 || blockedCount !== 28) {
  throw new Error(`Expected 33 approved and 28 blocked decisions; received ${approvedCount}/${blockedCount}.`);
}

const manifest = {
  schema_version: 1,
  scope: "tos_synthetic_staging_baseline",
  decision_status: "all_domains_decided_privacy_records_hold",
  decision_date: "2026-08-02",
  review_due_at: "2026-10-30T23:59:59.000Z",
  institution_id: "22222222-2222-4222-8222-222222222222",
  staging_project_ref: "gfalgonektwdylsxsgzc",
  staging_region: "us-east-1",
  protected_candidate_commit: "3076110661a30f970f0e3eec7e53413aa69e548b",
  production_project_ref_unchanged: "didwxihufueqbpfnfdmm",
  required_domain_count: 61,
  approved_domain_count: approvedCount,
  blocked_domain_count: blockedCount,
  privacy_records_gate: "hold",
  asu_institutional_adoption: "parked_pending_authorized_review",
  production_student_intake_enabled: false,
  production_project_touched: false,
  automatic_lifecycle_execution_enabled: false,
  contains_student_data: false,
  source_artifacts: [
    "docs/privacy-records-lifecycle-decision-workbook.csv",
    "docs/privacy-records-institutional-review-recommendations.json",
    "docs/PRIVACY_RECORDS_INSTITUTIONAL_REVIEW.md",
  ],
  calendar_guardrail_days: calendarGuardrailDays,
  policies,
};

await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const reviewHeaders = [
  "domain_key", "status", "disposition", "retention_days", "trigger", "record_series",
  "accountable_owner", "official_copy_role", "privacy_classification", "decision_basis",
  "condition", "dependency", "review_due_at", "automatic_execution_enabled",
];
const csv = [
  reviewHeaders.map(csvCell).join(","),
  ...policies.map((policy) => reviewHeaders.map((header) => csvCell(policy[header])).join(",")),
].join("\n");
await writeFile(reviewCsvUrl, `${csv}\n`, "utf8");

process.stdout.write(`Generated 61 decisions (${approvedCount} approved, ${blockedCount} blocked).\n`);
