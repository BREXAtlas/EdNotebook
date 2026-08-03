import assert from "node:assert/strict";
import test from "node:test";
import {
  DIGITAL_LITERACY_COURSE_KEY,
  DIGITAL_LITERACY_PROGRESS_MESSAGE,
  DIGITAL_LITERACY_RELEASE_ID,
  assignmentProgressSummary,
  buildCanonicalUnitUrl,
  firstOpenUnit,
  groupCanonicalUnits,
  instrumentQuestions,
  isCanonicalProgressMessage,
  normalizeEmbeddedProgress,
} from "./digitalLiteracyPilotModel.js";

test("canonical unit links remain inside the governed EdNotebook embed contract", () => {
  const url = new URL(
    buildCanonicalUnitUrl({
      assignment: {
        assignment_id: "11111111-1111-4111-8111-111111111111",
        source_home: "https://brexatlas.github.io/Digital-Literacy-Course/",
      },
      unit: { relative_url: "foundations.html#ep01" },
      parentOrigin: "https://ednotebook.com",
    }),
  );
  assert.equal(url.origin, "https://brexatlas.github.io");
  assert.equal(url.pathname, "/Digital-Literacy-Course/foundations.html");
  assert.equal(url.hash, "#ep01");
  assert.equal(url.searchParams.get("embedded"), "1");
  assert.equal(
    url.searchParams.get("ednotebook_origin"),
    "https://ednotebook.com",
  );
});

test("progress messages require the canonical origin, frame, course, and release", () => {
  const frame = {};
  const event = {
    origin: "https://brexatlas.github.io",
    source: frame,
    data: {
      type: DIGITAL_LITERACY_PROGRESS_MESSAGE,
      releaseId: DIGITAL_LITERACY_RELEASE_ID,
      courseKey: DIGITAL_LITERACY_COURSE_KEY,
    },
  };
  assert.equal(isCanonicalProgressMessage(event, frame), true);
  assert.equal(
    isCanonicalProgressMessage(
      { ...event, origin: "https://example.test" },
      frame,
    ),
    false,
  );
  assert.equal(
    isCanonicalProgressMessage({ ...event, source: {} }, frame),
    false,
  );
  assert.equal(
    isCanonicalProgressMessage(
      { ...event, data: { ...event.data, releaseId: "old" } },
      frame,
    ),
    false,
  );
  const nextReleaseEvent = {
    ...event,
    data: { ...event.data, releaseId: "2026.08.15.1" },
  };
  assert.equal(
    isCanonicalProgressMessage(nextReleaseEvent, frame, "2026.08.15.1"),
    true,
  );
  assert.equal(
    isCanonicalProgressMessage(
      nextReleaseEvent,
      frame,
      DIGITAL_LITERACY_RELEASE_ID,
    ),
    false,
  );
});

test("the two real course paths normalize into separate evidence writes", () => {
  const rows = normalizeEmbeddedProgress({
    progress: {
      foundations: { completedNodeIds: ["ep01"], stars: { ep01: 3 } },
      aiQuest: { completedNodeIds: ["q01"], stars: { q01: 2 } },
    },
  });
  assert.deepEqual(rows, [
    { path: "foundations", completedNodeIds: ["ep01"], stars: { ep01: 3 } },
    { path: "ai-quest", completedNodeIds: ["q01"], stars: { q01: 2 } },
  ]);
});

test("assignment evidence selects the first unfinished canonical unit", () => {
  const assignment = {
    units: [
      { unit_id: "ep01", completed: true },
      { unit_id: "ep02", completed: false },
      { unit_id: "q01", completed: false },
    ],
  };
  assert.deepEqual(assignmentProgressSummary(assignment), {
    completed: 1,
    total: 3,
    percent: 33,
  });
  assert.equal(firstOpenUnit(assignment).unit_id, "ep02");
});

test("catalog groups preserve Foundations before AI Quest", () => {
  const groups = groupCanonicalUnits([
    { unit_id: "q01", path: "ai-quest", group_number: 1, group_title: "Quest" },
    {
      unit_id: "ep01",
      path: "foundations",
      group_number: 1,
      group_title: "Foundation",
    },
  ]);
  assert.deepEqual(
    groups.map((group) => group.path),
    ["foundations", "ai-quest"],
  );
});

test("approved instrument definitions drive the response form", () => {
  assert.deepEqual(
    instrumentQuestions({
      definition: {
        questions: [{ key: "confidence", label: "Confidence", type: "number" }],
      },
    }),
    [
      {
        key: "confidence",
        label: "Confidence",
        help: "",
        type: "number",
        options: [],
        required: true,
      },
    ],
  );
});
