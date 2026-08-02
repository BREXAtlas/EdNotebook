import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

import {
  EXTERNAL_STUDENT_DATA_LIFECYCLE_DOMAINS,
  STUDENT_DATA_INTAKE_GATES,
  STUDENT_DATA_LIFECYCLE_DOMAINS,
  STUDENT_DATA_DOMAINS,
  createStudentDataSnapshot,
  evaluateDeletionRequest,
  evaluateStudentDataIntakeReadiness,
  evaluateStudentDataAccess,
  reconcileBlackboardGradeRecord,
  reconcileStudentDataSnapshots,
} from "./studentDataSafetyModel.js";

const STUDENT_ID = "student-a";
const INSTITUTION_A = "institution-a";
const INSTITUTION_B = "institution-b";

function completeCaptureResults(overrides = {}) {
  return Object.fromEntries(
    STUDENT_DATA_DOMAINS.map((domain) => [
      domain,
      Object.freeze({ status: "succeeded", rows: overrides[domain] || [] }),
    ]),
  );
}

function fixtureBundle() {
  return {
    studentId: STUDENT_ID,
    domains: completeCaptureResults({
      profile: [{ id: STUDENT_ID, full_name: "Student A", role: "learner" }],
      institutionAffiliations: [{ id: "affiliation-a", user_id: STUDENT_ID, institution_id: INSTITUTION_A, status: "active" }],
      institutionMemberships: [{ user_id: STUDENT_ID, institution_id: INSTITUTION_A, role: "learner", status: "active" }],
      courseMemberships: [{ user_id: STUDENT_ID, course_id: "course-a", role: "learner" }],
      studentGrades: [{ id: "grade-a", student_id: STUDENT_ID, grade_item_id: "item-a", score: 88.5, status: "finalized" }],
      secureFiles: [{ id: "file-a", owner_id: STUDENT_ID, availability_status: "released" }],
    }),
  };
}

test("logical restore reproduces the complete canonical student snapshot", () => {
  const before = createStudentDataSnapshot(fixtureBundle());
  const restored = createStudentDataSnapshot({
    ...fixtureBundle(),
    domains: {
      ...fixtureBundle().domains,
      studentGrades: {
        status: "succeeded",
        rows: [...fixtureBundle().domains.studentGrades.rows].reverse(),
      },
    },
  });

  assert.deepEqual(Object.keys(before.rowCounts), [...STUDENT_DATA_DOMAINS]);
  assert.equal(reconcileStudentDataSnapshots(before, restored).ok, true);

  const damaged = createStudentDataSnapshot({
    ...fixtureBundle(),
    domains: {
      ...fixtureBundle().domains,
      studentGrades: { status: "succeeded", rows: [] },
    },
  });
  const result = reconcileStudentDataSnapshots(before, damaged);
  assert.equal(result.ok, false);
  assert.deepEqual(result.differences, [{ domain: "studentGrades", beforeCount: 1, afterCount: 0, changed: true }]);
});

test("restore reconciliation rejects changed values, extra rows, and the wrong student", () => {
  const before = createStudentDataSnapshot(fixtureBundle());
  const changed = createStudentDataSnapshot({
    ...fixtureBundle(),
    domains: {
      ...fixtureBundle().domains,
      studentGrades: {
        status: "succeeded",
        rows: [{ ...fixtureBundle().domains.studentGrades.rows[0], score: 89 }],
      },
    },
  });
  const extra = createStudentDataSnapshot({
    ...fixtureBundle(),
    domains: {
      ...fixtureBundle().domains,
      secureFiles: {
        status: "succeeded",
        rows: [
          ...fixtureBundle().domains.secureFiles.rows,
          { id: "file-unexpected", owner_id: STUDENT_ID, availability_status: "released" },
        ],
      },
    },
  });

  assert.equal(reconcileStudentDataSnapshots(before, changed).ok, false);
  assert.deepEqual(reconcileStudentDataSnapshots(before, changed).differences, [{
    domain: "studentGrades",
    beforeCount: 1,
    afterCount: 1,
    changed: true,
  }]);
  assert.equal(reconcileStudentDataSnapshots(before, extra).ok, false);
  assert.throws(
    () => reconcileStudentDataSnapshots(before, createStudentDataSnapshot({
      ...fixtureBundle(),
      studentId: "student-b",
    })),
    /different students/u,
  );
  assert.throws(
    () => reconcileStudentDataSnapshots(before, { ...before, version: "999.0" }),
    /versions do not match/u,
  );
});

test("restore snapshots fail closed when any inventory query is omitted or failed", () => {
  const complete = fixtureBundle();
  const omitted = { ...complete.domains };
  delete omitted.ltiGradeSyncEvents;

  assert.throws(
    () => createStudentDataSnapshot({ studentId: STUDENT_ID, domains: omitted }),
    /ltiGradeSyncEvents must have an explicit succeeded capture result/u,
  );
  assert.throws(
    () => createStudentDataSnapshot({
      studentId: STUDENT_ID,
      domains: {
        ...complete.domains,
        billingSubscriptions: { status: "failed", rows: [] },
      },
    }),
    /billingSubscriptions must have an explicit succeeded capture result/u,
  );
  assert.throws(
    () => createStudentDataSnapshot({
      studentId: STUDENT_ID,
      domains: {
        ...complete.domains,
        auditEvents: { status: "succeeded" },
      },
    }),
    /auditEvents\.rows must be an array/u,
  );
});

test("restore reconciliation rejects a tampered or incomplete snapshot envelope", () => {
  const snapshot = createStudentDataSnapshot(fixtureBundle());
  assert.throws(
    () => reconcileStudentDataSnapshots(snapshot, { ...snapshot, fingerprint: "fnv1a32:00000000" }),
    /fingerprint is invalid/u,
  );
  const incompleteDomains = { ...snapshot.domains };
  delete incompleteDomains.learningMessages;
  assert.throws(
    () => reconcileStudentDataSnapshots(snapshot, { ...snapshot, domains: incompleteDomains }),
    /missing learningMessages/u,
  );
});

test("institution matching never grants student-record access by itself", () => {
  assert.deepEqual(evaluateStudentDataAccess({ actorId: STUDENT_ID, studentId: STUDENT_ID }), { allowed: true, reason: "self" });

  assert.deepEqual(evaluateStudentDataAccess({
    actorId: "professor-b",
    studentId: STUDENT_ID,
    actorInstitutionIds: [INSTITUTION_B],
    recordInstitutionId: INSTITUTION_A,
    recordKind: "grade",
    capabilities: ["view_records"],
    managesCourse: true,
  }), { allowed: false, reason: "institution_mismatch" });

  assert.deepEqual(evaluateStudentDataAccess({
    actorId: "student-b",
    studentId: STUDENT_ID,
    actorInstitutionIds: [INSTITUTION_A],
    recordInstitutionId: INSTITUTION_A,
    recordKind: "profile",
  }), { allowed: false, reason: "insufficient_capability" });

  assert.deepEqual(evaluateStudentDataAccess({
    actorId: "professor-a",
    studentId: STUDENT_ID,
    actorInstitutionIds: [INSTITUTION_A],
    recordInstitutionId: INSTITUTION_A,
    recordKind: "grade",
    managesCourse: true,
  }), { allowed: true, reason: "course_manager" });
});

test("student-record capabilities remain tenant-bound and resource-specific", () => {
  assert.deepEqual(evaluateStudentDataAccess({
    actorId: "institution-admin-a",
    studentId: STUDENT_ID,
    actorInstitutionIds: [INSTITUTION_A],
    recordInstitutionId: INSTITUTION_A,
    recordKind: "profile",
    capabilities: ["view_accounts"],
  }), { allowed: true, reason: "view_accounts" });

  assert.deepEqual(evaluateStudentDataAccess({
    actorId: "institution-admin-a",
    studentId: STUDENT_ID,
    actorInstitutionIds: [INSTITUTION_A],
    recordInstitutionId: INSTITUTION_A,
    recordKind: "grade",
    capabilities: ["view_accounts"],
  }), { allowed: false, reason: "insufficient_capability" });

  assert.deepEqual(evaluateStudentDataAccess({
    actorId: "institution-admin-b",
    studentId: STUDENT_ID,
    actorInstitutionIds: [INSTITUTION_B],
    recordInstitutionId: INSTITUTION_A,
    recordKind: "grade",
    capabilities: ["view_records"],
  }), { allowed: false, reason: "institution_mismatch" });

  assert.deepEqual(evaluateStudentDataAccess({
    actorId: "platform-owner",
    studentId: STUDENT_ID,
    platformOwner: true,
    recordInstitutionId: INSTITUTION_A,
    recordKind: "grade",
  }), { allowed: true, reason: "platform_owner" });
});

test("Blackboard export reconciles tenant, student, line item, score, and status", () => {
  const input = {
    identity: {
      institutionId: INSTITUTION_A,
      courseId: "course-a",
      ednotebookUserId: STUDENT_ID,
      blackboardUsername: "student.a",
      blackboardStudentId: "ASU-1001",
      blackboardSisUserId: "SIS-1001",
    },
    column: {
      institutionId: INSTITUTION_A,
      courseId: "course-a",
      ednotebookGradeItemId: "item-a",
      blackboardColumnKey: "column-a",
      externalLineItemId: "line-item-a",
      blackboardPointsPossible: 100,
      scalingMode: "raw",
    },
    grade: {
      institutionId: INSTITUTION_A,
      courseId: "course-a",
      gradeItemId: "item-a",
      studentId: STUDENT_ID,
      score: 88.5,
      status: "finalized",
    },
    gradeItem: { id: "item-a", maxPoints: 100 },
  };

  const reconciled = reconcileBlackboardGradeRecord(input);
  assert.equal(reconciled.ok, true);
  assert.deepEqual(reconciled.record, {
    blackboardUsername: "student.a",
    blackboardStudentId: "ASU-1001",
    blackboardSisUserId: "SIS-1001",
    blackboardColumnKey: "column-a",
    externalLineItemId: "line-item-a",
    score: 88.5,
    maximumPoints: 100,
    status: "finalized",
  });

  const wrongTenant = reconcileBlackboardGradeRecord({
    ...input,
    identity: { ...input.identity, institutionId: INSTITUTION_B },
  });
  assert.equal(wrongTenant.ok, false);
  assert.ok(wrongTenant.issues.includes("institution_mismatch"));
  assert.equal(wrongTenant.record, null);
});

test("Blackboard reconciliation fails closed for every required relationship", () => {
  const input = {
    identity: {
      institutionId: INSTITUTION_A,
      courseId: "course-a",
      ednotebookUserId: STUDENT_ID,
      blackboardUsername: "student.a",
      blackboardStudentId: "ASU-1001",
      blackboardSisUserId: "SIS-1001",
    },
    column: {
      institutionId: INSTITUTION_A,
      courseId: "course-a",
      ednotebookGradeItemId: "item-a",
      blackboardColumnKey: "column-a",
      externalLineItemId: "line-item-a",
      blackboardPointsPossible: 100,
      scalingMode: "raw",
    },
    grade: {
      institutionId: INSTITUTION_A,
      courseId: "course-a",
      gradeItemId: "item-a",
      studentId: STUDENT_ID,
      score: 88.5,
      status: "finalized",
    },
    gradeItem: { id: "item-a", maxPoints: 100 },
  };

  const cases = [
    ["course_mismatch", { grade: { ...input.grade, courseId: "course-b" } }],
    ["student_mismatch", { grade: { ...input.grade, studentId: "student-b" } }],
    ["grade_item_mismatch", { column: { ...input.column, ednotebookGradeItemId: "item-b" } }],
    ["maximum_points_mismatch", { column: { ...input.column, blackboardPointsPossible: 50 } }],
    ["score_out_of_range", { grade: { ...input.grade, score: 101 } }],
    ["invalid_score", { grade: { ...input.grade, score: null } }],
    ["invalid_score", { grade: { ...input.grade, score: "" } }],
    ["invalid_score", { grade: { ...input.grade, score: false } }],
    ["invalid_score", { grade: { ...input.grade, score: "not-a-number" } }],
    ["invalid_maximum_points", { gradeItem: { ...input.gradeItem, maxPoints: null } }],
    ["invalid_maximum_points", { gradeItem: { ...input.gradeItem, maxPoints: 0 } }],
    ["grade_not_finalized", { grade: { ...input.grade, status: "draft" } }],
    ["missing_institution", { grade: { ...input.grade, institutionId: null } }],
    ["missing_blackboard_identifier", {
      identity: {
        ...input.identity,
        blackboardUsername: "",
        blackboardStudentId: "",
        blackboardSisUserId: "",
      },
    }],
    ["missing_blackboard_grade_target", {
      column: {
        ...input.column,
        blackboardColumnKey: "",
        externalLineItemId: "",
      },
    }],
  ];

  for (const [issue, change] of cases) {
    const result = reconcileBlackboardGradeRecord({ ...input, ...change });
    assert.equal(result.ok, false, `${issue} must block export`);
    assert.ok(result.issues.includes(issue), `${issue} must be reported`);
    assert.equal(result.record, null, `${issue} must not produce an export record`);
  }
});

test("deletion honors legal hold first, then retention, then eligibility", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");
  assert.deepEqual(evaluateDeletionRequest({ now, retentionUntil: "2026-07-20T12:00:00.000Z" }), {
    status: "eligible",
    eligibleAt: "2026-07-21T12:00:00.000Z",
    nextAvailabilityStatus: "pending_delete",
  });
  assert.deepEqual(evaluateDeletionRequest({ now, retentionUntil: "2026-08-20T12:00:00.000Z" }), {
    status: "deferred_retention",
    eligibleAt: "2026-08-20T12:00:00.000Z",
    nextAvailabilityStatus: "released",
  });
  assert.deepEqual(evaluateDeletionRequest({
    now,
    retentionUntil: "2026-07-20T12:00:00.000Z",
    legalHoldActive: true,
  }), {
    status: "blocked_legal_hold",
    eligibleAt: null,
    nextAvailabilityStatus: "released",
  });
});

test("deletion evaluation is deterministic for completed files and invalid dates", () => {
  assert.deepEqual(evaluateDeletionRequest({
    now: "2026-07-21T12:00:00.000Z",
    availabilityStatus: "deleted",
    legalHoldActive: true,
    retentionUntil: "2027-07-21T12:00:00.000Z",
  }), {
    status: "completed",
    eligibleAt: null,
    nextAvailabilityStatus: "deleted",
  });
  assert.throws(
    () => evaluateDeletionRequest({ now: "not-a-date" }),
    /time is invalid/u,
  );
  assert.throws(
    () => evaluateDeletionRequest({ retentionUntil: "not-a-date" }),
    /retention date is invalid/iu,
  );
});

test("intake readiness requires every linked and external lifecycle decision plus every evidence gate", () => {
  const now = new Date("2026-08-02T03:00:00.000Z");
  const policies = STUDENT_DATA_LIFECYCLE_DOMAINS.map((domainKey) => ({
    domainKey,
    version: 1,
    disposition: "delete",
    retentionDays: 30,
    purpose: "Institution-approved synthetic lifecycle readiness test.",
    evidenceReference: `policy:${domainKey}`,
    status: "approved",
    reviewerType: "human",
    approvedAt: "2026-08-01T03:00:00.000Z",
    reviewDueAt: "2027-08-01T03:00:00.000Z",
  }));
  const evidence = STUDENT_DATA_INTAKE_GATES.map((gateKey) => ({
    gateKey,
    version: 1,
    status: "passed",
    evidenceReference: `evidence:${gateKey}`,
    reviewerType: "human",
    reviewedAt: "2026-08-01T03:00:00.000Z",
    expiresAt: "2027-08-01T03:00:00.000Z",
  }));

  const result = evaluateStudentDataIntakeReadiness({ policies, evidence, now });
  assert.equal(STUDENT_DATA_DOMAINS.length, 50);
  assert.equal(EXTERNAL_STUDENT_DATA_LIFECYCLE_DOMAINS.length, 11);
  assert.equal(result.lifecycleDomainCount, 61);
  assert.equal(result.requiredEvidenceGateCount, 13);
  assert.equal(result.readyForPromotionReview, true);
  assert.equal(result.decision, "ready_for_human_promotion_review");
  assert.equal(result.productionStudentIntakeEnabled, false);
  assert.deepEqual(result.missingLifecycleDomains, []);
  assert.deepEqual(result.missingEvidenceGates, []);
});

test("intake readiness fails closed for missing, expired, non-human, or malformed governance evidence", () => {
  const result = evaluateStudentDataIntakeReadiness({
    now: "2026-08-02T03:00:00.000Z",
    policies: [{
      domain_key: "profile",
      version: 1,
      disposition: "retain",
      retention_days: 0,
      purpose: "Too short",
      evidence_reference: "short",
      status: "approved",
      reviewer_type: "agent",
      approved_at: "2026-08-01T03:00:00.000Z",
      review_due_at: "2026-08-01T04:00:00.000Z",
    }],
    evidence: [{
      gate_key: "repositoryValidation",
      version: 1,
      status: "passed",
      evidence_reference: "evidence:repository",
      reviewer_type: "agent",
      reviewed_at: "2026-08-01T03:00:00.000Z",
    }],
  });

  assert.equal(result.decision, "hold");
  assert.equal(result.readyForPromotionReview, false);
  assert.equal(result.productionStudentIntakeEnabled, false);
  assert.ok(result.missingLifecycleDomains.includes("profile"));
  assert.ok(result.missingEvidenceGates.includes("repositoryValidation"));
  assert.throws(
    () => evaluateStudentDataIntakeReadiness({ policies: {}, evidence: [] }),
    /must be arrays/u,
  );

  const futureDated = evaluateStudentDataIntakeReadiness({
    now: "2026-08-02T03:00:00.000Z",
    policies: [{
      domainKey: "profile",
      version: 2,
      disposition: "delete",
      retentionDays: 30,
      purpose: "Institution-approved synthetic lifecycle readiness test.",
      evidenceReference: "policy:profile:future",
      status: "approved",
      reviewerType: "human",
      approvedAt: "2026-08-03T03:00:00.000Z",
      reviewDueAt: "2027-08-03T03:00:00.000Z",
    }],
    evidence: [{
      gateKey: "repositoryValidation",
      version: 2,
      status: "passed",
      evidenceReference: "evidence:repository:future",
      reviewerType: "human",
      reviewedAt: "2026-08-03T03:00:00.000Z",
      expiresAt: "2027-08-03T03:00:00.000Z",
    }],
  });
  assert.ok(futureDated.missingLifecycleDomains.includes("profile"));
  assert.ok(futureDated.missingEvidenceGates.includes("repositoryValidation"));
});

test("the disposable SQL harness contains all four rollback-safe database gates", async () => {
  const sql = await readFile(new URL("../../supabase/tests/institution_student_data_safety.sql", import.meta.url), "utf8");
  assert.equal(STUDENT_DATA_DOMAINS.length, 50);
  const captureBody = sql.match(/as \$capture\$([\s\S]*?)\$capture\$;/u)?.[1];
  assert.ok(captureBody, "SQL restore capture function is missing");
  const capturedDomains = [...captureBody.matchAll(/select '([^']+)'/gu)].map((match) => match[1]);
  assert.deepEqual(capturedDomains, [...STUDENT_DATA_DOMAINS]);
  assert.match(sql, /^begin;/mu);
  assert.match(sql, /rollback;\s*$/mu);
  assert.match(sql, /PASS representative logical restore reconciles/u);
  assert.doesNotMatch(sql, /PASS all student-data safety gates/u);
  assert.match(sql, /PASS [^\n']*student cross-institution access-control test/u);
  assert.match(sql, /PASS anonymous privileged-RPC revocation and public-catalog exception ACL test/u);
  assert.match(sql, /PASS anonymous catalog excludes review-stage content/u);
  assert.match(sql, /PASS signed-in course owner retains review-stage catalog access/u);
  assert.match(sql, /PASS professor\/admin [^\n']*cross-tenant invariant tests/u);
  assert.match(sql, /PASS legacy profile admin denial and institution-team anti-escalation tests/u);
  assert.match(sql, /PASS delegated operator capability and connection-scope tests/u);
  assert.match(sql, /PASS delegated auditor capability test/u);
  assert.match(sql, /PASS delegated support data-minimization test/u);
  assert.match(sql, /PASS platform-owner authorization inventory test/u);
  assert.match(sql, /PASS Blackboard export and reconciliation test/u);
  assert.match(sql, /PASS deletion, retention, and legal-hold test/u);
  assert.match(sql, /set local role authenticated/u);
  assert.match(sql, /reset role;\s*reset request\.jwt\.claim\.sub;\s*reset request\.jwt\.claim\.role;/u);
  assert.match(sql, /set_config\('request\.jwt\.claim\.sub','10000000-0000-4000-8000-000000000011',true\);\s*select set_config\('request\.jwt\.claim\.role','authenticated',true\);\s*insert into public\.learning_messages select \* from safety_backup_messages;\s*reset request\.jwt\.claim\.sub;\s*reset request\.jwt\.claim\.role;/u);
  assert.match(sql, /request_secure_file_deletion/u);
  assert.match(sql, /PASS governed account and data-subject request remains fail closed/u);
});

test("the intake-readiness migration is append-only, tenant-bound, explicit-grant, and cannot activate production", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260802023831_govern_student_data_intake_readiness.sql", import.meta.url), "utf8");

  for (const table of [
    "student_data_lifecycle_domains",
    "student_data_intake_gate_definitions",
    "student_data_lifecycle_policy_versions",
    "student_data_intake_evidence_versions",
    "student_data_subject_requests",
    "student_data_subject_request_items",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`, "u"));
  }
  assert.match(sql, /student_data_lifecycle_policy_versions_append_only/u);
  assert.match(sql, /student_data_intake_evidence_versions_append_only/u);
  assert.match(sql, /production_student_intake_enabled',false/u);
  assert.match(sql, /intake_decision text not null default 'hold' check \(intake_decision='hold'\)/u);
  assert.match(sql, /production_action_executed',false/u);
  assert.match(sql, /alter default privileges for role postgres in schema public[\s\S]*?revoke select,insert,update,delete on tables from anon,authenticated/u);
  assert.doesNotMatch(sql, /revoke select,insert,update,delete on tables from[^;]*service_role/u);
  assert.match(sql, /revoke all on function public\.get_student_data_intake_readiness\(uuid\) from public,anon/u);
  assert.match(sql, /revoke all on function public\.activate_tested_lti_deployment\(uuid\) from public,anon/u);
  assert.match(sql, /revoke all on function public\.issue_social_learning_reward\(uuid,uuid,text,text,text,text,integer,text,uuid\) from public,anon/u);
  assert.match(sql, /directory\.library_listing_status='published'/u);
  assert.match(sql, /directory\.library_listing_status='review'\s+and \(select auth\.uid\(\)\) is not null/u);
  assert.match(sql, /publication\.status='review'\s+and \(select auth\.uid\(\)\) is not null/u);
  assert.match(sql, /review rows require a signed-in account/u);
  assert.doesNotMatch(sql, /create or replace function public\.(?:enable|activate|promote)_student_data_intake/iu);
  assert.doesNotMatch(sql, /update auth\.users|delete from auth\.users/iu);
});

test("the staging-acceptance follow-up covers student-data governance foreign keys", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260802033711_index_student_data_governance_foreign_keys.sql", import.meta.url), "utf8");

  for (const [indexName, tableName, columnName] of [
    ["student_data_intake_evidence_versions_gate_key_idx", "student_data_intake_evidence_versions", "gate_key"],
    ["student_data_lifecycle_policy_versions_domain_key_idx", "student_data_lifecycle_policy_versions", "domain_key"],
    ["student_data_subject_request_items_domain_key_idx", "student_data_subject_request_items", "domain_key"],
  ]) {
    assert.match(
      sql,
      new RegExp(`create index if not exists ${indexName}\\s+on public\\.${tableName}\\(${columnName}\\);`, "u"),
    );
  }
});

test("the performance-advisor follow-up preserves RLS semantics and initializes auth once", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260802070000_optimize_advisor_rls_policies.sql", import.meta.url), "utf8");
  const policies = [
    ["digital_literacy_profiles_owner_all", "digital_literacy_profiles"],
    ["digital_literacy_progress_owner_all", "digital_literacy_progress"],
    ["digital_literacy_story_choices_owner_all", "digital_literacy_story_choices"],
    ["digital_literacy_achievements_owner_all", "digital_literacy_achievements"],
    ["digital_literacy_completion_records_owner_all", "digital_literacy_completion_records"],
    ["course_publications_insert", "course_publications"],
    ["course_publication_versions_insert", "course_publication_versions"],
    ["course_lesson_progress_select", "course_lesson_progress"],
    ["course_lesson_progress_insert", "course_lesson_progress"],
    ["course_lesson_progress_update", "course_lesson_progress"],
    ["course_progress_select", "course_progress"],
    ["course_progress_insert", "course_progress"],
    ["course_progress_update", "course_progress"],
  ];

  assert.equal([...sql.matchAll(/alter policy /gu)].length, policies.length);
  for (const [policyName, tableName] of policies) {
    assert.match(
      sql,
      new RegExp(`alter policy ${policyName}\\s+on public\\.${tableName}\\s+to authenticated`, "u"),
    );
  }
  assert.match(sql, /private\.can_manage_course\(course_id\)/u);
  assert.match(sql, /private\.can_access_course\(course_id\)/u);
  const executableSql = sql.replaceAll(/^--.*$/gmu, "");
  assert.doesNotMatch(executableSql.replaceAll("(select auth.uid())", ""), /auth\.uid\(\)/u);
});

test("the security-advisor follow-up makes deny-only surfaces and RPC assumptions executable", async () => {
  const [migration, gate, workflow] = await Promise.all([
    readFile(new URL("../../supabase/migrations/20260802073000_make_rls_deny_surfaces_explicit.sql", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/tests/security_advisor_contract.sql", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8"),
  ]);

  for (const tableName of [
    "digital_literacy_standard_enrollments",
    "digital_literacy_standard_progress",
    "research_export_secrets",
    "lti_launch_sessions",
    "lti_launch_states",
    "lti_service_endpoints",
    "marketplace_commerce_launch",
    "marketplace_launch_controls",
    "student_data_intake_evidence_versions",
    "student_data_intake_gate_definitions",
    "student_data_lifecycle_domains",
    "student_data_lifecycle_policy_versions",
    "student_data_subject_request_items",
    "student_data_subject_requests",
  ]) {
    assert.match(migration, new RegExp(`${tableName}_api_deny_all`, "u"));
  }

  assert.equal([...migration.matchAll(/as restrictive for all to anon, authenticated/gu)].length, 14);
  assert.match(migration, /revoke all on function public\.save_course_syllabus_draft\(uuid,jsonb,text,text,text,text\)\s+from anon;/u);
  assert.match(migration, /revoke all on function public\.set_course_syllabus_state\(uuid,text\)\s+from anon;/u);
  assert.match(gate, /privilege\.grantee=0/u);
  assert.match(gate, /An application table does not have RLS enabled/u);
  assert.match(gate, /private\.publication_learning_author_versions/u);
  assert.equal([...gate.matchAll(/dependency\.refclassid='pg_extension'::regclass/gu)].length, 5);
  assert.match(gate, /public\.list_alex_morrison_catalog\(text\)/u);
  assert.match(gate, /does not bind to request identity/u);
  assert.match(gate, /uses dynamic SQL and requires a dedicated review/u);
  assert.match(workflow, /--file=supabase\/tests\/security_advisor_contract\.sql/u);
});

test("the public Library catalog limits review-stage metadata to its owner and platform review", async () => {
  const [migration, hostedGate] = await Promise.all([
    readFile(new URL("../../supabase/migrations/20260802190000_scope_catalog_review_previews.sql", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/tests/institution_student_data_safety.sql", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /security definer\s+set search_path=''/u);
  assert.match(migration, /alter table private\.publication_learning_author_versions enable row level security/u);
  assert.match(migration, /publication_learning_author_versions_api_deny_all/u);
  assert.match(migration, /as restrictive\s+for all\s+to anon,authenticated\s+using \(false\)\s+with check \(false\)/u);
  assert.match(migration, /directory\.professor_id=\(select auth\.uid\(\)\)/u);
  assert.match(migration, /publication\.owner_id=\(select auth\.uid\(\)\)/u);
  assert.equal([...migration.matchAll(/private\.is_platform_owner\(\(select auth\.uid\(\)\)\)/gu)].length, 2);
  assert.match(migration, /revoke all on function public\.list_alex_morrison_catalog\(text\) from public,anon/u);
  assert.match(migration, /grant execute on function public\.list_alex_morrison_catalog\(text\) to anon,authenticated/u);
  assert.match(hostedGate, /another signed-in account could see a professor review-stage listing/u);
});

test("the existing Control Center exposes readiness as institution-scoped review only", async () => {
  const [component, service] = await Promise.all([
    readFile(new URL("./AdminControlCenter.jsx", import.meta.url), "utf8"),
    readFile(new URL("./adminControlService.js", import.meta.url), "utf8"),
  ]);

  assert.match(component, /\["student-data-readiness", "Student data readiness"\]/u);
  assert.match(component, /institutionId && \(access\.platform_owner \|\| access\.can_view_audit \|\| access\.can_manage_retention\)/u);
  assert.match(component, /This view cannot activate production intake or execute a data-subject request/u);
  assert.match(component, /Even complete evidence does not switch it on/u);
  assert.doesNotMatch(component, /recordStudentDataLifecyclePolicy|recordStudentDataIntakeEvidence/u);
  assert.match(service, /"get_student_data_intake_readiness"/u);
});

test("the institution migration enforces tenant-aware course and affiliation policies", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260721210000_institution_admin_control_center.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function private\.has_active_institution_affiliation/u);
  assert.match(sql, /create or replace function private\.can_join_course/u);
  assert.match(sql, /create policy institution_affiliations_select/u);
  assert.match(sql, /private\.has_institution_capability\(institution_id, 'view_accounts'/u);
  assert.match(sql, /create policy course_memberships_insert/u);
  assert.match(sql, /private\.can_join_course/u);
});

test("database migrations contain no captured tool-output truncation markers", async () => {
  const migrationDirectory = new URL("../../supabase/migrations/", import.meta.url);
  const migrationFiles = (await readdir(migrationDirectory)).filter((fileName) => fileName.endsWith(".sql"));

  for (const fileName of migrationFiles) {
    const sql = await readFile(new URL(fileName, migrationDirectory), "utf8");
    assert.doesNotMatch(sql, /\b(?:\d+\s+)?tokens?\s+truncated\b/iu, `${fileName} contains captured tool output`);
  }
});

test("student-data hardening defines publication-backed learning resources before using them", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260721220000_student_data_safety_hardening.sql", import.meta.url), "utf8");
  const relationshipPosition = sql.indexOf("add column if not exists publication_id uuid");
  const firstReferencePosition = sql.indexOf("create or replace function private.can_access_publication");
  const scopeGuard = sql.match(/create or replace function private\.enforce_learning_resource_scope\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/u)?.[1];

  assert.ok(relationshipPosition >= 0, "learning_resources.publication_id relationship is missing");
  assert.ok(firstReferencePosition >= 0 && relationshipPosition < firstReferencePosition, "publication relationship must exist before access functions and preflight checks");
  assert.match(sql, /create index if not exists learning_resources_publication_idx\s+on public\.learning_resources\(publication_id\)/u);
  assert.match(sql, /create policy learning_resources_insert[\s\S]*?publication_id is null or private\.can_access_publication\(publication_id,\(select auth\.uid\(\)\)\)/u);
  assert.match(sql, /create policy learning_resources_update[\s\S]*?publication_id is null or private\.can_access_publication\(publication_id,\(select auth\.uid\(\)\)\)/u);
  assert.ok(scopeGuard, "learning-resource scope guard is missing");
  assert.match(scopeGuard, /tg_op='INSERT'/u);
  assert.match(scopeGuard, /not private\.can_access_publication\(new\.publication_id,\(select auth\.uid\(\)\)\)/u);
});

test("deletion routines qualify columns that share public return-field names", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260721220000_student_data_safety_hardening.sql", import.meta.url), "utf8");

  assert.match(sql, /insert into public\.file_deletion_requests as fdr[\s\S]*?on conflict \(secure_file_id\) where fdr\.status in/u);
  assert.match(sql, /select fdr\.\* into v_request from public\.file_deletion_requests as fdr[\s\S]*?and fdr\.status in/u);
  assert.match(sql, /create or replace function public\.renew_file_deletion_claim[\s\S]*?fdr\.claim_token=p_claim_token[\s\S]*?update public\.file_deletion_requests as fdr[\s\S]*?fdr\.claim_token=p_claim_token/u);
});

test("every new administration table uses RLS and browser writes stay behind RPCs", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/20260721210000_institution_admin_control_center.sql", import.meta.url), "utf8");
  const tables = [
    "institution_directory_entries",
    "institution_directory_aliases",
    "institution_access_applications",
    "institution_affiliations",
    "institution_transfer_requests",
    "institution_team_invitations",
    "platform_admin_authorizations",
    "feature_definitions",
    "feature_dependencies",
    "feature_policy_templates",
    "feature_policy_template_items",
    "feature_policies",
    "feature_change_sets",
    "feature_change_items",
    "integration_connections",
    "integration_connection_capabilities",
    "integration_test_runs",
    "integration_sync_runs",
    "admin_report_exports",
  ];

  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`, "u"), `${table} must use RLS`);
  }
  assert.match(sql, /revoke all on\s+public\.institution_directory_entries,[\s\S]+?public\.admin_report_exports\s+from anon, authenticated;/u);
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)[^;]+public\.(?:feature_policies|institution_affiliations|integration_connections|admin_report_exports)[^;]+to authenticated/iu);
  assert.match(sql, /revoke all on function public\.apply_feature_control_change\(jsonb,text\) from public, anon;/u);
  assert.match(sql, /revoke all on function public\.admin_search_accounts_courses\(text,uuid,text\) from public, anon;/u);
});
