export const STAGING_PROJECT_REF = "gfalgonektwdylsxsgzc";
export const PRODUCTION_PROJECT_REF = "didwxihufueqbpfnfdmm";
export const STAGING_EVIDENCE_CONFIRMATION =
  "RUN SYNTHETIC STAGING LIFECYCLE EVIDENCE";

export interface StagingLifecycleChecks {
  uploadChecksumsMatch: boolean;
  anonymousReadsDenied: boolean;
  eligibleDeletionCompleted: boolean;
  eligibleObjectAbsent: boolean;
  retainedRequestDeferred: boolean;
  retainedObjectPresent: boolean;
  heldRequestBlocked: boolean;
  heldObjectPresent: boolean;
  requiredAuditsPresent: boolean;
  fixtureCleanupCompleted: boolean;
}

export function assertStagingEvidenceRequest(
  configuredProjectUrl: string,
  confirmation: string,
): void {
  if (confirmation !== STAGING_EVIDENCE_CONFIRMATION) {
    throw new RangeError(
      "The exact staging evidence confirmation is required.",
    );
  }
  let url: URL;
  try {
    url = new URL(configuredProjectUrl);
  } catch {
    throw new TypeError("The configured Supabase URL is invalid.");
  }
  const projectRef = url.hostname.split(".")[0];
  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new RangeError(
      "Production is forbidden for synthetic lifecycle evidence.",
    );
  }
  if (
    url.protocol !== "https:" ||
    projectRef !== STAGING_PROJECT_REF ||
    url.hostname !== `${STAGING_PROJECT_REF}.supabase.co`
  ) {
    throw new RangeError(
      "Synthetic lifecycle evidence is restricted to the approved staging project.",
    );
  }
}

export function evaluateStagingLifecycleEvidence(
  checks: StagingLifecycleChecks,
) {
  const missingChecks = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([key]) => key)
    .sort();
  const technicallyReconciled = missingChecks.length === 0;

  return Object.freeze({
    technicallyReconciled,
    decision: technicallyReconciled ? "eligible_for_human_review" : "hold",
    gateKey: "storageDeletionRetention",
    gatePassed: false,
    reviewerTypeRequired: "human",
    productionStudentIntakeEnabled: false,
    productionActionExecuted: false,
    missingChecks: Object.freeze(missingChecks),
  });
}
