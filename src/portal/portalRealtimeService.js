import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const COURSE_SELECT = "id,owner_id,title,course_code,subject,audience,teaching_window,status,education_division,created_at,updated_at";
const ASSIGNMENT_SELECT = "id,course_id,professor_id,title,instructions,due_at,status,syllabus_section,learner_preview,settings,created_at,updated_at";
const ANNOUNCEMENT_SELECT = "id,professor_id,institution_id,course_id,audience,title,body,is_published,published_at,created_at,updated_at";
const MESSAGE_SELECT = "id,course_id,sender_id,sender_label,body,attachment_resource_id,created_at";
const STUDENT_POST_SELECT = "id,group_id,author_id,post_type,body,shared_grade_summary,created_at,updated_at";
const COURSE_STATUSES = new Set(["draft", "review", "published", "archived"]);
const ASSIGNMENT_STATUSES = new Set(["draft", "review", "published", "closed", "archived"]);
const EDUCATION_DIVISIONS = new Set(["university", "k12"]);
const STUDENT_POST_TYPES = new Set(["update", "progress", "reward", "tip", "highlight"]);

let channelSequence = 0;

function connectedClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Live course updates are not connected to Supabase.");
  }
  return supabase;
}

export function isPortalUuid(value) {
  const candidate = String(value || "").trim();
  return UUID_PATTERN.test(candidate) && candidate.toLowerCase() !== NIL_UUID;
}

function requireUuid(value, label) {
  const candidate = String(value || "").trim();
  if (!isPortalUuid(candidate)) throw new Error(`${label} must be a valid ID.`);
  return candidate.toLowerCase();
}

function requiredText(value, label, maxLength) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength.toLocaleString()} characters or fewer.`);
  return text;
}

function optionalText(value, label, maxLength) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength.toLocaleString()} characters or fewer.`);
  return text;
}

function optionalTimestamp(value, label) {
  if (value == null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return parsed.toISOString();
}

function plainObject(value, label) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function boundedLimit(value, fallback = 30, maximum = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(parsed)));
}

function checkedChoice(value, allowed, label, fallback) {
  const candidate = value == null || value === "" ? fallback : String(value);
  if (!allowed.has(candidate)) throw new Error(`${label} is not supported.`);
  return candidate;
}

function throwSupabaseError(action, error) {
  const nextError = new Error(error?.message || `${action} failed.`);
  nextError.name = "PortalRealtimeError";
  nextError.code = error?.code;
  nextError.details = error?.details;
  nextError.hint = error?.hint;
  throw nextError;
}

async function requireAuthenticatedUser() {
  const client = connectedClient();
  const { data, error } = await client.auth.getUser();
  if (error) throwSupabaseError("Checking the signed-in account", error);
  if (!data?.user?.id) throw new Error("Sign in before changing a course.");
  return data.user;
}

async function rowsFrom(request, action) {
  const { data, error } = await request;
  if (error) throwSupabaseError(action, error);
  return Array.isArray(data) ? data : [];
}

async function rowFrom(request, action, notFoundMessage) {
  const { data, error } = await request;
  if (error) throwSupabaseError(action, error);
  if (!data) throw new Error(notFoundMessage);
  return data;
}

export async function listVisibleCourses({ educationDivision, status, limit = 50 } = {}) {
  const client = connectedClient();
  let request = client.from("courses").select(COURSE_SELECT).order("updated_at", { ascending: false }).limit(boundedLimit(limit, 50));
  if (educationDivision != null && educationDivision !== "") {
    request = request.eq("education_division", checkedChoice(educationDivision, EDUCATION_DIVISIONS, "Education division"));
  }
  if (status != null && status !== "") {
    request = request.eq("status", checkedChoice(status, COURSE_STATUSES, "Course status"));
  }
  return rowsFrom(request, "Loading courses");
}

export async function getVisibleCourse(courseId) {
  const id = requireUuid(courseId, "Course");
  return rowFrom(
    connectedClient().from("courses").select(COURSE_SELECT).eq("id", id).maybeSingle(),
    "Loading the course",
    "This course is unavailable or is not visible to the signed-in account."
  );
}

export async function createCourse({
  title,
  courseCode = null,
  subject = null,
  audience = null,
  teachingWindow = null,
  educationDivision = "university",
  status = "draft",
  settings = {},
}) {
  const user = await requireAuthenticatedUser();
  const payload = {
    owner_id: user.id,
    title: requiredText(title, "Course title", 180),
    course_code: optionalText(courseCode, "Course code", 80),
    subject: optionalText(subject, "Subject", 160),
    audience: optionalText(audience, "Audience", 240),
    teaching_window: optionalText(teachingWindow, "Teaching window", 160),
    education_division: checkedChoice(educationDivision, EDUCATION_DIVISIONS, "Education division", "university"),
    status: checkedChoice(status, COURSE_STATUSES, "Course status", "draft"),
    settings: plainObject(settings, "Course settings"),
  };
  return rowFrom(
    connectedClient().from("courses").insert(payload).select(COURSE_SELECT).single(),
    "Creating the course",
    "The course was not created."
  );
}

export async function updateCourse(courseId, changes = {}) {
  const id = requireUuid(courseId, "Course");
  await requireAuthenticatedUser();
  const payload = {};
  if (Object.hasOwn(changes, "title")) payload.title = requiredText(changes.title, "Course title", 180);
  if (Object.hasOwn(changes, "courseCode")) payload.course_code = optionalText(changes.courseCode, "Course code", 80);
  if (Object.hasOwn(changes, "subject")) payload.subject = optionalText(changes.subject, "Subject", 160);
  if (Object.hasOwn(changes, "audience")) payload.audience = optionalText(changes.audience, "Audience", 240);
  if (Object.hasOwn(changes, "teachingWindow")) payload.teaching_window = optionalText(changes.teachingWindow, "Teaching window", 160);
  if (Object.hasOwn(changes, "educationDivision")) payload.education_division = checkedChoice(changes.educationDivision, EDUCATION_DIVISIONS, "Education division");
  if (Object.hasOwn(changes, "status")) payload.status = checkedChoice(changes.status, COURSE_STATUSES, "Course status");
  if (Object.hasOwn(changes, "settings")) payload.settings = plainObject(changes.settings, "Course settings");
  if (!Object.keys(payload).length) throw new Error("Choose at least one course field to update.");
  return rowFrom(
    connectedClient().from("courses").update(payload).eq("id", id).select(COURSE_SELECT).single(),
    "Updating the course",
    "The course was not updated."
  );
}

export async function listVisibleAssignments({ courseId, status, limit = 30 }) {
  const id = requireUuid(courseId, "Course");
  let request = connectedClient()
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("course_id", id)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(boundedLimit(limit));
  if (status != null && status !== "") {
    request = request.eq("status", checkedChoice(status, ASSIGNMENT_STATUSES, "Assignment status"));
  }
  return rowsFrom(request, "Loading assignments");
}

export async function getVisibleAssignment(assignmentId) {
  const id = requireUuid(assignmentId, "Assignment");
  return rowFrom(
    connectedClient().from("assignments").select(ASSIGNMENT_SELECT).eq("id", id).maybeSingle(),
    "Loading the assignment",
    "This assignment is unavailable or is not visible to the signed-in account."
  );
}

export async function createAssignment({
  courseId,
  title,
  instructions = "",
  dueAt = null,
  status = "draft",
  syllabusSection = {},
  learnerPreview = {},
  settings = {},
}) {
  const user = await requireAuthenticatedUser();
  const payload = {
    course_id: requireUuid(courseId, "Course"),
    professor_id: user.id,
    title: requiredText(title, "Assignment title", 220),
    instructions: optionalText(instructions, "Assignment instructions", 20000) || "",
    due_at: optionalTimestamp(dueAt, "Assignment due date"),
    status: checkedChoice(status, ASSIGNMENT_STATUSES, "Assignment status", "draft"),
    syllabus_section: plainObject(syllabusSection, "Syllabus section"),
    learner_preview: plainObject(learnerPreview, "Learner preview"),
    settings: plainObject(settings, "Assignment settings"),
  };
  return rowFrom(
    connectedClient().from("assignments").insert(payload).select(ASSIGNMENT_SELECT).single(),
    "Creating the assignment",
    "The assignment was not created."
  );
}

export async function updateAssignment(assignmentId, changes = {}) {
  const id = requireUuid(assignmentId, "Assignment");
  await requireAuthenticatedUser();
  const payload = {};
  if (Object.hasOwn(changes, "title")) payload.title = requiredText(changes.title, "Assignment title", 220);
  if (Object.hasOwn(changes, "instructions")) payload.instructions = optionalText(changes.instructions, "Assignment instructions", 20000) || "";
  if (Object.hasOwn(changes, "dueAt")) payload.due_at = optionalTimestamp(changes.dueAt, "Assignment due date");
  if (Object.hasOwn(changes, "status")) payload.status = checkedChoice(changes.status, ASSIGNMENT_STATUSES, "Assignment status");
  if (Object.hasOwn(changes, "syllabusSection")) payload.syllabus_section = plainObject(changes.syllabusSection, "Syllabus section");
  if (Object.hasOwn(changes, "learnerPreview")) payload.learner_preview = plainObject(changes.learnerPreview, "Learner preview");
  if (Object.hasOwn(changes, "settings")) payload.settings = plainObject(changes.settings, "Assignment settings");
  if (!Object.keys(payload).length) throw new Error("Choose at least one assignment field to update.");
  return rowFrom(
    connectedClient().from("assignments").update(payload).eq("id", id).select(ASSIGNMENT_SELECT).single(),
    "Updating the assignment",
    "The assignment was not updated."
  );
}

export async function listVisibleAnnouncements({ courseId, limit = 30 }) {
  const id = requireUuid(courseId, "Course");
  return rowsFrom(
    connectedClient()
      .from("professor_announcements")
      .select(ANNOUNCEMENT_SELECT)
      .eq("course_id", id)
      .order("created_at", { ascending: false })
      .limit(boundedLimit(limit)),
    "Loading class announcements"
  );
}

export async function createCourseAnnouncement({ courseId, title, body, published = true }) {
  const user = await requireAuthenticatedUser();
  const normalizedCourseId = requireUuid(courseId, "Course");
  const course = await getVisibleCourse(normalizedCourseId);
  const isPublished = Boolean(published);
  const payload = {
    professor_id: user.id,
    course_id: normalizedCourseId,
    institution_id: null,
    audience: "course",
    education_division: checkedChoice(course.education_division, EDUCATION_DIVISIONS, "Education division", "university"),
    title: requiredText(title, "Announcement title", 240),
    body: requiredText(body, "Announcement message", 10000),
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
  };
  return rowFrom(
    connectedClient().from("professor_announcements").insert(payload).select(ANNOUNCEMENT_SELECT).single(),
    isPublished ? "Publishing the class announcement" : "Saving the announcement draft",
    "The class announcement was not saved."
  );
}

export async function updateCourseAnnouncement(announcementId, changes = {}) {
  const id = requireUuid(announcementId, "Announcement");
  await requireAuthenticatedUser();
  const payload = {};
  if (Object.hasOwn(changes, "title")) payload.title = requiredText(changes.title, "Announcement title", 240);
  if (Object.hasOwn(changes, "body")) payload.body = requiredText(changes.body, "Announcement message", 10000);
  if (Object.hasOwn(changes, "published")) {
    payload.is_published = Boolean(changes.published);
    payload.published_at = payload.is_published ? new Date().toISOString() : null;
  }
  if (!Object.keys(payload).length) throw new Error("Choose at least one announcement field to update.");
  return rowFrom(
    connectedClient().from("professor_announcements").update(payload).eq("id", id).select(ANNOUNCEMENT_SELECT).single(),
    "Updating the class announcement",
    "The class announcement was not updated."
  );
}

export function publishCourseAnnouncement(announcementId, published = true) {
  return updateCourseAnnouncement(announcementId, { published });
}

export async function deleteCourseAnnouncement(announcementId) {
  const id = requireUuid(announcementId, "Announcement");
  await requireAuthenticatedUser();
  return rowFrom(
    connectedClient().from("professor_announcements").delete().eq("id", id).select("id").single(),
    "Deleting the class announcement",
    "The class announcement was not deleted."
  );
}

export async function listVisibleLearningMessages({ courseId, limit = 50 }) {
  const id = requireUuid(courseId, "Course");
  return rowsFrom(
    connectedClient()
      .from("learning_messages")
      .select(MESSAGE_SELECT)
      .eq("course_id", id)
      .order("created_at", { ascending: false })
      .limit(boundedLimit(limit, 50, 100)),
    "Loading class messages"
  );
}

export async function createLearningMessage({ courseId, body, attachmentResourceId = null }) {
  const user = await requireAuthenticatedUser();
  // The database trigger derives sender_label from the authenticated profile.
  // Never trust a browser-supplied display label for message identity.
  const payload = {
    course_id: requireUuid(courseId, "Course"),
    sender_id: user.id,
    body: requiredText(body, "Message", 5000),
    attachment_resource_id: attachmentResourceId ? requireUuid(attachmentResourceId, "Attachment") : null,
  };
  return rowFrom(
    connectedClient().from("learning_messages").insert(payload).select(MESSAGE_SELECT).single(),
    "Sending the class message",
    "The class message was not sent."
  );
}

export async function listVisibleStudentPosts({ groupId, limit = 30 }) {
  const id = requireUuid(groupId, "Student group");
  return rowsFrom(
    connectedClient()
      .from("student_posts")
      .select(STUDENT_POST_SELECT)
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(boundedLimit(limit)),
    "Loading group posts"
  );
}

export async function createStudentPost({ groupId, body, postType = "update", sharedGradeSummary = null }) {
  const user = await requireAuthenticatedUser();
  const payload = {
    group_id: requireUuid(groupId, "Student group"),
    author_id: user.id,
    post_type: checkedChoice(postType, STUDENT_POST_TYPES, "Post type", "update"),
    body: requiredText(body, "Post", 5000),
    shared_grade_summary: sharedGradeSummary == null ? null : plainObject(sharedGradeSummary, "Shared grade summary"),
  };
  return rowFrom(
    connectedClient().from("student_posts").insert(payload).select(STUDENT_POST_SELECT).single(),
    "Publishing the group post",
    "The group post was not published."
  );
}

export async function updateStudentPost(postId, changes = {}) {
  const id = requireUuid(postId, "Post");
  await requireAuthenticatedUser();
  const payload = {};
  if (Object.hasOwn(changes, "body")) payload.body = requiredText(changes.body, "Post", 5000);
  if (Object.hasOwn(changes, "postType")) payload.post_type = checkedChoice(changes.postType, STUDENT_POST_TYPES, "Post type");
  if (Object.hasOwn(changes, "sharedGradeSummary")) {
    payload.shared_grade_summary = changes.sharedGradeSummary == null ? null : plainObject(changes.sharedGradeSummary, "Shared grade summary");
  }
  if (!Object.keys(payload).length) throw new Error("Choose at least one post field to update.");
  return rowFrom(
    connectedClient().from("student_posts").update(payload).eq("id", id).select(STUDENT_POST_SELECT).single(),
    "Updating the group post",
    "The group post was not updated."
  );
}

export async function deleteStudentPost(postId) {
  const id = requireUuid(postId, "Post");
  await requireAuthenticatedUser();
  return rowFrom(
    connectedClient().from("student_posts").delete().eq("id", id).select("id").single(),
    "Deleting the group post",
    "The group post was not deleted."
  );
}

export async function listVisibleCourseSnapshot(courseId, { assignmentLimit = 30, announcementLimit = 30, messageLimit = 20 } = {}) {
  const id = requireUuid(courseId, "Course");
  const [course, assignments, announcements, messages] = await Promise.all([
    getVisibleCourse(id),
    listVisibleAssignments({ courseId: id, limit: assignmentLimit }),
    listVisibleAnnouncements({ courseId: id, limit: announcementLimit }),
    listVisibleLearningMessages({ courseId: id, limit: messageLimit }),
  ]);
  return { course, assignments, announcements, messages };
}

function notify(handler, value, onError) {
  if (typeof handler !== "function") return;
  try {
    handler(value);
  } catch (error) {
    if (handler !== onError && typeof onError === "function") onError(error);
  }
}

export function subscribeToCourseUpdates(courseId, handlers = {}) {
  const client = connectedClient();
  const id = requireUuid(courseId, "Course");
  const callbacks = handlers && typeof handlers === "object" ? handlers : {};
  const requestedGroupIds = Array.isArray(callbacks.groupIds) ? callbacks.groupIds : [];
  const groupIds = [...new Set(requestedGroupIds.map((groupId) => requireUuid(groupId, "Student group")))].slice(0, 20);
  const channelName = `core-course-${id}-${Date.now()}-${channelSequence += 1}`;
  let channel = client.channel(channelName);
  let removed = false;

  const listeners = [
    { table: "courses", filter: `id=eq.${id}`, handler: callbacks.onCourseChange },
    { table: "assignments", filter: `course_id=eq.${id}`, handler: callbacks.onAssignmentChange },
    { table: "professor_announcements", filter: `course_id=eq.${id}`, handler: callbacks.onAnnouncementChange },
    { table: "learning_messages", filter: `course_id=eq.${id}`, handler: callbacks.onMessageChange },
    ...groupIds.map((groupId) => ({
      table: "student_posts",
      filter: `group_id=eq.${groupId}`,
      handler: callbacks.onStudentPostChange,
    })),
  ];

  listeners.forEach((listener) => {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: listener.table, filter: listener.filter },
      (payload) => {
        const change = { table: listener.table, courseId: id, eventType: payload.eventType, payload };
        notify(listener.handler, change, callbacks.onError);
        notify(callbacks.onChange, change, callbacks.onError);
      }
    );
  });

  channel = channel.subscribe((status, error) => {
    notify(callbacks.onStatus, { status, error: error || null }, callbacks.onError);
    if (error) notify(callbacks.onError, error, callbacks.onError);
  });

  return Object.freeze({
    channel,
    channelName,
    unsubscribe: async () => {
      if (removed) return "already_removed";
      removed = true;
      return client.removeChannel(channel);
    },
  });
}
