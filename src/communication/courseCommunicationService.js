import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import {
  COURSE_COMMUNICATION_LIMITS,
  isUuid,
  validateCourseAnnouncement,
  validateCourseMessage,
} from "./courseCommunicationModel.js";

const MANAGER_ROLES = ["owner", "admin", "professor"];

function unavailable(message = "Synced course communication is not connected.") {
  return { data: null, error: new Error(message), source: "unavailable" };
}

async function authenticatedUser() {
  if (!isSupabaseConfigured || !supabase) return { user: null, error: new Error("Cloud communication is not configured.") };
  const { data, error } = await supabase.auth.getUser();
  return { user: data?.user || null, error };
}

export async function listCommunicationCourses({ role, educationDivision }) {
  const authResult = await authenticatedUser();
  if (authResult.error || !authResult.user) return unavailable("Sign in to open synced course communication.");

  let request = supabase
    .from("course_memberships")
    .select("role,courses!inner(id,title,course_code,subject,teaching_window,status,education_division,institution_id,updated_at)")
    .eq("user_id", authResult.user.id)
    .in("role", role === "professor" ? MANAGER_ROLES : ["learner"]);
  if (["university", "k12"].includes(educationDivision)) {
    request = request.eq("courses.education_division", educationDivision);
  }
  const { data, error } = await request;
  if (error) return { data: [], error, source: "unavailable" };

  const courses = (data || [])
    .map((membership) => ({ ...membership.courses, membershipRole: membership.role }))
    .filter((course) => course?.id)
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
  return { data: courses, source: "cloud" };
}

export async function loadCourseCommunication(courseId) {
  const authResult = await authenticatedUser();
  if (authResult.error || !authResult.user || !isUuid(courseId)) return unavailable("Choose a current course to load communication.");

  const [messagesResult, announcementsResult, readsResult, preferencesResult, resourcesResult] = await Promise.all([
    supabase
      .from("learning_messages")
      .select("id,sender_id,sender_label,body,message_kind,parent_message_id,attachment_resource_id,created_at,learning_resources(id,title,resource_type,visibility)")
      .eq("course_id", courseId)
      .is("recipient_id", null)
      .order("created_at", { ascending: true })
      .limit(COURSE_COMMUNICATION_LIMITS.visibleMessages),
    supabase
      .from("professor_announcements")
      .select("id,professor_id,title,body,published_at,created_at")
      .eq("course_id", courseId)
      .eq("audience", "course")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(COURSE_COMMUNICATION_LIMITS.visibleAnnouncements),
    supabase
      .from("course_communication_reads")
      .select("message_id,announcement_id,read_at")
      .eq("course_id", courseId)
      .eq("user_id", authResult.user.id),
    supabase
      .from("course_communication_preferences")
      .select("notify_announcements,notify_replies")
      .eq("course_id", courseId)
      .eq("user_id", authResult.user.id)
      .maybeSingle(),
    supabase
      .from("learning_resources")
      .select("id,title,resource_type,visibility")
      .eq("course_id", courseId)
      .in("visibility", ["course", "public", "publisher"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const error = messagesResult.error
    || announcementsResult.error
    || readsResult.error
    || preferencesResult.error
    || resourcesResult.error;
  if (error) return { data: null, error, source: "unavailable" };

  const messages = (messagesResult.data || []).map((message) => ({
    id: message.id,
    senderLabel: message.sender_label || "Course member",
    body: message.body,
    kind: message.message_kind || "course_note",
    parentMessageId: message.parent_message_id || null,
    attachmentResourceId: message.attachment_resource_id || null,
    attachment: message.learning_resources || null,
    createdAt: message.created_at,
    own: message.sender_id === authResult.user.id,
  }));
  const announcements = (announcementsResult.data || []).map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    publishedAt: announcement.published_at || announcement.created_at,
    audienceLabel: "Entire course",
    own: announcement.professor_id === authResult.user.id,
  }));
  const reads = (readsResult.data || []).map((item) => ({
    messageId: item.message_id || null,
    announcementId: item.announcement_id || null,
    readAt: item.read_at,
  }));
  const preferences = {
    notifyAnnouncements: preferencesResult.data?.notify_announcements !== false,
    notifyReplies: preferencesResult.data?.notify_replies !== false,
  };
  return {
    data: {
      messages,
      announcements,
      reads,
      preferences,
      resources: resourcesResult.data || [],
    },
    source: "cloud",
  };
}

export async function sendCourseMessage({ courseId, body, kind = "question", parentMessageId = null, attachmentResourceId = null }) {
  if (!isUuid(courseId)) return unavailable("Choose a current course before sending.");
  const validation = validateCourseMessage({ body, kind, parentMessageId });
  if (!validation.ok) return { data: null, error: new Error(validation.reason), source: "unavailable" };
  if (attachmentResourceId && !isUuid(attachmentResourceId)) return { data: null, error: new Error("Choose an authorized course resource."), source: "unavailable" };

  const { data, error } = await supabase.rpc("send_course_message", {
    p_course_id: courseId,
    p_body: validation.value.body,
    p_message_kind: validation.value.kind,
    p_parent_message_id: validation.value.parentMessageId,
    p_attachment_resource_id: attachmentResourceId || null,
  });
  return { data, error, source: error ? "unavailable" : "cloud" };
}

export async function publishCourseAnnouncement({ courseId, title, body }) {
  if (!isUuid(courseId)) return unavailable("Choose a course you manage before publishing.");
  const validation = validateCourseAnnouncement({ title, body });
  if (!validation.ok) return { data: null, error: new Error(validation.reason), source: "unavailable" };

  const { data, error } = await supabase.rpc("publish_course_announcement", {
    p_course_id: courseId,
    p_title: validation.value.title,
    p_body: validation.value.body,
  });
  return { data, error, source: error ? "unavailable" : "cloud" };
}

export async function markCourseCommunicationRead({ courseId, messageIds = [], announcementIds = [] }) {
  if (!isUuid(courseId)) return unavailable("Choose a current course before updating read state.");
  const { data, error } = await supabase.rpc("mark_course_communication_read", {
    p_course_id: courseId,
    p_message_ids: messageIds.filter(isUuid),
    p_announcement_ids: announcementIds.filter(isUuid),
  });
  return { data, error, source: error ? "unavailable" : "cloud" };
}

export async function saveCourseCommunicationPreferences({ courseId, notifyAnnouncements, notifyReplies }) {
  const authResult = await authenticatedUser();
  if (authResult.error || !authResult.user || !isUuid(courseId)) return unavailable("Choose a current course before saving preferences.");
  const { data, error } = await supabase
    .from("course_communication_preferences")
    .upsert({
      course_id: courseId,
      user_id: authResult.user.id,
      notify_announcements: notifyAnnouncements !== false,
      notify_replies: notifyReplies !== false,
    }, { onConflict: "course_id,user_id" })
    .select("notify_announcements,notify_replies")
    .single();
  return { data, error, source: error ? "unavailable" : "cloud" };
}

export function subscribeCourseCommunication(courseId, onChange, onStatus = () => {}) {
  if (!supabase || !isUuid(courseId)) return () => {};
  const channel = supabase
    .channel(`course-communication-${courseId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "learning_messages", filter: `course_id=eq.${courseId}` },
      () => onChange("message")
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "professor_announcements", filter: `course_id=eq.${courseId}` },
      () => onChange("announcement")
    )
    .subscribe((status) => onStatus(status));
  return () => { supabase.removeChannel(channel); };
}
