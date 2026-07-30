import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import AssignmentTemplateWorkspace from "../portal/AssignmentTemplateWorkspace.jsx";
import { COURSE_PRESETS, flattenLessons } from "./courseManifest.js";
import CourseNotificationCenter from "./CourseNotificationCenter.jsx";
import {
  buildStudentNotificationFeed,
  CALENDAR_REMINDER_SETTINGS_EVENT,
  calendarReminderSettingsKey,
  filterUnreadStudentNotifications,
  markStudentNotificationRead,
  readCalendarReminderSettings,
  readStudentNotificationIds,
} from "./courseNotificationModel.js";
import { listStudentAssignmentEvents } from "../portal/assignmentTemplateService.js";
import {
  listCourseDueWork,
  loadLearnerProgress,
  loadPublishedCourse,
} from "./courseService.js";
import StudentLessonPlayer from "./StudentLessonPlayer.jsx";
import {
  nextDueWork,
  publishedCourseCalendarItems,
  publishedCourseSyllabusText,
  publishedDueWorkRows,
  publishedPackageIdentity,
} from "./studentExperienceContract.js";
import "./course-runtime.css";
import "./course-notifications.css";
import "./student-experience.css";

const OwnYourSemester = lazy(() => import("../ai/OwnYourSemester.jsx"));
const StudentLearningWorkspace = lazy(
  () => import("../learning/StudentLearningWorkspace.jsx"),
);
const CourseCommunicationPanel = lazy(
  () => import("../communication/CourseCommunicationPanel.jsx"),
);

function formatDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ToolLoading({ name }) {
  return (
    <section className="course-runtime-status" role="status">
      <strong>Opening {name}…</strong>
      <span>You will remain inside this course.</span>
    </section>
  );
}

function PublishedWorkDetail({ item, onClose, onOpenCalendar }) {
  if (!item) return null;
  const workType = item.workType === "grade_item"
    ? "Grade item"
    : "Assignment";
  return (
    <section
      className="course-work-detail"
      id={`course-work-detail-${item.id}`}
      aria-labelledby={`course-work-detail-title-${item.id}`}
    >
      <header>
        <div>
          <span className="course-kicker">ASSIGNMENT DETAILS</span>
          <h3 id={`course-work-detail-title-${item.id}`}>{item.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details">
          Close
        </button>
      </header>
      <p>
        {item.instructions ||
          "Your professor has not added a longer description yet."}
      </p>
      <dl>
        <div>
          <dt>Due</dt>
          <dd>{formatDate(item.due_at)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{workType}</dd>
        </div>
        {Number.isFinite(Number(item.max_points))
          ? (
            <div>
              <dt>Points</dt>
              <dd>{Number(item.max_points)}</dd>
            </div>
          )
          : null}
      </dl>
      <footer>
        <button type="button" onClick={onOpenCalendar}>
          See on calendar
        </button>
      </footer>
    </section>
  );
}

export default function CourseRuntimePage({
  publicationId,
  session,
  profile,
  track = "university",
  onBack,
}) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    publication: null,
    version: null,
    packageIdentity: null,
    manifest: null,
    progress: null,
    dueWork: null,
  });
  const [view, setView] = useState("home");
  const [active, setActive] = useState(null);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [requestedTemplateId, setRequestedTemplateId] = useState(null);
  const [notificationNow, setNotificationNow] = useState(() => new Date());
  const [assignmentEvents, setAssignmentEvents] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const studentCalendarScope =
    `ednotebook-own-semester-${session?.user?.id || "student"}-${track}-calendar`;
  const [reminderSettings, setReminderSettings] = useState(() =>
    readCalendarReminderSettings(studentCalendarScope)
  );
  const notificationScope =
    `ednotebook-${session?.user?.id || "student"}-${publicationId || "course"}`;

  useEffect(() => {
    setReadNotificationIds(readStudentNotificationIds(notificationScope));
  }, [notificationScope]);

  useEffect(() => {
    let active = true;
    listStudentAssignmentEvents({
      studentId: session?.user?.id,
      courseId: state.publication?.course_id,
    }).then((result) => {
      if (active) setAssignmentEvents(result.data || []);
    });
    return () => { active = false; };
  }, [session?.user?.id, state.publication?.course_id]);

  useEffect(() => {
    let live = true;
    (async () => {
      const courseResult = await loadPublishedCourse(publicationId);
      if (!live) return;
      if (courseResult.error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: courseResult.error.message,
        }));
        return;
      }
      const { publication, version, manifest } = courseResult.data;
      let packageIdentity;
      try {
        packageIdentity = publishedPackageIdentity({
          publication,
          version,
          manifest,
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
        return;
      }
      const [progressResult, dueResult] = await Promise.all([
        loadLearnerProgress(publication.id, session?.user?.id),
        listCourseDueWork(publication.course_id),
      ]);
      if (!live) return;
      setState({
        loading: false,
        error: "",
        publication,
        version,
        packageIdentity,
        manifest,
        progress: progressResult.data,
        dueWork: dueResult.data,
      });
    })();
    return () => {
      live = false;
    };
  }, [publicationId, session?.user?.id]);

  useEffect(() => {
    setReminderSettings(readCalendarReminderSettings(studentCalendarScope));
    function refreshReminderSettings(event) {
      if (
        event.type === "storage" &&
        event.key !== calendarReminderSettingsKey(studentCalendarScope)
      ) {
        return;
      }
      if (
        event.type === CALENDAR_REMINDER_SETTINGS_EVENT &&
        event.detail?.scope !== studentCalendarScope
      ) {
        return;
      }
      setReminderSettings(
        event.detail?.settings ||
          readCalendarReminderSettings(studentCalendarScope),
      );
    }
    window.addEventListener("storage", refreshReminderSettings);
    window.addEventListener(
      CALENDAR_REMINDER_SETTINGS_EVENT,
      refreshReminderSettings,
    );
    return () => {
      window.removeEventListener("storage", refreshReminderSettings);
      window.removeEventListener(
        CALENDAR_REMINDER_SETTINGS_EVENT,
        refreshReminderSettings,
      );
    };
  }, [studentCalendarScope]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNotificationNow(new Date()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const preset =
    COURSE_PRESETS[state.manifest?.preset?.id] ||
    COURSE_PRESETS["ednotebook-default"];
  const lessons = useMemo(
    () => flattenLessons(state.manifest),
    [state.manifest],
  );
  const completed = new Set(
    (state.progress?.lessons || [])
      .filter((item) => item.status === "completed")
      .map((item) => item.lesson_id),
  );
  const course = state.publication?.courses;
  const dueNext = useMemo(() => nextDueWork(state.dueWork), [state.dueWork]);
  const publishedWork = useMemo(
    () => publishedDueWorkRows(state.dueWork),
    [state.dueWork],
  );
  const publishedCalendarItems = useMemo(
    () =>
      publishedCourseCalendarItems(state.dueWork, {
        courseCode: course?.course_code,
        courseId: course?.id,
      }),
    [course?.course_code, course?.id, state.dueWork],
  );
  const publishedSyllabusText = useMemo(
    () =>
      publishedCourseSyllabusText(state.dueWork, {
        courseCode: course?.course_code,
        courseTitle: course?.title,
      }),
    [course?.course_code, course?.title, state.dueWork],
  );
  const notifications = useMemo(
    () =>
      filterUnreadStudentNotifications(buildStudentNotificationFeed({
        items: publishedCalendarItems,
        activityItems: assignmentEvents,
        reminders: reminderSettings.reminders,
        now: notificationNow,
      }), readNotificationIds),
    [
      assignmentEvents,
      notificationNow,
      publishedCalendarItems,
      readNotificationIds,
      reminderSettings.reminders,
    ],
  );
  const selectedWork = useMemo(
    () =>
      publishedWork.find((item) => String(item.id) === String(selectedWorkId)) ||
      null,
    [publishedWork, selectedWorkId],
  );

  function openLesson(lesson) {
    const saved = (state.progress?.lessons || []).find(
      (item) => item.lesson_id === lesson.id && item.path_id === lesson.pathId,
    );
    setActive({
      lesson,
      path: state.manifest.paths.find((item) => item.id === lesson.pathId),
      saved,
    });
    setView("lesson");
  }

  function continueLesson() {
    const current = state.progress?.summary;
    const lesson =
      lessons.find((item) => item.id === current?.current_lesson_id) ||
      lessons.find((item) => !completed.has(item.id)) ||
      lessons[0];
    if (lesson) openLesson(lesson);
  }

  function openTool(nextView) {
    setActive(null);
    setView(nextView);
  }

  function openPublishedWorkDetail(workId) {
    setActive(null);
    setSelectedWorkId(workId);
    setView("assignments");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  function openNotification(notification) {
    setReadNotificationIds(
      markStudentNotificationRead(notificationScope, notification.id),
    );
    if (notification.route?.templateId) {
      setActive(null);
      setSelectedWorkId(null);
      setRequestedTemplateId(notification.route.templateId);
      setView("assignments");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
      return;
    }
    openPublishedWorkDetail(notification.route.workId);
  }

  async function refreshProgress() {
    const result = await loadLearnerProgress(
      state.publication.id,
      session?.user?.id,
    );
    setState((current) => ({ ...current, progress: result.data }));
  }

  if (state.loading) {
    return (
      <main className="course-runtime-status" aria-live="polite">
        <strong>Opening course…</strong>
        <span>Checking enrollment and loading your saved place.</span>
      </main>
    );
  }
  if (state.error) {
    return (
      <main className="course-runtime-status is-error" role="alert">
        <strong>Course unavailable</strong>
        <span>{state.error}</span>
        <button type="button" onClick={onBack}>
          Back to classes
        </button>
      </main>
    );
  }

  const style = {
    "--course-primary": preset.primary,
    "--course-primary-dark": preset.primaryDark,
    "--course-accent": preset.accent,
    "--course-surface": preset.surface,
    "--course-bg": preset.background,
    "--course-text": preset.text,
    "--course-muted": preset.muted,
    "--course-border": preset.border,
    "--course-success": preset.success,
    "--course-error": preset.error,
  };
  const courseClass = {
    id: course.id,
    code: course.course_code || "COURSE",
    course_code: course.course_code || "COURSE",
    title: course.title,
    division: course.education_division || track,
    education_division: course.education_division || track,
    professor: "Course professor",
    progress: state.progress?.summary?.completion_percent || 0,
    points: 0,
    grade: state.progress?.summary?.final_score ?? null,
    next: dueNext?.title || "Continue the current lesson",
  };
  const toolViews = new Set(["calendar", "notes", "messages"]);

  return (
    <div className="course-account-shell" style={style}>
      <header className="course-account-header">
        <button type="button" onClick={onBack}>
          ← My classes
        </button>
        <nav className="course-header-nav" aria-label="Course shortcuts">
          <button type="button" onClick={() => openTool("home")}>
            Course home
          </button>
          <button type="button" onClick={() => openTool("assignments")}>
            Assignments
          </button>
          <button type="button" onClick={() => openTool("calendar")}>
            Calendar
          </button>
          <button type="button" onClick={() => openTool("notes")}>
            Notes
          </button>
          <button type="button" onClick={() => openTool("messages")}>
            Messages
          </button>
        </nav>
        <CourseNotificationCenter
          notifications={notifications}
          onSelect={openNotification}
          onOpenCalendar={() => openTool("calendar")}
        />
        <span className="course-profile-name">
          {profile?.full_name || session?.user?.email || "Learner"}
        </span>
      </header>
      <div className="course-shell-grid">
        <aside className="course-rail">
          <div>
            <small>{course.course_code || "COURSE"}</small>
            <strong>{state.manifest.course.title}</strong>
            <span>{state.packageIdentity.label}</span>
          </div>
          <nav aria-label="Course">
            <button
              className={view === "home" ? "is-active" : ""}
              type="button"
              onClick={() => openTool("home")}
            >
              Course home
            </button>
            <button
              className={view === "map" ? "is-active" : ""}
              type="button"
              onClick={() => openTool("map")}
            >
              Course map
            </button>
            <button
              className={view === "assignments" ? "is-active" : ""}
              type="button"
              onClick={() => openTool("assignments")}
            >
              Assignments
            </button>
            <button
              className={view === "calendar" ? "is-active" : ""}
              type="button"
              onClick={() => openTool("calendar")}
            >
              Calendar &amp; syllabus
            </button>
            <button
              className={view === "notes" ? "is-active" : ""}
              type="button"
              onClick={() => openTool("notes")}
            >
              Notes &amp; sources
            </button>
            <button
              className={view === "messages" ? "is-active" : ""}
              type="button"
              onClick={() => openTool("messages")}
            >
              Course messages
            </button>
            <button type="button" onClick={continueLesson}>
              Continue lesson
            </button>
          </nav>
          <section>
            <span>Progress</span>
            <strong>{state.progress?.summary?.completion_percent || 0}%</strong>
            <div>
              <i
                style={{
                  width: `${state.progress?.summary?.completion_percent || 0}%`,
                }}
              />
            </div>
            <small>
              {state.progress?.summary?.grade_status === "auto_graded"
                ? `Grade ${state.progress.summary.final_score}%`
                : state.progress?.summary?.grade_status === "awaiting_grading"
                  ? "Awaiting grading"
                  : "In progress"}
            </small>
          </section>
        </aside>
        <main
          className={`course-viewport ${toolViews.has(view) ? "is-course-tool" : ""}`}
        >
          {view === "home" && (
            <>
              <section
                className="course-orientation"
                aria-labelledby="course-orientation-title"
              >
                <div>
                  <span className="course-kicker">
                    YOUR PLACE IN THE COURSE
                  </span>
                  <h1 id="course-orientation-title">
                    {state.progress?.summary?.current_lesson_id
                      ? "Pick up where you left off."
                      : "Start with the first professor-published lesson."}
                  </h1>
                  <p>
                    {state.progress?.summary?.current_lesson_id
                      ? "Your last synchronized place and any safe device recovery are ready."
                      : "Read, act, check your understanding, recover when needed, and continue."}
                  </p>
                </div>
                <button type="button" onClick={continueLesson}>
                  {state.progress?.summary?.current_lesson_id
                    ? "Resume lesson"
                    : "Start lesson"}
                </button>
              </section>
              {dueNext && (
                <section
                  className="course-workflow-alert"
                  aria-label="Next due work"
                >
                  <span>{dueNext.timeRemaining}</span>
                  <div>
                    <strong>{dueNext.title}</strong>
                    <small>{formatDate(dueNext.due_at)}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPublishedWorkDetail(dueNext.id)}
                  >
                    View assignment
                  </button>
                </section>
              )}
              <section className="course-hero">
                <span>{state.manifest.template.family} course</span>
                <h2>{state.manifest.course.title}</h2>
                <p>{state.manifest.course.subtitle}</p>
                <p>{state.manifest.course.description}</p>
                <div>
                  <button type="button" onClick={continueLesson}>
                    Continue learning
                  </button>
                  <button type="button" onClick={() => openTool("map")}>
                    View course map
                  </button>
                </div>
              </section>
              <section className="course-due-panel">
                <div>
                  <span className="course-kicker">DUE NEXT</span>
                  <h2>Course work and dates</h2>
                </div>
                {publishedWork
                  .filter((item) => item.due_at)
                  .slice(0, 4)
                  .map((item) => (
                    <article key={item.id}>
                      <button
                        className="course-work-summary-button"
                        type="button"
                        aria-controls={`course-work-detail-${item.id}`}
                        aria-expanded={
                          view === "assignments" &&
                          String(selectedWorkId) === String(item.id)
                        }
                        onClick={() => openPublishedWorkDetail(item.id)}
                      >
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.due_at)}</span>
                      </button>
                    </article>
                  ))}
                {!publishedWork.some((item) => item.due_at) && (
                  <p>No dated work has been published yet.</p>
                )}
              </section>
            </>
          )}
          {view === "map" && (
            <section className="course-map-view">
              <span className="course-kicker">COURSE MAP</span>
              <h1>{state.manifest.course.title}</h1>
              {state.manifest.paths.map((path) => (
                <div key={path.id}>
                  <h2>{path.label}</h2>
                  <p>{path.description}</p>
                  {path.groups.map((group) => (
                    <section key={group.id}>
                      <h3>{group.title}</h3>
                      <div>
                        {path.nodes
                          .filter((node) => group.nodeIds.includes(node.id))
                          .map((lesson) => (
                            <button
                              type="button"
                              key={lesson.id}
                              onClick={() =>
                                openLesson({
                                  ...lesson,
                                  pathId: path.id,
                                  pathLabel: path.label,
                                })
                              }
                            >
                              <span>
                                {completed.has(lesson.id)
                                  ? "✓ Completed"
                                  : "Available"}
                              </span>
                              <strong>{lesson.title}</strong>
                              <small>
                                ~{lesson.estimatedMinutes || 15} min
                              </small>
                            </button>
                          ))}
                      </div>
                    </section>
                  ))}
                </div>
              ))}
            </section>
          )}
          {view === "lesson" && active && (
            <StudentLessonPlayer
              publication={state.publication}
              publicationVersion={state.packageIdentity.version}
              manifest={state.manifest}
              path={active.path}
              lesson={active.lesson}
              saved={active.saved}
              userId={session?.user?.id}
              onOpenTool={openTool}
              onExit={() => {
                setActive(null);
                setView("map");
                refreshProgress();
              }}
              onProgress={(progress) =>
                setState((current) => ({
                  ...current,
                  progress: { ...current.progress, summary: progress },
                }))
              }
            />
          )}
          {view === "assignments" && (
            <section className="course-assignment-frame">
              <section
                className="course-due-panel"
                aria-labelledby="published-course-work-title"
              >
                <div>
                  <span className="course-kicker">PROFESSOR-PUBLISHED</span>
                  <h2 id="published-course-work-title">
                    Course work and official dates
                  </h2>
                </div>
                {publishedWork.map((item) => (
                  <article key={`${item.workType}-${item.id}`}>
                    <button
                      className="course-work-summary-button"
                      type="button"
                      aria-controls={`course-work-detail-${item.id}`}
                      aria-expanded={String(selectedWorkId) === String(item.id)}
                      onClick={() => setSelectedWorkId(item.id)}
                    >
                      <strong>{item.title}</strong>
                      <span>{formatDate(item.due_at)}</span>
                    </button>
                  </article>
                ))}
                {!publishedWork.length && (
                  <p>No published course work is available yet.</p>
                )}
                <PublishedWorkDetail
                  item={selectedWork}
                  onClose={() => setSelectedWorkId(null)}
                  onOpenCalendar={() => openTool("calendar")}
                />
              </section>
              <AssignmentTemplateWorkspace
                mode="student"
                session={session}
                track={track}
                classes={[courseClass]}
                initialTemplateId={requestedTemplateId}
              />
            </section>
          )}
          {view === "calendar" && (
            <Suspense fallback={<ToolLoading name="course calendar" />}>
              <OwnYourSemester
                profile={profile}
                session={session}
                track={track}
                classes={[courseClass]}
                officialAssignments={publishedCalendarItems}
                officialCalendarScope={course.id}
                calendarScope={studentCalendarScope}
                onOpenAssignment={openPublishedWorkDetail}
                initialSyllabusText={publishedSyllabusText}
                syllabusSourceName={`${course.course_code || "COURSE"} professor-published dates`}
              />
            </Suspense>
          )}
          {view === "notes" && (
            <Suspense fallback={<ToolLoading name="notes and sources" />}>
              <StudentLearningWorkspace
                classes={[courseClass]}
                session={session}
                track={track}
                storageScope={`student-${session?.user?.id || `guest-${track}`}`}
              />
            </Suspense>
          )}
          {view === "messages" && (
            <Suspense fallback={<ToolLoading name="course messages" />}>
              <CourseCommunicationPanel
                role="student"
                session={session}
                educationDivision={track}
                initialCourseId={course.id}
                headingLevel="h1"
              />
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}
