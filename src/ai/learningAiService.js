import { supabase } from "../supabaseClient.js";

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

async function invokeProfessorTask(taskType, input, { courseId } = {}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user) throw new Error("Sign in with an approved professor account before using governed AI.");

  const context = UUID_PATTERN.test(courseId || "") ? { courseId } : undefined;
  const { data, error } = await supabase.functions.invoke(routerFunction, {
    body: {
      apiVersion: LEARNING_AI_API_VERSION,
      taskType,
      input,
      ...(context ? { context } : {}),
    },
  });

  if (error) throw new Error(await messageFromInvocationError(error, data));
  if (!data || data.status !== "human_review_required" || data.humanReviewRequired !== true) {
    throw new Error(data?.message || "The AI router did not return a professor-reviewable draft.");
  }
  if (!data.artifact || !data.provenance) {
    throw new Error("The AI router response is missing its artifact or provenance record.");
  }
  return data;
}

export function generateProfessorCourseOutline(input, options = {}) {
  return invokeProfessorTask("course_outline", input, options);
}

export function interpretUncertainSyllabusSections(input, options = {}) {
  return invokeProfessorTask("syllabus_uncertain_extraction", input, options);
}