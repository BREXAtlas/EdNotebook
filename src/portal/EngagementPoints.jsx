import { useCallback, useEffect, useMemo, useState } from "react";
import * as portalService from "./portalService.js";

const EMPTY_OVERVIEW = {
  balance: 0,
  ledger: [],
  classRewards: [],
  rewards: [],
  groups: [],
  activities: [],
  classes: [],
  assignments: [],
  settings: [],
};

const ACTIVITY_BLUEPRINTS = [
  { type: "quiz", title: "Live quiz", description: "Check understanding together during class.", action: "Start live quiz" },
  { type: "poll", title: "Class poll", description: "Ask one quick question and review the response pattern.", action: "Start class poll" },
  { type: "group_challenge", title: "Group challenge", description: "Give class groups one shared goal to complete.", action: "Start class challenge" },
];

// portalService returns the engagement tables for one course. This component joins the related
// rows into the small view models used below; service mutations receive the concrete IDs they own.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeOverview(result, userId, mode) {
  const source = result?.data ?? result ?? {};
  const balances = asArray(source.balances);
  const ledger = asArray(source.ledger);
  const unlocks = asArray(source.unlocks);
  const memberships = asArray(source.groupMemberships ?? source.group_memberships);
  const questions = asArray(source.questions);
  const options = asArray(source.options);
  const ownBalance = balances.find((balance) => String(balance.learner_id ?? balance.learnerId) === String(userId));
  const balance = mode === "professor"
    ? balances.reduce((total, row) => total + (Number(row.points_balance ?? row.pointsBalance) || 0), 0)
    : Number(ownBalance?.points_balance ?? ownBalance?.pointsBalance ?? 0) || 0;
  const learnerUnlockIds = new Set(unlocks
    .filter((unlock) => mode === "professor" || String(unlock.learner_id ?? unlock.learnerId) === String(userId))
    .map((unlock) => String(unlock.reward_id ?? unlock.rewardId)));

  return {
    balance,
    ledger: mode === "professor" ? ledger : ledger.filter((entry) => String(entry.learner_id ?? entry.learnerId) === String(userId)),
    classRewards: asArray(source.goals ?? source.classRewards ?? source.class_rewards),
    rewards: asArray(source.rewards ?? source.rewardStore ?? source.reward_store).map((reward) => ({
      ...reward,
      is_unlocked: learnerUnlockIds.has(String(reward.id ?? reward.reward_id)),
    })),
    groups: asArray(source.groups ?? source.classGroups ?? source.class_groups).map((group) => {
      const groupMemberships = memberships.filter((membership) => String(membership.group_id ?? membership.groupId) === String(group.id));
      return {
        ...group,
        member_count: groupMemberships.filter((membership) => (membership.status ?? "active") === "active").length,
        is_member: groupMemberships.some((membership) => (membership.status ?? "active") === "active" && String(membership.learner_id ?? membership.learnerId) === String(userId)),
      };
    }),
    activities: asArray(source.activities ?? source.classActivities ?? source.class_activities)
      .filter((activity) => mode === "professor" || activity.status === "live")
      .map((activity) => {
        const question = questions.find((item) => String(item.activity_id ?? item.activityId) === String(activity.id));
        return {
          ...activity,
          question,
          questionId: question?.id ?? "",
          choices: question ? options.filter((option) => String(option.question_id ?? option.questionId) === String(question.id)) : [],
        };
      }),
    classes: asArray(source.classes ?? source.courses),
    assignments: asArray(source.assignmentRules ?? source.assignment_rules ?? source.assignments ?? source.courseAssignments ?? source.course_assignments),
    settings: asArray(source.settings ?? source.courseSettings ?? source.course_settings),
  };
}

function itemId(item, fallback) {
  return item?.id ?? item?.reward_id ?? item?.group_id ?? item?.activity_id ?? fallback;
}

function classId(item) {
  return item?.courseId ?? item?.course_id ?? item?.classId ?? item?.class_id ?? item?.id ?? "";
}

function classLabel(item) {
  const code = item?.code ?? item?.course_code ?? item?.class_code;
  const title = item?.title ?? item?.name ?? item?.class_name;
  return [code, title].filter(Boolean).join(" · ") || "Untitled class";
}

function assignmentId(item) {
  return item?.assignmentId ?? item?.assignment_id ?? item?.id ?? "";
}

function assignmentLabel(item) {
  return item?.title ?? item?.name ?? item?.assignment_title ?? "Untitled assignment";
}

function formatLedgerDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function actionLabelForActivity(activity) {
  const type = activity.type ?? activity.activity_type;
  if (type === "poll") return activity.questionId ? "Submit poll answer" : "Join class poll";
  if (type === "group_challenge") return "Join group challenge";
  return "Join live quiz";
}

function PointsSummary({ overview, ledgerOpen, onToggleLedger }) {
  return (
    <section className="dashboard-card engagement-points-card">
      <div className="engagement-balance">
        <span>ACTIVITY POINTS</span>
        <strong>{overview.balance.toLocaleString()}</strong>
        <small>Activity Points reward participation and completed work. They do not change a grade.</small>
      </div>
      <button type="button" aria-expanded={ledgerOpen} onClick={onToggleLedger}>
        {ledgerOpen ? "Hide activity points" : "View activity points"}
      </button>
      {ledgerOpen && (
        <div className="engagement-ledger" aria-live="polite">
          <div className="engagement-section-heading">
            <div>
              <span className="portal-kicker">EARNING LEDGER</span>
              <h2>How Activity Points were earned</h2>
            </div>
            <span>{overview.ledger.length} entr{overview.ledger.length === 1 ? "y" : "ies"}</span>
          </div>
          {overview.ledger.length === 0 ? (
            <p className="engagement-empty-copy">No Activity Points have been recorded. Completed class activity will appear here after an educator publishes it.</p>
          ) : (
            <div className="engagement-ledger-list">
              {overview.ledger.map((entry, index) => {
                const points = Number(entry.points ?? entry.point_value ?? entry.points_delta ?? entry.amount ?? 0) || 0;
                return (
                  <article key={itemId(entry, `ledger-${index}`)}>
                    <div>
                      <strong>{entry.description ?? entry.reason ?? entry.assignment_title ?? "Class activity"}</strong>
                      <span>{entry.className ?? entry.class_name ?? entry.course_code ?? "Class"} · {formatLedgerDate(entry.created_at ?? entry.createdAt ?? entry.date)}</span>
                    </div>
                    <b>{points > 0 ? "+" : ""}{points}</b>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ClassRewardProgress({ rewards }) {
  return (
    <section className="dashboard-card engagement-progress-card">
      <div className="engagement-section-heading">
        <div>
          <span className="portal-kicker">CLASS REWARD PROGRESS</span>
          <h2>Goals set by the educator</h2>
          <p>Everyone can see the target and how close the class is to reaching it.</p>
        </div>
      </div>
      {rewards.length === 0 ? (
        <p className="engagement-empty-copy">No class reward target has been published.</p>
      ) : (
        <div className="engagement-progress-list">
          {rewards.map((reward, index) => {
            const current = Number(reward.currentPoints ?? reward.current_points ?? reward.progress ?? 0) || 0;
            const target = Math.max(1, Number(reward.targetPoints ?? reward.target_points ?? reward.target ?? 1) || 1);
            const percent = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
            return (
              <article key={itemId(reward, `class-reward-${index}`)}>
                <div>
                  <strong>{reward.description ?? reward.title ?? "Class reward"}</strong>
                  <span>{reward.className ?? reward.class_name ?? reward.course_code ?? "Class goal"}</span>
                </div>
                <div className="engagement-progress-track" role="progressbar" aria-label={`${reward.description ?? "Class reward"} progress`} aria-valuemin="0" aria-valuemax={target} aria-valuenow={Math.min(current, target)}>
                  <i style={{ width: `${percent}%` }} />
                </div>
                <small>{current.toLocaleString()} of {target.toLocaleString()} Activity Points · {percent}%</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RewardsStore({ overview, canMutate, busyAction, onUnlock }) {
  return (
    <section className="dashboard-card engagement-store-card">
      <div className="engagement-section-heading">
        <div>
          <span className="portal-kicker">SMALL UNLOCK STORE</span>
          <h2>Use Activity Points for optional extras</h2>
          <p>Core class tools stay available. Educators decide which small extras a class can unlock.</p>
        </div>
      </div>
      {overview.rewards.length === 0 ? (
        <p className="engagement-empty-copy">No optional class rewards are available yet.</p>
      ) : (
        <div className="engagement-store-grid">
          {overview.rewards.map((reward, index) => {
            const id = itemId(reward, `reward-${index}`);
            const cost = Number(reward.cost ?? reward.point_cost ?? reward.cost_points ?? reward.points ?? 0) || 0;
            const unlocked = Boolean(reward.unlocked ?? reward.is_unlocked);
            const enoughPoints = overview.balance >= cost;
            return (
              <article key={id}>
                <span>{cost.toLocaleString()} Activity Points</span>
                <strong>{reward.title ?? reward.name ?? "Class extra"}</strong>
                <p>{reward.description ?? "An optional extra selected by the educator."}</p>
                {unlocked ? <span className="engagement-unlocked-status">Feature already unlocked</span> : <button type="button" disabled={!canMutate || !enoughPoints || busyAction === `unlock-${id}`} onClick={() => onUnlock(reward, id)}>
                  {busyAction === `unlock-${id}` ? "Unlocking feature…" : "Unlock feature"}
                </button>}
                {!unlocked && !enoughPoints && <small>Earn {(cost - overview.balance).toLocaleString()} more Activity Points to unlock this feature.</small>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClassGroups({ mode, groups, canMutate, busyAction, onJoin, onLeave }) {
  return (
    <section className="dashboard-card engagement-groups-card">
      <div className="engagement-section-heading">
        <div>
          <span className="portal-kicker">CLASS GROUPS</span>
          <h2>Know who chooses each group</h2>
          <p>Teacher-assigned groups are managed by the educator. Student-choice groups let enrolled students join or leave.</p>
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="engagement-empty-copy">No class groups have been created.</p>
      ) : (
        <div className="engagement-group-grid">
          {groups.map((group, index) => {
            const id = itemId(group, `group-${index}`);
            const assignmentMode = group.assignmentMode ?? group.assignment_mode ?? group.mode ?? "teacher_assign";
            const studentChoice = assignmentMode === "student_choice" || assignmentMode === "student-choice";
            const joined = Boolean(group.joined ?? group.is_member ?? group.member);
            const joiningOpen = group.joinOpen ?? group.join_open ?? true;
            return (
              <article key={id}>
                <span className={studentChoice ? "is-choice" : "is-assigned"}>{studentChoice ? "Student-choice group" : "Teacher-assigned group"}</span>
                <strong>{group.name ?? group.title ?? "Class group"}</strong>
                <p>{group.description ?? group.className ?? group.class_name ?? "A group inside this class."}</p>
                <small>{Number(group.memberCount ?? group.member_count ?? group.members ?? 0).toLocaleString()} members</small>
                {mode === "student" && studentChoice && (
                  <button type="button" disabled={!canMutate || (!joined && !joiningOpen) || busyAction === `group-${id}`} onClick={() => joined ? onLeave(group, id) : onJoin(group, id)}>
                    {busyAction === `group-${id}` ? (joined ? "Leaving group…" : "Joining group…") : (joined ? "Leave group" : "Join group")}
                  </button>
                )}
                {mode === "student" && studentChoice && !joiningOpen && !joined && <small className="engagement-group-rule">Your educator has not opened this group for joining.</small>}
                {mode === "student" && !studentChoice && <small className="engagement-group-rule">Your educator assigns this group.</small>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Activities({ mode, activities, classOptions, selectedClassId, canMutate, busyAction, answers, setAnswers, onStudentAction, onStart }) {
  if (mode === "professor") {
    return (
      <section className="dashboard-card engagement-activities-card">
        <div className="engagement-section-heading">
          <div>
            <span className="portal-kicker">CLASS ACTIVITIES</span>
            <h2>Start a quick class activity</h2>
            <p>Live quizzes, polls, and group challenges appear for enrolled students after the activity service confirms them.</p>
          </div>
        </div>
        <div className="engagement-activity-grid">
          {ACTIVITY_BLUEPRINTS.map((activity) => (
            <article key={activity.type}>
              <strong>{activity.title}</strong>
              <p>{activity.description}</p>
              <button type="button" disabled={!canMutate || !selectedClassId || busyAction === `start-${activity.type}`} onClick={() => onStart(activity)}>
                {busyAction === `start-${activity.type}` ? `Starting ${activity.title.toLowerCase()}…` : activity.action}
              </button>
            </article>
          ))}
        </div>
        {!classOptions.length && <p className="engagement-help-copy">Connect a class before starting an activity.</p>}
      </section>
    );
  }

  return (
    <section className="dashboard-card engagement-activities-card">
      <div className="engagement-section-heading">
        <div>
          <span className="portal-kicker">CLASS ACTIVITIES</span>
          <h2>Join what is open now</h2>
          <p>Only activities started by your educator appear here.</p>
        </div>
      </div>
      {activities.length === 0 ? (
        <p className="engagement-empty-copy">No live quiz, poll, or group challenge is open.</p>
      ) : (
        <div className="engagement-activity-grid">
          {activities.map((activity, index) => {
            const id = itemId(activity, `activity-${index}`);
            const type = activity.type ?? activity.activity_type ?? "quiz";
            const choices = asArray(activity.choices ?? activity.options);
            return (
              <article key={id}>
                <span>{type.replaceAll("_", " ")}</span>
                <strong>{activity.title ?? "Class activity"}</strong>
                <p>{activity.description ?? activity.instructions ?? activity.className ?? activity.class_name ?? "Your educator opened this activity."}</p>
                {activity.question?.prompt && <p><strong>{activity.question.prompt}</strong></p>}
                {type === "poll" && choices.length > 0 && (
                  <label>Choose poll answer
                    <select value={answers[id] ?? ""} onChange={(event) => setAnswers({ ...answers, [id]: event.target.value })}>
                      <option value="">Select an answer</option>
                      {choices.map((choice) => {
                        const value = typeof choice === "string" ? choice : choice.value ?? choice.id ?? choice.label;
                        const label = typeof choice === "string" ? choice : choice.label ?? choice.value;
                        return <option value={value} key={value}>{label}</option>;
                      })}
                    </select>
                  </label>
                )}
                <button type="button" disabled={!canMutate || busyAction === `activity-${id}` || (type === "poll" && choices.length > 0 && !answers[id])} onClick={() => onStudentAction(activity, id)}>
                  {busyAction === `activity-${id}` ? "Sending class activity response…" : actionLabelForActivity(activity)}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProfessorControls({ assignmentOptions, groupOptions, selectedClassId, defaultGroupMode, canMutate, busyAction, onAssignPoints, onSaveReward, onCreateGroup, onSetGroupMode }) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [assignmentPoints, setAssignmentPoints] = useState(10);
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardTarget, setRewardTarget] = useState(500);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [newGroupMode, setNewGroupMode] = useState("teacher_assign");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [existingGroupMode, setExistingGroupMode] = useState("teacher_assign");

  const classReady = Boolean(selectedClassId);

  useEffect(() => {
    setNewGroupMode(defaultGroupMode === "student_choice" ? "student_choice" : "teacher_assign");
  }, [defaultGroupMode, selectedClassId]);

  useEffect(() => {
    if (!assignmentOptions.some((assignment) => assignmentId(assignment) === selectedAssignmentId)) {
      setSelectedAssignmentId(assignmentOptions.length ? assignmentId(assignmentOptions[0]) : "");
    }
  }, [assignmentOptions, selectedAssignmentId]);

  useEffect(() => {
    if (!groupOptions.some((group) => String(itemId(group, "")) === String(selectedGroupId))) {
      setSelectedGroupId(groupOptions.length ? String(itemId(groupOptions[0], "")) : "");
    }
  }, [groupOptions, selectedGroupId]);

  useEffect(() => {
    const selectedGroup = groupOptions.find((group) => String(itemId(group, "")) === String(selectedGroupId));
    if (selectedGroup) setExistingGroupMode(selectedGroup.assignment_mode ?? selectedGroup.assignmentMode ?? "teacher_assign");
  }, [groupOptions, selectedGroupId]);

  return (
    <section className="dashboard-card engagement-professor-controls">
      <div className="engagement-section-heading">
        <div>
          <span className="portal-kicker">EDUCATOR CONTROLS</span>
          <h2>Set points, rewards, and class groups</h2>
          <p>Each save goes through the class service. Nothing is stored as a browser-only class record.</p>
        </div>
      </div>
      <div className="engagement-control-grid">
        <form onSubmit={(event) => { event.preventDefault(); onAssignPoints({ selectedAssignmentId, assignmentPoints }); }}>
          <span>ASSIGNMENT POINT VALUE</span>
          <h3>Choose what an assignment earns</h3>
          <label>Choose assignment for points<select required value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}><option value="">{assignmentOptions.length ? "Select an assignment" : "No assignments in this class"}</option>{assignmentOptions.map((assignment) => <option value={assignmentId(assignment)} key={assignmentId(assignment)}>{assignmentLabel(assignment)}</option>)}</select></label>
          <label>Activity Points earned<input required min="0" max="100000" type="number" value={assignmentPoints} onChange={(event) => setAssignmentPoints(Number(event.target.value))} /></label>
          <button type="submit" disabled={!canMutate || !classReady || !selectedAssignmentId || busyAction === "assign-points"}>{busyAction === "assign-points" ? "Assigning points…" : "Assign points"}</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); onSaveReward({ rewardDescription, rewardTarget }); }}>
          <span>CLASS REWARD TARGET</span>
          <h3>Give the class one shared goal</h3>
          <label>Reward description<input required value={rewardDescription} onChange={(event) => setRewardDescription(event.target.value)} placeholder="Example: Choose Friday's review game" /></label>
          <label>Target Activity Points<input required min="1" max="10000000" type="number" value={rewardTarget} onChange={(event) => setRewardTarget(Number(event.target.value))} /></label>
          <button type="submit" disabled={!canMutate || !classReady || !rewardDescription.trim() || busyAction === "save-reward"}>{busyAction === "save-reward" ? "Setting class reward target…" : "Set class reward target"}</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); onCreateGroup({ groupName, groupDescription, groupMode: newGroupMode }); }}>
          <span>CREATE CLASS GROUP</span>
          <h3>Name the group and choose who assigns it</h3>
          <label>Group name<input required value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Example: Lab table 1" /></label>
          <label>Group description<input value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} placeholder="What this group works on" /></label>
          <label>Choose group assignment mode<select value={newGroupMode} onChange={(event) => setNewGroupMode(event.target.value)}><option value="teacher_assign">Teacher assigns students</option><option value="student_choice">Students choose the group</option></select></label>
          <button type="submit" disabled={!canMutate || !classReady || !groupName.trim() || busyAction === "create-group"}>{busyAction === "create-group" ? "Creating class group…" : "Create class group"}</button>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); onSetGroupMode({ selectedGroupId, groupMode: existingGroupMode }); }}>
          <span>CHANGE CLASS GROUP</span>
          <h3>Update who can choose this group</h3>
          <label>Choose class group to change<select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}><option value="">{groupOptions.length ? "Select a class group" : "No class groups available"}</option>{groupOptions.map((group) => <option value={itemId(group, "")} key={itemId(group, "")}>{group.name ?? group.title ?? "Class group"}</option>)}</select></label>
          <label>Choose assignment mode<select value={existingGroupMode} onChange={(event) => setExistingGroupMode(event.target.value)}><option value="teacher_assign">Teacher assigns students</option><option value="student_choice">Students choose the group</option></select></label>
          <p>Student-choice groups open joining. Teacher-assigned groups can only be changed by an educator.</p>
          <button type="submit" disabled={!canMutate || !classReady || !selectedGroupId || busyAction === "set-group-mode"}>{busyAction === "set-group-mode" ? "Changing group assignment mode…" : "Change group assignment mode"}</button>
        </form>
      </div>
    </section>
  );
}

export default function EngagementPoints({ mode = "student", session, classes = [], serviceApi = portalService }) {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [discoveredClasses, setDiscoveredClasses] = useState([]);
  const [status, setStatus] = useState("loading");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [answers, setAnswers] = useState({});
  const userId = session?.user?.id;

  useEffect(() => {
    let active = true;
    async function loadClasses() {
      if (!userId || typeof serviceApi?.listCurrentStudentCourses !== "function") return;
      try {
        const result = await serviceApi.listCurrentStudentCourses();
        if (active && !result?.error) setDiscoveredClasses(asArray(result?.data ?? result));
      } catch {
        if (active) setDiscoveredClasses([]);
      }
    }
    loadClasses();
    return () => { active = false; };
  }, [serviceApi, userId]);

  const loadOverview = useCallback(async ({ quiet = false } = {}) => {
    if (!userId || typeof serviceApi?.getEngagementOverview !== "function") {
      setOverview(EMPTY_OVERVIEW);
      setStatus("preview");
      return;
    }
    if (!selectedClassId) {
      setOverview(EMPTY_OVERVIEW);
      setStatus("empty");
      return;
    }
    if (!quiet) setStatus("loading");
    setError("");
    try {
      const result = await serviceApi.getEngagementOverview(selectedClassId);
      if (result?.error) throw result.error;
      setOverview(normalizeOverview(result, userId, mode));
      setStatus(result?.source === "device" ? "preview" : "connected");
    } catch (loadError) {
      setOverview(EMPTY_OVERVIEW);
      setStatus("error");
      setError(loadError?.message || "Points and class groups could not be loaded.");
    }
  }, [mode, selectedClassId, serviceApi, userId]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (!userId || !selectedClassId || typeof serviceApi?.subscribeToCourseEngagement !== "function") return undefined;
    let refreshTimer;
    const subscription = serviceApi.subscribeToCourseEngagement(selectedClassId, {
      onChange: () => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => loadOverview({ quiet: true }), 100);
      },
    });
    return () => {
      window.clearTimeout(refreshTimer);
      Promise.resolve(subscription?.unsubscribe?.()).catch(() => undefined);
    };
  }, [loadOverview, selectedClassId, serviceApi, userId]);

  const classOptions = useMemo(() => {
    const combined = [...discoveredClasses, ...overview.classes, ...classes];
    return [...new Map(combined.filter((course) => classId(course)).map((course) => [classId(course), course])).values()];
  }, [classes, discoveredClasses, overview.classes]);

  const assignmentOptions = useMemo(() => overview.assignments.filter((assignment) => {
    const assignmentCourseId = assignment.courseId ?? assignment.course_id ?? assignment.classId ?? assignment.class_id;
    return !selectedClassId || !assignmentCourseId || assignmentCourseId === selectedClassId;
  }), [overview.assignments, selectedClassId]);

  useEffect(() => {
    if (classOptions.length && !classOptions.some((course) => String(classId(course)) === String(selectedClassId))) {
      setSelectedClassId(classId(classOptions[0]));
    }
  }, [classOptions, selectedClassId]);

  const canMutate = status === "connected";

  async function runAction({ serviceName, payload, busyKey, successMessage }) {
    const service = serviceApi?.[serviceName];
    if (typeof service !== "function") {
      setNotice("This action is not connected yet. Nothing was changed.");
      return;
    }
    setBusyAction(busyKey);
    setNotice("");
    setError("");
    try {
      const result = await service(payload);
      if (result?.error) throw result.error;
      await loadOverview();
      setNotice(successMessage);
    } catch (actionError) {
      setError(actionError?.message || "The class service did not confirm this action. Nothing was changed.");
    } finally {
      setBusyAction("");
    }
  }

  function unlockReward(reward, id) {
    runAction({ serviceName: "unlockEngagementReward", payload: itemId(reward, id), busyKey: `unlock-${id}`, successMessage: "The class service confirmed the feature unlock." });
  }

  function joinGroup(group, id) {
    runAction({ serviceName: "joinClassGroup", payload: itemId(group, id), busyKey: `group-${id}`, successMessage: "The class service confirmed that you joined the group." });
  }

  function leaveGroup(group, id) {
    runAction({ serviceName: "leaveClassGroup", payload: itemId(group, id), busyKey: `group-${id}`, successMessage: "The class service confirmed that you left the group." });
  }

  function studentActivityAction(activity, id) {
    const type = activity.type ?? activity.activity_type;
    const questionId = activity.questionId ?? activity.question?.id;
    const isPollAnswer = type === "poll" && Boolean(questionId);
    runAction({
      serviceName: isPollAnswer ? "answerClassActivity" : "joinClassActivity",
      payload: isPollAnswer
        ? { activityId: itemId(activity, id), questionId, optionIds: answers[id] ? [answers[id]] : [] }
        : itemId(activity, id),
      busyKey: `activity-${id}`,
      successMessage: isPollAnswer ? "The class service confirmed your poll answer." : "The class service confirmed that you joined the activity.",
    });
  }

  function startActivity(activity) {
    runAction({ serviceName: "startClassActivity", payload: { courseId: selectedClassId, activityType: activity.type, title: activity.title, instructions: activity.description, questions: [] }, busyKey: `start-${activity.type}`, successMessage: `${activity.title} started for the selected class.` });
  }

  return (
    <div className="engagement-page">
      <section className="dashboard-card engagement-intro-card">
        <div>
          <span className="portal-kicker">POINTS & GROUPS</span>
          <h1>{mode === "professor" ? "Reward activity without changing grades." : "See what you earned and where you belong."}</h1>
          <p>{mode === "professor" ? "Set Activity Points, a shared class reward, and clear group rules from one screen." : "Activity Points, class rewards, and groups are separate from your grade and easy to check in one place."}</p>
        </div>
        <span className={`engagement-connection-status is-${status}`}>{status === "connected" ? "Class data connected" : status === "loading" ? "Loading points and groups" : status === "error" ? "Class data unavailable" : status === "empty" ? "Choose a connected class" : "Setup preview only"}</span>
      </section>

      {status === "preview" && <div className="engagement-honesty-note" role="status"><strong>Setup preview only.</strong><span>The points and groups service is not connected, so this screen will not save, join, unlock, or start anything yet.</span></div>}
      {status === "empty" && <div className="engagement-honesty-note" role="status"><strong>Choose a class.</strong><span>Points, rewards, groups, and live activities load one class at a time.</span></div>}
      {error && <div className="portal-form-error engagement-error" role="alert"><span>{error}</span><button type="button" onClick={loadOverview}>Reload points and groups</button></div>}
      {notice && <div className="portal-form-notice" role="status">{notice}</div>}

      <section className="dashboard-card engagement-course-filter">
        <label className="engagement-class-picker">Choose class for points and groups
          <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
            <option value="">{classOptions.length ? "Select a connected class" : "No connected classes"}</option>
            {classOptions.map((course) => <option value={classId(course)} key={classId(course)}>{classLabel(course)}</option>)}
          </select>
        </label>
      </section>

      <div className="engagement-summary-grid">
        <PointsSummary overview={overview} ledgerOpen={ledgerOpen} onToggleLedger={() => setLedgerOpen((open) => !open)} />
        <ClassRewardProgress rewards={overview.classRewards} />
      </div>

      <RewardsStore overview={overview} canMutate={canMutate} busyAction={busyAction} onUnlock={unlockReward} />
      <ClassGroups mode={mode} groups={overview.groups} canMutate={canMutate} busyAction={busyAction} onJoin={joinGroup} onLeave={leaveGroup} />

      {mode === "professor" && (
        <ProfessorControls
          assignmentOptions={assignmentOptions}
          groupOptions={overview.groups}
          selectedClassId={selectedClassId}
          defaultGroupMode={overview.settings[0]?.default_group_assignment_mode ?? overview.settings[0]?.defaultGroupAssignmentMode}
          canMutate={canMutate}
          busyAction={busyAction}
          onAssignPoints={({ selectedAssignmentId, assignmentPoints }) => runAction({ serviceName: "setAssignmentPointValue", payload: { courseId: selectedClassId, assignmentId: selectedAssignmentId, points: assignmentPoints }, busyKey: "assign-points", successMessage: "The assignment Activity Point value was saved." })}
          onSaveReward={({ rewardDescription, rewardTarget }) => runAction({ serviceName: "saveClassEngagementGoal", payload: { courseId: selectedClassId, title: rewardDescription.trim(), description: rewardDescription.trim(), targetPoints: rewardTarget }, busyKey: "save-reward", successMessage: "The class reward target was saved." })}
          onCreateGroup={({ groupName, groupDescription, groupMode }) => runAction({ serviceName: "createClassGroup", payload: { courseId: selectedClassId, name: groupName.trim(), description: groupDescription.trim(), assignmentMode: groupMode }, busyKey: "create-group", successMessage: "The class group was created." })}
          onSetGroupMode={({ selectedGroupId, groupMode }) => runAction({ serviceName: "setClassGroupAssignmentMode", payload: { groupId: selectedGroupId, assignmentMode: groupMode, joinOpen: groupMode === "student_choice" }, busyKey: "set-group-mode", successMessage: "The class group assignment mode was changed." })}
        />
      )}

      <Activities
        mode={mode}
        activities={overview.activities}
        classOptions={classOptions}
        selectedClassId={selectedClassId}
        canMutate={canMutate}
        busyAction={busyAction}
        answers={answers}
        setAnswers={setAnswers}
        onStudentAction={studentActivityAction}
        onStart={startActivity}
      />
    </div>
  );
}
