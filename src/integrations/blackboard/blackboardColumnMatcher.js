import { gradeColumnTitle, normalizeHeader } from "./blackboardCsvParser.js";
import { canonicalGradeItemRecord, INTEGRATION_MODES, LEARNING_SYSTEMS } from "../learningRecordContract.js";

function normalizeTitle(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleSimilarity(left, right) {
  const a = new Set(normalizeTitle(left).split(" ").filter(Boolean));
  const b = new Set(normalizeTitle(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return (2 * overlap) / (a.size + b.size);
}

function samePoints(left, right) {
  return left !== null && left !== undefined && right !== null && right !== undefined && Math.abs(Number(left) - Number(right)) < 0.001;
}

export function proposeColumnMatch(column, gradeItems = [], savedMappings = []) {
  const saved = savedMappings.find((mapping) => normalizeHeader(mapping.blackboard_column_key) === normalizeHeader(column.key));
  if (saved) {
    const gradeItemExists = !saved.ednotebook_grade_item_id || gradeItems.some((item) => item.id === saved.ednotebook_grade_item_id);
    if (gradeItemExists) return {
      mappingType: saved.mapping_type,
      gradeItemId: saved.ednotebook_grade_item_id || "",
      scalingMode: saved.scaling_mode || "none",
      confidence: "high",
      method: "Saved column mapping",
      status: "accepted",
    };
  }

  const title = gradeColumnTitle(column.header);
  const exact = gradeItems.filter((item) => normalizeTitle(item.title) === normalizeTitle(title));
  const exactPoints = exact.find((item) => samePoints(column.pointsPossible, item.max_points));
  if (exactPoints) return { mappingType: "grade_item", gradeItemId: exactPoints.id, scalingMode: "raw", confidence: "high", method: "Exact title and points", status: "accepted" };
  if (exact.length === 1) return { mappingType: "grade_item", gradeItemId: exact[0].id, scalingMode: "none", confidence: "medium", method: "Exact title; points need review", status: "review" };

  const similar = gradeItems
    .map((item) => ({ item, score: titleSimilarity(title, item.title) }))
    .filter((candidate) => candidate.score >= 0.55)
    .sort((left, right) => right.score - left.score);
  if (similar.length && (!similar[1] || similar[0].score > similar[1].score)) {
    return {
      mappingType: "grade_item",
      gradeItemId: similar[0].item.id,
      scalingMode: samePoints(column.pointsPossible, similar[0].item.max_points) ? "raw" : "none",
      confidence: samePoints(column.pointsPossible, similar[0].item.max_points) ? "medium" : "low",
      method: "Similar assignment title",
      status: "review",
    };
  }
  return { mappingType: "ignore", gradeItemId: "", scalingMode: "none", confidence: "none", method: "No reliable match", status: "accepted" };
}

export function buildColumnMappings({ structure, gradeItems = [], savedMappings = [] }) {
  return structure.gradeColumns.map((column) => ({
    columnIndex: column.index,
    columnKey: column.key,
    columnName: column.header,
    title: column.title,
    pointsPossible: column.pointsPossible,
    externalLineItemId: column.externalId,
    protected: column.protected,
    ...proposeColumnMatch(column, gradeItems, savedMappings),
  }));
}

export function columnMappingPayload(mapping) {
  return {
    blackboard_column_key: mapping.columnKey,
    blackboard_column_name: mapping.columnName,
    blackboard_points_possible: mapping.pointsPossible,
    external_line_item_id: mapping.externalLineItemId || null,
    ednotebook_grade_item_id: mapping.mappingType === "grade_item" ? mapping.gradeItemId : null,
    mapping_type: mapping.mappingType,
    scaling_mode: mapping.scalingMode,
    canonical_line_item: canonicalGradeItemRecord({
      externalLineItemId: mapping.externalLineItemId,
      title: mapping.title,
      scoreMaximum: mapping.pointsPossible,
      status: mapping.protected ? "calculated_or_protected" : "available",
      provenance: {
        provider: LEARNING_SYSTEMS.BLACKBOARD,
        mode: INTEGRATION_MODES.CSV,
        sourceRecordId: mapping.columnKey,
      },
    }),
  };
}

export { normalizeTitle, titleSimilarity };
