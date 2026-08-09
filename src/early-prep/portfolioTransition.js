import { stablePreviewHash } from "../integrations/early-prep/earlyPrepLearningAdapters.js";

export const EDUCATION_PATH_TRANSITION_MANIFEST_VERSION = "EdNotebookEducationTransition/1.0";
export const EARLY_PREP_TRANSITION_PREVIEW_VERSION = "early-prep-transition-preview-v1";

const TRANSITION_ITEMS = [
  {
    id: "selected-writing-document",
    category: "writing_portfolio",
    label: "Selected writing portfolio document",
    description: "A student-created writing draft or final document chosen for continuity.",
    disposition: "student_selectable",
    approvalRequirement: "student_confirmation",
    sourceVersion: "EdNotebookStudentLearning/1.0",
  },
  {
    id: "selected-learning-note",
    category: "learning_note",
    label: "Selected learning note",
    description: "A private note the student explicitly chooses from the existing Learning Workspace.",
    disposition: "student_selectable",
    approvalRequirement: "student_confirmation",
    sourceVersion: "EdNotebookStudentLearning/1.0",
  },
  {
    id: "selected-source-library-entry",
    category: "source_library",
    label: "Selected source-library entry",
    description: "A citation or source note selected without copying school-only access rights.",
    disposition: "student_selectable",
    approvalRequirement: "student_confirmation",
    sourceVersion: "EdNotebookStudentLearning/1.0",
  },
  {
    id: "selected-student-file",
    category: "student_created_file",
    label: "Selected student-created file",
    description: "A student-owned file selected for review; school-owned and licensed files are excluded.",
    disposition: "review_required",
    approvalRequirement: "rights_and_institution_review",
    sourceVersion: "EdNotebookLearningPacket/1.0",
  },
  {
    id: "selected-project",
    category: "student_project",
    label: "Selected project or portfolio artifact",
    description: "A project the student chooses after checking privacy, ownership, and collaborator permissions.",
    disposition: "review_required",
    approvalRequirement: "rights_and_institution_review",
    sourceVersion: "early-prep-subject-workspace-v1",
  },
  {
    id: "digital-literacy-evidence",
    category: "course_completion_evidence",
    label: "Digital Literacy completion evidence",
    description: "Release-pinned completion evidence, not unit responses, grades, feedback, or research data.",
    disposition: "review_required",
    approvalRequirement: "institution_review",
    sourceVersion: "2026.08.01.1",
  },
  {
    id: "financial-literacy-evidence",
    category: "course_completion_evidence",
    label: "Financial Literacy completion evidence",
    description: "Release-pinned completion evidence, not private financial scenarios or account information.",
    disposition: "review_required",
    approvalRequirement: "institution_review",
    sourceVersion: "2026.08.08.1",
  },
  {
    id: "selected-learning-badge",
    category: "learning_badge",
    label: "Selected learning badge",
    description: "A versioned learning badge chosen for institutional verification.",
    disposition: "review_required",
    approvalRequirement: "institution_review",
    sourceVersion: "course-completion-badge-v1",
  },
  {
    id: "selected-preferences",
    category: "student_preferences",
    label: "Selected non-sensitive preferences",
    description: "Student-chosen display or learning preferences; school controls and safety settings remain behind.",
    disposition: "student_selectable",
    approvalRequirement: "student_confirmation",
    sourceVersion: "account-settings-v1",
  },
  {
    id: "official-high-school-grades",
    category: "official_school_record",
    label: "Official high-school grades and transcripts",
    description: "Remain in the governed school-record process and never move through this portfolio preview.",
    disposition: "archive_only",
    approvalRequirement: "separate_official_records_process",
  },
  {
    id: "disciplinary-and-safety-records",
    category: "protected_school_record",
    label: "Disciplinary, safeguarding, and safety records",
    description: "Remain protected and are not copied into the University student workspace.",
    disposition: "archive_only",
    approvalRequirement: "not_transferable_here",
  },
  {
    id: "private-school-communication",
    category: "private_school_communication",
    label: "Private school messages and teacher feedback",
    description: "Remain inside the original class and school context.",
    disposition: "archive_only",
    approvalRequirement: "not_transferable_here",
  },
  {
    id: "school-social-audience",
    category: "school_social_record",
    label: "School profile, posts, groups, and connections",
    description: "Early Prep and University social audiences never merge automatically.",
    disposition: "archive_only",
    approvalRequirement: "not_transferable_here",
  },
  {
    id: "district-and-research-records",
    category: "restricted_institution_record",
    label: "District identifiers, roster crosswalks, and research data",
    description: "Remain in their approved institutional or research boundary.",
    disposition: "archive_only",
    approvalRequirement: "not_transferable_here",
  },
];

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const EARLY_PREP_TRANSITION_ITEMS = deepFreeze(TRANSITION_ITEMS.map((item) => ({ ...item })));
const ITEMS_BY_ID = new Map(EARLY_PREP_TRANSITION_ITEMS.map((item) => [item.id, item]));

function requireTransitionRoute(sourceDivision, targetDivision) {
  if (sourceDivision !== "k12" || targetDivision !== "university") throw new Error("early_prep_to_university_route_required");
}

function summarizeItem(item) {
  return {
    id: item.id,
    category: item.category,
    label: item.label,
    disposition: item.disposition,
    approvalRequirement: item.approvalRequirement,
    sourceVersion: item.sourceVersion || null,
  };
}

export function previewEducationPathTransition({
  sourceDivision = "k12",
  targetDivision = "university",
  selectedItemIds = [],
} = {}) {
  requireTransitionRoute(sourceDivision, targetDivision);
  const selectedIds = [...new Set(selectedItemIds.map(String))];
  const unknownId = selectedIds.find((id) => !ITEMS_BY_ID.has(id));
  if (unknownId) throw new Error(`unknown_transition_item:${unknownId}`);
  const blockedId = selectedIds.find((id) => ITEMS_BY_ID.get(id).disposition === "archive_only");
  if (blockedId) throw new Error(`transition_item_not_transferable:${blockedId}`);
  const selected = selectedIds.map((id) => summarizeItem(ITEMS_BY_ID.get(id)));
  const available = EARLY_PREP_TRANSITION_ITEMS
    .filter((item) => item.disposition !== "archive_only" && !selectedIds.includes(item.id))
    .map(summarizeItem);
  const archived = EARLY_PREP_TRANSITION_ITEMS
    .filter((item) => item.disposition === "archive_only")
    .map(summarizeItem);
  const preview = {
    previewVersion: EARLY_PREP_TRANSITION_PREVIEW_VERSION,
    manifestVersion: EDUCATION_PATH_TRANSITION_MANIFEST_VERSION,
    classification: "synthetic_test_data_only",
    sourceDivision,
    targetDivision,
    selected,
    available,
    archived,
    counts: {
      selected: selected.length,
      available: available.length,
      archived: archived.length,
      requiringReview: selected.filter((item) => item.disposition === "review_required").length,
    },
    writeAuthorized: false,
    applyAuthorized: false,
    currentDivisionChanged: false,
    universityAccountCreated: false,
    socialAudiencesMerged: false,
  };
  return { ...preview, previewHash: stablePreviewHash(preview) };
}

export function confirmSyntheticTransitionManifest(preview, confirmations = {}) {
  if (preview?.classification !== "synthetic_test_data_only" || preview?.previewVersion !== EARLY_PREP_TRANSITION_PREVIEW_VERSION) {
    throw new Error("synthetic_transition_preview_required");
  }
  requireTransitionRoute(preview.sourceDivision, preview.targetDivision);
  if (!preview.selected?.length) throw new Error("explicit_transition_selection_required");
  const rebuiltPreview = previewEducationPathTransition({
    sourceDivision: preview.sourceDivision,
    targetDivision: preview.targetDivision,
    selectedItemIds: preview.selected.map(({ id }) => id),
  });
  const { previewHash, ...previewPayload } = preview;
  if (stablePreviewHash(previewPayload) !== previewHash || rebuiltPreview.previewHash !== previewHash) {
    throw new Error("transition_preview_integrity_failed");
  }
  if (!confirmations.itemSelection || !confirmations.archiveBoundary || !confirmations.reviewBoundary) {
    throw new Error("all_transition_confirmations_required");
  }
  const manifest = {
    manifestVersion: EDUCATION_PATH_TRANSITION_MANIFEST_VERSION,
    classification: "synthetic_test_data_only",
    sourceDivision: "k12",
    targetDivision: "university",
    selectedItems: rebuiltPreview.selected.map(({ id, category, disposition, approvalRequirement, sourceVersion }) => ({
      id,
      category,
      disposition,
      approvalRequirement,
      sourceVersion,
    })),
    archivedItemIds: rebuiltPreview.archived.map(({ id }) => id),
    studentConfirmedSelection: true,
    institutionReviewRequired: true,
    schoolOrGuardianReviewMayBeRequired: true,
    applyAuthorized: false,
  };
  return {
    status: "synthetic_manifest_ready",
    manifest,
    manifestHash: stablePreviewHash(manifest),
    requestSubmitted: false,
    recordsCopied: 0,
    currentDivisionChanged: false,
    universityAccountCreated: false,
    universityRecordsModified: false,
    socialAudiencesMerged: false,
    requiresStudentReconfirmationAtApply: true,
  };
}
