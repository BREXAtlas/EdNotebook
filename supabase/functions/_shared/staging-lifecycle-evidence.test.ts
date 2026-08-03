import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import {
  assertStagingEvidenceRequest,
  evaluateStagingLifecycleEvidence,
  PRODUCTION_PROJECT_REF,
  STAGING_EVIDENCE_CONFIRMATION,
  STAGING_PROJECT_REF,
} from "./staging-lifecycle-evidence.ts";

const completeChecks = {
  uploadChecksumsMatch: true,
  anonymousReadsDenied: true,
  eligibleDeletionCompleted: true,
  eligibleObjectAbsent: true,
  retainedRequestDeferred: true,
  retainedObjectPresent: true,
  heldRequestBlocked: true,
  heldObjectPresent: true,
  requiredAuditsPresent: true,
  fixtureCleanupCompleted: true,
};

Deno.test("staging evidence rejects production and every unapproved project", () => {
  assertThrows(
    () =>
      assertStagingEvidenceRequest(
        `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
        STAGING_EVIDENCE_CONFIRMATION,
      ),
    RangeError,
    "Production is forbidden",
  );
  assertThrows(
    () =>
      assertStagingEvidenceRequest(
        "https://another-project.supabase.co",
        STAGING_EVIDENCE_CONFIRMATION,
      ),
    RangeError,
    "approved staging project",
  );
  assertThrows(
    () =>
      assertStagingEvidenceRequest(
        `http://${STAGING_PROJECT_REF}.supabase.co`,
        STAGING_EVIDENCE_CONFIRMATION,
      ),
    RangeError,
    "approved staging project",
  );
});

Deno.test("staging evidence requires the exact destructive-operation confirmation", () => {
  assertThrows(
    () =>
      assertStagingEvidenceRequest(
        `https://${STAGING_PROJECT_REF}.supabase.co`,
        "run it",
      ),
    RangeError,
    "exact staging evidence confirmation",
  );
  assertStagingEvidenceRequest(
    `https://${STAGING_PROJECT_REF}.supabase.co`,
    STAGING_EVIDENCE_CONFIRMATION,
  );
});

Deno.test("technical success remains human-reviewed and cannot enable production", () => {
  const result = evaluateStagingLifecycleEvidence(completeChecks);
  assertEquals(result.technicallyReconciled, true);
  assertEquals(result.decision, "eligible_for_human_review");
  assertEquals(result.gatePassed, false);
  assertEquals(result.reviewerTypeRequired, "human");
  assertEquals(result.productionStudentIntakeEnabled, false);
  assertEquals(result.productionActionExecuted, false);
  assertEquals(result.missingChecks, []);
});

Deno.test("any missing operational proof produces a hold", () => {
  const result = evaluateStagingLifecycleEvidence({
    ...completeChecks,
    heldObjectPresent: false,
    requiredAuditsPresent: false,
  });
  assertEquals(result.technicallyReconciled, false);
  assertEquals(result.decision, "hold");
  assertEquals(result.gatePassed, false);
  assertEquals(result.missingChecks, [
    "heldObjectPresent",
    "requiredAuditsPresent",
  ]);
});
