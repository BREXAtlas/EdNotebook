import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const LOCAL_PREFIX = "ednotebook-course-publication-";

function randomCode(prefix = "course") {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (value) => value.toString(36).padStart(2, "0")).join("")}`;
}

function safeText(value, limit, fallback = "") {
  return String(value ?? fallback).slice(0, limit);
}

function safeLesson(value) {
  const lesson = value && typeof value === "object" ? value : {};
  return {
    sections: (Array.isArray(lesson.sections) ? lesson.sections : []).slice(0, 100).map((section) => ({
      heading: safeText(section?.heading, 220, "Section"),
      body: safeText(section?.body, 10_000),
    })),
    knowledgeChecks: (Array.isArray(lesson.knowledgeChecks) ? lesson.knowledgeChecks : []).slice(0, 100).map((check) => {
      const options = (Array.isArray(check?.options) ? check.options : []).slice(0, 12).map((option) => safeText(option, 500));
      return {
        after: Math.max(0, Math.min(99, Number(check?.after) || 0)),
        q: safeText(check?.q, 1_000, "Check your understanding"),
        options,
        answer: Math.max(0, Math.min(Math.max(0, options.length - 1), Number(check?.answer) || 0)),
        why: safeText(check?.why, 2_000),
      };
    }),
  };
}

export function safeAppearance(value) {
  const appearance = value && typeof value === "object" ? value : {};
  const color = (candidate, fallback) => /^#[0-9a-f]{6}$/iu.test(String(candidate || "")) ? String(candidate) : fallback;
  const allowedFonts = new Set(["Notebook", "Clean", "Friendly", "Classic"]);
  return {
    accent: color(appearance.accent, "#1d4ed8"),
    background: color(appearance.background, "#f6f7fb"),
    font: allowedFonts.has(appearance.font) ? appearance.font : "Notebook",
  };
}

function safeCoursePayload(course, lessons) {
  const acts = (Array.isArray(course?.acts) ? course.acts : []).slice(0, 30).map((act) => ({
    title: String(act?.title || "Unit").slice(0, 180),
    episodes: (Array.isArray(act?.episodes) ? act.episodes : []).slice(0, 60).map((episode) => ({
      id: String(episode?.id || randomCode("lesson")).slice(0, 100),
      title: String(episode?.title || "Lesson").slice(0, 220),
      type: String(episode?.type || "Lesson").slice(0, 40),
      minutes: Math.max(1, Math.min(600, Number(episode?.minutes) || 20)),
    })),
  }));
  const currentLessonIds = new Set(acts.flatMap((act) => act.episodes).map((episode) => episode.id));
  const safeLessons = Object.fromEntries(Object.entries(lessons && typeof lessons === "object" ? lessons : {})
    .map(([id, lesson]) => [safeText(id, 100), lesson])
    .filter(([id]) => currentLessonIds.has(id))
    .slice(0, 500)
    .map(([id, lesson]) => [id, safeLesson(lesson)]));

  return {
    courseTitle: String(course?.courseTitle || "Untitled course").slice(0, 180),
    subtitle: String(course?.subtitle || "").slice(0, 300),
    templateKey: String(course?.templateKey || "ramready").slice(0, 40),
    acts,
    lessons: safeLessons,
  };
}

function storeLocalPublication(publication) {
  window.localStorage.setItem(`${LOCAL_PREFIX}${publication.share_code}`, JSON.stringify(publication));
}

export async function publishCourse({ courseId, course, lessons, appearance, accessMode = "unlisted" }) {
  const shareCode = randomCode("learn");
  const content = safeCoursePayload(course, lessons);
  const localPublication = {
    share_code: shareCode,
    course_id: courseId || null,
    title: content.courseTitle,
    subtitle: content.subtitle,
    content_json: content,
    appearance_json: safeAppearance(appearance),
    access_mode: accessMode,
    allows_guest_checks: true,
    status: "published",
    published_at: new Date().toISOString(),
    local_only: true,
  };

  if (!isSupabaseConfigured || !supabase || !courseId) {
    storeLocalPublication(localPublication);
    return localPublication;
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in before broadcasting a course.");
  const { data, error } = await supabase.from("course_publications").upsert({
    course_id: courseId,
    owner_id: userData.user.id,
    share_code: shareCode,
    title: content.courseTitle,
    subtitle: content.subtitle,
    content_json: content,
    appearance_json: safeAppearance(appearance),
    access_mode: accessMode,
    allows_guest_checks: true,
    status: "published",
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "course_id" }).select().single();
  if (error) throw error;
  storeLocalPublication({ ...data, local_only: false });
  return data;
}

export async function loadPublicCourse(shareCode) {
  const normalized = String(shareCode || "").replace(/[^a-z0-9-]/gi, "").slice(0, 80);
  if (!normalized) return null;
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("get_course_publication", { p_share_code: normalized });
    if (!error && data) return data;
  }
  try { return JSON.parse(window.localStorage.getItem(`${LOCAL_PREFIX}${normalized}`) || "null"); } catch { return null; }
}

export async function createCourseJoinLink(courseId) {
  if (!courseId || !isSupabaseConfigured || !supabase) throw new Error("Save this course to your account before creating an enrollment link.");
  const { data, error } = await supabase.rpc("create_course_join_link", { p_course_id: courseId });
  if (error) throw error;
  return data;
}

export async function claimCourseJoinLink(token) {
  if (!token || !isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("claim_course_join_link", { p_token: token });
  if (error) throw error;
  return data;
}

export { safeCoursePayload };
