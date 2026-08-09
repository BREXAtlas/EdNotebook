import { ACCESSIBILITY_APPROVAL_CANDIDATE } from "../admin-control/accessibilityApprovalDecision.js";
import { PRIVACY_RECORDS_APPROVAL_CANDIDATE } from "../admin-control/privacyRecordsApprovalDecision.js";
import { SECURITY_APPROVAL_CANDIDATE } from "../admin-control/securityApprovalDecision.js";
import { STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE } from "../admin-control/studentDataPromotionPreflight.js";
import { DIGITAL_LITERACY_RELEASE_ID } from "../digital-literacy/digitalLiteracyPilotModel.js";
import { FINANCIAL_LITERACY_RELEASE_ID } from "../financial-literacy/financialLiteracyModel.js";
import { stablePreviewHash } from "../integrations/early-prep/earlyPrepLearningAdapters.js";
import { EARLY_PREP_LEARNING_SYSTEMS_ACCEPTANCE_VERSION } from "../integrations/early-prep/learningSystemsAcceptance.js";
import { EARLY_PREP_TRANSITION_PREVIEW_VERSION } from "./portfolioTransition.js";
import { EARLY_PREP_READINESS_VERSION } from "./readinessCatalog.js";
import { EARLY_PREP_SUBJECTS, EARLY_PREP_WORKSPACE_VERSION } from "./subjectCatalog.js";

export const EARLY_PREP_PILOT_READINESS_VERSION = "early-prep-pilot-readiness-v1";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const EARLY_PREP_TECHNICAL_EVIDENCE = deepFreeze([
  {
    id: "foundation-and-isolation",
    label: "Early Prep foundation and division isolation",
    detail: "K–12 courses, controls, social audiences, and commerce denials remain separate from University records.",
    evidenceReference: "migration:20260808211028_early_prep_foundation;test:early-prep-foundation",
    status: "repository_evidence_ready",
  },
  {
    id: "subject-workspaces",
    label: `${EARLY_PREP_SUBJECTS.length} subject-adaptive workspaces`,
    detail: "All stable Grades 9–12 subjects have versioned teacher and student adapters without rewriting existing work.",
    evidenceReference: `workspace:${EARLY_PREP_WORKSPACE_VERSION}`,
    status: "repository_evidence_ready",
  },
  {
    id: "digital-literacy",
    label: "Digital Literacy class evidence",
    detail: "The governed release supports bounded class assignments and completion evidence without activating research.",
    evidenceReference: `release:${DIGITAL_LITERACY_RELEASE_ID}`,
    status: "repository_evidence_ready",
  },
  {
    id: "financial-literacy",
    label: "Financial Literacy class evidence",
    detail: "The governed K–12-only release stores no personal financial scenarios and exposes no commerce actions.",
    evidenceReference: `release:${FINANCIAL_LITERACY_RELEASE_ID}`,
    status: "repository_evidence_ready",
  },
  {
    id: "learning-systems",
    label: "Synthetic OneRoster and Schoology rehearsal",
    detail: "Counts-only acceptance verifies the shared contracts with zero provider writes and no credentials.",
    evidenceReference: `acceptance:${EARLY_PREP_LEARNING_SYSTEMS_ACCEPTANCE_VERSION}`,
    status: "repository_evidence_ready",
  },
  {
    id: "college-career-readiness",
    label: "College and career practice tools",
    detail: "Planning, resume, and interview practice remain private and do not rank, match, apply, record, or score students.",
    evidenceReference: `workspace:${EARLY_PREP_READINESS_VERSION}`,
    status: "repository_evidence_ready",
  },
  {
    id: "portfolio-transition",
    label: "Governed portfolio-transition preview",
    detail: "Item-by-item synthetic selection excludes official grades, safety records, private messages, district IDs, and research data.",
    evidenceReference: `preview:${EARLY_PREP_TRANSITION_PREVIEW_VERSION}`,
    status: "repository_evidence_ready",
  },
  {
    id: "staging-database-gates",
    label: "Disposable staging database gates",
    detail: "CI rehearses RLS, tenant isolation, K–12 commerce denial, idempotency, and zero-write grade export against fresh migrations.",
    evidenceReference: "test:supabase/tests/early_prep_staging_pilot.sql",
    status: "repository_evidence_ready",
  },
]);

export const EARLY_PREP_STAGING_WALKTHROUGH_CHECKS = deepFreeze([
  ["public-paths", "both", "Open the Early Prep landing, student path, teacher path, and institution-gated readiness route."],
  ["teacher-account", "teacher", "Create and sign in to a synthetic high-school teacher account without granting University professor access."],
  ["student-account", "student", "Create and sign in to a synthetic Grades 9–12 student account without University feed or profile crossover."],
  ["class-lifecycle", "teacher", "Create, review, publish, and reopen a synthetic K–12 class using the existing governed class lifecycle."],
  ["subject-workspaces", "both", `Exercise teacher and student adapters across all ${EARLY_PREP_SUBJECTS.length} stable subject configurations.`],
  ["discovery-and-enrollment", "both", "Find the synthetic class, request or confirm enrollment, and verify the private class handoff."],
  ["assignments-and-writing", "both", "Create, publish, open, draft, submit, review, and recover synthetic assignment and writing work."],
  ["digital-literacy", "both", "Assign, complete, review, and verify private feedback and completion evidence for Digital Literacy."],
  ["financial-literacy", "both", "Open and complete bounded Financial Literacy work without storing personal financial details."],
  ["learning-workspace", "student", "Exercise notes, sources, documents, files, citations, portable export, and non-destructive restore."],
  ["communication", "both", "Verify course-scoped announcements, questions, replies, notifications, read state, and audience boundaries."],
  ["social-and-rewards", "both", "Verify school-only social spaces, profiles, groups, points, badges, corrections, and no public minor discovery."],
  ["college-and-career", "both", "Exercise private planning, resume, interview, and portfolio tools without ranking, matching, applying, or recording."],
  ["synthetic-learning-systems", "teacher", "Run synthetic OneRoster, PowerSchool, and Schoology acceptance with zero provider writes and no credentials."],
  ["portfolio-transition", "student", "Build a synthetic item-by-item transition manifest and verify protected records remain excluded."],
  ["cross-cutting-boundaries", "both", "Verify keyboard, responsive, session recovery, logout, data isolation, payment denial, and no University crossover."],
].map(([id, persona, label]) => ({ id, persona, label, status: "pending_staging_walkthrough" })));

export const EARLY_PREP_HUMAN_APPROVAL_GATES = deepFreeze([
  {
    id: "institution-and-district-authority",
    label: "Institution sponsor and district authority",
    detail: "An accountable school or district representative must define the permitted pilot population, purpose, dates, and owners.",
    evidenceReference: "governed-control:institution-authorization",
  },
  {
    id: "privacy-and-records",
    label: "Privacy and education-records review",
    detail: `${PRIVACY_RECORDS_APPROVAL_CANDIDATE.blockedDomainCount} lifecycle domains remain blocked in the current cross-platform packet; an authorized institution reviewer must decide the high-school pilot scope independently.`,
    evidenceReference: `candidate:${PRIVACY_RECORDS_APPROVAL_CANDIDATE.manifestSha256}`,
  },
  {
    id: "security",
    label: "Independent security review",
    detail: "An authorized security reviewer must assess the exact release, residual risks, incident boundary, and evidence expiration.",
    evidenceReference: SECURITY_APPROVAL_CANDIDATE.evidencePacket,
  },
  {
    id: "accessibility",
    label: "Manual accessibility acceptance",
    detail: "Authorized reviewers must complete keyboard, assistive-technology, zoom, reflow, responsive, media, and content review.",
    evidenceReference: ACCESSIBILITY_APPROVAL_CANDIDATE.evidencePacket,
  },
  {
    id: "minor-data-and-consent",
    label: "Minor-data, consent, and records authority",
    detail: "The institution must define lawful authority, required guardian or student notices and consent, minimization, retention, access, dispute, and deletion handling.",
    evidenceReference: "governed-control:student-data-scope",
  },
  {
    id: "support-incident-and-rollback",
    label: "Support, incident, and rollback ownership",
    detail: "Named owners, escalation paths, recovery evidence, stop conditions, and a tested rollback plan are required before a real pilot.",
    evidenceReference: "governed-control:operational-readiness",
  },
  {
    id: "bounded-pilot-lane",
    label: "Exact institution Pilot-lane assignment",
    detail: "An authorized human must assign the exact institution, course, or account scope. Technical evidence cannot assign the live lane.",
    evidenceReference: `candidate:${STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE.migrationVersion}`,
  },
].map((gate) => ({ ...gate, status: "authorized_human_decision_required" })));

export const EARLY_PREP_PILOT_ACKNOWLEDGEMENTS = deepFreeze([
  { id: "technicalEvidenceIsNotApproval", label: "Repository and CI evidence is technical evidence—not institution approval." },
  { id: "humanDecisionsRemainIndependent", label: "Every approval gate must be decided independently by an authorized human." },
  { id: "syntheticDataOnly", label: "This packet uses synthetic categories only and authorizes no real minor data." },
  { id: "noLiveIntegrations", label: "No live SIS or LMS connection, credential, roster, grade, or provider write is authorized." },
  { id: "noProductionOrResearch", label: "Production intake and research collection remain disabled." },
  { id: "noCommercialOrUniversityChange", label: "Payments and University, professor, publisher, and marketplace flows remain unchanged." },
]);

function requireFailClosedScope(input) {
  if ((input.division ?? "k12") !== "k12") throw new Error("early_prep_division_required");
  if ((input.classification ?? "synthetic_test_data_only") !== "synthetic_test_data_only") throw new Error("synthetic_data_only");
  if ((input.integrationMode ?? "none") !== "none") throw new Error("live_integrations_not_authorized");
  if ((input.productionMode ?? "disabled") !== "disabled") throw new Error("production_not_authorized");
  if ((input.researchMode ?? "disabled") !== "disabled") throw new Error("research_not_authorized");
  if ((input.commerceMode ?? "disabled") !== "disabled") throw new Error("early_prep_commerce_not_authorized");
}

export function previewEarlyPrepPilotReadiness(input = {}) {
  requireFailClosedScope(input);
  const preview = {
    version: EARLY_PREP_PILOT_READINESS_VERSION,
    classification: "synthetic_test_data_only",
    division: "k12",
    requestedLane: "pilot_review_only",
    technicalEvidence: EARLY_PREP_TECHNICAL_EVIDENCE,
    humanApprovalGates: EARLY_PREP_HUMAN_APPROVAL_GATES,
    counts: {
      technicalEvidenceReady: EARLY_PREP_TECHNICAL_EVIDENCE.length,
      stagingWalkthroughChecksPending: EARLY_PREP_STAGING_WALKTHROUGH_CHECKS.length,
      stagingWalkthroughChecksCompleted: 0,
      humanDecisionsRequired: EARLY_PREP_HUMAN_APPROVAL_GATES.length,
      institutionApprovalsRecorded: 0,
    },
    status: "awaiting_authorized_institution_review",
    institutionDecisionStatus: "not_recorded",
    pilotApproved: false,
    pilotActivated: false,
    stagingWalkthroughCompleted: false,
    mainPromotionAuthorized: false,
    liveDataLaneAssigned: false,
    realMinorDataAuthorized: false,
    liveIntegrationAuthorized: false,
    productionActivated: false,
    researchActivated: false,
    paymentsEnabled: false,
    universityRecordsModified: false,
  };
  return deepFreeze({ ...preview, previewHash: stablePreviewHash(preview) });
}

export function prepareEarlyPrepInstitutionReviewPacket(preview, acknowledgements = {}) {
  if (preview?.version !== EARLY_PREP_PILOT_READINESS_VERSION || preview?.classification !== "synthetic_test_data_only") {
    throw new Error("synthetic_pilot_readiness_preview_required");
  }
  const rebuilt = previewEarlyPrepPilotReadiness({
    division: preview.division,
    classification: preview.classification,
  });
  const { previewHash, ...previewPayload } = preview;
  if (stablePreviewHash(previewPayload) !== previewHash || rebuilt.previewHash !== previewHash) {
    throw new Error("pilot_readiness_preview_integrity_failed");
  }
  const missing = EARLY_PREP_PILOT_ACKNOWLEDGEMENTS.find(({ id }) => acknowledgements[id] !== true);
  if (missing) throw new Error(`pilot_readiness_acknowledgement_required:${missing.id}`);

  const packet = {
    version: EARLY_PREP_PILOT_READINESS_VERSION,
    classification: "synthetic_test_data_only",
    division: "k12",
    status: "ready_for_authorized_institution_review",
    technicalEvidenceReferences: rebuilt.technicalEvidence.map(({ id, evidenceReference }) => ({ id, evidenceReference })),
    stagingWalkthroughChecks: EARLY_PREP_STAGING_WALKTHROUGH_CHECKS,
    humanApprovalGates: rebuilt.humanApprovalGates.map(({ id, status, evidenceReference }) => ({ id, status, evidenceReference })),
    acknowledgements: EARLY_PREP_PILOT_ACKNOWLEDGEMENTS.map(({ id }) => id),
    institutionDecisionStatus: "not_recorded",
    pilotApproved: false,
    pilotActivated: false,
    stagingWalkthroughCompleted: false,
    mainPromotionAuthorized: false,
    liveDataLaneAssigned: false,
    realMinorDataAuthorized: false,
    liveIntegrationAuthorized: false,
    productionActivated: false,
    researchActivated: false,
    paymentsEnabled: false,
    universityRecordsModified: false,
    nextRequiredAction: "Authorized institution reviewers must independently record every required decision in the governed controls.",
  };
  return deepFreeze({ ...packet, packetHash: stablePreviewHash(packet) });
}
