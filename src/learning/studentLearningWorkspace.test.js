import test from "node:test";
import assert from "node:assert/strict";
import {
  DIGITAL_LITERACY_SYNTHETIC_CONTEXT,
  PACKET_SCHEMA,
  appendRecord,
  buildLearningPacket,
  courseSelectionKey,
  createVersionedRecord,
  latestRecords,
  migrateLegacyStudentNotes,
  mergeRestoreManifest,
  reconcileCourseContext,
  recordMatchesQuery,
  selectableCourseContexts,
  shouldLoadPrivateCloudRecords,
  validateRestoreManifest,
} from "./studentLearningWorkspace.js";

const now = new Date("2026-07-29T04:00:00.000Z");

test("notes retain append-only lineage and teach predictable file names", () => {
  const first = createVersionedRecord({
    kind: "note",
    content: { title: "Source check", body: "Check author, evidence, and date." },
    context: { courseCode: "DIGL-101", courseTitle: "Digital Literacy", lessonId: "source-check", lessonTitle: "Check a source" },
    now,
  });
  const second = createVersionedRecord({
    kind: "note",
    content: { title: "Source check", body: "Also compare independent reporting." },
    context: first,
    previous: first,
    now: new Date("2026-07-29T05:00:00.000Z"),
  });
  const records = appendRecord(appendRecord([], first), second);

  assert.equal(second.version, 2);
  assert.equal(second.previousVersionId, first.id);
  assert.equal(second.rootId, first.rootId);
  assert.match(first.filename, /^2026-07-29_digl-101_note_source-check_v01\.md$/u);
  assert.equal(latestRecords(records, "note")[0].id, second.id);
  assert.equal(recordMatchesQuery(second, "independent reporting"), true);
  assert.throws(() => appendRecord(records, { ...second, id: "different-id" }), /version already exists/iu);
});

test("portable packet contains selected records, file manifest, and restore schema", () => {
  const note = createVersionedRecord({
    kind: "note",
    content: { title: "Evaluation notes", body: "Lateral reading means leaving the page to compare sources." },
    context: DIGITAL_LITERACY_SYNTHETIC_CONTEXT,
    now,
  });
  const packet = buildLearningPacket({
    course: DIGITAL_LITERACY_SYNTHETIC_CONTEXT,
    records: [note],
    selectedRecordIds: [note.id],
    files: [{ id: "file-1", originalName: "worksheet.docx", safeName: "2026-07-29_digl-101_student-file_worksheet_v01.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 1240, createdAt: now.toISOString() }],
    exportedAt: now,
  });

  assert.equal(packet.manifest.schema, PACKET_SCHEMA);
  assert.equal(packet.manifest.records.length, 1);
  assert.equal(packet.manifest.files.length, 1);
  assert.match(packet.html, /Lateral reading/u);
  assert.match(packet.html, /opens without EdNotebook/u);
  assert.equal(validateRestoreManifest(packet.manifest).ok, true);
});

test("restore adds records without overwriting an existing version", () => {
  const local = createVersionedRecord({
    kind: "feedback",
    content: { title: "Instructor feedback", body: "Explain why the source is credible." },
    context: DIGITAL_LITERACY_SYNTHETIC_CONTEXT,
    now,
  });
  const manifest = {
    schema: PACKET_SCHEMA,
    records: [{ ...local, id: "imported-id", content: { ...local.content, body: "Add evidence." } }],
  };
  const result = mergeRestoreManifest([local], manifest);
  const versions = result.records.filter((record) => record.rootId === local.rootId);
  assert.equal(result.imported, 1);
  assert.equal(versions.length, 2);
  assert.deepEqual(versions.map((record) => record.version).sort(), [1, 2]);
});

test("Digital Literacy fixture is clearly synthetic", () => {
  assert.equal(DIGITAL_LITERACY_SYNTHETIC_CONTEXT.synthetic, true);
  assert.equal(DIGITAL_LITERACY_SYNTHETIC_CONTEXT.courseTitle, "Digital Literacy");
  assert.ok(DIGITAL_LITERACY_SYNTHETIC_CONTEXT.lessons.length >= 3);
});

test("course selection uses unique course ids instead of duplicate display codes", () => {
  const options = selectableCourseContexts([
    { id: "course-fall-a", code: "ENG-101", title: "Writing Seminar" },
    { id: "course-fall-b", code: "ENG-101", title: "Writing Seminar" },
  ]);
  const first = options.find((course) => course.courseId === "course-fall-a");
  const second = options.find((course) => course.courseId === "course-fall-b");

  assert.notEqual(courseSelectionKey(first), courseSelectionKey(second));
  assert.equal(courseSelectionKey(first), "course:course-fall-a");
  assert.equal(
    reconcileCourseContext(second, options).courseId,
    "course-fall-b",
  );
});

test("a real Digital Literacy course replaces stale synthetic context before save", () => {
  const initialOptions = selectableCourseContexts([]);
  const synthetic = reconcileCourseContext(null, initialOptions);
  const liveOptions = selectableCourseContexts([
    DIGITAL_LITERACY_SYNTHETIC_CONTEXT,
    {
      id: "course-digital-literacy-live",
      code: "DIGL-101",
      title: "Digital Literacy",
      lessons: [{ id: "live-source-check", title: "Evaluate a source" }],
    },
  ]);
  const reconciled = reconcileCourseContext(synthetic, liveOptions);
  const record = createVersionedRecord({
    kind: "note",
    content: { title: "Live course note", body: "This belongs to the enrolled course." },
    context: reconciled,
    now,
  });

  assert.equal(synthetic.synthetic, true);
  assert.equal(synthetic.courseId, null);
  assert.equal(liveOptions.length, 1);
  assert.equal(reconciled.synthetic, false);
  assert.equal(reconciled.courseId, "course-digital-literacy-live");
  assert.equal(record.courseId, "course-digital-literacy-live");
});

test("live display rows without a unique id cannot become save targets", () => {
  const options = selectableCourseContexts([
    { code: "DIGL-101", title: "Digital Literacy" },
  ]);

  assert.equal(options.length, 1);
  assert.equal(options[0].synthetic, true);
  assert.equal(courseSelectionKey(options[0]), "synthetic:digl-101::digital literacy");
});

test("private cloud records load only after the signed-in student selects cloud mode", () => {
  assert.equal(shouldLoadPrivateCloudRecords("device", "student-1"), false);
  assert.equal(shouldLoadPrivateCloudRecords("cloud", null), false);
  assert.equal(shouldLoadPrivateCloudRecords("cloud", "student-1"), true);
});

test("legacy student notes migrate once without deleting the original device copy", () => {
  const values = new Map([
    ["ednotebook-university-student-abc-student-notes", JSON.stringify([
      { id: "old-1", course: "DIGL-101", body: "A note that already existed before the learning workspace.", createdAt: now.toISOString() },
    ])],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const first = migrateLegacyStudentNotes(storage, "student-abc", "university", []);
  const second = migrateLegacyStudentNotes(storage, "student-abc", "university", first.records);

  assert.equal(first.imported, 1);
  assert.equal(second.imported, 0);
  assert.equal(second.records[0].content.migratedFrom, "student-notes-v1");
  assert.ok(storage.getItem("ednotebook-university-student-abc-student-notes"));
});
