export const SOCIAL_LEARNING_CATEGORIES = Object.freeze([
  { value: "evidence", label: "Evidence" },
  { value: "source_literacy", label: "Source literacy" },
  { value: "digital_citizenship", label: "Digital citizenship" },
  { value: "growth", label: "Growth" },
  { value: "effort", label: "Purposeful effort" },
  { value: "collaboration", label: "Collaboration" },
  { value: "reflection", label: "Reflection" },
]);

export const SOCIAL_LEARNING_VISUALS = Object.freeze([
  { value: "spark", label: "Spark", symbol: "✨" },
  { value: "star", label: "Star", symbol: "⭐" },
  { value: "book", label: "Book", symbol: "📘" },
  { value: "lightbulb", label: "Idea", symbol: "💡" },
  { value: "compass", label: "Compass", symbol: "🧭" },
  { value: "shield", label: "Shield", symbol: "🛡️" },
  { value: "growth", label: "Growth", symbol: "🌱" },
]);

export const SOCIAL_LEARNING_MILESTONES = Object.freeze([
  {
    threshold_points: 100,
    badge_name: "Source Scout",
    badge_description: "Recognizes careful source checking and clear evidence choices.",
    unlock_key: "focus_palette",
    unlock_name: "Focus palette",
    unlock_description: "An optional low-distraction color theme for reading and study.",
    unlock_kind: "theme",
    is_optional: true,
  },
  {
    threshold_points: 250,
    badge_name: "Digital Citizen",
    badge_description: "Recognizes responsible, accessible, and thoughtful participation.",
    unlock_key: "source_organizer_layout",
    unlock_name: "Source organizer layout",
    unlock_description: "An optional source-card layout for organizing citation practice.",
    unlock_kind: "study_aid",
    is_optional: true,
  },
  {
    threshold_points: 500,
    badge_name: "Evidence Builder",
    badge_description: "Recognizes sustained growth in explaining and supporting ideas.",
    unlock_key: "reflection_prompt_pack",
    unlock_name: "Reflection prompt pack",
    unlock_description: "Optional reflection prompts that help a learner describe how their work improved.",
    unlock_kind: "study_aid",
    is_optional: true,
  },
  {
    threshold_points: 1000,
    badge_name: "Learning Guide",
    badge_description: "Recognizes a sustained record of thoughtful, evidence-based learning.",
    unlock_key: "private_badge_display",
    unlock_name: "Badge display choice",
    unlock_description: "An optional profile setting; badges stay private unless the student chooses to display them.",
    unlock_kind: "profile_option",
    is_optional: true,
  },
]);

export const DIGITAL_LITERACY_REWARD_ROSTER = Object.freeze([
  {
    course_id: "digital-literacy-course",
    course_code: "DLIT 1001",
    course_title: "Digital Literacy Course",
    student_id: "digital-literacy-student",
    student_display_name: "Brooke Carter",
  },
]);

export const DIGITAL_LITERACY_REWARD_EVENTS = Object.freeze([
  {
    id: "dl-source-check",
    course_id: "digital-literacy-course",
    student_id: "digital-literacy-student",
    issued_by: "digital-literacy-professor",
    issuer_display_name: "Professor Atlas",
    event_type: "award",
    source_event_id: null,
    reward_name: "Source Scout",
    visual_key: "compass",
    category: "source_literacy",
    activity_reference: "Digital Literacy · Lateral reading source check",
    points_delta: 75,
    reason: "Compared the claim across three sources and explained which evidence was most trustworthy.",
    created_at: "2026-08-20T15:30:00.000Z",
  },
  {
    id: "dl-accessible-post",
    course_id: "digital-literacy-course",
    student_id: "digital-literacy-student",
    issued_by: "digital-literacy-professor",
    issuer_display_name: "Professor Atlas",
    event_type: "award",
    source_event_id: null,
    reward_name: "Accessible Communicator",
    visual_key: "spark",
    category: "digital_citizenship",
    activity_reference: "Digital Literacy · Accessible publishing practice",
    points_delta: 50,
    reason: "Added useful alternative text and revised the heading order so the class resource was easier to use.",
    created_at: "2026-08-22T17:15:00.000Z",
  },
  {
    id: "dl-accessible-post-adjustment",
    course_id: "digital-literacy-course",
    student_id: "digital-literacy-student",
    issued_by: "digital-literacy-professor",
    issuer_display_name: "Professor Atlas",
    event_type: "adjustment",
    source_event_id: "dl-accessible-post",
    reward_name: "Accessible Communicator",
    visual_key: "spark",
    category: "digital_citizenship",
    activity_reference: "Digital Literacy · Accessible publishing practice",
    points_delta: -10,
    reason: "Corrected the original point entry after reviewing the published quest rubric.",
    created_at: "2026-08-22T17:25:00.000Z",
  },
]);

export function normalizeLearningText(value) {
  return String(value || "").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function rewardSemanticFingerprint({
  courseId,
  studentId,
  rewardName,
  category,
  activityReference,
}) {
  return [
    courseId,
    studentId,
    normalizeLearningText(rewardName),
    normalizeLearningText(category),
    normalizeLearningText(activityReference),
  ].join("|");
}

export function categoryLabel(value) {
  return SOCIAL_LEARNING_CATEGORIES.find((category) => category.value === value)?.label
    || String(value || "Learning").replaceAll("_", " ");
}

export function rewardVisual(value) {
  return SOCIAL_LEARNING_VISUALS.find((visual) => visual.value === value)
    || SOCIAL_LEARNING_VISUALS[0];
}

export function hasRewardReversal(eventId, events) {
  return events.some((event) => event.source_event_id === eventId && event.event_type === "reversal");
}

export function summarizeRewardLedger(events = [], milestones = SOCIAL_LEARNING_MILESTONES) {
  const sortedMilestones = [...milestones].sort((a, b) => a.threshold_points - b.threshold_points);
  const totalPoints = Math.max(0, events.reduce((sum, event) => sum + Number(event.points_delta || 0), 0));
  const earnedMilestones = sortedMilestones.filter((milestone) => totalPoints >= milestone.threshold_points);
  const nextMilestone = sortedMilestones.find((milestone) => totalPoints < milestone.threshold_points) || null;
  const currentThreshold = earnedMilestones.at(-1)?.threshold_points || 0;
  const progressPercent = nextMilestone
    ? Math.min(100, Math.max(0, ((totalPoints - currentThreshold) / (nextMilestone.threshold_points - currentThreshold)) * 100))
    : 100;

  return {
    totalPoints,
    earnedMilestones,
    nextMilestone,
    pointsToNext: nextMilestone ? nextMilestone.threshold_points - totalPoints : 0,
    progressPercent,
    currentBadge: earnedMilestones.at(-1)?.badge_name || "Learning in progress",
  };
}
