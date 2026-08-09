import assert from "node:assert/strict";
import test from "node:test";
import {
  EARLY_PREP_DIVISION,
  EARLY_PREP_SUBJECTS,
  EARLY_PREP_WORKSPACE_VERSION,
  earlyPrepAssignmentStarter,
  earlyPrepAdapterConfig,
  earlyPrepSubjectLabel,
  earlyPrepWorkspaceConfig,
  isEarlyPrepSubject,
} from "./subjectCatalog.js";

test("Early Prep keeps the existing internal k12 identifier and exactly eleven stable subjects", () => {
  assert.equal(EARLY_PREP_DIVISION, "k12");
  assert.equal(EARLY_PREP_SUBJECTS.length, 11);
  assert.equal(new Set(EARLY_PREP_SUBJECTS.map(({ id }) => id)).size, 11);
  assert.equal(earlyPrepSubjectLabel("financial-literacy-personal-finance"), "Financial Literacy / Personal Finance");
});

test("subject adapter identity remains stable for workspace configuration", () => {
  const config = earlyPrepAdapterConfig("mathematics");
  assert.deepEqual(config, {
    adapterKey: "math",
    subjectId: "mathematics",
    standardsAuthority: "Texas Education Agency",
    standardsLabel: "TEKS: Mathematics",
    status: "configuration-ready",
  });
  assert.equal(isEarlyPrepSubject("general"), false);
});

test("all eleven governed subjects now have versioned teacher and student workspace adapters", () => {
  const configs = EARLY_PREP_SUBJECTS.map(({ id }) => earlyPrepWorkspaceConfig(id));
  assert.equal(configs.length, 11);
  assert.ok(configs.every(Boolean));
  assert.ok(configs.every((config) => config.version === EARLY_PREP_WORKSPACE_VERSION));
  assert.ok(configs.every((config) => config.tools.length >= 4));
  assert.ok(configs.every((config) => config.workflow.length >= 4));
  assert.equal(new Set(configs.map((config) => config.subjectId)).size, 11);
});

test("subject starters persist stable adapter metadata and editable evidence prompts", () => {
  const math = earlyPrepAssignmentStarter("mathematics");
  assert.deepEqual(math.editorConfig.subject_workspace, {
    subject_id: "mathematics",
    adapter_key: "math",
    version: EARLY_PREP_WORKSPACE_VERSION,
  });
  assert.match(JSON.stringify(math.sections), /equation, graph, or model/iu);
  assert.match(JSON.stringify(math.sections), /units/iu);

  const science = earlyPrepAssignmentStarter("science");
  assert.match(JSON.stringify(science.sections), /variables, controls/iu);
  assert.match(JSON.stringify(science.sections), /safety/iu);

  for (const { id } of EARLY_PREP_SUBJECTS) {
    const starter = earlyPrepAssignmentStarter(id);
    assert.equal(starter.subjectId, id);
    assert.ok(starter.sections.length >= 3);
    assert.ok(starter.sections.every((section) => section.type && section.prompt && section.helpText));
  }
});

test("subject workspaces contain no commerce or payment operations", () => {
  const serialized = JSON.stringify(EARLY_PREP_SUBJECTS.map(({ id }) => earlyPrepWorkspaceConfig(id)));
  assert.doesNotMatch(serialized, /checkout|marketplace|payout|seller onboarding|payment processing/iu);
  assert.equal(earlyPrepWorkspaceConfig("university-general"), null);
  assert.equal(earlyPrepAssignmentStarter("university-general"), null);
});
