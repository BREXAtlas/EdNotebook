export const BLACKBOARD_CSV_MAX_BYTES = 10 * 1024 * 1024;
export const BLACKBOARD_CSV_MAX_ROWS = 50_000;
export const BLACKBOARD_CSV_MAX_COLUMNS = 1_000;

const IDENTITY_RULES = [
  ["username", /^(user\s*name|username|login|login\s*id|user\s*id)$/i],
  ["sis_user_id", /^(sis\s*(user\s*)?id|external\s*person\s*key)$/i],
  ["student_id", /^(student\s*id|institution\s*id|campus\s*id)$/i],
  ["email", /^(e-?mail|email\s*address)$/i],
  ["first_name", /^(first|given)\s*name$/i],
  ["last_name", /^(last|family|sur)\s*name$/i],
  ["full_name", /^(full\s*name|student\s*name|name)$/i],
];

const PROTECTED_HEADER = /(calculated|weighted\s*total|overall\s*grade|external\s*grade|running\s*total|average)/i;
const SUPPORTING_HEADER = /(feedback|status|availability|attempt|date|notes?|comments?|exempt)/i;
const GRADE_HINT = /(grade|score|points?|pts\.?|total\s*pts|assignment|quiz|exam|test|project|lab|discussion|paper|essay)/i;
const NUMERIC_TEXT = /^-?(?:\d+\.?\d*|\.\d+)$/;

export class BlackboardCsvError extends Error {
  constructor(message, code = "invalid_csv", details = {}) {
    super(message);
    this.name = "BlackboardCsvError";
    this.code = code;
    this.details = details;
  }
}

export function normalizeHeader(value = "") {
  return String(value)
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(/\s+/g, " ");
}

export function detectIdentityKind(header) {
  const normalized = normalizeHeader(header).replace(/[_-]+/g, " ");
  return IDENTITY_RULES.find(([, pattern]) => pattern.test(normalized))?.[0] || null;
}

export function detectPointsPossible(header) {
  const value = String(header || "");
  const match = value.match(/(?:total\s*pts?|points?\s*possible|max(?:imum)?\s*points?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i)
    || value.match(/\[(?:[^\]]*?)(\d+(?:\.\d+)?)\s*(?:pts?|points?)(?:[^\]]*?)\]/i);
  return match ? Number(match[1]) : null;
}

export function gradeColumnTitle(header) {
  return String(header || "")
    .replace(/\[(?:[^\]]*?(?:total\s*pts?|points?\s*possible|score|grade)[^\]]*?)\]/ig, "")
    .replace(/\s*\|\s*(?:id|column)\s*[:=].*$/i, "")
    .trim() || String(header || "").trim();
}

export function detectExternalColumnId(header) {
  const match = String(header || "").match(/\|\s*(?:id|column(?:\s*id)?)\s*[:=]\s*([^|\]]+)/i)
    || String(header || "").match(/\[(?:[^\]]*?)(?:id|column(?:\s*id)?)\s*[:=]\s*([^;|\]]+)/i);
  return match?.[1]?.trim() || null;
}

export function decodeCsvBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!bytes.length) throw new BlackboardCsvError("The Blackboard file is empty.", "empty_file");
  if (bytes.length > BLACKBOARD_CSV_MAX_BYTES) {
    throw new BlackboardCsvError("The Blackboard file must be 10 MB or smaller.", "file_too_large", { bytes: bytes.length });
  }
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
  if (sample.some((byte) => byte === 0)) {
    throw new BlackboardCsvError("The selected file appears to contain binary data. Upload a UTF-8 CSV downloaded from Blackboard.", "binary_file");
  }
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    return { text, encoding: hasBom ? "UTF-8 with BOM" : "UTF-8" };
  } catch {
    throw new BlackboardCsvError("The file is not valid UTF-8. Download the gradebook from Blackboard as a UTF-8 CSV and try again.", "unsupported_encoding");
  }
}

function isBlankRow(row) {
  return row.every((cell) => String(cell).trim() === "");
}

export function parseCsvText(text, options = {}) {
  const maxRows = options.maxRows || BLACKBOARD_CSV_MAX_ROWS;
  const maxColumns = options.maxColumns || BLACKBOARD_CSV_MAX_COLUMNS;
  if (typeof text !== "string" || !text.trim()) throw new BlackboardCsvError("The Blackboard file is empty.", "empty_file");
  if (text.includes("\0")) throw new BlackboardCsvError("The selected file contains unexpected binary data.", "binary_file");

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  const finishField = () => {
    row.push(field);
    field = "";
    afterQuote = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
    if (rows.length > maxRows + 1) {
      throw new BlackboardCsvError(`The file exceeds the ${maxRows.toLocaleString()} row safety limit.`, "too_many_rows");
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (afterQuote && char !== "," && char !== "\r" && char !== "\n") {
      if (/\s/.test(char)) continue;
      throw new BlackboardCsvError(`Malformed quoting near character ${index + 1}.`, "malformed_quoting", { index });
    }
    if (char === '"') {
      if (field.length) throw new BlackboardCsvError(`Malformed quoting near character ${index + 1}.`, "malformed_quoting", { index });
      quoted = true;
    } else if (char === ",") {
      finishField();
    } else if (char === "\n") {
      finishRow();
    } else if (char === "\r") {
      if (text[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      field += char;
    }
  }

  if (quoted) throw new BlackboardCsvError("The file ends inside a quoted value.", "malformed_quoting");
  if (field.length || row.length || afterQuote) finishRow();
  while (rows.length && isBlankRow(rows[rows.length - 1])) rows.pop();
  if (!rows.length || isBlankRow(rows[0])) throw new BlackboardCsvError("The Blackboard file does not contain a header row.", "missing_headers");

  const headers = rows[0].map((header) => String(header).replace(/^\uFEFF/, ""));
  if (headers.length > maxColumns) {
    throw new BlackboardCsvError(`The file exceeds the ${maxColumns.toLocaleString()} column safety limit.`, "too_many_columns");
  }
  const dataRows = rows.slice(1);
  const issues = [];
  const normalizedCounts = new Map();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) issues.push({ severity: "blocking", code: "blank_header", message: `Column ${index + 1} has a blank header.` });
    normalizedCounts.set(normalized, (normalizedCounts.get(normalized) || 0) + 1);
  });
  const duplicates = [...normalizedCounts.entries()].filter(([header, count]) => header && count > 1).map(([header]) => header);
  duplicates.forEach((header) => issues.push({ severity: "blocking", code: "duplicate_header", message: `The header “${header}” appears more than once.` }));

  const normalizedRows = dataRows.map((cells, rowIndex) => {
    if (cells.length !== headers.length) {
      issues.push({
        severity: "blocking",
        code: "row_width",
        message: `Row ${rowIndex + 2} has ${cells.length} cells; the header has ${headers.length}.`,
      });
    }
    return headers.map((_, columnIndex) => cells[columnIndex] ?? "");
  });

  let formulaLikeCells = 0;
  normalizedRows.forEach((cells) => cells.forEach((cell) => {
    const value = String(cell).trim();
    if (/^[=+@]/.test(value) || (value.startsWith("-") && !NUMERIC_TEXT.test(value))) formulaLikeCells += 1;
  }));
  if (formulaLikeCells) {
    issues.push({ severity: "warning", code: "formula_like_cells", message: `${formulaLikeCells} text cell${formulaLikeCells === 1 ? " begins" : "s begin"} with a spreadsheet formula character. EdNotebook will neutralize those text values in the downloaded file.` });
  }
  if (!normalizedRows.length) issues.push({ severity: "blocking", code: "no_student_rows", message: "The file has headers but no gradebook rows." });

  return { headers, rows: normalizedRows, issues, duplicates, formulaLikeCells };
}

export function inspectBlackboardCsv(parsed, encoding = "UTF-8") {
  const columns = parsed.headers.map((header, index) => {
    const identityKind = detectIdentityKind(header);
    const pointsPossible = detectPointsPossible(header);
    const normalized = normalizeHeader(header);
    const protectedColumn = PROTECTED_HEADER.test(normalized);
    const supportingColumn = SUPPORTING_HEADER.test(normalized);
    const gradeLike = !identityKind && !supportingColumn && (protectedColumn || pointsPossible !== null || GRADE_HINT.test(normalized));
    return {
      index,
      header,
      key: normalized,
      identityKind,
      kind: identityKind ? "identity" : gradeLike ? "grade" : "unknown",
      protected: protectedColumn,
      pointsPossible,
      externalId: detectExternalColumnId(header),
      title: gradeColumnTitle(header),
    };
  });
  const identityColumns = columns.filter((column) => column.kind === "identity");
  const gradeColumns = columns.filter((column) => column.kind === "grade");
  const unknownColumns = columns.filter((column) => column.kind === "unknown");
  const blankColumns = columns.filter((column) => parsed.rows.every((row) => !String(row[column.index]).trim()));
  const issues = [...parsed.issues];
  if (!identityColumns.length) issues.push({ severity: "blocking", code: "no_identity_columns", message: "No likely Blackboard student identity column was found." });
  if (!gradeColumns.length) issues.push({ severity: "blocking", code: "no_grade_columns", message: "No likely Blackboard grade column was found." });
  return {
    encoding,
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
    columns,
    identityColumns,
    gradeColumns,
    unknownColumns,
    blankColumns,
    issues,
  };
}

export async function parseBlackboardFile(file) {
  if (!file) throw new BlackboardCsvError("Choose a Blackboard gradebook CSV.", "missing_file");
  const extension = String(file.name || "").toLowerCase().split(".").pop();
  if (extension !== "csv") throw new BlackboardCsvError("Upload a .csv file downloaded from Blackboard.", "unsupported_file");
  if (file.size > BLACKBOARD_CSV_MAX_BYTES) throw new BlackboardCsvError("The Blackboard file must be 10 MB or smaller.", "file_too_large");
  if (file.type && !["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"].includes(file.type)) {
    throw new BlackboardCsvError("The selected file is not recognized as a CSV.", "unsupported_mime");
  }
  const decoded = decodeCsvBuffer(await file.arrayBuffer());
  const parsed = parseCsvText(decoded.text);
  return { parsed, structure: inspectBlackboardCsv(parsed, decoded.encoding), text: decoded.text, encoding: decoded.encoding };
}
