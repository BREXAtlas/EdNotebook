import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authGate = readFileSync(new URL("../AuthGate.jsx", import.meta.url), "utf8");
const professorDashboard = readFileSync(new URL("./ProfessorDashboard.jsx", import.meta.url), "utf8");
const assignments = readFileSync(new URL("./AssignmentTemplateWorkspace.jsx", import.meta.url), "utf8");
const digitalLiteracy = readFileSync(new URL("../digital-literacy/DigitalLiteracyPilotWorkspace.jsx", import.meta.url), "utf8");
const workspaceRoleMigration = readFileSync(
  new URL("../../supabase/migrations/20260804025029_allow_unverified_educator_workspace_access.sql", import.meta.url),
  "utf8",
);
const institutionControls = readFileSync(
  new URL("../../supabase/migrations/20260721210000_institution_admin_control_center.sql", import.meta.url),
  "utf8",
);

test("professor signup opens the workspace without approving an institution affiliation", () => {
  assert.match(workspaceRoleMigration, /private\.assign_requested_workspace_role/u);
  assert.match(workspaceRoleMigration, /v_requested_role='professor'/u);
  assert.match(workspaceRoleMigration, /new\.role := 'professor'/u);
  assert.match(workspaceRoleMigration, /identity_onboarding_requests request/u);
  assert.doesNotMatch(workspaceRoleMigration, /new\.role\s*:=\s*'(?:admin|owner|security|records)'/u);
  assert.doesNotMatch(workspaceRoleMigration, /set\s+verification_status\s*=\s*'approved'/iu);
  assert.doesNotMatch(workspaceRoleMigration, /set\s+status\s*=\s*'active'/iu);
});

test("institution-owned course access still requires an active professor affiliation", () => {
  assert.match(institutionControls, /create policy courses_insert/u);
  assert.match(institutionControls, /institution_id is null/u);
  assert.match(institutionControls, /private\.has_active_institution_affiliation\(\(select auth\.uid\(\)\), institution_id, 'professor'\)/u);
});

test("the account gate treats professor as a workspace choice and review as a visible status", () => {
  assert.match(authGate, /requestedProfessor && profile\?\.role === "learner"/u);
  assert.match(authGate, /identity_onboarding_requests/u);
  assert.match(authGate, /\.eq\("user_id", session\.user\.id\)/u);
  assert.match(authGate, /UNVERIFIED EDUCATOR/u);
  assert.match(authGate, /Your professor workspace is active/u);
  assert.doesNotMatch(authGate, /You cannot open institutional teaching, roster, assignment, or grade tools/u);
});

test("Emily's professor Beta walkthrough labels are visible and actionable", () => {
  for (const label of [
    "Course Library",
    "Create Course",
    "Digital Literacy Course",
    "Students & Roster",
    "Assignments",
    "Syllabus & Calendar",
    "Progress & Analytics",
    "Notifications",
    "Settings",
    "Help & Support",
  ]) assert.match(professorDashboard, new RegExp(label.replace("&", "&"), "u"));
  assert.match(professorDashboard, /Open Digital Literacy Course/u);
  assert.match(professorDashboard, /AUTOMATIC COURSE · READY TO REVIEW/u);
});

test("professors can preview the full canonical Digital Literacy Course inside EdNotebook", () => {
  assert.match(digitalLiteracy, /Open full course preview/u);
  assert.match(digitalLiteracy, /LEARNER PREVIEW · IN EDNOTEBOOK/u);
  assert.match(digitalLiteracy, /<iframe/u);
  assert.match(digitalLiteracy, /preview", "professor"/u);
  assert.match(digitalLiteracy, /Preview does not create student progress/u);
});

test("new professor accounts contain no synthetic courses, students, grades, profiles, or K-12 SIS controls", () => {
  for (const syntheticValue of [
    "EDUCATOR_CLASSES",
    "INITIAL_ROSTER",
    "INITIAL_GRADEBOOK",
    "Maya Reynolds",
    "Jordan Lee",
    "Avery Johnson",
    "Sam Rivera",
    "Dr. Nguyen",
    "SCI 101",
    "ENG 10",
    "PowerSchool",
  ]) assert.doesNotMatch(professorDashboard, new RegExp(syntheticValue, "u"));
  assert.match(professorDashboard, /const teachingClasses = courseLibrary/u);
  assert.match(professorDashboard, /No sample courses or student profiles are loaded/u);
  assert.doesNotMatch(assignments, /fallbackClasses/u);
  assert.doesNotMatch(assignments, /sci-101-cell|eng10-stories|What Is a Cell\?/u);
  assert.match(assignments, /New professor accounts start empty/u);
});
