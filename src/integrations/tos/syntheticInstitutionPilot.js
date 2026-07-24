export const SYNTHETIC_PILOT_SCHEMA_VERSION = "1.0.0";

export const SYNTHETIC_PILOT_SCOPE = Object.freeze({
  tenantId: "tenant.synthetic.ednotebook-pilot",
  institutionId: "institution.synthetic.example-university",
  productId: "ednotebook",
  environment: "simulation",
  dataClass: "synthetic",
});

export const SYNTHETIC_PILOT_STEPS = Object.freeze([
  {
    id: "institution_application",
    actor: "institution_applicant",
    label: "Submit synthetic institution application",
    result: "Synthetic institution application submitted.",
  },
  {
    id: "institution_approval",
    actor: "tos_owner",
    label: "Approve synthetic institution",
    result: "Human owner approved the synthetic institution fixture.",
  },
  {
    id: "professor_signup",
    actor: "professor_applicant",
    label: "Create synthetic professor account",
    result: "Synthetic professor signup recorded as pending.",
  },
  {
    id: "professor_approval",
    actor: "institution_admin",
    label: "Approve synthetic professor",
    result: "Independent synthetic institution administrator approved the professor.",
  },
  {
    id: "course_create",
    actor: "professor",
    label: "Create and assign synthetic class",
    result: "Professor created EDLD 5310 and received the teaching assignment.",
  },
  {
    id: "student_signup",
    actor: "student_applicant",
    label: "Create synthetic student account",
    result: "Synthetic student signup recorded as pending enrollment.",
  },
  {
    id: "student_add",
    actor: "professor",
    label: "Add and approve synthetic student",
    result: "Professor matched and approved the synthetic student roster entry.",
  },
  {
    id: "assignment_publish",
    actor: "professor",
    label: "Publish synthetic assignment",
    result: "Professor published the bounded pilot reflection assignment.",
  },
  {
    id: "student_discussion",
    actor: "student",
    label: "Student posts in class discussion",
    result: "Student posted a synthetic course discussion response.",
  },
  {
    id: "professor_discussion",
    actor: "professor",
    label: "Professor replies to discussion",
    result: "Professor replied to the synthetic student discussion.",
  },
  {
    id: "assignment_submit",
    actor: "student",
    label: "Student completes assignment",
    result: "Student submitted the synthetic assignment.",
  },
  {
    id: "points_award",
    actor: "professor",
    label: "Professor awards progress points",
    result: "Professor reviewed completion and awarded 10 synthetic progress points.",
  },
  {
    id: "grade_publish",
    actor: "professor",
    label: "Professor finalizes and publishes grade",
    result: "Professor finalized and published the synthetic grade.",
  },
  {
    id: "student_grade_view",
    actor: "student",
    label: "Student views published grade",
    result: "Student viewed the published synthetic grade and feedback.",
  },
  {
    id: "semester_closeout",
    actor: "professor",
    label: "Close synthetic semester",
    result: "Professor closed the synthetic semester; counts-only TOS evidence is ready.",
  },
]);

export const LIVE_ACTIVATION_GATES = Object.freeze([
  "stages_1_through_12_verified",
  "institution_contract_and_approval",
  "independent_security_assessment",
  "accessibility_acceptance",
  "support_and_incident_owners",
  "approved_data_retention_and_route_policy",
  "student_privacy_and_records_approval",
  "backend_rate_limits_and_budget_caps",
  "tested_export_deletion_and_rollback",
  "zero_unresolved_critical_findings",
]);

export const EDNOTEBOOK_TOS_INFRASTRUCTURE_MAP = Object.freeze([
  ["institution_application", "#/institution-access", "institution_access_applications", "institution readiness evidence"],
  ["institution_approval", "#/admin/control-center", "institutions + institution_memberships", "human approval reference"],
  ["professor_signup", "#/professors", "auth.users + profiles + identity_onboarding_requests", "professor onboarding state"],
  ["professor_approval", "#/admin/control-center", "educator_verification_requests + affiliation review RPC", "independent professor approval"],
  ["course_create", "#/app", "courses + course_memberships + course_publications", "course package and assignment scope"],
  ["student_signup", "#/students/university", "auth.users + profiles + identity_onboarding_requests", "student onboarding count"],
  ["student_add", "#/app", "student_roster_entries + student_enrollment_requests + course_memberships", "roster count"],
  ["assignment_publish", "#/app", "assignments + grade_items + course_publication_versions", "assignment count and publication reference"],
  ["student_discussion", "#/students/university", "learning_messages + student_posts", "discussion count"],
  ["professor_discussion", "#/app", "learning_messages + professor_announcements", "discussion count"],
  ["assignment_submit", "#/students/university", "assignment_drafts + protected submission objects", "submission completion evidence"],
  ["points_award", "#/app", "course_progress + course_lesson_progress", "progress evidence"],
  ["grade_publish", "#/app", "student_grades + grade_items", "finalized-grade count"],
  ["student_grade_view", "#/students/university", "student_grades RLS projection", "grade-view evidence"],
  ["semester_closeout", "#/app", "Blackboard reconciliation/export + audit_events", "counts, hashes, approvals, and audit references"],
].map(([action, route, authoritativeRecords, tosEvidence]) =>
  Object.freeze({ action, route, authoritativeRecords, tosEvidence }),
));

export function createSyntheticPilotState() {
  return Object.freeze({
    schemaVersion: SYNTHETIC_PILOT_SCHEMA_VERSION,
    scope: SYNTHETIC_PILOT_SCOPE,
    mode: "synthetic_bounded_pilot",
    productionActivated: false,
    realUserPilotActivated: false,
    nextStepIndex: 0,
    institution: Object.freeze({ status: "not_submitted", verified: false }),
    professor: Object.freeze({
      status: "not_submitted",
      verified: false,
      classIds: Object.freeze([]),
    }),
    student: Object.freeze({
      status: "not_submitted",
      verified: false,
      enrolled: false,
      gradeVisible: false,
    }),
    course: Object.freeze({
      id: "course.synthetic.edld-5310",
      status: "not_created",
      professorAssigned: false,
      studentCount: 0,
      discussionCount: 0,
    }),
    assignment: Object.freeze({
      status: "not_created",
      submitted: false,
      progressPoints: 0,
      gradeStatus: "not_graded",
    }),
    closeout: Object.freeze({
      status: "open",
      tosEvidenceReady: false,
      tosRegistered: false,
    }),
    audit: Object.freeze([]),
  });
}

function appendAudit(state, event, changes = {}) {
  return Object.freeze({
    ...state,
    ...changes,
    audit: Object.freeze([event, ...state.audit]),
  });
}

function eventFor(step, actor, outcome, summary, occurredAt) {
  return Object.freeze({
    id: `audit.synthetic-pilot.${step.id}.${occurredAt}`,
    occurredAt,
    action: step.id,
    actor,
    outcome,
    summary,
    synthetic: true,
    persisted: false,
    scope: SYNTHETIC_PILOT_SCOPE,
  });
}

function changesFor(stepId, state) {
  switch (stepId) {
    case "institution_application":
      return { institution: Object.freeze({ status: "pending", verified: false }) };
    case "institution_approval":
      return { institution: Object.freeze({ status: "approved", verified: true }) };
    case "professor_signup":
      return {
        professor: Object.freeze({
          ...state.professor,
          status: "pending",
          verified: false,
        }),
      };
    case "professor_approval":
      return {
        professor: Object.freeze({
          ...state.professor,
          status: "approved",
          verified: true,
        }),
      };
    case "course_create":
      return {
        professor: Object.freeze({
          ...state.professor,
          classIds: Object.freeze([state.course.id]),
        }),
        course: Object.freeze({
          ...state.course,
          status: "active",
          professorAssigned: true,
        }),
      };
    case "student_signup":
      return {
        student: Object.freeze({
          ...state.student,
          status: "pending_enrollment",
          verified: true,
        }),
      };
    case "student_add":
      return {
        student: Object.freeze({
          ...state.student,
          status: "active",
          enrolled: true,
        }),
        course: Object.freeze({ ...state.course, studentCount: 1 }),
      };
    case "assignment_publish":
      return {
        assignment: Object.freeze({
          ...state.assignment,
          status: "published",
        }),
      };
    case "student_discussion":
    case "professor_discussion":
      return {
        course: Object.freeze({
          ...state.course,
          discussionCount: state.course.discussionCount + 1,
        }),
      };
    case "assignment_submit":
      return {
        assignment: Object.freeze({
          ...state.assignment,
          status: "submitted",
          submitted: true,
        }),
      };
    case "points_award":
      return {
        assignment: Object.freeze({
          ...state.assignment,
          progressPoints: 10,
        }),
      };
    case "grade_publish":
      return {
        assignment: Object.freeze({
          ...state.assignment,
          status: "graded",
          gradeStatus: "published",
        }),
      };
    case "student_grade_view":
      return {
        student: Object.freeze({ ...state.student, gradeVisible: true }),
      };
    case "semester_closeout":
      return {
        course: Object.freeze({ ...state.course, status: "closed" }),
        closeout: Object.freeze({
          ...state.closeout,
          status: "export_ready",
          tosEvidenceReady: true,
        }),
      };
    default:
      return {};
  }
}

export function applySyntheticPilotStep(
  state,
  stepId,
  actor,
  occurredAt = new Date().toISOString(),
) {
  const expected = SYNTHETIC_PILOT_STEPS[state.nextStepIndex];
  const requested = SYNTHETIC_PILOT_STEPS.find((step) => step.id === stepId);
  if (!requested) throw new Error("Unknown synthetic pilot step.");
  if (!expected || expected.id !== requested.id) {
    return appendAudit(
      state,
      eventFor(
        requested,
        actor,
        "denied",
        expected
          ? `Complete ${expected.label} before this action.`
          : "The synthetic semester is already closed.",
        occurredAt,
      ),
    );
  }
  if (requested.actor !== actor) {
    return appendAudit(
      state,
      eventFor(
        requested,
        actor,
        "denied",
        `${actor} cannot perform an action reserved for ${requested.actor}.`,
        occurredAt,
      ),
    );
  }
  if (stepId === "professor_approval" && actor === "professor_applicant") {
    return appendAudit(
      state,
      eventFor(
        requested,
        actor,
        "denied",
        "A professor cannot approve their own affiliation.",
        occurredAt,
      ),
    );
  }
  return appendAudit(
    state,
    eventFor(requested, actor, "allowed", requested.result, occurredAt),
    {
      ...changesFor(stepId, state),
      nextStepIndex: state.nextStepIndex + 1,
    },
  );
}

function canonicalEvidence(packet) {
  return JSON.stringify({
    schemaVersion: packet.schemaVersion,
    packetId: packet.packetId,
    scope: packet.scope,
    courseReference: packet.courseReference,
    recordCounts: packet.recordCounts,
    lifecycleEvidence: packet.lifecycleEvidence,
    infrastructureMappings: packet.infrastructureMappings,
    containsDirectIdentifiers: packet.containsDirectIdentifiers,
    containsRawGrades: packet.containsRawGrades,
    containsCredentials: packet.containsCredentials,
    officialRecordTransfer: packet.officialRecordTransfer,
    generatedAt: packet.generatedAt,
  });
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSyntheticPilotEvidencePacket(
  state,
  generatedAt = new Date().toISOString(),
) {
  if (!state.closeout.tosEvidenceReady) {
    throw new Error("Close the synthetic semester before exporting TOS evidence.");
  }
  const packet = {
    schemaVersion: SYNTHETIC_PILOT_SCHEMA_VERSION,
    packetId: `pilot-evidence.synthetic.edld-5310.${generatedAt}`,
    scope: SYNTHETIC_PILOT_SCOPE,
    courseReference: state.course.id,
    recordCounts: {
      institutions: 1,
      professors: 1,
      learners: state.course.studentCount,
      courses: 1,
      assignments: 1,
      discussions: state.course.discussionCount,
      finalizedGrades: state.assignment.gradeStatus === "published" ? 1 : 0,
      semesterCloseouts: 1,
    },
    lifecycleEvidence: SYNTHETIC_PILOT_STEPS.map((step) => step.id),
    infrastructureMappings: EDNOTEBOOK_TOS_INFRASTRUCTURE_MAP,
    containsDirectIdentifiers: false,
    containsRawGrades: false,
    containsCredentials: false,
    officialRecordTransfer: false,
    productionActivated: false,
    realUserPilotActivated: false,
    generatedAt,
  };
  return Object.freeze({
    ...packet,
    integrity: Object.freeze({
      algorithm: "SHA-256",
      digest: await sha256(canonicalEvidence(packet)),
    }),
  });
}

export function evaluateLiveActivation(mode, evidence) {
  const missing = LIVE_ACTIVATION_GATES.filter((gate) => !evidence?.[gate]);
  if (mode === "synthetic_bounded_pilot") {
    return Object.freeze({ allowed: true, missing: Object.freeze([]) });
  }
  if (mode !== "approved_pilot" && mode !== "production") {
    return Object.freeze({
      allowed: false,
      missing: Object.freeze(["recognized_activation_mode"]),
    });
  }
  return Object.freeze({
    allowed: missing.length === 0,
    missing: Object.freeze(missing),
  });
}
