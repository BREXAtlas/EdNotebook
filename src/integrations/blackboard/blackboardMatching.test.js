import test from "node:test";
import assert from "node:assert/strict";
import { buildStudentMappings, identityMappingPayload, proposeStudentMatch } from "./blackboardIdentityMatcher.js";
import { buildColumnMappings, columnMappingPayload, proposeColumnMatch } from "./blackboardColumnMatcher.js";
import { createExportPreview } from "./blackboardCsvGenerator.js";
import { inspectBlackboardCsv, parseCsvText } from "./blackboardCsvParser.js";
import { issueCounts, validateMappings } from "./blackboardValidation.js";

const learners = [
  { id: "student-1", full_name: "Jordan Smith", email: "jordan.smith@example.edu" },
  { id: "student-2", full_name: "Avery Johnson", email: "avery.johnson@example.edu" },
];
const gradeItems = [
  { id: "item-1", title: "Cell structure lab", max_points: 100 },
  { id: "item-2", title: "Evidence paragraph", max_points: 50 },
];

test("matches exact email at high confidence", () => {
  const match = proposeStudentMatch({ email: "JORDAN.SMITH@example.edu" }, learners, []);
  assert.equal(match.learnerId, "student-1");
  assert.equal(match.confidence, "high");
  assert.equal(match.status, "accepted");
});

test("requires review for a unique name-only match", () => {
  const match = proposeStudentMatch({ full_name: "Avery Johnson" }, learners, []);
  assert.equal(match.learnerId, "student-2");
  assert.equal(match.confidence, "medium");
  assert.equal(match.status, "review");
});

test("stores institution-facing identifiers as a canonical identifier set", () => {
  const payload = identityMappingPayload({
    rowKey: "student01",
    learnerId: "student-1",
    username: "student01",
    sis_user_id: "SIS-8",
    student_id: "A001",
    email: "student@example.edu",
    displayName: "Student One",
    method: "Manual professor match",
    confidence: "manual",
  });
  assert.deepEqual(payload.external_identifiers, {
    username: "student01",
    sis_user_id: "SIS-8",
    student_id: "A001",
    email: "student@example.edu",
  });
});

test("saved mapping wins only when the learner still exists", () => {
  const match = proposeStudentMatch({ rowKey: "jsmith" }, learners, [{ blackboard_row_key: "jsmith", ednotebook_user_id: "student-1" }]);
  assert.equal(match.method, "Saved Blackboard mapping");
  assert.equal(match.status, "accepted");
});

test("duplicate automatic learner matches are downgraded for review", () => {
  const parsed = parseCsvText("Email,Assignment [Total Pts: 10 Score]\njordan.smith@example.edu,9\njordan.smith@example.edu,8\n");
  const structure = inspectBlackboardCsv(parsed);
  const mappings = buildStudentMappings({ parsed, structure, learners });
  assert.ok(mappings.every((mapping) => mapping.status === "review"));
});

test("matches exact assignment title and points", () => {
  const mapping = proposeColumnMatch({ header: "Cell structure lab [Total Pts: 100 Score]", key: "cell structure lab", pointsPossible: 100 }, gradeItems, []);
  assert.equal(mapping.gradeItemId, "item-1");
  assert.equal(mapping.status, "accepted");
  assert.equal(mapping.scalingMode, "raw");
});

test("requires scaling review when points differ", () => {
  const mapping = proposeColumnMatch({ header: "Evidence paragraph [Total Pts: 25 Score]", key: "evidence paragraph", pointsPossible: 25 }, gradeItems, []);
  assert.equal(mapping.gradeItemId, "item-2");
  assert.equal(mapping.status, "review");
  assert.equal(mapping.scalingMode, "none");
});

test("maps Blackboard columns into the shared line-item contract", () => {
  const parsed = parseCsvText("Username,Lab [Total Pts: 50 Score] | id: _123_1\nstudent,45\n");
  const structure = inspectBlackboardCsv(parsed);
  const mapping = buildColumnMappings({ structure, gradeItems: [{ id: "lab", title: "Lab", max_points: 50 }] })[0];
  const payload = columnMappingPayload(mapping);
  assert.equal(payload.external_line_item_id, "_123_1");
  assert.equal(payload.canonical_line_item.externalLineItemId, "_123_1");
  assert.equal(payload.canonical_line_item.scoreMaximum, 50);
});

test("creates a preview from finalized grades and excludes pending grades", () => {
  const parsed = parseCsvText("Email,Cell structure lab [Total Pts: 100 Score]\njordan.smith@example.edu,80\navery.johnson@example.edu,70\n");
  const structure = inspectBlackboardCsv(parsed);
  const studentMappings = buildStudentMappings({ parsed, structure, learners });
  const columnMappings = buildColumnMappings({ structure, gradeItems });
  const context = {
    learners,
    gradeItems,
    grades: [
      { student_id: "student-1", grade_item_id: "item-1", score: 92, status: "finalized", updated_at: "2026-01-01T00:00:00Z" },
      { student_id: "student-2", grade_item_id: "item-1", score: 88, status: "pending", updated_at: "2026-01-01T00:00:00Z" },
    ],
    progress: [],
  };
  const preview = createExportPreview({ parsed, context, studentMappings, columnMappings });
  assert.equal(preview.changedGradeCells, 1);
  assert.equal(preview.gradeSnapshot[0].blackboard_row_key, studentMappings[0].rowKey);
  assert.equal(preview.gradeSnapshot[0].blackboard_column_key, columnMappings[0].columnKey);
  assert.equal(preview.rows.find((row) => row.studentId === "student-2").status, "Not finalized");
});

test("validation blocks duplicate mappings and missing scaling rules", () => {
  const parsed = parseCsvText("Email,Evidence paragraph [Total Pts: 25 Score]\njordan.smith@example.edu,20\n");
  const structure = inspectBlackboardCsv(parsed);
  const studentMappings = [
    { rowIndex: 0, learnerId: "student-1", status: "accepted", excluded: false },
    { rowIndex: 1, learnerId: "student-1", status: "accepted", excluded: false },
  ];
  const columnMappings = [{ columnIndex: 1, columnName: "Evidence paragraph", mappingType: "grade_item", gradeItemId: "item-2", pointsPossible: 25, scalingMode: "none", status: "accepted", protected: false }];
  const issues = validateMappings({ structure, context: { learners, gradeItems, grades: [] }, studentMappings, columnMappings });
  const counts = issueCounts(issues);
  assert.ok(counts.blocking >= 2);
  assert.ok(issues.some((item) => item.code === "duplicate_student_match"));
  assert.ok(issues.some((item) => item.code === "scaling_required"));
});
