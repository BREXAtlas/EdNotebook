function issue(severity, code, message, detail = null) {
  return { severity, code, message, detail };
}

export function validateMappings({ structure, context, studentMappings, columnMappings, preview = null }) {
  const issues = [...(structure?.issues || [])];
  const learners = context?.learners || [];
  const gradeItems = new Map((context?.gradeItems || []).map((item) => [item.id, item]));
  const acceptedStudents = studentMappings.filter((mapping) => mapping.status === "accepted" && mapping.learnerId && !mapping.excluded);
  const learnerCounts = new Map();
  acceptedStudents.forEach((mapping) => learnerCounts.set(mapping.learnerId, (learnerCounts.get(mapping.learnerId) || 0) + 1));
  [...learnerCounts.entries()].filter(([, count]) => count > 1).forEach(([learnerId]) => {
    const learner = learners.find((item) => item.id === learnerId);
    issues.push(issue("blocking", "duplicate_student_match", `${learner?.full_name || "One learner"} is matched to more than one Blackboard row.`));
  });
  const awaitingStudents = studentMappings.filter((mapping) => mapping.status === "review" && !mapping.excluded);
  if (awaitingStudents.length) issues.push(issue("blocking", "student_review_required", `${awaitingStudents.length} student match${awaitingStudents.length === 1 ? " requires" : "es require"} professor review.`));
  const unmatched = studentMappings.filter((mapping) => !mapping.excluded && (!mapping.learnerId || mapping.status === "unmatched"));
  if (unmatched.length) issues.push(issue("warning", "unmatched_blackboard_students", `${unmatched.length} Blackboard student${unmatched.length === 1 ? " is" : "s are"} unmatched and will not receive grades.`));
  const matchedIds = new Set(acceptedStudents.map((mapping) => mapping.learnerId));
  const absentLearners = learners.filter((learner) => !matchedIds.has(learner.id));
  if (absentLearners.length) issues.push(issue("warning", "learners_missing_from_blackboard", `${absentLearners.length} EdNotebook learner${absentLearners.length === 1 ? " is" : "s are"} not present in the Blackboard file.`));

  const activeColumns = columnMappings.filter((mapping) => mapping.status === "accepted" && !["ignore", "exclude"].includes(mapping.mappingType));
  const reviewColumns = columnMappings.filter((mapping) => mapping.status === "review");
  if (reviewColumns.length) issues.push(issue("blocking", "column_review_required", `${reviewColumns.length} grade column match${reviewColumns.length === 1 ? " requires" : "es require"} professor review.`));
  if (!activeColumns.length) issues.push(issue("blocking", "no_mapped_grade_columns", "Map at least one Blackboard grade column before exporting."));

  const mappedItemCounts = new Map();
  activeColumns.filter((mapping) => mapping.mappingType === "grade_item").forEach((mapping) => {
    mappedItemCounts.set(mapping.gradeItemId, (mappedItemCounts.get(mapping.gradeItemId) || 0) + 1);
    const item = gradeItems.get(mapping.gradeItemId);
    if (!item) issues.push(issue("blocking", "grade_item_missing", `${mapping.columnName} points to an EdNotebook grade item that is no longer available.`));
    const target = mapping.pointsPossible;
    const source = Number(item?.max_points);
    if (target !== null && Number.isFinite(source) && Math.abs(Number(target) - source) > 0.001 && mapping.scalingMode === "none") {
      issues.push(issue("blocking", "scaling_required", `${mapping.columnName} has ${target} Blackboard points while ${item?.title || "the EdNotebook item"} has ${source}. Choose a scaling rule.`));
    }
    if (mapping.scalingMode === "proportional" && !(Number(target) > 0)) {
      issues.push(issue("blocking", "target_points_required", `${mapping.columnName} needs Blackboard points possible before proportional scaling can be used.`));
    }
  });
  [...mappedItemCounts.entries()].filter(([, count]) => count > 1).forEach(([gradeItemId]) => {
    const item = gradeItems.get(gradeItemId);
    issues.push(issue("blocking", "duplicate_grade_mapping", `${item?.title || "One EdNotebook grade item"} is mapped to more than one Blackboard column.`));
  });
  activeColumns.filter((mapping) => mapping.protected).forEach((mapping) => {
    issues.push(issue("warning", "protected_column", `${mapping.columnName} appears to be calculated or protected. Confirm that Blackboard permits this column to be uploaded.`));
  });
  const ignored = columnMappings.filter((mapping) => ["ignore", "exclude"].includes(mapping.mappingType)).length;
  if (ignored) issues.push(issue("information", "ignored_columns", `${ignored} Blackboard grade column${ignored === 1 ? " is" : "s are"} intentionally unchanged.`));

  (context?.grades || []).forEach((grade) => {
    if (grade.score !== null && Number(grade.score) < 0) issues.push(issue("blocking", "negative_grade", "A mapped EdNotebook grade is below zero."));
    const item = gradeItems.get(grade.grade_item_id);
    if (grade.score !== null && item && Number(grade.score) > Number(item.max_points)) issues.push(issue("blocking", "grade_above_maximum", `${item.title} contains a score above its maximum points.`));
  });
  if (preview?.missingCells) issues.push(issue("warning", "grades_not_exported", `${preview.missingCells} mapped grade cell${preview.missingCells === 1 ? " is" : "s are"} missing, pending, or not finalized and will remain unchanged.`));
  return issues;
}

export function issueCounts(issues = []) {
  return issues.reduce((counts, item) => ({ ...counts, [item.severity]: (counts[item.severity] || 0) + 1 }), { blocking: 0, warning: 0, information: 0 });
}

export function exportIsReady(issues = []) {
  return !issues.some((item) => item.severity === "blocking");
}

export async function sha256Hex(value) {
  const bytes = value instanceof ArrayBuffer
    ? value
    : value instanceof Uint8Array
      ? value
      : new TextEncoder().encode(String(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
