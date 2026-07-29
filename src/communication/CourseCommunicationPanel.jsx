import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COURSE_COMMUNICATION_LIMITS,
  audienceLabel,
  countUnreadCommunication,
  groupCourseThreads,
  visibleReadTargets,
} from "./courseCommunicationModel.js";
import {
  listCommunicationCourses,
  loadCourseCommunication,
  markCourseCommunicationRead,
  publishCourseAnnouncement,
  saveCourseCommunicationPreferences,
  sendCourseMessage,
  subscribeCourseCommunication,
} from "./courseCommunicationService.js";
import "./course-communication.css";

function readDeviceNotes(key) {
  try {
    const notes = JSON.parse(window.sessionStorage.getItem(key) || "[]");
    return Array.isArray(notes) ? notes : [];
  } catch {
    return [];
  }
}

function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function EmptyCourseState({ role, educationDivision }) {
  const divisionLabel = educationDivision === "k12"
    ? "K–12"
    : educationDivision === "both" ? "university or K–12" : "university";
  return (
    <section className="course-communication-empty" role="status">
      <strong>No synced {divisionLabel} course is available.</strong>
      <p>
        {role === "professor"
          ? "Create or join a course as a current manager before publishing course communication."
          : "Course communication opens after an educator approves your active enrollment."}
      </p>
    </section>
  );
}

function DeviceNotes({ storageKey }) {
  const [notes, setNotes] = useState(() => readDeviceNotes(storageKey));
  const [body, setBody] = useState("");

  function save(event) {
    event.preventDefault();
    if (!body.trim()) return;
    const next = [...notes, {
      id: crypto.randomUUID(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    }];
    setNotes(next);
    window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    setBody("");
  }

  function clear() {
    setNotes([]);
    window.sessionStorage.removeItem(storageKey);
  }

  return (
    <section className="course-device-notes">
      <div className="course-communication-warning" role="note">
        <strong>Device-only notes are not messages.</strong>
        <span>Nothing here is sent to a professor or student, synced, delivered, or saved after this browser session ends.</span>
      </div>
      <div className="course-device-note-list">
        {notes.length === 0
          ? <p>No private notes in this browser session.</p>
          : notes.map((note) => (
            <article key={note.id}>
              <strong>Private device note</strong>
              <time dateTime={note.createdAt}>{formatWhen(note.createdAt)}</time>
              <p>{note.body}</p>
            </article>
          ))}
      </div>
      <form onSubmit={save}>
        <label>
          Private note
          <textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a note that stays in this browser session…"
          />
        </label>
        <div>
          <button type="submit" disabled={!body.trim()}>Save device-only note</button>
          <button type="button" className="is-secondary" onClick={clear} disabled={notes.length === 0}>Clear this session</button>
        </div>
      </form>
    </section>
  );
}

export default function CourseCommunicationPanel({
  role,
  session,
  educationDivision = "university",
  initialCourseId = null,
  headingLevel = "h1",
}) {
  const Heading = headingLevel;
  const [mode, setMode] = useState("cloud");
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(initialCourseId || "");
  const [snapshot, setSnapshot] = useState({
    messages: [],
    announcements: [],
    reads: [],
    preferences: { notifyAnnouncements: true, notifyReplies: true },
    resources: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");
  const [messageBody, setMessageBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [attachmentResourceId, setAttachmentResourceId] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [preferences, setPreferences] = useState({ notifyAnnouncements: true, notifyReplies: true });
  const activeCourse = courses.find((course) => course.id === courseId) || null;
  const deviceDivision = activeCourse?.education_division || educationDivision;
  const deviceStorageKey = `ednotebook-${deviceDivision}-${role}-${session?.user?.id || "guest"}-session-device-notes`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    listCommunicationCourses({ role, educationDivision }).then((result) => {
      if (!active) return;
      const nextCourses = result.data || [];
      setCourses(nextCourses);
      setError(result.error?.message || "");
      setCourseId((current) => {
        if (nextCourses.some((course) => course.id === current)) return current;
        if (nextCourses.some((course) => course.id === initialCourseId)) return initialCourseId;
        return nextCourses[0]?.id || "";
      });
      setLoading(false);
    });
    return () => { active = false; };
  }, [educationDivision, initialCourseId, role, session?.user?.id]);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!courseId) return;
    if (!quiet) setLoading(true);
    const result = await loadCourseCommunication(courseId);
    if (result.error) {
      setError("Synced course communication is unavailable. Device-only notes remain separate and are not delivered.");
    } else {
      setSnapshot(result.data);
      setPreferences(result.data.preferences);
      setError("");
    }
    if (!quiet) setLoading(false);
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return undefined;
    let active = true;
    refresh();
    const unsubscribe = subscribeCourseCommunication(
      courseId,
      () => { if (active) refresh({ quiet: true }); },
      (status) => { if (active) setRealtimeStatus(status); }
    );
    const fallbackTimer = window.setInterval(
      () => { if (active) refresh({ quiet: true }); },
      COURSE_COMMUNICATION_LIMITS.refreshMilliseconds
    );
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(fallbackTimer);
    };
  }, [courseId, refresh]);

  const grouped = useMemo(() => groupCourseThreads(snapshot.messages), [snapshot.messages]);
  const unread = useMemo(() => countUnreadCommunication({
    ...snapshot,
    preferences,
  }), [preferences, snapshot]);

  async function submitMessage(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const result = await sendCourseMessage({
      courseId,
      body: messageBody,
      kind: replyTo ? "reply" : role === "student" ? "question" : "course_note",
      parentMessageId: replyTo?.id || null,
      attachmentResourceId: attachmentResourceId || null,
    });
    if (result.error) setError(result.error.message || "The course message could not be sent.");
    else {
      setMessageBody("");
      setReplyTo(null);
      setAttachmentResourceId("");
      setNotice("Sent to the current course room.");
      await refresh({ quiet: true });
    }
    setBusy(false);
  }

  async function submitAnnouncement(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const result = await publishCourseAnnouncement({
      courseId,
      title: announcementTitle,
      body: announcementBody,
    });
    if (result.error) setError(result.error.message || "The announcement could not be published.");
    else {
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setNotice("Announcement published to currently enrolled students and course educators.");
      await refresh({ quiet: true });
    }
    setBusy(false);
  }

  async function markVisibleRead() {
    const targets = visibleReadTargets(snapshot);
    if (!targets.messageIds.length && !targets.announcementIds.length) return;
    setBusy(true);
    const result = await markCourseCommunicationRead({ courseId, ...targets });
    if (result.error) setError(result.error.message || "Read state could not be saved.");
    else {
      setNotice("Visible course communication marked as read.");
      await refresh({ quiet: true });
    }
    setBusy(false);
  }

  async function savePreferences(event) {
    event.preventDefault();
    setBusy(true);
    const result = await saveCourseCommunicationPreferences({ courseId, ...preferences });
    if (result.error) setError(result.error.message || "Notification preferences could not be saved.");
    else setNotice("In-app notification preferences saved for this course.");
    setBusy(false);
  }

  return (
    <section className="course-communication-shell" aria-labelledby="course-communication-title">
      <header className="course-communication-heading">
        <div>
          <span className="portal-kicker">COURSE COMMUNICATION</span>
          <Heading id="course-communication-title">Announcements, questions, and replies in one course room.</Heading>
          <p>No public feed, grades, reward details, private student IDs, email addresses, or attachment bytes are placed in messages.</p>
        </div>
        <div className="course-communication-status">
          <strong aria-label={`${unread} unread course notifications`}>{unread} unread</strong>
          <span>{realtimeStatus === "SUBSCRIBED" ? "Live updates connected" : "30-second refresh active"}</span>
        </div>
      </header>

      <div className="course-communication-mode" role="tablist" aria-label="Communication storage">
        <button type="button" role="tab" aria-selected={mode === "cloud"} className={mode === "cloud" ? "is-active" : ""} onClick={() => setMode("cloud")}>
          Synced course room
          <small>Authorized cloud delivery</small>
        </button>
        <button type="button" role="tab" aria-selected={mode === "device"} className={mode === "device" ? "is-active" : ""} onClick={() => setMode("device")}>
          Device-only notes
          <small>Private · not sent · not synced</small>
        </button>
      </div>

      {mode === "device" ? <DeviceNotes key={deviceStorageKey} storageKey={deviceStorageKey} /> : (
        <div className="course-communication-cloud">
          {courses.length > 0 && (
            <div className="course-communication-toolbar">
              <label>
                Course
                <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.education_division === "k12" ? "K–12" : "University"} · {course.course_code || "COURSE"} · {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span>{activeCourse ? audienceLabel(activeCourse) : "Choose a course"}</span>
                <button type="button" className="is-secondary" onClick={() => refresh()} disabled={loading}>Refresh now</button>
                <button type="button" className="is-secondary" onClick={markVisibleRead} disabled={busy || unread === 0}>Mark visible as read</button>
              </div>
            </div>
          )}

          {error && <div className="course-communication-alert is-error" role="alert">{error}</div>}
          {notice && <div className="course-communication-alert is-success" role="status">{notice}</div>}
          {!loading && courses.length === 0 && <EmptyCourseState role={role} educationDivision={educationDivision} />}
          {loading && <div className="course-communication-loading" role="status">Loading the current course room…</div>}

          {!loading && activeCourse && (
            <>
              <section className="course-announcements" aria-labelledby="course-announcements-title">
                <div className="course-communication-section-heading">
                  <div>
                    <span>ANNOUNCEMENTS</span>
                    <h2 id="course-announcements-title">Professor updates</h2>
                  </div>
                  <small>Audience: {audienceLabel(activeCourse)}</small>
                </div>
                {role === "professor" && (
                  <form className="course-announcement-composer" onSubmit={submitAnnouncement}>
                    <label>
                      Title
                      <input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={COURSE_COMMUNICATION_LIMITS.announcementTitleCharacters} />
                    </label>
                    <label>
                      Announcement
                      <textarea rows={4} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={COURSE_COMMUNICATION_LIMITS.messageCharacters} />
                    </label>
                    <button type="submit" disabled={busy || !announcementTitle.trim() || !announcementBody.trim()}>Publish to this course</button>
                  </form>
                )}
                <div className="course-announcement-list">
                  {snapshot.announcements.length === 0
                    ? <p>No published course announcements.</p>
                    : snapshot.announcements.map((announcement) => (
                      <article key={announcement.id}>
                        <header>
                          <span>Entire course</span>
                          <time dateTime={announcement.publishedAt}>{formatWhen(announcement.publishedAt)}</time>
                        </header>
                        <h3>{announcement.title}</h3>
                        <p>{announcement.body}</p>
                      </article>
                    ))}
                </div>
              </section>

              <section className="course-question-room" aria-labelledby="course-questions-title">
                <div className="course-communication-section-heading">
                  <div>
                    <span>QUESTIONS &amp; REPLIES</span>
                    <h2 id="course-questions-title">Shared course thread</h2>
                  </div>
                  <small>Showing at most {COURSE_COMMUNICATION_LIMITS.visibleMessages} recent items · no infinite feed</small>
                </div>

                <div className="course-thread-list" aria-live="polite">
                  {grouped.threads.length === 0 && grouped.notes.length === 0
                    ? <p>No course questions yet.</p>
                    : <>
                      {grouped.notes.map((note) => (
                        <article className="course-thread-note" key={note.id}>
                          <header><strong>{note.own ? "You" : note.senderLabel}</strong><span>Course note · Entire course</span><time dateTime={note.createdAt}>{formatWhen(note.createdAt)}</time></header>
                          <p>{note.body}</p>
                          {note.attachment && <small>Authorized resource reference · {note.attachment.title}</small>}
                        </article>
                      ))}
                      {grouped.threads.map(({ question, replies }) => (
                        <article className="course-thread" key={question.id}>
                          <header>
                            <div><strong>{question.own ? "You" : question.senderLabel}</strong><span>Question · Entire course</span></div>
                            <time dateTime={question.createdAt}>{formatWhen(question.createdAt)}</time>
                          </header>
                          <p>{question.body}</p>
                          {question.attachment && <small>Authorized resource reference · {question.attachment.title}</small>}
                          <button type="button" className="course-thread-reply-button" onClick={() => setReplyTo(question)}>Reply in this course</button>
                          {replies.length > 0 && (
                            <div className="course-thread-replies">
                              {replies.map((reply) => (
                                <article key={reply.id}>
                                  <header><strong>{reply.own ? "You" : reply.senderLabel}</strong><time dateTime={reply.createdAt}>{formatWhen(reply.createdAt)}</time></header>
                                  <p>{reply.body}</p>
                                  {reply.attachment && <small>Authorized resource reference · {reply.attachment.title}</small>}
                                </article>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </>}
                </div>

                <form className="course-message-composer" onSubmit={submitMessage}>
                  {replyTo && (
                    <div className="course-reply-context">
                      <span>Replying to {replyTo.own ? "your question" : replyTo.senderLabel}</span>
                      <button type="button" onClick={() => setReplyTo(null)}>Cancel reply</button>
                    </div>
                  )}
                  <label>
                    {replyTo ? "Reply" : role === "student" ? "Ask the course" : "Course note"}
                    <textarea
                      rows={4}
                      value={messageBody}
                      onChange={(event) => setMessageBody(event.target.value)}
                      maxLength={COURSE_COMMUNICATION_LIMITS.messageCharacters}
                      placeholder={replyTo ? "Write a reply for the entire course…" : role === "student" ? "Ask a course question…" : "Share a short course note…"}
                    />
                  </label>
                  <label>
                    Authorized course resource (optional)
                    <select value={attachmentResourceId} onChange={(event) => setAttachmentResourceId(event.target.value)}>
                      <option value="">No resource reference</option>
                      {snapshot.resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title} · {resource.resource_type}</option>)}
                    </select>
                    <small>Only the authorized resource ID and title are referenced. File bytes and private links are not placed in the message.</small>
                  </label>
                  <button type="submit" disabled={busy || !messageBody.trim()}>{replyTo ? "Send reply to course" : role === "student" ? "Send question to course" : "Send course note"}</button>
                </form>
              </section>

              <form className="course-notification-preferences" onSubmit={savePreferences}>
                <div><span>IN-APP NOTIFICATIONS</span><strong>Choose badges without hiding the course record.</strong></div>
                <label><input type="checkbox" checked={preferences.notifyAnnouncements} onChange={(event) => setPreferences((current) => ({ ...current, notifyAnnouncements: event.target.checked }))} />Count new announcements</label>
                <label><input type="checkbox" checked={preferences.notifyReplies} onChange={(event) => setPreferences((current) => ({ ...current, notifyReplies: event.target.checked }))} />Count new questions and replies</label>
                <button type="submit" className="is-secondary" disabled={busy}>Save preferences</button>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
