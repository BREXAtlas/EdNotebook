import { earlyPrepAssignmentStarter } from "./subjectCatalog.js";

export const EARLY_PREP_READINESS_VERSION = "early-prep-readiness-v1";
export const EARLY_PREP_READINESS_DIVISION = "k12";

const MODULES = [
  {
    id: "career-exploration",
    label: "Career exploration",
    title: "Explore work without being matched",
    summary: "Compare the daily work, preparation, environment, and tradeoffs of paths you choose to investigate.",
    outcomes: ["Name the work people actually do", "Compare preparation routes", "Record questions for a trusted adult or educator"],
    prompts: ["What problem does this work solve?", "What does a typical day include?", "Which facts still need a reliable source?"],
    teacherChecks: ["Sources are identified", "Student choice remains open", "No path is ranked as a personal prediction"],
  },
  {
    id: "trade-pathway",
    label: "Trade pathway",
    title: "Research training, safety, and credentials",
    summary: "Investigate one skilled trade through its training sequence, working conditions, safety expectations, and credential sources.",
    outcomes: ["Map apprenticeship or training steps", "Identify safety responsibilities", "Verify licensing or credential claims"],
    prompts: ["Which training providers or apprenticeship sources are official?", "What tools and safety practices matter?", "What costs or commitments need verification?"],
    teacherChecks: ["Credential source is authoritative", "Safety is explicit", "Costs and outcomes are not guaranteed"],
  },
  {
    id: "resume-practice",
    label: "Resume practice",
    title: "Turn learning into evidence",
    summary: "Draft a private practice resume from classes, projects, service, activities, and skills without publishing personal details.",
    outcomes: ["Use action-and-evidence statements", "Connect projects to skills", "Revise for clarity and accuracy"],
    prompts: ["What did you make, improve, organize, or learn?", "What evidence shows your contribution?", "Which claim should be more specific?"],
    teacherChecks: ["Claims are truthful", "Evidence is specific", "Private contact details are omitted from class review"],
  },
  {
    id: "interview-practice",
    label: "Interview practice",
    title: "Practice clear, truthful answers",
    summary: "Rehearse common questions with a situation-action-result structure and self-review instead of automated scoring.",
    outcomes: ["Answer with a concrete example", "Explain an action honestly", "Ask a useful closing question"],
    prompts: ["What was the situation?", "What action did you personally take?", "What happened, and what did you learn?"],
    teacherChecks: ["Examples are age-appropriate", "Feedback is descriptive", "No personality or employability score is produced"],
  },
  {
    id: "summer-job-readiness",
    label: "Summer-job readiness",
    title: "Prepare before applying anywhere",
    summary: "Use a safety-first checklist for researching an organization, asking trusted adults for help, and recognizing job scams.",
    outcomes: ["Verify the organization and role", "Recognize payment and identity scams", "Prepare questions before any application"],
    prompts: ["Can the organization and role be verified independently?", "Is anyone asking for money, gift cards, or sensitive identifiers?", "Which trusted adult can review the next step?"],
    teacherChecks: ["No application is submitted", "Scam warnings are visible", "Local age and work rules are checked outside EdNotebook"],
  },
  {
    id: "college-readiness",
    label: "College readiness",
    title: "Organize choices and deadlines",
    summary: "Build a student-owned checklist for programs, questions, documents, deadlines, and affordability research without admissions predictions.",
    outcomes: ["Compare programs using sourced facts", "Track questions and deadlines", "Separate estimates from confirmed requirements"],
    prompts: ["Which program facts come from an official source?", "What deadline or document needs confirmation?", "Who can review affordability and aid information with you?"],
    teacherChecks: ["No admission likelihood is predicted", "Requirements are source-dated", "Financial aid claims are not individualized advice"],
  },
];

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const EARLY_PREP_READINESS_MODULES = deepFreeze(MODULES.map((module) => ({ ...module })));
const MODULES_BY_ID = new Map(EARLY_PREP_READINESS_MODULES.map((module) => [module.id, module]));

const FORBIDDEN_DRAFT_KEYS = /address|birth|dob|social.?security|ssn|driver.?license|bank|routing|account.?number|password|secret|token/iu;
const INTERVIEW_QUESTIONS = Object.freeze([
  "Tell me about a project or responsibility you are proud of.",
  "Describe a time you solved a problem or learned from a mistake.",
  "How do you organize your work when several tasks are due?",
  "Describe a time you worked with someone whose approach was different from yours.",
  "What would you like to learn in this role, program, or experience?",
  "What question would you ask before deciding whether an opportunity is safe and appropriate?",
]);

function requireEarlyPrep(educationDivision) {
  if (educationDivision !== EARLY_PREP_READINESS_DIVISION) throw new Error("early_prep_readiness_requires_k12");
}

function boundedText(value, maxLength = 600) {
  return String(value || "").trim().replace(/\s+/gu, " ").slice(0, maxLength);
}

function escapeHtml(value) {
  return boundedText(value, 1200)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function assertNoRestrictedDraftFields(draft) {
  const restricted = Object.keys(draft || {}).find((key) => FORBIDDEN_DRAFT_KEYS.test(key));
  if (restricted) throw new Error(`restricted_resume_field:${restricted}`);
}

export function earlyPrepReadinessModule(moduleId) {
  return MODULES_BY_ID.get(String(moduleId || "")) || null;
}

export function createStudentReadinessPlan({
  educationDivision = EARLY_PREP_READINESS_DIVISION,
  selectedModuleIds = [],
  goalText = "",
} = {}) {
  requireEarlyPrep(educationDivision);
  const ids = [...new Set(selectedModuleIds.map(String))];
  if (!ids.length || ids.some((id) => !MODULES_BY_ID.has(id))) throw new Error("known_readiness_module_required");
  return {
    version: EARLY_PREP_READINESS_VERSION,
    educationDivision,
    classification: "student_directed_practice",
    goalText: boundedText(goalText),
    selectedModules: ids.map((id) => ({ id, label: MODULES_BY_ID.get(id).label })),
    automatedRecommendation: false,
    eligibilityDecision: false,
    admissionsPrediction: false,
    employerMatch: false,
    applicationSubmitted: false,
    sharingAuthorized: false,
    paymentRequired: false,
  };
}

export function buildPracticeResume({ educationDivision = EARLY_PREP_READINESS_DIVISION, ...draft } = {}) {
  requireEarlyPrep(educationDivision);
  assertNoRestrictedDraftFields(draft);
  const allowed = {
    displayName: boundedText(draft.displayName, 80) || "Student Name",
    summary: boundedText(draft.summary),
    education: boundedText(draft.education),
    skills: boundedText(draft.skills),
    experience: boundedText(draft.experience, 1200),
  };
  const section = (title, body) => `<h2>${title}</h2><p>${escapeHtml(body) || "Add your practice notes here."}</p>`;
  return {
    version: EARLY_PREP_READINESS_VERSION,
    classification: "private_practice_draft",
    storage: "memory_only",
    title: `${allowed.displayName} — Practice Resume`,
    html: `<section class="document-page"><h1>${escapeHtml(allowed.displayName)}</h1><p>Practice resume · contact details intentionally omitted</p>${section("Summary", allowed.summary)}${section("Education and learning", allowed.education)}${section("Skills", allowed.skills)}${section("Projects, service, and experience", allowed.experience)}</section>`,
    sharingAuthorized: false,
    applicationSubmitted: false,
  };
}

export function interviewPractice({ educationDivision = EARLY_PREP_READINESS_DIVISION, questionIndex = 0 } = {}) {
  requireEarlyPrep(educationDivision);
  const normalizedIndex = Math.abs(Number(questionIndex) || 0) % INTERVIEW_QUESTIONS.length;
  return {
    version: EARLY_PREP_READINESS_VERSION,
    questionIndex: normalizedIndex,
    questionCount: INTERVIEW_QUESTIONS.length,
    question: INTERVIEW_QUESTIONS[normalizedIndex],
    coachChecks: ["Use a real example", "Name your own action", "Explain the result or lesson", "Keep private details out"],
    automatedScore: null,
    recordingEnabled: false,
    employerMatch: false,
  };
}

export function buildTeacherReadinessAssignment(moduleId, { educationDivision = EARLY_PREP_READINESS_DIVISION } = {}) {
  requireEarlyPrep(educationDivision);
  const module = earlyPrepReadinessModule(moduleId);
  if (!module) throw new Error("known_readiness_module_required");
  const cteStarter = earlyPrepAssignmentStarter("career-technical-education");
  return {
    version: EARLY_PREP_READINESS_VERSION,
    educationDivision,
    moduleId: module.id,
    subjectId: cteStarter.subjectId,
    adapterKey: cteStarter.adapterKey,
    title: module.label,
    instructions: module.summary,
    sections: module.prompts.map((prompt, index) => ({
      type: index === module.prompts.length - 1 ? "reflection" : "long",
      prompt,
      helpText: module.outcomes[index] || "Use reliable evidence and identify what still needs review.",
      wordTarget: index === module.prompts.length - 1 ? 100 : 140,
    })),
    teacherReviewChecks: [...module.teacherChecks],
    editorConfig: { ...cteStarter.editorConfig },
    automatedScoring: false,
    publishAuthorized: false,
    requiresTeacherReview: true,
    studentDataRequired: false,
  };
}
