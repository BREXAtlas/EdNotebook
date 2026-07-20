import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

export async function listPublishedCourses(educationDivision = "university") {
  if (!isSupabaseConfigured) return { data: [], source: "demo" };

  const { data, error } = await supabase
    .from("published_course_directory")
    .select("course_id,institution_id,institution_name,professor_id,professor_display_name,course_code,title,subject,term,schedule,summary,enrollment_open,education_division,educator_verification_status")
    .eq("is_listed", true)
    .eq("education_division", educationDivision)
    .order("institution_name")
    .order("course_code");

  if (error) {
    console.info("Published class directory is not available yet; using demonstration listings.", error.message);
    return { data: [], source: "demo" };
  }

  return { data: data || [], source: data?.length ? "live" : "demo" };
}

export async function requestClassLink({ courseId, rosterEntryId = null, studentId }) {
  return supabase.from("student_enrollment_requests").upsert(
    {
      course_id: courseId,
      roster_entry_id: rosterEntryId,
      student_id: studentId,
      status: "pending",
    },
    { onConflict: "course_id,student_id" }
  );
}

export async function approveClassLink(requestId) {
  return supabase.rpc("approve_student_enrollment", { p_request_id: requestId });
}

export async function savePublicStudentPage(profile) {
  return supabase.from("student_public_profiles").upsert(profile, { onConflict: "user_id,education_division" });
}

export async function loadPublicStudentPage(userId, educationDivision) {
  if (!isSupabaseConfigured || !userId) return { data: null, source: "device" };
  const { data, error } = await supabase
    .from("student_public_profiles")
    .select("user_id,education_division,display_name,school_name,graduation_year,bio,youtube_url,social_links,theme_key,visibility,discoverable_by_name")
    .eq("user_id", userId)
    .eq("education_division", educationDivision)
    .maybeSingle();
  return { data, error, source: error ? "device" : "cloud" };
}

export async function searchStudentProfiles(query, educationDivision, currentUserId) {
  if (!isSupabaseConfigured || query.trim().length < 2) return { data: [], source: "device" };
  let request = supabase
    .from("student_public_profiles")
    .select("user_id,display_name,school_name,graduation_year,bio,theme_key,visibility")
    .eq("education_division", educationDivision)
    .eq("discoverable_by_name", true)
    .neq("visibility", "private")
    .ilike("display_name", `%${query.trim().replaceAll("%", "").replaceAll("_", "")}%`)
    .order("display_name")
    .limit(20);
  if (currentUserId) request = request.neq("user_id", currentUserId);
  const { data, error } = await request;
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function searchEducatorProfiles(query, educationDivision) {
  if (!isSupabaseConfigured || query.trim().length < 2) return { data: [], source: "device" };
  const clean = query.trim().replaceAll("%", "").replaceAll("_", "");
  const { data, error } = await supabase
    .from("published_course_directory")
    .select("professor_id,professor_display_name,institution_name,educator_verification_status")
    .eq("education_division", educationDivision)
    .ilike("professor_display_name", `%${clean}%`)
    .order("professor_display_name")
    .limit(40);
  const unique = [...new Map((data || []).map((person) => [person.professor_id, {
    user_id: person.professor_id,
    display_name: person.professor_display_name || "Educator",
    school_name: person.institution_name || "Educator",
    bio: person.educator_verification_status === "approved" ? "Verified school affiliation" : "Published educator",
    role: "Educator",
  }])).values()];
  return { data: unique, error, source: error ? "device" : "cloud" };
}

export async function listCurrentStudentCourses() {
  if (!isSupabaseConfigured) return { data: [], source: "device" };
  const { data, error } = await supabase
    .from("courses")
    .select("id,course_code,title,subject,teaching_window,status,education_division")
    .order("updated_at", { ascending: false });
  return { data: data || [], error, source: error ? "device" : "cloud" };
}

export async function submitPortalInterest(payload) {
  if (!isSupabaseConfigured) return { data: null, error: new Error("The signup service is not connected."), source: "device" };
  const { error } = await supabase
    .from("portal_interest_submissions")
    .insert({
      kind: payload.kind,
      name: payload.name?.trim() || "",
      email: payload.email?.trim().toLowerCase() || "",
      school: payload.school?.trim() || "",
      message: payload.message?.trim() || "",
      education_division: payload.educationDivision === "k12" ? "k12" : "university",
      source_path: `${window.location.pathname}${window.location.hash}`.slice(0, 500),
    });
  return { data: error ? null : { submitted: true }, error, source: error ? "device" : "cloud" };
}

export async function submitEducatorVerification(request) {
  return supabase.from("educator_verification_requests").upsert(request, { onConflict: "user_id" }).select().single();
}

export async function listEducatorVerificationRequests() {
  return supabase
    .from("educator_verification_requests")
    .select("user_id,institution_name,education_division,department,teacher_identifier_last4,secure_file_id,status,submitted_at,profiles(full_name,email)")
    .order("submitted_at", { ascending: true });
}

export async function reviewEducatorVerification(userId, decision) {
  return supabase.rpc("review_educator_verification", { p_user_id: userId, p_decision: decision });
}

export async function listAccountAudit(status = "all") {
  if (!isSupabaseConfigured || !supabase) return { data: [], error: new Error("The account audit service is not connected.") };
  return supabase.rpc("list_account_audit", { p_status: status });
}

export async function reviewAccountAudit(userId, status) {
  if (!isSupabaseConfigured || !supabase) return { error: new Error("The account audit service is not connected.") };
  return supabase.rpc("review_account_audit", { p_user_id: userId, p_status: status });
}

function engagementUnavailable() {
  return { data: null, error: new Error("The class engagement service is not connected."), source: "device" };
}

function engagementInvalid(message) {
  return Promise.resolve({ data: null, error: new Error(message), source: "device" });
}

function emptyEngagementOverview(overrides = {}) {
  return {
    balance: 0,
    balances: [],
    ledger: [],
    assignmentRules: [],
    settings: [],
    goals: [],
    classRewards: [],
    rewards: [],
    unlocks: [],
    groups: [],
    groupMemberships: [],
    activities: [],
    questions: [],
    options: [],
    participants: [],
    responses: [],
    classes: [],
    assignments: [],
    ...overrides,
  };
}

function engagementRpc(name, parameters) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(engagementUnavailable());
  return supabase.rpc(name, parameters);
}

export async function getEngagementOverview(courseOrOptions = {}) {
  const options = typeof courseOrOptions === "object" && courseOrOptions !== null ? courseOrOptions : {};
  const explicitCourseId = typeof courseOrOptions === "string" ? courseOrOptions : options.courseId ?? options.course_id ?? null;
  const userId = options.userId ?? options.user_id ?? null;
  const role = options.role ?? null;
  if (!isSupabaseConfigured || !supabase) {
    return {
      data: emptyEngagementOverview(),
      error: null,
      source: "device",
    };
  }

  let courseQuery = supabase
    .from("courses")
    .select("id,course_code,title,subject,teaching_window,status,education_division")
    .order("updated_at", { ascending: false });
  if (explicitCourseId) courseQuery = courseQuery.eq("id", explicitCourseId).limit(1);
  const courseResult = await courseQuery;
  const classes = courseResult.data || [];
  const courseIds = explicitCourseId ? [explicitCourseId] : classes.map((course) => course.id).filter(Boolean);
  if (!courseIds.length) {
    return {
      data: emptyEngagementOverview({ classes }),
      error: courseResult.error || null,
      source: courseResult.error ? "device" : "cloud",
    };
  }

  const inCourseScope = (query) => courseIds.length === 1
    ? query.eq("course_id", courseIds[0])
    : query.in("course_id", courseIds);
  const requests = [
    inCourseScope(supabase.from("engagement_point_balances").select("course_id,learner_id,points_balance,lifetime_earned,lifetime_spent,updated_at")).order("points_balance", { ascending: false }),
    inCourseScope(supabase.from("engagement_point_ledger").select("id,course_id,learner_id,rule_id,source_type,points_delta,reason,metadata,created_by,created_at")).order("created_at", { ascending: false }).limit(100),
    inCourseScope(supabase.from("assignment_point_rules").select("id,course_id,assignment_id,points_value,claim_mode,requires_submission,is_active,created_by,updated_at")).order("updated_at", { ascending: false }),
    inCourseScope(supabase.from("course_engagement_settings").select("course_id,default_group_assignment_mode,created_by,updated_at")),
    inCourseScope(supabase.from("class_engagement_goals").select("id,course_id,reward_id,title,description,target_points,current_points,status,starts_at,ends_at,achieved_at,updated_at")).order("updated_at", { ascending: false }),
    inCourseScope(supabase.from("engagement_reward_catalog").select("id,course_id,title,description,reward_type,cost_points,is_active,created_by,updated_at")).order("cost_points"),
    inCourseScope(supabase.from("engagement_reward_unlocks").select("id,course_id,reward_id,learner_id,ledger_entry_id,points_spent,unlocked_at")).order("unlocked_at", { ascending: false }),
    inCourseScope(supabase.from("class_groups").select("id,course_id,name,description,assignment_mode,join_open,max_members,status,created_by,updated_at")).order("name"),
    inCourseScope(supabase.from("class_group_memberships").select("id,group_id,course_id,learner_id,status,assigned_by,joined_at,left_at,updated_at")).order("joined_at"),
    inCourseScope(supabase.from("classroom_activities").select("id,course_id,created_by,title,instructions,activity_type,status,settings,started_at,closed_at,updated_at")).order("updated_at", { ascending: false }).limit(50),
    inCourseScope(supabase.from("classroom_activity_questions").select("id,activity_id,course_id,position,prompt,response_kind,is_required,points_available,updated_at")).order("position"),
    inCourseScope(supabase.from("classroom_activity_options").select("id,question_id,activity_id,course_id,position,label,updated_at")).order("position"),
    inCourseScope(supabase.from("classroom_activity_participants").select("activity_id,course_id,learner_id,joined_at,last_seen_at")).order("last_seen_at", { ascending: false }),
    inCourseScope(supabase.from("classroom_activity_responses").select("id,activity_id,question_id,course_id,learner_id,group_id,option_ids,text_response,submitted_at,updated_at")).order("submitted_at", { ascending: false }),
    inCourseScope(supabase.from("assignments").select("id,course_id,title,status,due_at,updated_at")).order("updated_at", { ascending: false }),
  ];
  const results = await Promise.all(requests);
  const firstError = courseResult.error || results.find((result) => result.error)?.error || null;
  const [balances, ledger, assignmentRules, settings, goals, rewards, unlocks, groups, groupMemberships, activities, questions, activityOptions, participants, responses, assignments] = results;
  const balanceRows = balances.data || [];
  const unlockRows = unlocks.data || [];
  const membershipRows = groupMemberships.data || [];
  const questionRows = questions.data || [];
  const optionRows = activityOptions.data || [];
  const classById = new Map(classes.map((course) => [course.id, course]));
  const withClassLabel = (row) => {
    const course = classById.get(row.course_id);
    return course ? { ...row, class_name: course.title, course_code: course.course_code } : row;
  };
  const ownBalanceRows = userId ? balanceRows.filter((row) => row.learner_id === userId) : balanceRows;
  const unlockedRewardIds = new Set(unlockRows.filter((row) => !userId || row.learner_id === userId).map((row) => row.reward_id));
  const activeMemberships = membershipRows.filter((row) => row.status === "active");
  const groupRows = (groups.data || []).map((group) => ({
    ...withClassLabel(group),
    member_count: activeMemberships.filter((membership) => membership.group_id === group.id).length,
    is_member: Boolean(userId && activeMemberships.some((membership) => membership.group_id === group.id && membership.learner_id === userId)),
  }));
  const rewardRows = (rewards.data || []).map((reward) => ({
    ...withClassLabel(reward),
    is_unlocked: unlockedRewardIds.has(reward.id),
  }));
  const goalRows = (goals.data || []).map((goal) => ({
    ...withClassLabel(goal),
    description: goal.description || goal.title,
  }));
  const activityRows = (activities.data || [])
    .filter((activity) => role !== "student" || activity.status === "live")
    .map((activity) => {
      const firstQuestion = questionRows.find((question) => question.activity_id === activity.id);
      const choices = firstQuestion ? optionRows.filter((option) => option.question_id === firstQuestion.id) : [];
      return { ...withClassLabel(activity), question_id: firstQuestion?.id ?? null, question: firstQuestion ?? null, choices, options: choices };
    });
  return {
    data: {
      balance: ownBalanceRows.reduce((total, row) => total + (Number(row.points_balance) || 0), 0),
      balances: balanceRows,
      ledger: (ledger.data || []).map(withClassLabel),
      assignmentRules: assignmentRules.data || [],
      settings: settings.data || [],
      goals: goalRows,
      classRewards: goalRows,
      rewards: rewardRows,
      unlocks: unlockRows,
      groups: groupRows,
      groupMemberships: membershipRows,
      activities: activityRows,
      questions: questionRows,
      options: optionRows,
      participants: participants.data || [],
      responses: responses.data || [],
      classes,
      assignments: assignments.data || [],
    },
    error: firstError,
    source: firstError ? "device" : "cloud",
  };
}

export function setAssignmentPointValue({ courseId, assignmentId, points, claimMode = "learner_claim", requiresSubmission = true, isActive = true }) {
  return engagementRpc("set_assignment_point_rule", {
    p_course_id: courseId,
    p_assignment_id: assignmentId,
    p_points: Number(points),
    p_claim_mode: claimMode,
    p_requires_submission: Boolean(requiresSubmission),
    p_is_active: Boolean(isActive),
  });
}

export function claimAssignmentEngagementPoints(ruleId) {
  return engagementRpc("claim_assignment_engagement_points", { p_rule_id: ruleId });
}

export function awardCourseEngagementPoints({ courseId, learnerId, points, reason, idempotencyKey }) {
  return engagementRpc("award_course_engagement_points", {
    p_course_id: courseId,
    p_learner_id: learnerId,
    p_points: Number(points),
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
}

export function saveClassReward(input = {}) {
  const {
    courseId,
    title,
    costPoints,
    rewardId = null,
    description = "",
    rewardType = "badge",
    isActive = true,
    goalTitle = null,
    goalTargetPoints = null,
    targetPoints = null,
  } = input;
  if (costPoints == null && targetPoints != null) {
    const goalLabel = String(title || description || "Class reward").trim();
    return saveClassEngagementGoal({
      courseId,
      title: goalLabel,
      description: description || goalLabel,
      targetPoints,
    });
  }
  if (!title || costPoints == null) return engagementInvalid("A reward title and point cost are required.");
  return engagementRpc("save_class_engagement_reward", {
    p_course_id: courseId,
    p_title: title,
    p_cost_points: Number(costPoints),
    p_reward_id: rewardId,
    p_description: description,
    p_reward_type: rewardType,
    p_is_active: Boolean(isActive),
    p_goal_title: goalTitle,
    p_goal_target_points: goalTargetPoints == null ? null : Number(goalTargetPoints),
  });
}

export function saveClassEngagementGoal({
  courseId,
  title,
  targetPoints,
  goalId = null,
  description = "",
  status = "active",
  rewardId = null,
  startsAt = null,
  endsAt = null,
}) {
  return engagementRpc("save_class_engagement_goal", {
    p_course_id: courseId,
    p_title: title,
    p_target_points: Number(targetPoints),
    p_goal_id: goalId,
    p_description: description,
    p_status: status,
    p_reward_id: rewardId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
}

export function unlockEngagementReward(rewardId) {
  const id = typeof rewardId === "object" ? rewardId?.rewardId ?? rewardId?.reward_id : rewardId;
  if (!id) return engagementInvalid("Choose a reward to unlock.");
  return engagementRpc("unlock_engagement_reward", { p_reward_id: id });
}

export function createClassGroup({ courseId, name, description = "", assignmentMode = "teacher_assign", maxMembers = 6 }) {
  return engagementRpc("create_class_group", {
    p_course_id: courseId,
    p_name: name,
    p_description: description,
    p_assignment_mode: assignmentMode,
    p_max_members: Number(maxMembers),
  });
}

export function setClassGroupAssignmentMode(groupOrId, assignmentMode, joinOpen = true) {
  const groupId = typeof groupOrId === "object" ? groupOrId?.groupId : groupOrId;
  const courseId = typeof groupOrId === "object" ? groupOrId?.courseId : null;
  const nextMode = typeof groupOrId === "object" ? groupOrId?.assignmentMode : assignmentMode;
  const nextJoinOpen = typeof groupOrId === "object" ? groupOrId?.joinOpen ?? true : joinOpen;
  if (!groupId && courseId) {
    return engagementRpc("set_course_group_assignment_mode", {
      p_course_id: courseId,
      p_assignment_mode: nextMode,
    });
  }
  if (!groupId) return engagementInvalid("Choose a class group to update.");
  return engagementRpc("set_class_group_assignment_mode", {
    p_group_id: groupId,
    p_assignment_mode: nextMode,
    p_join_open: Boolean(nextJoinOpen),
  });
}

export function assignClassGroupMember(groupId, learnerId, active = true) {
  return engagementRpc("set_class_group_member", {
    p_group_id: groupId,
    p_learner_id: learnerId,
    p_active: Boolean(active),
  });
}

export function joinClassGroup(groupId) {
  const id = typeof groupId === "object" ? groupId?.groupId ?? groupId?.group_id : groupId;
  if (!id) return engagementInvalid("Choose a class group to join.");
  return engagementRpc("join_class_group", { p_group_id: id });
}

export function leaveClassGroup(groupId) {
  const id = typeof groupId === "object" ? groupId?.groupId ?? groupId?.group_id : groupId;
  if (!id) return engagementInvalid("Choose a class group to leave.");
  return engagementRpc("leave_class_group", { p_group_id: id });
}

export function createClassActivity({ courseId, title, activityType, type, instructions = "", questions = [], settings = {} } = {}) {
  return engagementRpc("create_classroom_activity", {
    p_course_id: courseId,
    p_title: title,
    p_activity_type: activityType ?? type,
    p_instructions: instructions,
    p_questions: questions,
    p_settings: settings,
  });
}

export async function startClassActivity(activityOrId) {
  if (typeof activityOrId === "string") {
    return engagementRpc("start_classroom_activity", { p_activity_id: activityOrId });
  }
  if (activityOrId?.activityId) {
    return engagementRpc("start_classroom_activity", { p_activity_id: activityOrId.activityId });
  }
  const activity = activityOrId || {};
  const activityType = activity.activityType ?? activity.type ?? "quiz";
  const defaultQuestions = activityType === "poll"
    ? [{ prompt: "How is this lesson feeling right now?", responseKind: "single_choice", options: ["Ready to continue", "I need more time"] }]
    : [{ prompt: activityType === "group_challenge" ? "Is your group ready to begin?" : "Are you ready to begin?", responseKind: "single_choice", options: ["Ready", "Need directions"] }];
  const created = await createClassActivity({
    ...activity,
    activityType,
    questions: Array.isArray(activity.questions) && activity.questions.length ? activity.questions : defaultQuestions,
  });
  const createdActivity = Array.isArray(created.data) ? created.data[0] : created.data;
  if (created.error || !createdActivity?.id) return created;
  return engagementRpc("start_classroom_activity", { p_activity_id: createdActivity.id });
}

export function closeClassActivity(activityId) {
  return engagementRpc("close_classroom_activity", { p_activity_id: activityId });
}

export function joinClassActivity(activityId) {
  const id = typeof activityId === "object" ? activityId?.activityId ?? activityId?.activity_id : activityId;
  if (!id) return engagementInvalid("Choose a live class activity to join.");
  return engagementRpc("join_classroom_activity", { p_activity_id: id });
}

export async function answerClassActivity({ activityId, questionId = null, optionIds = [], textResponse = null, groupId = null, answer = null } = {}) {
  if (!activityId) return engagementInvalid("Choose a live class activity to answer.");
  let resolvedQuestionId = questionId;
  let resolvedOptionIds = Array.isArray(optionIds) ? optionIds : [];
  let resolvedTextResponse = textResponse;
  if (!resolvedQuestionId) {
    if (!isSupabaseConfigured || !supabase) return engagementUnavailable();
    const questionResult = await supabase
      .from("classroom_activity_questions")
      .select("id,response_kind")
      .eq("activity_id", activityId)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (questionResult.error || !questionResult.data?.id) {
      return { data: null, error: questionResult.error || new Error("This activity does not have an answerable question."), source: "device" };
    }
    resolvedQuestionId = questionResult.data.id;
    if (questionResult.data.response_kind === "free_text") {
      resolvedTextResponse = answer == null ? textResponse : String(answer);
    } else if (answer != null && !resolvedOptionIds.length) {
      const optionResult = await supabase
        .from("classroom_activity_options")
        .select("id,label")
        .eq("question_id", resolvedQuestionId)
        .order("position");
      if (optionResult.error) return { data: null, error: optionResult.error, source: "device" };
      const answerText = String(answer);
      const selected = (optionResult.data || []).find((option) => option.id === answerText || option.label === answerText);
      if (!selected) return engagementInvalid("Choose one of the available activity answers.");
      resolvedOptionIds = [selected.id];
    }
  }
  return engagementRpc("submit_classroom_activity_response", {
    p_activity_id: activityId,
    p_question_id: resolvedQuestionId,
    p_option_ids: resolvedOptionIds,
    p_text_response: resolvedTextResponse,
    p_group_id: groupId,
  });
}

const COURSE_ENGAGEMENT_REALTIME_TABLES = [
  ["assignment_point_rules", "onPointsChange"],
  ["engagement_point_ledger", "onPointsChange"],
  ["engagement_point_balances", "onPointsChange"],
  ["course_engagement_settings", "onGroupsChange"],
  ["engagement_reward_catalog", "onRewardsChange"],
  ["class_engagement_goals", "onRewardsChange"],
  ["engagement_reward_unlocks", "onRewardsChange"],
  ["class_groups", "onGroupsChange"],
  ["class_group_memberships", "onGroupsChange"],
  ["classroom_activities", "onActivityChange"],
  ["classroom_activity_questions", "onActivityChange"],
  ["classroom_activity_options", "onActivityChange"],
  ["classroom_activity_participants", "onActivityChange"],
  ["classroom_activity_responses", "onActivityChange"],
];

export function subscribeToCourseEngagement(courseId, handlers = {}) {
  const resolvedCourseId = typeof courseId === "object" ? courseId?.courseId ?? courseId?.course_id : courseId;
  const validCourseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(resolvedCourseId || ""));
  if (!isSupabaseConfigured || !supabase || !validCourseId) {
    return { channel: null, unsubscribe: () => Promise.resolve("not_connected") };
  }

  let channel = supabase.channel(`course-engagement-${resolvedCourseId}-${Math.random().toString(36).slice(2)}`);
  COURSE_ENGAGEMENT_REALTIME_TABLES.forEach(([table, handlerName]) => {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `course_id=eq.${resolvedCourseId}` },
      (payload) => {
        handlers[handlerName]?.(payload, table);
        handlers.onChange?.({ table, payload });
      }
    );
  });
  channel = channel.subscribe((status, error) => handlers.onStatus?.(status, error));
  let removed = false;
  const unsubscribe = () => {
    if (removed) return Promise.resolve("already_removed");
    removed = true;
    return supabase.removeChannel(channel);
  };
  return {
    channel,
    unsubscribe,
    cleanup: unsubscribe,
  };
}
