import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import {
  DIGITAL_LITERACY_REWARD_EVENTS,
  DIGITAL_LITERACY_REWARD_ROSTER,
  SOCIAL_LEARNING_MILESTONES,
  rewardSemanticFingerprint,
} from "./socialLearningModel.js";

function firstRpcRow(data) {
  return Array.isArray(data) ? data[0] || null : data;
}

function newestFirst(events) {
  return [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function demoEvent(payload, eventType = "award") {
  return {
    id: crypto.randomUUID(),
    course_id: payload.courseId,
    student_id: payload.studentId,
    issued_by: "demo-professor",
    issuer_display_name: "Professor Atlas",
    event_type: eventType,
    source_event_id: payload.sourceEventId || null,
    reward_name: payload.rewardName,
    visual_key: payload.visualKey,
    category: payload.category,
    activity_reference: payload.activityReference,
    points_delta: payload.pointsDelta ?? payload.points,
    reason: payload.reason,
    semantic_key: rewardSemanticFingerprint(payload),
    created_at: new Date().toISOString(),
  };
}

export async function loadManagedSocialLearning() {
  if (!isSupabaseConfigured) {
    return {
      roster: [...DIGITAL_LITERACY_REWARD_ROSTER],
      events: newestFirst(DIGITAL_LITERACY_REWARD_EVENTS),
      milestones: [...SOCIAL_LEARNING_MILESTONES],
      source: "demo",
      error: null,
    };
  }

  const [rosterResult, eventsResult, milestonesResult] = await Promise.all([
    supabase.rpc("list_social_learning_managed_roster"),
    supabase
      .from("social_learning_reward_events")
      .select("id,course_id,student_id,issued_by,issuer_display_name,event_type,source_event_id,reward_name,visual_key,category,activity_reference,points_delta,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("social_learning_milestones")
      .select("threshold_points,badge_name,badge_description,unlock_key,unlock_name,unlock_description,unlock_kind,is_optional")
      .order("threshold_points"),
  ]);

  const error = rosterResult.error || eventsResult.error || milestonesResult.error || null;
  return {
    roster: rosterResult.data || [],
    events: eventsResult.data || [],
    milestones: milestonesResult.data?.length ? milestonesResult.data : [...SOCIAL_LEARNING_MILESTONES],
    source: error ? "unavailable" : "cloud",
    error,
  };
}

export async function loadStudentSocialLearning({ userId, demo = false }) {
  if (demo) {
    return {
      events: newestFirst(DIGITAL_LITERACY_REWARD_EVENTS),
      milestones: [...SOCIAL_LEARNING_MILESTONES],
      source: "demo",
      error: null,
    };
  }
  if (!isSupabaseConfigured || !userId) {
    return {
      events: [],
      milestones: [...SOCIAL_LEARNING_MILESTONES],
      source: "device",
      error: null,
    };
  }

  const [eventsResult, milestonesResult] = await Promise.all([
    supabase
      .from("social_learning_reward_events")
      .select("id,course_id,student_id,issued_by,issuer_display_name,event_type,source_event_id,reward_name,visual_key,category,activity_reference,points_delta,reason,created_at")
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("social_learning_milestones")
      .select("threshold_points,badge_name,badge_description,unlock_key,unlock_name,unlock_description,unlock_kind,is_optional")
      .order("threshold_points"),
  ]);

  const error = eventsResult.error || milestonesResult.error || null;
  return {
    events: eventsResult.data || [],
    milestones: milestonesResult.data?.length ? milestonesResult.data : [...SOCIAL_LEARNING_MILESTONES],
    source: error ? "unavailable" : "cloud",
    error,
  };
}

export async function issueSocialLearningReward(payload, { demo = false } = {}) {
  if (demo || !isSupabaseConfigured) return { data: demoEvent(payload), error: null, source: "demo" };
  const { data, error } = await supabase.rpc("issue_social_learning_reward", {
    p_course_id: payload.courseId,
    p_student_id: payload.studentId,
    p_reward_name: payload.rewardName,
    p_visual_key: payload.visualKey,
    p_category: payload.category,
    p_activity_reference: payload.activityReference,
    p_points: payload.points,
    p_reason: payload.reason,
    p_idempotency_key: payload.idempotencyKey,
  });
  return { data: firstRpcRow(data), error, source: "cloud" };
}

export async function correctSocialLearningReward(payload, { demo = false } = {}) {
  if (demo || !isSupabaseConfigured) {
    return {
      data: demoEvent(
        {
          ...payload,
          courseId: payload.source.course_id,
          studentId: payload.source.student_id,
          rewardName: payload.source.reward_name,
          visualKey: payload.source.visual_key,
          category: payload.source.category,
          activityReference: payload.source.activity_reference,
          sourceEventId: payload.source.id,
          pointsDelta: payload.type === "reversal" ? -payload.currentPoints : payload.pointsDelta,
        },
        payload.type
      ),
      error: null,
      source: "demo",
    };
  }
  const { data, error } = await supabase.rpc("correct_social_learning_reward", {
    p_source_event_id: payload.source.id,
    p_correction_type: payload.type,
    p_points_delta: payload.type === "adjustment" ? payload.pointsDelta : null,
    p_reason: payload.reason,
    p_idempotency_key: payload.idempotencyKey,
  });
  return { data: firstRpcRow(data), error, source: "cloud" };
}
