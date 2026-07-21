import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const downloadSource = new URL("./secure-file-download/index.ts", import.meta.url);
const hardeningMigration = new URL("../migrations/20260721220000_student_data_safety_hardening.sql", import.meta.url);
const safetyHarness = new URL("../tests/institution_student_data_safety.sql", import.meta.url);

test("originals and previews share the same released-and-clean download gate", async () => {
  const source = await readFile(downloadSource, "utf8");
  const universalGate = source.search(
    /if\s*\([\s\S]{0,80}file\.availability_status\s*!==\s*"released"[\s\S]{0,80}file\.security_status\s*!==\s*"clean"/u,
  );
  const previewBranch = source.indexOf("if (input.previewId)");
  const branchEnd = source.search(/if\s*\(!file\)\s*throw new HttpError\(404,\s*"File was not found\."\)/u);

  assert.ok(previewBranch >= 0, "the preview path must exist");
  assert.ok(universalGate > branchEnd, "the release gate must run after both original and preview lookup paths");
  assert.match(source, /recordAuditRequired/u, "signed student-data access must require an audit record");
  assert.doesNotMatch(source, /await recordAudit\(/u, "download evidence must not use best-effort auditing");
});

test("secure-file authorization is purpose-aware and does not expose submissions to classmates", async () => {
  const [sql, harness] = await Promise.all([
    readFile(hardeningMigration, "utf8"),
    readFile(safetyHarness, "utf8"),
  ]);
  assert.match(sql, /f\.purpose='course'[\s\S]{0,300}private\.can_access_course/u);
  assert.match(sql, /f\.purpose='submission'[\s\S]{0,500}private\.can_manage_course/u);
  assert.doesNotMatch(
    sql,
    /or\s+\(f\.course_id is not null and private\.can_access_course\(f\.course_id\)\)/u,
    "generic course access must not authorize every file purpose",
  );
  assert.equal(
    [...sql.matchAll(/f\.course_id is not null and private\.can_access_course\(f\.course_id\)/gu)].length,
    1,
    "course membership access must appear only in the explicit course-purpose branch",
  );
  assert.match(harness, /same-course peer/u, "the rollback-safe SQL harness must preserve peer-submission isolation evidence");
});
