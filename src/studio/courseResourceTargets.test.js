import assert from "node:assert/strict";
import test from "node:test";
import { lessonTargetsFromManifest } from "./courseResourceTargets.js";

test("published course manifests expose exact lesson and knowledge-check targets", () => {
  const lessons = lessonTargetsFromManifest({
    paths: [{
      id: "information-literacy",
      label: "Information Literacy",
      nodes: [{
        id: "lesson-evaluating-online-information",
        title: "Evaluating Online Information",
        knowledgeChecks: [{ id: "check-corroboration", question: "What does corroboration add?" }],
      }],
    }],
  });

  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].pathLabel, "Information Literacy");
  assert.equal(lessons[0].id, "lesson-evaluating-online-information");
  assert.equal(lessons[0].knowledgeChecks[0].id, "check-corroboration");
});

test("malformed or empty manifests do not invent media learning targets", () => {
  assert.deepEqual(lessonTargetsFromManifest(), []);
  assert.deepEqual(lessonTargetsFromManifest({ paths: [{ nodes: [{ title: "Missing id" }] }] }), []);
});
