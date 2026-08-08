import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const assignmentWorkspace = await readFile(new URL("../portal/AssignmentTemplateWorkspace.jsx", import.meta.url), "utf8");
const assignmentService = await readFile(new URL("../portal/assignmentTemplateService.js", import.meta.url), "utf8");
const portalService = await readFile(new URL("../portal/portalService.js", import.meta.url), "utf8");
const studentDashboard = await readFile(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");
const connectedDashboard = await readFile(new URL("../portal/ConnectedStudentDashboard.jsx", import.meta.url), "utf8");
const guide = await readFile(new URL("./SubjectWorkspaceGuide.jsx", import.meta.url), "utf8");

test("assignment templates adapt only when the active dashboard track is Early Prep", () => {
  assert.match(assignmentWorkspace, /const subjectStarter = k12 \? earlyPrepAssignmentStarter\(stableSubjectId\) : null/u);
  assert.match(assignmentWorkspace, /track === "k12" && <SubjectWorkspaceGuide/u);
  assert.match(assignmentWorkspace, /editor_config: subjectStarter\?\.editorConfig/u);
  assert.match(assignmentWorkspace, /title: subjectStarter\?\.title \|\| "Source Analysis Response"/u);
});

test("course reads are explicitly scoped by the selected education division", () => {
  assert.match(assignmentWorkspace, /listAssignmentCourses\(track\)/u);
  assert.match(assignmentService, /query = query\.eq\("education_division", educationDivision\)/u);
  assert.match(portalService, /query = query\.eq\("education_division", educationDivision\)/u);
  assert.match(studentDashboard, /listCurrentStudentCourses\(track\)/u);
  assert.match(connectedDashboard, /listCurrentStudentCourses\(track\)/u);
});

test("student course records carry the stable subject identifier into the shared workspace", () => {
  assert.match(portalService, /subject,subject_id,teaching_window/u);
  assert.match(portalService, /subjectId: course\.subject_id \|\| null/u);
  assert.match(studentDashboard, /subjectId: course\.subject_id \|\| null/u);
  assert.match(guide, /Evidence tools for this class/u);
  assert.match(guide, /Existing templates and completed student work are never rewritten/u);
});

test("the Early Prep subject guide does not expose commercial actions", () => {
  assert.doesNotMatch(guide, /checkout|marketplace|seller|rental|payout|payment/iu);
});
