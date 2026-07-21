import { canonicalIdentifiersFromCsv } from "../learningRecordContract.js";

function fold(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function normalizeName(value = "") {
  return fold(value).replace(/\s+/g, " ").trim();
}

function nameSimilarity(left, right) {
  const a = new Set(normalizeName(left).split(" ").filter(Boolean));
  const b = new Set(normalizeName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return (2 * overlap) / (a.size + b.size);
}

function rowIdentity(parsed, structure, row, rowIndex) {
  const identity = {};
  structure.identityColumns.forEach((column) => {
    const value = String(row[column.index] || "").trim();
    if (value && !identity[column.identityKind]) identity[column.identityKind] = value;
  });
  const joinedName = [identity.first_name, identity.last_name].filter(Boolean).join(" ");
  const displayName = identity.full_name || joinedName || identity.email || identity.username || `Blackboard row ${rowIndex + 2}`;
  const stableKey = [identity.username, identity.sis_user_id, identity.student_id, normalizeEmail(identity.email)]
    .find(Boolean) || `${normalizeName(displayName)}::${rowIndex}`;
  return { ...identity, displayName, rowKey: stableKey };
}

function savedMatchFor(identity, savedMappings = []) {
  const comparable = [
    ["blackboard_row_key", identity.rowKey],
    ["blackboard_username", identity.username],
    ["blackboard_sis_user_id", identity.sis_user_id],
    ["blackboard_student_id", identity.student_id],
    ["blackboard_email", identity.email && normalizeEmail(identity.email)],
  ];
  return savedMappings.find((saved) => comparable.some(([field, value]) => {
    if (!value || !saved[field]) return false;
    return field === "blackboard_email"
      ? normalizeEmail(saved[field]) === normalizeEmail(value)
      : fold(saved[field]) === fold(value);
  }));
}

export function proposeStudentMatch(identity, learners = [], savedMappings = []) {
  const saved = savedMatchFor(identity, savedMappings);
  if (saved && learners.some((learner) => learner.id === saved.ednotebook_user_id)) {
    return { learnerId: saved.ednotebook_user_id, confidence: "high", method: "Saved Blackboard mapping", status: "accepted" };
  }

  const email = normalizeEmail(identity.email);
  if (email) {
    const emailMatches = learners.filter((learner) => normalizeEmail(learner.email) === email);
    if (emailMatches.length === 1) return { learnerId: emailMatches[0].id, confidence: "high", method: "Exact email", status: "accepted" };
  }

  const name = identity.full_name || [identity.first_name, identity.last_name].filter(Boolean).join(" ");
  const normalized = normalizeName(name);
  if (normalized) {
    const exactNames = learners.filter((learner) => normalizeName(learner.full_name) === normalized);
    if (exactNames.length === 1) return { learnerId: exactNames[0].id, confidence: "medium", method: "Exact unique name", status: "review" };
    const similar = learners
      .map((learner) => ({ learner, score: nameSimilarity(name, learner.full_name) }))
      .filter((candidate) => candidate.score >= 0.66)
      .sort((left, right) => right.score - left.score);
    if (similar.length && (!similar[1] || similar[0].score > similar[1].score)) {
      return { learnerId: similar[0].learner.id, confidence: "low", method: "Similar name", status: "review" };
    }
  }
  return { learnerId: "", confidence: "none", method: "No reliable match", status: "unmatched" };
}

export function buildStudentMappings({ parsed, structure, learners = [], savedMappings = [] }) {
  const mappings = parsed.rows
    .map((row, rowIndex) => {
      const identity = rowIdentity(parsed, structure, row, rowIndex);
      const proposed = proposeStudentMatch(identity, learners, savedMappings);
      return { rowIndex, ...identity, ...proposed, excluded: false };
    })
    .filter((mapping) => structure.identityColumns.some((column) => String(parsed.rows[mapping.rowIndex]?.[column.index] || "").trim()));

  const assigned = new Map();
  mappings.forEach((mapping) => {
    if (!mapping.learnerId || mapping.status !== "accepted") return;
    assigned.set(mapping.learnerId, [...(assigned.get(mapping.learnerId) || []), mapping.rowIndex]);
  });
  assigned.forEach((rowIndexes) => {
    if (rowIndexes.length < 2) return;
    rowIndexes.forEach((rowIndex) => {
      const mapping = mappings.find((item) => item.rowIndex === rowIndex);
      mapping.status = "review";
      mapping.confidence = "low";
      mapping.method = "Duplicate learner match";
    });
  });
  return mappings;
}

export function identityMappingPayload(mapping) {
  return {
    blackboard_row_key: mapping.rowKey,
    ednotebook_user_id: mapping.learnerId,
    blackboard_username: mapping.username || null,
    blackboard_student_id: mapping.student_id || null,
    blackboard_sis_user_id: mapping.sis_user_id || null,
    blackboard_email: mapping.email || null,
    blackboard_display_name: mapping.displayName || null,
    external_identifiers: canonicalIdentifiersFromCsv(mapping),
    match_method: mapping.method || "Manual professor match",
    confidence: mapping.confidence === "none" ? "manual" : mapping.confidence,
  };
}
