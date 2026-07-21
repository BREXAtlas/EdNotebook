import test from "node:test";
import assert from "node:assert/strict";
import { BlackboardCsvError, decodeCsvBuffer, inspectBlackboardCsv, parseCsvText } from "./blackboardCsvParser.js";
import { csvEscape, generateBlackboardCsv, neutralizeSpreadsheetFormula, scaleGrade } from "./blackboardCsvGenerator.js";

test("parses quoted commas and escaped quotes", () => {
  const parsed = parseCsvText('Username,Full Name,Essay [Total Pts: 10 Score]\r\njsmith,"Smith, Jordan","He said ""yes"""\r\n');
  assert.deepEqual(parsed.headers, ["Username", "Full Name", "Essay [Total Pts: 10 Score]"]);
  assert.deepEqual(parsed.rows[0], ["jsmith", "Smith, Jordan", 'He said "yes"']);
});

test("preserves UTF-8 names and detects the encoding", () => {
  const bytes = new TextEncoder().encode("Username,Full Name\nzoe,Zoë Álvarez\n");
  const decoded = decodeCsvBuffer(bytes);
  assert.equal(decoded.encoding, "UTF-8");
  assert.equal(parseCsvText(decoded.text).rows[0][1], "Zoë Álvarez");
});

test("reports duplicate and blank headers", () => {
  const parsed = parseCsvText("Username, username,\njsmith,jsmith,value\n");
  assert.ok(parsed.issues.some((item) => item.code === "duplicate_header"));
  assert.ok(parsed.issues.some((item) => item.code === "blank_header"));
});

test("rejects malformed quoting", () => {
  assert.throws(() => parseCsvText('Username,Grade\njsmith,"92\n'), BlackboardCsvError);
});

test("ignores blank trailing rows but retains data order", () => {
  const parsed = parseCsvText("Username,Grade\nsecond,2\nfirst,1\n\n");
  assert.deepEqual(parsed.rows.map((row) => row[0]), ["second", "first"]);
});

test("detects identity, grade, protected, and unknown columns", () => {
  const parsed = parseCsvText("Student ID,Email,Lab [Total Pts: 50 Score],Weighted Total,Custom Flag\n1,a@example.edu,40,80,Y\n");
  const structure = inspectBlackboardCsv(parsed);
  assert.equal(structure.identityColumns.length, 2);
  assert.equal(structure.gradeColumns.find((column) => column.header.startsWith("Lab")).pointsPossible, 50);
  assert.equal(structure.gradeColumns.find((column) => column.header === "Weighted Total").protected, true);
  assert.ok(structure.unknownColumns.some((column) => column.header === "Custom Flag"));
});

test("retains an external line-item identifier when the provider includes one", () => {
  const parsed = parseCsvText("Username,Lab [Total Pts: 50 Score] | id: _123_1\nstudent,45\n");
  const structure = inspectBlackboardCsv(parsed);
  assert.equal(structure.gradeColumns[0].externalId, "_123_1");
});

test("reports formula-like text without treating a negative number as a formula", () => {
  const parsed = parseCsvText('Username,Note,Grade\na,"=HYPERLINK(""x"")",-5\n');
  assert.equal(parsed.formulaLikeCells, 1);
});

test("neutralizes spreadsheet formulas and safely quotes CSV values", () => {
  assert.equal(neutralizeSpreadsheetFormula("=2+2"), "'=2+2");
  assert.equal(neutralizeSpreadsheetFormula("-5"), "-5");
  assert.equal(csvEscape('Smith, "Jordan"'), '"Smith, ""Jordan"""');
});

test("generates a CSV from the original structure and changes only approved cells", () => {
  const parsed = parseCsvText("Username,Unknown,Grade\nfirst,keep,1\nsecond,also keep,2\n");
  const csv = generateBlackboardCsv(parsed, [{ rowIndex: 1, columnIndex: 2, value: "99" }]);
  assert.equal(csv, "Username,Unknown,Grade\r\nfirst,keep,1\r\nsecond,also keep,99\r\n");
});

test("generated output parses back to the same headers and row order", () => {
  const original = parseCsvText('Username,Full Name,Unknown,Grade\nfirst,"Smith, Jordan","keep ""this""",1\nsecond,Avery,also keep,2\n');
  const generated = generateBlackboardCsv(original, [{ rowIndex: 1, columnIndex: 3, value: "99" }]);
  const reparsed = parseCsvText(generated);
  assert.deepEqual(reparsed.headers, original.headers);
  assert.deepEqual(reparsed.rows.map((row) => row[0]), ["first", "second"]);
  assert.equal(reparsed.rows[0][2], 'keep "this"');
  assert.equal(reparsed.rows[1][3], "99");
});

test("scales and rounds grades", () => {
  assert.equal(scaleGrade({ score: 88, sourceMaximum: 100, targetMaximum: 44, mode: "proportional" }), 38.72);
  assert.equal(scaleGrade({ score: 44, sourceMaximum: 50, mode: "percentage" }), 88);
  assert.equal(scaleGrade({ score: 7.126, sourceMaximum: 10, mode: "raw" }), 7.13);
});
