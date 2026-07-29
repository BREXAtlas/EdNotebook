export const RESEARCH_PURPOSE = "research";
export const UNGATED_FEEDBACK_PURPOSES = Object.freeze([
  "product_feedback",
  "course_feedback",
]);

export const RESEARCH_ACTIVITY_LABELS = Object.freeze({
  pre_post_assessment: "Pre/post assessment",
  qualitative_interview: "Qualitative interview",
  open_ended_survey: "Open-ended survey",
  learning_effectiveness_analysis: "Learning-effectiveness analysis",
});

export const DIGITAL_LITERACY_RESEARCH_FIXTURE = Object.freeze({
  fixture: true,
  project_key: "digital-literacy-asu-pilot",
  title: "Digital Literacy course pilot",
  institution: "Angelo State University planning fixture",
  course: "Digital Literacy",
  purpose: RESEARCH_PURPOSE,
  purpose_statement: "Evaluate whether the Digital Literacy course improves information-literacy learning outcomes and understand the learner experience.",
  research_activities: Object.freeze([
    "pre_post_assessment",
    "qualitative_interview",
    "open_ended_survey",
    "learning_effectiveness_analysis",
  ]),
  data_owner: null,
  effective_at: null,
  expires_at: null,
  notice_config: Object.freeze({ version: null, participant_notice: null }),
  consent_config: Object.freeze({ mode: null }),
  minimization_rules: Object.freeze({ collection_limit: null }),
  retention_days: null,
  export_rules: Object.freeze({ mode: "disabled" }),
  deletion_rules: Object.freeze({ request_process: null }),
  instruments: Object.freeze([]),
  latest_determination: null,
  status: "not_activated",
  activated_at: null,
});

function present(value) {
  return typeof value === "string" ? Boolean(value.trim()) : value !== null && value !== undefined;
}

function parseTime(value) {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function purposeRequiresResearchGate(purpose) {
  return purpose === RESEARCH_PURPOSE;
}

export function purposeUsesOrdinaryFeedbackMode(purpose) {
  return UNGATED_FEEDBACK_PURPOSES.includes(purpose);
}

export function researchContractChangeRequiresNewVersion({
  currentPurpose,
  nextPurpose,
  currentInstrumentVersion,
  nextInstrumentVersion,
} = {}) {
  return currentPurpose !== nextPurpose || currentInstrumentVersion !== nextInstrumentVersion;
}

export function evaluateResearchGate(contract, { now = new Date() } = {}) {
  if (!contract || contract.purpose !== RESEARCH_PURPOSE) {
    return Object.freeze({
      status: "ordinary_feedback",
      activated: false,
      collectionAllowed: false,
      blockers: Object.freeze([]),
    });
  }

  const blockers = [];
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const effectiveTime = parseTime(contract.effective_at);
  const expiryTime = parseTime(contract.expires_at);
  const determination = contract.latest_determination;
  const instruments = Array.isArray(contract.instruments) ? contract.instruments : [];
  const activities = Array.isArray(contract.research_activities) ? contract.research_activities : [];

  if (!present(contract.institution_id) || !present(contract.course_id)) blockers.push("approved_scope_missing");
  if (!contract.data_owner || !present(contract.data_owner.name) || !present(contract.data_owner.contact)) blockers.push("named_data_owner_missing");
  if (!present(contract.purpose_statement)) blockers.push("purpose_missing");
  if (!Number.isFinite(effectiveTime) || !Number.isFinite(expiryTime) || effectiveTime >= expiryTime) blockers.push("project_dates_missing");
  else {
    if (nowTime < effectiveTime) blockers.push("project_not_yet_effective");
    if (nowTime >= expiryTime) blockers.push("project_expired");
  }
  if (!determination || determination.decision !== "approved") blockers.push("written_determination_missing_or_revoked");
  else {
    const approvalEffective = parseTime(determination.effective_at);
    const approvalExpiry = parseTime(determination.expires_at);
    if (!present(determination.protocol_reference) || !present(determination.documentation_reference)) blockers.push("determination_details_incomplete");
    if (!Number.isFinite(approvalEffective) || !Number.isFinite(approvalExpiry) || nowTime < approvalEffective || nowTime >= approvalExpiry) blockers.push("determination_not_current");
  }
  if (!present(contract.notice_config?.version) || !present(contract.notice_config?.participant_notice)) blockers.push("participant_notice_incomplete");
  if (!["required", "waived_by_written_determination"].includes(contract.consent_config?.mode)) blockers.push("consent_configuration_incomplete");
  if (!present(contract.minimization_rules?.collection_limit)) blockers.push("minimization_rules_incomplete");
  if (!Number.isInteger(contract.retention_days) || contract.retention_days < 1) blockers.push("retention_rule_incomplete");
  if (!present(contract.export_rules?.mode)) blockers.push("export_rule_incomplete");
  if (!present(contract.deletion_rules?.request_process)) blockers.push("deletion_rule_incomplete");
  if (!instruments.length) blockers.push("instrument_version_missing");

  const kinds = new Set(instruments.map((instrument) => instrument.instrument_kind));
  if (activities.includes("pre_post_assessment") && (!kinds.has("pre_assessment") || !kinds.has("post_assessment"))) {
    blockers.push("paired_pre_post_instruments_required");
  }
  if (activities.includes("qualitative_interview") && !kinds.has("qualitative_interview")) blockers.push("qualitative_instrument_required");
  if (activities.includes("open_ended_survey") && !kinds.has("open_ended_survey")) blockers.push("open_ended_instrument_required");
  if (contract.feature_enabled !== true) blockers.push("course_research_feature_disabled");
  if (contract.status !== "active" || !present(contract.activated_at)) blockers.push("explicit_activation_missing");

  return Object.freeze({
    status: blockers.length ? "not_activated" : "active",
    activated: blockers.length === 0,
    collectionAllowed: blockers.length === 0,
    blockers: Object.freeze([...new Set(blockers)]),
  });
}

export function describeResearchBlocker(blocker) {
  const descriptions = {
    approved_scope_missing: "Approved institution and course scope",
    named_data_owner_missing: "Named data owner and contact",
    purpose_missing: "Specific research purpose",
    project_dates_missing: "Effective and expiration dates",
    project_not_yet_effective: "Project effective date",
    project_expired: "A current project version",
    written_determination_missing_or_revoked: "Written ASU IRB/HRPP determination",
    determination_details_incomplete: "Protocol and determination documentation",
    determination_not_current: "Current determination dates",
    participant_notice_incomplete: "Versioned participant notice",
    consent_configuration_incomplete: "Consent or written waiver configuration",
    minimization_rules_incomplete: "Data-minimization rules",
    retention_rule_incomplete: "Bounded retention period",
    export_rule_incomplete: "Research export rule",
    deletion_rule_incomplete: "Withdrawal and deletion process",
    instrument_version_missing: "Versioned research instrument",
    paired_pre_post_instruments_required: "Paired pre- and post-assessments",
    qualitative_instrument_required: "Versioned qualitative instrument",
    open_ended_instrument_required: "Versioned open-ended survey",
    course_research_feature_disabled: "Course-scoped research feature approval",
    explicit_activation_missing: "Explicit institutional activation",
  };
  return descriptions[blocker] || blocker.replaceAll("_", " ");
}
