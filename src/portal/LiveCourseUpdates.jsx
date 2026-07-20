import { useCallback, useEffect, useId, useRef, useState } from "react";
import * as defaultRealtimeService from "./portalRealtimeService.js";
import "./live-course-updates.css";

const EMPTY_SNAPSHOT = { course: null, assignments: [], announcements: [], messages: [] };

function formatDateTime(value, fallback = "No date set") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function connectionCopy(status) {
  if (status === "IDLE") return "Choose a class to connect";
  if (status === "SUBSCRIBED") return "Live updates connected";
  if (status === "CHANNEL_ERROR") return "Live updates unavailable";
  if (status === "TIMED_OUT") return "Live updates timed out";
  if (status === "CLOSED") return "Live updates closed";
  return "Connecting live updates";
}

function changeCopy(table) {
  if (table === "courses") return "Course details updated";
  if (table === "assignments") return "Assignment list updated";
  if (table === "professor_announcements") return "Class announcement updated";
  if (table === "learning_messages") return "Class messages updated";
  if (table === "student_posts") return "Class group post updated";
  return "Class information updated";
}

function courseName(course) {
  if (!course) return "Class updates";
  return [course.course_code, course.title].filter(Boolean).join(" · ") || "Class updates";
}

export default function LiveCourseUpdates({
  mode = "student",
  courseId,
  groupIds = [],
  onCourseChange,
  onOpenCourse,
  onOpenAssignment,
  onOpenMessages,
  serviceApi = defaultRealtimeService,
}) {
  const titleId = useId();
  const requestVersion = useRef(0);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("IDLE");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const isProfessor = mode === "professor";
  const groupIdKey = Array.isArray(groupIds) ? groupIds.join("|") : "";
  const selectedCourse = snapshot.course || courses.find((course) => course.id === selectedCourseId) || null;

  useEffect(() => {
    let active = true;
    setCoursesLoading(true);
    setError("");
    if (typeof serviceApi.listVisibleCourses !== "function") {
      setCourses([]);
      setSelectedCourseId("");
      setCoursesLoading(false);
      setError("The live course directory service is unavailable.");
      return undefined;
    }

    serviceApi.listVisibleCourses({ limit: 100 }).then((visibleCourses) => {
      if (!active) return;
      const nextCourses = Array.isArray(visibleCourses) ? visibleCourses : [];
      const requestedCourseId = defaultRealtimeService.isPortalUuid(courseId) ? String(courseId).toLowerCase() : "";
      const requestedCourseIsVisible = requestedCourseId && nextCourses.some((course) => course.id === requestedCourseId);
      const nextSelectedId = requestedCourseIsVisible
        ? requestedCourseId
        : nextCourses.length === 1
          ? nextCourses[0].id
          : "";
      setCourses(nextCourses);
      setSelectedCourseId(nextSelectedId);
      setConnectionStatus(nextSelectedId ? "CONNECTING" : "IDLE");
    }).catch((courseError) => {
      if (!active) return;
      setCourses([]);
      setSelectedCourseId("");
      setConnectionStatus("IDLE");
      setError(courseError?.message || "Classes could not be loaded.");
    }).finally(() => {
      if (active) setCoursesLoading(false);
    });

    return () => { active = false; };
  }, [courseId, serviceApi]);

  const refresh = useCallback(async ({ quiet = false, reason = "manual" } = {}) => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    if (!quiet) setLoading(true);
    setError("");
    try {
      if (!defaultRealtimeService.isPortalUuid(selectedCourseId)) throw new Error("Choose a class to see live updates.");
      if (typeof serviceApi.listVisibleCourseSnapshot !== "function") throw new Error("The live course service is unavailable.");
      const nextSnapshot = await serviceApi.listVisibleCourseSnapshot(selectedCourseId);
      if (requestVersion.current !== version) return;
      setSnapshot({
        course: nextSnapshot?.course || null,
        assignments: Array.isArray(nextSnapshot?.assignments) ? nextSnapshot.assignments : [],
        announcements: Array.isArray(nextSnapshot?.announcements) ? nextSnapshot.announcements : [],
        messages: Array.isArray(nextSnapshot?.messages) ? nextSnapshot.messages : [],
      });
      setLastUpdatedAt(new Date());
      if (reason === "manual") setNotice("Class updates refreshed.");
    } catch (refreshError) {
      if (requestVersion.current === version) {
        setError(refreshError?.message || "Class updates could not be loaded.");
      }
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }, [selectedCourseId, serviceApi]);

  useEffect(() => {
    requestVersion.current += 1;
    setSnapshot(EMPTY_SNAPSHOT);
    setNotice("");
    setError("");
    setLastUpdatedAt(null);

    if (!defaultRealtimeService.isPortalUuid(selectedCourseId)) {
      setConnectionStatus("IDLE");
      return undefined;
    }

    setConnectionStatus("CONNECTING");

    let active = true;
    let subscription;
    refresh({ quiet: false, reason: "initial" });

    try {
      if (typeof serviceApi.subscribeToCourseUpdates !== "function") throw new Error("The live update subscription service is unavailable.");
      subscription = serviceApi.subscribeToCourseUpdates(selectedCourseId, {
        groupIds: Array.isArray(groupIds) ? groupIds : [],
        onChange: (change) => {
          if (!active) return;
          setNotice(changeCopy(change.table));
          refresh({ quiet: true, reason: "realtime" });
        },
        onStatus: ({ status }) => {
          if (active) setConnectionStatus(status || "CHANNEL_ERROR");
        },
        onError: (subscriptionError) => {
          if (!active) return;
          setConnectionStatus("CHANNEL_ERROR");
          setError(subscriptionError?.message || "Live updates disconnected. Manual refresh is still available.");
        },
      });
    } catch (subscriptionError) {
      setConnectionStatus("CHANNEL_ERROR");
      setError(subscriptionError?.message || "Live updates could not connect.");
    }

    return () => {
      active = false;
      requestVersion.current += 1;
      if (subscription?.unsubscribe) {
        Promise.resolve(subscription.unsubscribe()).catch(() => undefined);
      }
    };
  // A stable key lets callers pass a newly allocated groupIds array without reconnecting unnecessarily.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, groupIdKey, refresh, serviceApi]);

  async function saveAnnouncement(published) {
    setSavingAnnouncement(true);
    setError("");
    setNotice("");
    try {
      if (typeof serviceApi.createCourseAnnouncement !== "function") throw new Error("The class announcement service is unavailable.");
      await serviceApi.createCourseAnnouncement({
        courseId: selectedCourseId,
        title: announcementTitle,
        body: announcementBody,
        published,
      });
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setNotice(published ? "Class announcement published." : "Announcement draft saved.");
      await refresh({ quiet: true, reason: "saved" });
    } catch (saveError) {
      setError(saveError?.message || "The class announcement was not saved.");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  return (
    <section className="live-course-updates" aria-labelledby={titleId}>
      <header className="dashboard-card live-course-updates__header">
        <div>
          <span className="portal-kicker">LIVE CLASS VIEW</span>
          <h1 id={titleId}>{courseName(selectedCourse)}</h1>
          <p>{isProfessor ? "Review what students can receive and publish a clear class update." : "Assignments, announcements, and class messages refresh when your class changes."}</p>
          <label className="live-course-updates__course-picker">Choose class for live updates
            <select
              value={selectedCourseId}
              disabled={coursesLoading || courses.length === 0}
              onChange={(event) => {
                const nextCourseId = event.target.value;
                setSelectedCourseId(nextCourseId);
                onCourseChange?.(nextCourseId || null);
              }}
            >
              <option value="">{coursesLoading ? "Loading your classes…" : courses.length ? "Choose a class" : "No visible classes available"}</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{courseName(course)}</option>)}
            </select>
          </label>
        </div>
        <div className="live-course-updates__status">
          <span className={connectionStatus === "SUBSCRIBED" ? "is-connected" : ""}>{connectionCopy(connectionStatus)}</span>
          <small>{lastUpdatedAt ? `Last checked ${formatDateTime(lastUpdatedAt, "just now")}` : "Waiting for the first refresh"}</small>
          <button type="button" disabled={loading || !selectedCourseId} onClick={() => refresh({ quiet: false, reason: "manual" })}>
            {loading ? "Refreshing class updates…" : "Refresh class updates"}
          </button>
          {selectedCourseId && typeof onOpenCourse === "function" && (
            <button type="button" onClick={() => onOpenCourse(selectedCourse)}>Open course details</button>
          )}
        </div>
      </header>

      {notice && <div className="live-course-updates__notice" role="status">{notice}</div>}
      {error && <div className="portal-form-error live-course-updates__error" role="alert">{error}</div>}

      {!selectedCourseId && !coursesLoading && !error && (
        <section className="dashboard-card live-course-updates__choose-class">
          <h2>{courses.length ? "Choose a class above." : "No class is available yet."}</h2>
          <p>{courses.length ? "Live assignments, announcements, and messages will load after you choose one of your classes." : "Join or create a cloud class before opening live updates."}</p>
        </section>
      )}

      {selectedCourseId && <div className="live-course-updates__grid">
        <section className="dashboard-card">
          <div className="dashboard-card-heading">
            <div><span className="portal-kicker">ASSIGNMENTS</span><h2>{isProfessor ? "Course work to manage" : "Course work to complete"}</h2></div>
            <span>{snapshot.assignments.length}</span>
          </div>
          {snapshot.assignments.length ? (
            <div className="live-course-updates__list">
              {snapshot.assignments.map((assignment) => (
                <article key={assignment.id}>
                  <div>
                    <strong>{assignment.title || "Untitled assignment"}</strong>
                    <span>{formatDateTime(assignment.due_at, "No due date")}</span>
                    <small>{assignment.status || "Status not set"}</small>
                  </div>
                  {typeof onOpenAssignment === "function" && (
                    <button type="button" onClick={() => onOpenAssignment(assignment)}>
                      {isProfessor ? "Manage assignment" : "Open assignment"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : <p className="live-course-updates__empty">No assignments are available to this account for this class.</p>}
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card-heading">
            <div><span className="portal-kicker">ANNOUNCEMENTS</span><h2>{isProfessor ? "Published and draft updates" : "Updates from your educator"}</h2></div>
            <span>{snapshot.announcements.length}</span>
          </div>
          {snapshot.announcements.length ? (
            <div className="live-course-updates__list">
              {snapshot.announcements.map((announcement) => (
                <article key={announcement.id}>
                  <div>
                    <strong>{announcement.title}</strong>
                    <p>{announcement.body}</p>
                    <small>{announcement.is_published ? `Published ${formatDateTime(announcement.published_at || announcement.created_at)}` : "Draft — students cannot see this yet"}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="live-course-updates__empty">No announcements are available to this account for this class.</p>}
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card-heading">
            <div><span className="portal-kicker">CLASS MESSAGES</span><h2>Recent course conversation</h2></div>
            <span>{snapshot.messages.length}</span>
          </div>
          {snapshot.messages.length ? (
            <div className="live-course-updates__list">
              {snapshot.messages.slice(0, 5).map((message) => (
                <article key={message.id}>
                  <div>
                    <strong>{message.sender_label || "Course member"}</strong>
                    <p>{message.body}</p>
                    <small>{formatDateTime(message.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="live-course-updates__empty">No messages are available to this account for this class.</p>}
          {typeof onOpenMessages === "function" && (
            <button type="button" className="live-course-updates__section-action" onClick={() => onOpenMessages(selectedCourse)}>Open class messages</button>
          )}
        </section>

        {isProfessor && (
          <section className="dashboard-card live-course-updates__composer">
            <div className="dashboard-card-heading">
              <div><span className="portal-kicker">NEW CLASS UPDATE</span><h2>Write once, choose when students see it</h2></div>
            </div>
            <label>Announcement title
              <input maxLength={240} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} />
            </label>
            <label>Announcement message
              <textarea rows={5} maxLength={10000} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} />
            </label>
            <div>
              <button type="button" disabled={savingAnnouncement || !selectedCourseId || !announcementTitle.trim() || !announcementBody.trim()} onClick={() => saveAnnouncement(false)}>
                {savingAnnouncement ? "Saving announcement…" : "Save announcement draft"}
              </button>
              <button type="button" className="primary" disabled={savingAnnouncement || !selectedCourseId || !announcementTitle.trim() || !announcementBody.trim()} onClick={() => saveAnnouncement(true)}>
                {savingAnnouncement ? "Publishing announcement…" : "Publish class announcement"}
              </button>
            </div>
          </section>
        )}
      </div>}
    </section>
  );
}
