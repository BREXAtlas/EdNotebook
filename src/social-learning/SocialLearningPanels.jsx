import { useEffect, useMemo, useState } from "react";
import {
  SOCIAL_LEARNING_CATEGORIES,
  SOCIAL_LEARNING_MILESTONES,
  SOCIAL_LEARNING_VISUALS,
  categoryLabel,
  hasRewardReversal,
  rewardSemanticFingerprint,
  rewardVisual,
  summarizeRewardLedger,
} from "./socialLearningModel.js";
import {
  correctSocialLearningReward,
  issueSocialLearningReward,
  loadManagedSocialLearning,
  loadStudentSocialLearning,
} from "./socialLearningService.js";
import "./social-learning.css";

function readUnlockPreferences(key) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key));
    return Array.isArray(saved) ? saved.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function RecognitionMark({ visualKey, label, large = false }) {
  const visual = rewardVisual(visualKey);
  return (
    <span
      className={`social-learning-mark ${large ? "is-large" : ""} is-${visual.value}`}
      role="img"
      aria-label={`${visual.label} recognition for ${label}`}
    >
      {visual.symbol}
    </span>
  );
}

function LearningBoundary() {
  return (
    <aside className="social-learning-boundary">
      <strong>Recognition, not a grade</strong>
      <p>
        Social Education Learning points celebrate specific evidence, growth, and contribution.
        They never change a score, unlock course content, or affect academic standing.
      </p>
    </aside>
  );
}

function MilestoneShelf({ summary, milestones }) {
  return (
    <section className="social-learning-shelf" aria-labelledby="social-learning-shelf-title">
      <div>
        <span className="portal-kicker">TROPHY SHELF</span>
        <h2 id="social-learning-shelf-title">Milestones earned through learning</h2>
        <p>Every threshold is fixed and visible. There are no mystery prizes or purchasable points.</p>
      </div>
      <div className="social-learning-badges">
        {milestones.map((milestone) => {
          const earned = summary.totalPoints >= milestone.threshold_points;
          return (
            <article className={earned ? "is-earned" : ""} key={milestone.threshold_points}>
              <span aria-hidden="true">{earned ? "★" : "○"}</span>
              <strong>{milestone.badge_name}</strong>
              <small>{milestone.threshold_points} points</small>
              <p>{milestone.badge_description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UnlockPath({ summary, milestones, enabledUnlocks = [], onToggle }) {
  return (
    <section className="social-learning-unlocks dashboard-card">
      <div className="dashboard-card-heading">
        <div>
          <span className="portal-kicker">OPTIONAL EXPERIENCE PATH</span>
          <h2>Useful extras, never academic gates</h2>
        </div>
        <strong>{summary.currentBadge}</strong>
      </div>
      <div className="social-learning-path" role="list" aria-label="Deterministic reward milestones">
        {milestones.map((milestone) => {
          const earned = summary.totalPoints >= milestone.threshold_points;
          return (
            <article className={earned ? "is-earned" : ""} role="listitem" key={milestone.unlock_key}>
              <span>{milestone.threshold_points}</span>
              <div>
                <strong>{milestone.unlock_name}</strong>
                <p>{milestone.unlock_description}</p>
                <small>{earned ? "Available" : "Not yet reached"} · Optional</small>
                <button
                  type="button"
                  disabled={!earned}
                  onClick={() => onToggle?.(milestone.unlock_key)}
                >
                  {enabledUnlocks.includes(milestone.unlock_key) ? "Turn off" : "Try this"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Ledger({ events, roster = [], professorMode = false, onCorrect }) {
  if (!events.length) {
    return <div className="social-learning-empty">No recognition has been recorded yet.</div>;
  }
  return (
    <div className="social-learning-ledger" role="list" aria-label="Append-only recognition history">
      {events.map((event) => {
        const student = roster.find((row) => row.student_id === event.student_id && row.course_id === event.course_id);
        const reversed = event.event_type === "award" && hasRewardReversal(event.id, events);
        return (
          <article
            className={`social-learning-ledger-row is-${event.event_type} ${reversed ? "is-reversed" : ""}`}
            role="listitem"
            key={event.id}
          >
            <RecognitionMark visualKey={event.visual_key} label={event.reward_name} />
            <div>
              <span>{event.event_type === "award" ? categoryLabel(event.category) : `${event.event_type} record`}</span>
              <strong>{event.reward_name}</strong>
              {professorMode && student && <small>{student.student_display_name} · {student.course_code}</small>}
              <p>{event.reason}</p>
              <small>{event.activity_reference} · {new Date(event.created_at).toLocaleString()}</small>
            </div>
            <div className="social-learning-ledger-points">
              <strong>{event.points_delta > 0 ? "+" : ""}{event.points_delta}</strong>
              <span>points</span>
              {reversed && <small>reversed</small>}
              {professorMode && event.event_type === "award" && !reversed && (
                <button type="button" onClick={() => onCorrect(event)}>Correct</button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ProfessorSocialLearningPanel() {
  const [state, setState] = useState({
    roster: [],
    events: [],
    milestones: SOCIAL_LEARNING_MILESTONES,
    source: "loading",
    error: null,
  });
  const [form, setForm] = useState({
    courseId: "",
    studentId: "",
    rewardName: "Source Scout",
    visualKey: "compass",
    category: "source_literacy",
    activityReference: "Digital Literacy · Lateral reading source check",
    points: 25,
    reason: "Compared the claim across multiple sources and clearly explained which evidence was most trustworthy.",
  });
  const [correction, setCorrection] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadManagedSocialLearning().then((result) => {
      if (!active) return;
      setState(result);
      const first = result.roster[0];
      if (first) setForm((current) => ({ ...current, courseId: first.course_id, studentId: first.student_id }));
    });
    return () => { active = false; };
  }, []);

  const courseRows = useMemo(
    () => [...new Map(state.roster.map((row) => [row.course_id, row])).values()],
    [state.roster]
  );
  const studentRows = useMemo(
    () => state.roster.filter((row) => row.course_id === form.courseId),
    [state.roster, form.courseId]
  );
  const selectedEvents = useMemo(
    () => state.events.filter((event) => event.course_id === form.courseId && event.student_id === form.studentId),
    [state.events, form.courseId, form.studentId]
  );
  const summary = useMemo(
    () => summarizeRewardLedger(selectedEvents, state.milestones),
    [selectedEvents, state.milestones]
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseCourse(courseId) {
    const firstStudent = state.roster.find((row) => row.course_id === courseId);
    setForm((current) => ({ ...current, courseId, studentId: firstStudent?.student_id || "" }));
  }

  async function submitReward(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const fingerprint = rewardSemanticFingerprint(form);
    const duplicate = selectedEvents.some((item) => item.event_type === "award" && rewardSemanticFingerprint({
      courseId: item.course_id,
      studentId: item.student_id,
      rewardName: item.reward_name,
      category: item.category,
      activityReference: item.activity_reference,
    }) === fingerprint);
    if (duplicate) {
      setError("This student already has that named reward for the same learning activity. Open its correction record instead.");
      setBusy(false);
      return;
    }

    const result = await issueSocialLearningReward(
      { ...form, points: Number(form.points), idempotencyKey: crypto.randomUUID() },
      { demo: state.source === "demo" }
    );
    if (result.error || !result.data) {
      setError(result.error?.message || "The recognition could not be recorded.");
    } else {
      setState((current) => ({ ...current, events: [result.data, ...current.events] }));
      setNotice(`Recorded “${form.rewardName}” in the append-only learning ledger.`);
    }
    setBusy(false);
  }

  function openCorrection(source) {
    const related = state.events.filter((event) => event.id === source.id || event.source_event_id === source.id);
    const currentPoints = related.reduce((sum, event) => sum + Number(event.points_delta || 0), 0);
    setCorrection({
      source,
      type: "adjustment",
      pointsDelta: -5,
      currentPoints,
      reason: "Corrected the original point entry after reviewing the learning evidence.",
    });
    setError("");
    setNotice("");
  }

  async function submitCorrection(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const adjustment = Number(correction.pointsDelta);
    if (
      correction.type === "adjustment"
      && (
        !Number.isInteger(adjustment)
        || adjustment === 0
        || correction.currentPoints + adjustment < 1
        || correction.currentPoints + adjustment > 100
      )
    ) {
      setError("An adjustment must leave this reward between 1 and 100 points. Use full reversal to remove it.");
      setBusy(false);
      return;
    }
    const result = await correctSocialLearningReward(
      {
        ...correction,
        pointsDelta: adjustment,
        idempotencyKey: crypto.randomUUID(),
      },
      { demo: state.source === "demo" }
    );
    if (result.error || !result.data) {
      setError(result.error?.message || "The correction could not be recorded.");
    } else {
      setState((current) => ({ ...current, events: [result.data, ...current.events] }));
      setNotice(`${correction.type === "reversal" ? "Reversal" : "Adjustment"} recorded. The original entry remains visible.`);
      setCorrection(null);
    }
    setBusy(false);
  }

  const selectedStudent = studentRows.find((row) => row.student_id === form.studentId);
  const visual = rewardVisual(form.visualKey);

  return (
    <div className="professor-panel-stack social-learning-workspace">
      <section className="social-learning-professor-hero">
        <div>
          <span>SOCIAL EDUCATION LEARNING</span>
          <h1>Make learning progress feel seen.</h1>
          <p>Give warm, specific recognition for a real learning moment. Students see the same reason and every correction.</p>
        </div>
        <LearningBoundary />
      </section>

      {state.source === "demo" && (
        <div className="portal-form-notice" role="status">
          Digital Literacy Course example · preview records stay on this screen until the connected migration is available.
        </div>
      )}
      {state.error && (
        <div className="portal-form-error" role="alert">
          Social Education Learning is not connected yet: {state.error.message}
        </div>
      )}

      <section className="social-learning-professor-grid">
        <form className="dashboard-card social-learning-award-form" onSubmit={submitReward}>
          <div>
            <span className="portal-kicker">PROFESSOR RECOGNITION</span>
            <h2>Create a learning reward</h2>
            <p>Name the exact learning moment. Points are capped and cannot be purchased or attached to a grade.</p>
          </div>
          <div className="social-learning-form-grid">
            <label>
              Course
              <select required value={form.courseId} onChange={(event) => chooseCourse(event.target.value)}>
                {courseRows.map((row) => <option value={row.course_id} key={row.course_id}>{row.course_code} · {row.course_title}</option>)}
              </select>
            </label>
            <label>
              Student
              <select required value={form.studentId} onChange={(event) => updateForm("studentId", event.target.value)}>
                {studentRows.map((row) => <option value={row.student_id} key={row.student_id}>{row.student_display_name}</option>)}
              </select>
            </label>
            <label>
              Named reward
              <input required minLength={2} maxLength={80} value={form.rewardName} onChange={(event) => updateForm("rewardName", event.target.value)} />
            </label>
            <label>
              Category
              <select value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
                {SOCIAL_LEARNING_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
              </select>
            </label>
            <label className="social-learning-wide-field">
              Lesson, assignment, quest, or learning moment
              <input required minLength={3} maxLength={160} value={form.activityReference} onChange={(event) => updateForm("activityReference", event.target.value)} />
              <small>This reference is part of the duplicate guard.</small>
            </label>
            <fieldset className="social-learning-visual-picker">
              <legend>Friendly visual</legend>
              {SOCIAL_LEARNING_VISUALS.map((item) => (
                <label className={form.visualKey === item.value ? "is-selected" : ""} key={item.value}>
                  <input type="radio" name="reward-visual" value={item.value} checked={form.visualKey === item.value} onChange={() => updateForm("visualKey", item.value)} />
                  <span aria-hidden="true">{item.symbol}</span>
                  <small>{item.label}</small>
                </label>
              ))}
            </fieldset>
            <label>
              Points
              <input type="number" required min={1} max={100} value={form.points} onChange={(event) => updateForm("points", event.target.value)} />
              <small>1–100, proportional to the learning evidence</small>
            </label>
            <label className="social-learning-wide-field">
              Plain-language reason
              <textarea required minLength={10} maxLength={500} rows={4} value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} />
            </label>
          </div>
          {error && <div className="portal-form-error" role="alert">{error}</div>}
          {notice && <div className="portal-form-notice" role="status">{notice}</div>}
          <button type="submit" disabled={busy || !form.courseId || !form.studentId}>
            {busy ? "Recording…" : "Give recognition"}
          </button>
        </form>

        <aside className="social-learning-preview" aria-label="Student celebration preview">
          <span>STUDENT CELEBRATION PREVIEW</span>
          <RecognitionMark visualKey={form.visualKey} label={form.rewardName} large />
          <small>{visual.label} recognition</small>
          <h2>{form.rewardName || "Named learning reward"}</h2>
          <strong>+{Number(form.points) || 0} points</strong>
          <p>{form.reason || "The professor’s plain-language message appears here."}</p>
          <footer>{selectedStudent?.student_display_name || "Selected student"} · private by default</footer>
        </aside>
      </section>

      {correction && (
        <form className="dashboard-card social-learning-correction" onSubmit={submitCorrection}>
          <div>
            <span className="portal-kicker">APPEND-ONLY CORRECTION</span>
            <h2>Correct “{correction.source.reward_name}”</h2>
            <p>The original stays visible. This creates a linked adjustment or full reversal.</p>
          </div>
          <label>
            Correction type
            <select value={correction.type} onChange={(event) => setCorrection((current) => ({ ...current, type: event.target.value }))}>
              <option value="adjustment">Point adjustment</option>
              <option value="reversal">Full reversal</option>
            </select>
          </label>
          {correction.type === "adjustment" && (
            <label>
              Point change
              <input type="number" min={-100} max={100} value={correction.pointsDelta} onChange={(event) => setCorrection((current) => ({ ...current, pointsDelta: event.target.value }))} />
              <small>Current reward value: {correction.currentPoints} points</small>
            </label>
          )}
          <label>
            Correction reason
            <textarea required minLength={10} maxLength={500} rows={3} value={correction.reason} onChange={(event) => setCorrection((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <div>
            <button type="button" onClick={() => setCorrection(null)}>Cancel</button>
            <button type="submit" disabled={busy}>{busy ? "Recording…" : "Record correction"}</button>
          </div>
        </form>
      )}

      <section className="dashboard-card">
        <div className="dashboard-card-heading">
          <div>
            <span className="portal-kicker">TRANSPARENT LEDGER</span>
            <h2>{selectedStudent?.student_display_name || "Student"} · {summary.totalPoints} points</h2>
          </div>
          <span>{summary.pointsToNext ? `${summary.pointsToNext} to ${summary.nextMilestone.badge_name}` : "All current milestones reached"}</span>
        </div>
        <Ledger events={selectedEvents} roster={state.roster} professorMode onCorrect={openCorrection} />
      </section>
    </div>
  );
}

export function StudentSocialLearningPanel({ userId, demo = false, onSummary }) {
  const [state, setState] = useState({
    events: [],
    milestones: SOCIAL_LEARNING_MILESTONES,
    source: "loading",
    error: null,
  });
  const preferenceKey = `ednotebook-social-learning-unlocks-${demo ? "digital-literacy-demo" : userId || "guest"}`;
  const [enabledUnlocks, setEnabledUnlocks] = useState(() => readUnlockPreferences(preferenceKey));

  useEffect(() => {
    let active = true;
    loadStudentSocialLearning({ userId, demo }).then((result) => {
      if (!active) return;
      setState(result);
    });
    return () => { active = false; };
  }, [userId, demo]);

  useEffect(() => {
    setEnabledUnlocks(readUnlockPreferences(preferenceKey));
  }, [preferenceKey]);

  const summary = useMemo(
    () => summarizeRewardLedger(state.events, state.milestones),
    [state.events, state.milestones]
  );
  const activeUnlocks = useMemo(
    () => enabledUnlocks.filter((unlockKey) => {
      const milestone = state.milestones.find((item) => item.unlock_key === unlockKey);
      return milestone && summary.totalPoints >= milestone.threshold_points;
    }),
    [enabledUnlocks, state.milestones, summary.totalPoints]
  );
  const latestAward = state.events.find(
    (event) => event.event_type === "award" && !hasRewardReversal(event.id, state.events)
  );

  useEffect(() => {
    onSummary?.(summary);
  }, [onSummary, summary]);

  function toggleUnlock(unlockKey) {
    const milestone = state.milestones.find((item) => item.unlock_key === unlockKey);
    if (!milestone || summary.totalPoints < milestone.threshold_points) return;
    setEnabledUnlocks((current) => {
      const next = current.includes(unlockKey)
        ? current.filter((item) => item !== unlockKey)
        : [...current, unlockKey];
      window.localStorage.setItem(preferenceKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className={`student-panel-stack social-learning-workspace ${activeUnlocks.includes("focus_palette") ? "is-focus-palette" : ""}`}>
      <section className="social-learning-celebration">
        <div className="social-learning-celebration-copy">
          <span>SOCIAL EDUCATION LEARNING</span>
          <h1>{latestAward ? `You earned “${latestAward.reward_name}.”` : "Your learning deserves to be seen."}</h1>
          <p>
            {latestAward?.reason || "When a professor recognizes a specific learning moment, the reason and points will appear here."}
          </p>
          {latestAward && <small>{latestAward.issuer_display_name} · {latestAward.activity_reference}</small>}
        </div>
        <div className="social-learning-celebration-mark">
          <RecognitionMark visualKey={latestAward?.visual_key || "spark"} label={latestAward?.reward_name || "Learning progress"} large />
          <strong>{summary.totalPoints}</strong>
          <span>learning points</span>
        </div>
      </section>

      <section className="dashboard-card social-learning-progress-card">
        <div>
          <span className="portal-kicker">YOUR PROGRESS PATH</span>
          <h2>{summary.currentBadge}</h2>
          <p>
            {summary.nextMilestone
              ? `${summary.pointsToNext} points to ${summary.nextMilestone.badge_name}`
              : "You reached every current milestone."}
          </p>
        </div>
        <div className="social-learning-progress-track" aria-label={`${Math.round(summary.progressPercent)} percent to next milestone`}>
          <i style={{ width: `${summary.progressPercent}%` }} />
        </div>
      </section>

      {state.source === "demo" && (
        <div className="portal-form-notice" role="status">
          Digital Literacy Course example · these are synthetic demonstration rewards.
        </div>
      )}
      {state.error && (
        <div className="portal-form-error" role="alert">
          Your learning recognition could not be loaded yet: {state.error.message}
        </div>
      )}

      <MilestoneShelf summary={summary} milestones={state.milestones} />
      <UnlockPath
        summary={summary}
        milestones={state.milestones}
        enabledUnlocks={activeUnlocks}
        onToggle={toggleUnlock}
      />

      {activeUnlocks.includes("source_organizer_layout") && (
        <section className="dashboard-card social-learning-unlocked-aid">
          <span className="portal-kicker">SOURCE ORGANIZER LAYOUT · ON</span>
          <h2>A quick source-check path</h2>
          <div>
            <article><strong>1 · Identify</strong><p>Who made the source, and what are they asking you to believe?</p></article>
            <article><strong>2 · Check sideways</strong><p>Open other reliable sources before spending too long on the original page.</p></article>
            <article><strong>3 · Save the evidence</strong><p>Record the author, title, date, link, and the reason you trust or question it.</p></article>
          </div>
        </section>
      )}

      {activeUnlocks.includes("reflection_prompt_pack") && (
        <section className="dashboard-card social-learning-unlocked-aid">
          <span className="portal-kicker">REFLECTION PROMPT PACK · ON</span>
          <h2>Describe the learning, not just the points</h2>
          <ul>
            <li>What did you change after checking the evidence?</li>
            <li>Which part of your process would you repeat next time?</li>
            <li>What question can your professor help you answer next?</li>
          </ul>
        </section>
      )}

      {activeUnlocks.includes("private_badge_display") && (
        <aside className="social-learning-private-display">
          <strong>Private badge display is on for this trophy shelf.</strong>
          <span>Nothing is posted to a profile or shared with classmates automatically.</span>
        </aside>
      )}

      <section className="dashboard-card">
        <div className="dashboard-card-heading">
          <div>
            <span className="portal-kicker">WHY YOU EARNED IT</span>
            <h2>Your complete recognition history</h2>
            <p>Award, adjustment, and reversal records stay together so the total is understandable.</p>
          </div>
        </div>
        <Ledger events={state.events} />
      </section>

      <LearningBoundary />
    </div>
  );
}
