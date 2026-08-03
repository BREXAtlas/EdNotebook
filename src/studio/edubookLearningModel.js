export const EDUBOOK_LEARNING_VERSION = "EduBookLearning/1.0";

function cleanText(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function stableId(prefix = "item") {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function emptyEduBookLearningLayer() {
  return {
    schemaVersion: EDUBOOK_LEARNING_VERSION,
    chapters: [],
    finalQuiz: [],
  };
}

function normalizeQuestion(question = {}) {
  const options = Array.isArray(question.options)
    ? question.options.map((option) => cleanText(option, 500)).filter(Boolean).slice(0, 6)
    : [];
  return {
    id: cleanText(question.id, 120) || stableId("question"),
    prompt: cleanText(question.prompt, 1000),
    options,
    ...(question.correctAnswer !== undefined
      ? { correctAnswer: cleanText(question.correctAnswer, 500) }
      : {}),
    ...(question.explanation !== undefined
      ? { explanation: cleanText(question.explanation, 2000) }
      : {}),
  };
}

function normalizeDiscussionPrompt(prompt = {}) {
  return {
    id: cleanText(prompt.id, 120) || stableId("discussion"),
    prompt: cleanText(prompt.prompt, 2000),
  };
}

export function normalizeEduBookLearningLayer(layer) {
  const source = layer && typeof layer === "object" ? layer : emptyEduBookLearningLayer();
  return {
    schemaVersion: EDUBOOK_LEARNING_VERSION,
    chapters: (Array.isArray(source.chapters) ? source.chapters : []).map((chapter) => ({
      chapterId: cleanText(chapter.chapterId, 160),
      knowledgeChecks: (Array.isArray(chapter.knowledgeChecks) ? chapter.knowledgeChecks : [])
        .map(normalizeQuestion),
      discussionPrompts: (Array.isArray(chapter.discussionPrompts) ? chapter.discussionPrompts : [])
        .map(normalizeDiscussionPrompt),
    })).filter((chapter) => chapter.chapterId),
    finalQuiz: (Array.isArray(source.finalQuiz) ? source.finalQuiz : []).map(normalizeQuestion),
  };
}

export function learningLayerFromManifest(manifest) {
  return normalizeEduBookLearningLayer(manifest?.learningLayer);
}

export function chapterLearningLayer(layer, chapterId) {
  const normalized = normalizeEduBookLearningLayer(layer);
  return normalized.chapters.find((chapter) => chapter.chapterId === chapterId) || {
    chapterId,
    knowledgeChecks: [],
    discussionPrompts: [],
  };
}

function replaceChapter(layer, chapterId, update) {
  const normalized = normalizeEduBookLearningLayer(layer);
  const current = chapterLearningLayer(normalized, chapterId);
  const nextChapter = update(current);
  const chapters = normalized.chapters.some((chapter) => chapter.chapterId === chapterId)
    ? normalized.chapters.map((chapter) => chapter.chapterId === chapterId ? nextChapter : chapter)
    : [...normalized.chapters, nextChapter];
  return { ...normalized, chapters };
}

export function addEduBookQuestion(layer, {
  chapterId,
  destination = "knowledgeChecks",
  prompt,
  options,
  correctAnswer,
  explanation = "",
}) {
  const question = normalizeQuestion({
    id: stableId(destination === "finalQuiz" ? "quiz" : "check"),
    prompt,
    options,
    correctAnswer,
    explanation,
  });
  if (!question.prompt || question.options.length < 2 || !question.options.includes(question.correctAnswer)) {
    throw new Error("Add a question, at least two answer choices, and select the correct answer.");
  }
  if (destination === "finalQuiz") {
    const normalized = normalizeEduBookLearningLayer(layer);
    return { ...normalized, finalQuiz: [...normalized.finalQuiz, question] };
  }
  if (!chapterId) throw new Error("Choose a chapter for this knowledge check.");
  return replaceChapter(layer, chapterId, (chapter) => ({
    ...chapter,
    knowledgeChecks: [...chapter.knowledgeChecks, question],
  }));
}

export function addEduBookDiscussionPrompt(layer, { chapterId, prompt }) {
  const discussion = normalizeDiscussionPrompt({ id: stableId("discussion"), prompt });
  if (!chapterId || !discussion.prompt) throw new Error("Choose a chapter and add a discussion prompt.");
  return replaceChapter(layer, chapterId, (chapter) => ({
    ...chapter,
    discussionPrompts: [...chapter.discussionPrompts, discussion],
  }));
}

export function removeEduBookLearningItem(layer, { chapterId, collection, itemId }) {
  const normalized = normalizeEduBookLearningLayer(layer);
  if (collection === "finalQuiz") {
    return { ...normalized, finalQuiz: normalized.finalQuiz.filter((item) => item.id !== itemId) };
  }
  return replaceChapter(normalized, chapterId, (chapter) => ({
    ...chapter,
    [collection]: (chapter[collection] || []).filter((item) => item.id !== itemId),
  }));
}

export function eduBookCompletionReadiness(layer, interactionState = {}) {
  const normalized = normalizeEduBookLearningLayer(layer);
  const answers = interactionState?.answers && typeof interactionState.answers === "object"
    ? interactionState.answers
    : {};
  const questions = [
    ...normalized.chapters.flatMap((chapter) => chapter.knowledgeChecks),
    ...normalized.finalQuiz,
  ];
  const answered = questions.filter((question) => cleanText(answers[question.id], 500)).length;
  return {
    total: questions.length,
    answered,
    remaining: Math.max(questions.length - answered, 0),
    ready: answered === questions.length,
  };
}

export function withEduBookAnswer(interactionState = {}, questionId, answer) {
  return {
    ...interactionState,
    answers: {
      ...(interactionState.answers || {}),
      [questionId]: cleanText(answer, 500),
    },
  };
}

export function withEduBookDiscussionResponse(interactionState = {}, promptId, response) {
  return {
    ...interactionState,
    discussionResponses: {
      ...(interactionState.discussionResponses || {}),
      [promptId]: String(response || "").slice(0, 5000),
    },
  };
}
