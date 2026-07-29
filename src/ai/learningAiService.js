import { supabase } from "../supabaseClient.js";
import { identifyGovernedUncertaintyFieldKeys } from "./syllabusGovernedReview.js";

export const LEARNING_AI_API_VERSION = "2026-07-24";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FUNCTION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;
const configuredRouterFunction = String(import.meta.env.VITE_AI_ROUTER_FUNCTION || "").trim();
const routerFunction = FUNCTION_SLUG_PATTERN.test(configuredRouterFunction)
  ? configuredRouterFunction
  : "ai-learning-router";

async function messageFromInvocationError(error, data) {
  if (data?.message) return data.message;
  if (error?.context instanceof Response) {
    try {
      const body = await error.context.clone().json();
      if (body?.message) return body.message;
    } catch {
      // The response body may be empty or non-JSON. Use the safe fallback below.
    }
  }
  return error?.message || "The governed AI request could not be completed.";
}

function governedSyllabusInput(input) {
  const uncertainFieldKeys = identifyGovernedUncertaintyFieldKeys(
    input?.uncertainSections,
  );
  if (!uncertainFieldKeys.length) {
    throw new Error(
      "The uncertain syllabus passage could not be tied to an approved requirement field. No AI request was sent.",
    );
  }

  const deterministicFields =
    input?.deterministicFields &&
    typeof input.deterministicFields === "object" &&
    !Array.isArray(input.deterministicFields)
      ? input.deterministicFields
      : {};
  const profile =
    deterministicFields._requirementProfile &&
    typeof deterministicFields._requirementProfile === "object" &&
    !Array.isArray(deterministicFields._requirementProfile)
      ? deterministicFields._requirementProfile
      : null;
  const definitions = Array.isArray(profile?.fields) ? profile.fields : [];
  const uncertainKeySet = new Set(uncertainFieldKeys);
  const approvedDefinitions = definitions.filter(
    (definition) =>
      definition &&
      typeof definition === "object" &&
      uncertainKeySet.has(definition.key),
  );
  const approvedKeys = new Set(
    approvedDefinitions.map((definition) => definition.key),
  );
  if (uncertainFieldKeys.some((key) => !approvedKeys.has(key))) {
    throw new Error(
      "The uncertain syllabus passage referenced a field outside the approved requirement profile. No AI request was sent.",
    );
  }

  return {
    ...input,
    deterministicFields: {
      ...deterministicFields,
      _requirementProfile: {
        ...profile,
        uncertainFieldKeys,
        fields: approvedDefinitions,
      },
    },
  };
}

async function invokeGovernedTask(
  taskType,
  input,
  { courseId, institutionId, reviewer = "professor" } = {},
) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user) {
    throw new Error(
      `Sign in with an approved ${reviewer} account before using governed AI.`,
    );
  }

  const context = {
    ...(UUID_PATTERN.test(institutionId || "") ? { institutionId } : {}),
    ...(UUID_PATTERN.test(courseId || "") ? { courseId } : {}),
  };
  const { data, error } = await supabase.functions.invoke(routerFunction, {
    body: {
      apiVersion: LEARNING_AI_API_VERSION,
      taskType,
      input,
      ...(Object.keys(context).length ? { context } : {}),
    },
  });

  if (error) throw new Error(await messageFromInvocationError(error, data));
  if (!data || data.status !== "human_review_required" || data.humanReviewRequired !== true) {
    throw new Error(
      data?.message ||
        `The AI router did not return a ${reviewer}-reviewable draft.`,
    );
  }
  if (!data.artifact || !data.provenance) {
    throw new Error("The AI router response is missing its artifact or provenance record.");
  }
  return data;
}

export function generateProfessorCourseOutline(input, options = {}) {
  return invokeGovernedTask("course_outline", input, options);
}

export function interpretUncertainSyllabusSections(input, options = {}) {
  return invokeGovernedTask(
    "syllabus_uncertain_extraction",
    governedSyllabusInput(input),
    options,
  );
}

export function interpretStudentSemesterSections(input, options = {}) {
  return invokeGovernedTask("student_semester_extraction", input, {
    ...options,
    reviewer: "student",
  });
}

export function generateProfessorLesson(input, options = {}) {
  if (
    !UUID_PATTERN.test(options.institutionId || "")
    || !UUID_PATTERN.test(options.courseId || "")
  ) {
    throw new Error(
      "Lesson generation requires an approved institution and cloud course context.",
    );
  }
  if (options.courseId !== input?.course?.courseId) {
    throw new Error(
      "The selected lesson does not match the authorized cloud course context.",
    );
  }
  return invokeGovernedTask("lesson", input, options);
}

export function generateProfessorContentUnit(
  taskType,
  input,
  options = {},
) {
  if (
    ![
      "lesson_section",
      "activity",
      "discussion_prompt",
      "knowledge_check",
    ].includes(taskType)
  ) {
    throw new Error("Select an approved lesson content-unit task.");
  }
  if (
    !UUID_PATTERN.test(options.institutionId || "")
    || !UUID_PATTERN.test(options.courseId || "")
  ) {
    throw new Error(
      "Content-unit generation requires an approved institution and cloud course context.",
    );
  }
  if (
    options.courseId !== input?.lessonContract?.course?.courseId
    || options.courseId !== input?.currentLesson?.courseId
  ) {
    throw new Error(
      "The selected content unit does not match the authorized cloud course context.",
    );
  }
  return invokeGovernedTask(taskType, input, options);
}
