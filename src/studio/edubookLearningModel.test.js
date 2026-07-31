import assert from "node:assert/strict";
import test from "node:test";
import {
  addEduBookDiscussionPrompt,
  addEduBookQuestion,
  eduBookCompletionReadiness,
  emptyEduBookLearningLayer,
  normalizeEduBookLearningLayer,
  removeEduBookLearningItem,
  withEduBookAnswer,
  withEduBookDiscussionResponse,
} from "./edubookLearningModel.js";

test("professor teaching items stay separate from source chapters", () => {
  const sourceChapter = {
    id: "chapter-one",
    title: "Finding credible information",
    blocks: [{ id: "source-one", type: "paragraph", text: "The source text stays unchanged." }],
  };
  let layer = addEduBookQuestion(emptyEduBookLearningLayer(), {
    chapterId: sourceChapter.id,
    prompt: "Which action best verifies a source?",
    options: ["Check its evidence", "Trust the first result", "Skip the author"],
    correctAnswer: "Check its evidence",
    explanation: "Verification follows the evidence and author context.",
  });
  layer = addEduBookDiscussionPrompt(layer, {
    chapterId: sourceChapter.id,
    prompt: "Describe one signal you use before sharing a source.",
  });
  layer = addEduBookQuestion(layer, {
    destination: "finalQuiz",
    prompt: "What should happen before sharing a claim?",
    options: ["Verify it", "Repeat it"],
    correctAnswer: "Verify it",
  });

  assert.equal(sourceChapter.blocks[0].text, "The source text stays unchanged.");
  assert.equal(layer.chapters[0].knowledgeChecks.length, 1);
  assert.equal(layer.chapters[0].discussionPrompts.length, 1);
  assert.equal(layer.finalQuiz.length, 1);
});

test("student readiness counts chapter checks and the final quiz without scoring in the browser", () => {
  const layer = normalizeEduBookLearningLayer({
    chapters: [{
      chapterId: "chapter-one",
      knowledgeChecks: [{ id: "check-one", prompt: "Choose one", options: ["A", "B"] }],
      discussionPrompts: [],
    }],
    finalQuiz: [{ id: "quiz-one", prompt: "Finish one", options: ["Yes", "No"] }],
  });
  let interaction = withEduBookAnswer({}, "check-one", "A");
  interaction = withEduBookDiscussionResponse(interaction, "discussion-one", "A private reflection draft.");
  assert.deepEqual(eduBookCompletionReadiness(layer, interaction), {
    total: 2,
    answered: 1,
    remaining: 1,
    ready: false,
  });
  interaction = withEduBookAnswer(interaction, "quiz-one", "Yes");
  assert.equal(eduBookCompletionReadiness(layer, interaction).ready, true);
  assert.equal(interaction.discussionResponses["discussion-one"], "A private reflection draft.");
});

test("a professor can remove one teaching item without deleting the chapter layer", () => {
  const layer = normalizeEduBookLearningLayer({
    chapters: [{
      chapterId: "chapter-one",
      knowledgeChecks: [{ id: "keep", prompt: "Keep this", options: ["A", "B"] }, { id: "remove", prompt: "Remove this", options: ["A", "B"] }],
      discussionPrompts: [{ id: "discussion", prompt: "Keep this discussion" }],
    }],
    finalQuiz: [],
  });
  const next = removeEduBookLearningItem(layer, {
    chapterId: "chapter-one",
    collection: "knowledgeChecks",
    itemId: "remove",
  });
  assert.deepEqual(next.chapters[0].knowledgeChecks.map((item) => item.id), ["keep"]);
  assert.equal(next.chapters[0].discussionPrompts.length, 1);
});
