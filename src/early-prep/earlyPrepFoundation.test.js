import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const foundation = read("../../supabase/migrations/20260803120000_early_prep_foundation.sql");
const adminScope = read("../../supabase/migrations/20260803121000_scope_admin_controls_by_education_division.sql");
const main = read("../main.jsx");
const landing = read("../portal/StudentLanding.jsx");
const courseStart = read("../CourseStart.jsx");
const professor = read("../portal/ProfessorDashboard.jsx");

test("public Early Prep routes expose separate student and high-school teacher account paths", () => {
  assert.match(main, /#\/early-prep\/teacher/u);
  assert.match(main, /educationTrack="k12"/u);
  assert.match(main, /#\/early-prep\/student/u);
  assert.match(landing, /Student sign in or create account/u);
  assert.match(landing, /High-school teacher sign in or create account/u);
});

test("course creation uses the exact subject prompt and persists stable subject metadata", () => {
  assert.match(courseStart, /What subject is this for\?/u);
  assert.match(courseStart, /subject_id: educationDivision === "k12" \? subjectId : null/u);
  assert.match(foundation, /create table public\.education_subjects/u);
  assert.equal((foundation.match(/^\s*\('[a-z-]+','/gmu) || []).length, 11);
  assert.match(foundation, /Course education division is immutable after creation/u);
});

test("Digital Literacy is reused and assignment templates inherit the subject contract", () => {
  const standard = read("../../supabase/migrations/20260801220956_standardize_digital_literacy_access.sql");
  assert.match(standard, /digital_literacy_standard_enrollments/u);
  assert.match(standard, /student_id uuid not null unique/u);
  assert.match(foundation, /assignment_form_templates_subject_guard/u);
  assert.doesNotMatch(foundation, /create table public\.digital_literacy_catalog/u);
  assert.match(professor, /Digital Literacy Class/u);
});

test("the admin selector is backed by division-scoped RPCs, policy resolution, and audit", () => {
  assert.match(adminScope, /get_admin_control_center_by_division/u);
  assert.match(adminScope, /admin_search_accounts_courses_by_division/u);
  assert.match(adminScope, /policy\.education_division in \(p_education_division,'both'\)/u);
  assert.match(adminScope, /fp\.education_division in \(v_division,'both'\)/u);
  assert.match(adminScope, /fp\.education_division=v_division/u);
  assert.match(adminScope, /admin\.education_division_selected/u);
  assert.match(adminScope, /Choose University or Early Prep before previewing a control/u);
});

test("Early Prep commerce is absent in the UI and denied by SQL and Edge boundaries", () => {
  assert.match(professor, /Commerce unavailable in Early Prep/u);
  assert.match(professor, /course\.division !== "k12"/u);
  assert.match(foundation, /Marketplace seller onboarding is unavailable in Early Prep/u);
  assert.match(foundation, /marketplace_orders_early_prep_commerce_guard/u);
  assert.match(read("../../supabase/functions/marketplace-checkout/index.ts"), /requireUniversityMarketplaceListing/u);
  assert.match(read("../../supabase/functions/marketplace-seller-onboarding/index.ts"), /requireUniversityMarketplaceApplication/u);
  assert.match(read("../../supabase/functions/marketplace-refund/index.ts"), /requireUniversityMarketplaceOrder/u);
});

test("existing social policies keep Early Prep out of anonymous and university discovery", () => {
  const divisionMigration = read("../../supabase/migrations/20260719000739_education_divisions_and_educator_verification.sql");
  const campusSocial = read("../../supabase/migrations/20260730193830_govern_campus_social_and_educator_verification.sql");
  assert.match(divisionMigration, /education_division = 'university' and visibility = 'public'/u);
  assert.match(campusSocial, /if new\.education_division='k12' and new\.audience='public_university'/u);
  assert.match(campusSocial, /viewer\.education_division=post\.education_division/u);
});

test("learning-system writes and Move to University remain reviewed foundations", () => {
  assert.match(foundation, /learning_system_crosswalks/u);
  assert.match(foundation, /learning_system_exchange_runs/u);
  assert.match(foundation, /unique\(institution_id,provider,idempotency_key\)/u);
  assert.match(foundation, /education_path_transition_requests/u);
  assert.match(foundation, /Applying a transition requires a later reviewed unit/u);
});
