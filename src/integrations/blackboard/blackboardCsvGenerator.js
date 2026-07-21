const NUMERIC_TEXT = /^-?(?:\d+\.?\d*|\.\d+)$/;

export function roundGrade(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function scaleGrade({ score, sourceMaximum = 100, targetMaximum = null, mode = "raw", decimals = 2 }) {
  const numericScore = Number(score);
  const sourceMax = Number(sourceMaximum);
  const targetMax = targetMaximum === null || targetMaximum === undefined ? null : Number(targetMaximum);
  if (!Number.isFinite(numericScore)) throw new Error("The EdNotebook grade is not numeric.");
  if (!Number.isFinite(sourceMax) || sourceMax <= 0) throw new Error("The EdNotebook maximum points are invalid.");
  if (mode === "raw") return roundGrade(numericScore, decimals);
  if (mode === "percentage") return roundGrade((numericScore / sourceMax) * 100, decimals);
  if (mode === "proportional") {
    if (!Number.isFinite(targetMax) || targetMax <= 0) throw new Error("Blackboard points possible are required for proportional scaling.");
    return roundGrade((numericScore / sourceMax) * targetMax, decimals);
  }
  throw new Error("Choose a grade scaling rule before exporting.");
}

export function neutralizeSpreadsheetFormula(value) {
  const text = String(value ?? "");
  const trimmed = text.trimStart();
  if (!trimmed || text.startsWith("'")) return text;
  if (/^[=+@]/.test(trimmed) || (trimmed.startsWith("-") && !NUMERIC_TEXT.test(trimmed))) return `'${text}`;
  return text;
}

export function csvEscape(value) {
  const safe = neutralizeSpreadsheetFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function generateBlackboardCsv(parsed, changes = []) {
  const changeMap = new Map(changes.map((change) => [`${change.rowIndex}:${change.columnIndex}`, String(change.value ?? "")]));
  const lines = [parsed.headers.map(csvEscape).join(",")];
  parsed.rows.forEach((sourceRow, rowIndex) => {
    const output = parsed.headers.map((_, columnIndex) => {
      const key = `${rowIndex}:${columnIndex}`;
      return changeMap.has(key) ? changeMap.get(key) : sourceRow[columnIndex] ?? "";
    });
    lines.push(output.map(csvEscape).join(","));
  });
  return `${lines.join("\r\n")}\r\n`;
}

function gradeLookup(context) {
  return new Map((context.grades || []).map((grade) => [`${grade.student_id}:${grade.grade_item_id}`, grade]));
}

function progressLookup(context) {
  return new Map((context.progress || []).map((row) => [row.user_id, row]));
}

function asDisplay(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(roundGrade(Number(value), 2));
}

export function createExportPreview({ parsed, context, studentMappings, columnMappings }) {
  const grades = gradeLookup(context);
  const progress = progressLookup(context);
  const items = new Map((context.gradeItems || []).map((item) => [item.id, item]));
  const learners = new Map((context.learners || []).map((learner) => [learner.id, learner]));
  const rows = [];
  const changes = [];
  const gradeSnapshot = [];

  studentMappings.filter((mapping) => mapping.status === "accepted" && mapping.learnerId && !mapping.excluded).forEach((studentMapping) => {
    columnMappings.filter((mapping) => mapping.status === "accepted" && !["ignore", "exclude"].includes(mapping.mappingType)).forEach((columnMapping) => {
      let source = null;
      let sourceKind = columnMapping.mappingType;
      let sourceMaximum = 100;
      let gradeStatus = "missing";
      let updatedAt = null;

      if (columnMapping.mappingType === "grade_item") {
        const item = items.get(columnMapping.gradeItemId);
        const grade = grades.get(`${studentMapping.learnerId}:${columnMapping.gradeItemId}`);
        source = grade?.score;
        sourceMaximum = Number(item?.max_points || 100);
        gradeStatus = grade?.status || "missing";
        updatedAt = grade?.updated_at || null;
      } else {
        const learnerProgress = progress.get(studentMapping.learnerId);
        if (columnMapping.mappingType === "course_completion") {
          source = learnerProgress?.completion_percent;
          gradeStatus = learnerProgress?.status === "completed" ? "finalized" : learnerProgress?.status || "missing";
        } else if (columnMapping.mappingType === "final_course_grade") {
          source = learnerProgress?.final_score ?? learnerProgress?.auto_score;
          gradeStatus = ["graded", "auto_graded"].includes(learnerProgress?.grade_status) ? "finalized" : learnerProgress?.grade_status || "missing";
        }
        updatedAt = learnerProgress?.updated_at || null;
      }

      const previousValue = parsed.rows[studentMapping.rowIndex]?.[columnMapping.columnIndex] ?? "";
      const learner = learners.get(studentMapping.learnerId);
      const base = {
        rowIndex: studentMapping.rowIndex,
        columnIndex: columnMapping.columnIndex,
        blackboardLearner: studentMapping.displayName,
        blackboardIdentifier: studentMapping.username || studentMapping.sis_user_id || studentMapping.student_id || studentMapping.email || "Not provided",
        ednotebookLearner: learner?.full_name || learner?.email || "Matched learner",
        studentId: studentMapping.learnerId,
        gradeColumn: columnMapping.columnName,
        previousValue,
        maximumPoints: columnMapping.pointsPossible,
        sourceKind,
        gradeItemId: columnMapping.mappingType === "grade_item" ? columnMapping.gradeItemId : null,
      };

      if (source === null || source === undefined || source === "") {
        rows.push({ ...base, newValue: "", status: gradeStatus === "pending" ? "Pending grade" : "Missing grade" });
        return;
      }
      if (gradeStatus !== "finalized") {
        rows.push({ ...base, newValue: "", status: "Not finalized" });
        return;
      }

      try {
        const exported = scaleGrade({
          score: source,
          sourceMaximum,
          targetMaximum: columnMapping.pointsPossible,
          mode: columnMapping.scalingMode === "none" ? "raw" : columnMapping.scalingMode,
        });
        const newValue = asDisplay(exported);
        const changed = String(previousValue).trim() !== newValue;
        rows.push({ ...base, newValue, sourceValue: Number(source), sourceMaximum, status: changed ? "Changed" : "Unchanged" });
        if (changed) {
          changes.push({ rowIndex: studentMapping.rowIndex, columnIndex: columnMapping.columnIndex, value: newValue });
          gradeSnapshot.push({
            student_id: studentMapping.learnerId,
            source_kind: sourceKind,
            grade_item_id: columnMapping.mappingType === "grade_item" ? columnMapping.gradeItemId : null,
            source_score: Number(source),
            source_updated_at: updatedAt,
            exported_score: exported,
          });
        }
      } catch (error) {
        rows.push({ ...base, newValue: "", status: error.message || "Invalid grade" });
      }
    });
  });

  const matchedStudents = new Set(rows.map((row) => row.studentId)).size;
  return {
    rows,
    changes,
    gradeSnapshot,
    matchedStudents,
    changedGradeCells: changes.length,
    unchangedCells: rows.filter((row) => row.status === "Unchanged").length,
    missingCells: rows.filter((row) => !["Changed", "Unchanged"].includes(row.status)).length,
  };
}

export function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
