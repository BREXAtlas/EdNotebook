import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyPersonalCalendarEdit,
  approveCalendarCandidate,
  buildCalendarIcs,
  buildDueNotificationCandidates,
  deriveCalendarWorkflow,
  parseCalendarIcs,
  resetPersonalCalendarEdit,
} from "../ai/syllabusCalendarContract.js";
import {
  CALENDAR_REMINDER_SETTINGS_EVENT,
  calendarReminderSettingsKey,
  readCalendarReminderSettings,
} from "../course-runtime/courseNotificationModel.js";
import {
  cx,
  dateKey,
  formatDate,
  formatDateTime,
  iconForType,
  NotebookLabel,
} from "./demoShared.jsx";
import "./workspace-calendar.css";

function localDateKey(date) {
  return `${date.getFullYear()}-${
    String(date.getMonth() + 1).padStart(2, "0")
  }-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKeyInTimeZone(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateKey(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce(
    (result, part) => ({ ...result, [part.type]: part.value }),
    {},
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timeSortValue(value = "") {
  const match = String(value).trim().match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i,
  );
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function monthStart(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12, 0, 0);
}

function shiftMonth(value, amount) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + amount,
    1,
    12,
    0,
    0,
  );
}

function monthLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function monthInputValue(value) {
  return `${value.getFullYear()}-${
    String(value.getMonth() + 1).padStart(2, "0")
  }`;
}

function monthFromInput(value) {
  const match = String(value).match(/^(\d{4,})-(\d{2})$/u);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Number(match[1]), month - 1, 1, 12, 0, 0);
}

function dateTimeInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function MonthCalendar({ events, visibleMonth, onSelectEvent }) {
  const firstVisible = monthStart(visibleMonth);
  firstVisible.setDate(firstVisible.getDate() - firstVisible.getDay());
  const dates = Array.from({ length: 42 }, (_, index) => {
    const next = new Date(firstVisible);
    next.setDate(next.getDate() + index);
    return next;
  });
  const weeks = Array.from(
    { length: 6 },
    (_, index) => dates.slice(index * 7, index * 7 + 7),
  );
  const eventMap = events.reduce((map, event) => {
    map[event.date] = [...(map[event.date] || []), event];
    return map;
  }, {});
  const todayKey = localDateKey(new Date());
  return (
    <div
      className="month-calendar"
      role="grid"
      aria-label={`${monthLabel(visibleMonth)} calendar`}
    >
      <div className="month-calendar-weekdays" role="row">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day} role="columnheader">{day}</span>
        ))}
      </div>
      <div className="month-calendar-grid" role="rowgroup">
        {weeks.map((week, weekIndex) => (
          <div
            className="month-calendar-week"
            role="row"
            key={`week-${weekIndex + 1}`}
          >
            {week.map((date) => {
              const key = localDateKey(date);
              const dayEvents = eventMap[key] || [];
              const today = key === todayKey;
              return (
                <article
                  role="gridcell"
                  aria-current={today ? "date" : undefined}
                  aria-label={`${
                    formatDate(`${key}T12:00:00`, { year: true })
                  }${today ? ", today" : ""}${dayEvents.length
                    ? `, ${dayEvents.length} calendar item${
                      dayEvents.length === 1 ? "" : "s"
                    }`
                    : ""}`}
                  className={cx(
                    date.getMonth() !== visibleMonth.getMonth() && "is-muted",
                    dayEvents.length && "has-events",
                    today && "is-today",
                  )}
                  key={key}
                >
                  <strong>{date.getDate()}</strong>
                  {today ? <em>Today</em> : null}
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      type="button"
                      className={`is-${event.type}`}
                      key={event.id || `${event.title}-${event.time}`}
                      title={`${event.title}${
                        event.time ? ` · ${event.time}` : ""
                      }`}
                      onClick={() => onSelectEvent(event)}
                    >
                      {event.title}
                    </button>
                  ))}
                  {dayEvents.length > 3
                    ? <small>+{dayEvents.length - 3} more</small>
                    : null}
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarItemEditor({
  assignments,
  setAssignments,
  timeZone,
  role,
  now,
  onNotice,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", due: "", hours: 1 });
  const sorted = useMemo(
    () =>
      [...assignments].sort(
        (first, second) =>
          deriveCalendarWorkflow(first, now).rank -
            deriveCalendarWorkflow(second, now).rank ||
          new Date(first.due).getTime() - new Date(second.due).getTime(),
      ),
    [assignments, now],
  );

  function beginEdit(item) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      due: dateTimeInputValue(item.due),
      hours: Number(item.hours) || 1,
    });
  }

  function saveEdit(item) {
    try {
      const due = new Date(draft.due);
      if (Number.isNaN(due.getTime())) {
        throw new Error("Choose a valid personal calendar date and time.");
      }
      setAssignments((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? applyPersonalCalendarEdit(candidate, {
              ...draft,
              due: due.toISOString(),
            })
            : candidate
        )
      );
      setEditingId(null);
      onNotice(
        "Personal calendar edit saved. The syllabus source title and deadline were preserved separately.",
      );
    } catch (error) {
      onNotice(error.message);
    }
  }

  if (!assignments.length) {
    return (
      <p className="calendar-empty">
        No approved calendar items yet. Review a syllabus or import a calendar
        file, then approve only the dates you trust.
      </p>
    );
  }

  return (
    <div className="calendar-edit-list">
      {sorted.map((item) => {
        const workflow = deriveCalendarWorkflow(item, now);
        const editing = item.id === editingId;
        const sourceChanged = Boolean(
          item.personalDueOverride || item.personalTitleOverride,
        );
        return (
          <article className={`is-${workflow.stage}`} key={item.id}>
            <div className="calendar-item-heading">
              <span>{item.course}</span>
              <strong>{item.title}</strong>
              <em>{workflow.label}</em>
            </div>
            {editing
              ? (
                <div className="calendar-edit-fields">
                  <label>
                    Personal calendar title
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))}
                    />
                  </label>
                  <label>
                    Personal date and time
                    <input
                      type="datetime-local"
                      value={draft.due}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          due: event.target.value,
                        }))}
                    />
                  </label>
                  <label>
                    Planned hours
                    <input
                      type="number"
                      min="0.25"
                      max="100"
                      step="0.25"
                      value={draft.hours}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          hours: Number(event.target.value),
                        }))}
                    />
                  </label>
                </div>
              )
              : (
                <>
                  <time dateTime={item.due}>
                    {formatDateTime(item.due, timeZone)}
                  </time>
                  <p>{workflow.nextAction}</p>
                  <small>
                    {sourceChanged
                      ? `Personal plan differs from syllabus source: ${
                        formatDateTime(item.sourceDue, timeZone)
                      }.`
                      : "Matches the approved syllabus source date."}
                  </small>
                </>
              )}
            <div className="calendar-item-actions">
              {editing
                ? (
                  <>
                    <button type="button" onClick={() => saveEdit(item)}>
                      Save personal edit
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </>
                )
                : (
                  <>
                    <button type="button" onClick={() => beginEdit(item)}>
                      Edit personal plan
                    </button>
                    {sourceChanged
                      ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignments((current) =>
                              current.map((candidate) =>
                                candidate.id === item.id
                                  ? resetPersonalCalendarEdit(candidate)
                                  : candidate
                              )
                            );
                            onNotice(
                              "Personal edits cleared. The approved syllabus source date is active again.",
                            );
                          }}
                        >
                          Restore source
                        </button>
                      )
                      : null}
                    <button
                      type="button"
                      onClick={() =>
                        setAssignments((current) =>
                          current.map((candidate) =>
                            candidate.id === item.id
                              ? {
                                ...candidate,
                                status: candidate.status === "complete"
                                  ? "not-started"
                                  : "complete",
                              }
                              : candidate
                          )
                        )}
                    >
                      {item.status === "complete" ? "Reopen" : "Mark complete"}
                    </button>
                    {item.sourceAuthority !== "professor-published-course" && (
                      <button
                        type="button"
                        onClick={() =>
                          setAssignments((current) =>
                            current.filter((candidate) =>
                              candidate.id !== item.id
                            )
                          )}
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
            </div>
            <footer>
              {item.sourceAuthority === "professor-published-course"
                ? "This professor-published deadline stays visible; personal edits never change its official source."
                : role === "professor"
                ? "Calendar edits are personal until the syllabus is revised and re-synced."
                : "A personal edit never changes the professor’s official deadline."}
            </footer>
          </article>
        );
      })}
    </div>
  );
}

function CalendarPanel({
  persona,
  assignments = [],
  setAssignments,
  calendarScope = `ednotebook-calendar-${persona?.id || "workspace"}`,
  role = persona?.id === "professor" ? "professor" : "student",
  onOpenAssignment,
}) {
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [hour12, setHour12] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [notice, setNotice] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthStart(new Date())
  );
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [settings, setSettings] = useState(() =>
    readCalendarReminderSettings(calendarScope)
  );
  const [pendingImports, setPendingImports] = useState([]);
  const [approvedImports, setApprovedImports] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return window.Notification.permission;
  });
  const importRef = useRef(null);
  const onOpenAssignmentRef = useRef(onOpenAssignment);
  const reminders = settings.reminders;
  const canEdit = typeof setAssignments === "function";

  useEffect(() => {
    onOpenAssignmentRef.current = onOpenAssignment;
  }, [onOpenAssignment]);

  useEffect(() => {
    window.localStorage.setItem(
      calendarReminderSettingsKey(calendarScope),
      JSON.stringify(settings),
    );
    window.dispatchEvent(
      new CustomEvent(CALENDAR_REMINDER_SETTINGS_EVENT, {
        detail: { scope: calendarScope, settings },
      }),
    );
  }, [calendarScope, settings]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notificationPermission !== "granted") return undefined;
    const sentKey = `${calendarScope}-sent-alerts`;
    function notifyDueItems() {
      let sent = [];
      try {
        const parsed = JSON.parse(
          window.localStorage.getItem(sentKey) || "[]",
        );
        sent = Array.isArray(parsed) ? parsed : [];
      } catch {
        sent = [];
      }
      const sentIds = new Set(sent);
      const candidates = buildDueNotificationCandidates(
        assignments,
        reminders,
      ).filter((candidate) => !sentIds.has(candidate.id)).slice(0, 3);
      for (const candidate of candidates) {
        const notification = new window.Notification(candidate.title, {
          body: candidate.body,
          tag: candidate.id,
        });
        notification.onclick = () => {
          window.focus();
          onOpenAssignmentRef.current?.(candidate.route.workId);
          notification.close();
        };
        sentIds.add(candidate.id);
      }
      if (candidates.length) {
        window.localStorage.setItem(
          sentKey,
          JSON.stringify([...sentIds].slice(-250)),
        );
      }
    }
    notifyDueItems();
    const timer = window.setInterval(notifyDueItems, 60_000);
    return () => window.clearInterval(timer);
  }, [
    assignments,
    calendarScope,
    notificationPermission,
    reminders,
  ]);

  const assignmentEvents = assignments.map((item) => ({
    id: item.id,
    sourceWorkId: item.sourceWorkId,
    workType: item.workType,
    date: dateKeyInTimeZone(item.due, timeZone),
    time: formatDateTime(item.due, timeZone, hour12).split(", ").pop(),
    due: item.due,
    course: item.course,
    title: item.title,
    description:
      item.description ||
      "Open the professor-published course item for details.",
    type: "assignment",
    workflow: deriveCalendarWorkflow(item, now),
  }));
  const personaEvents = Array.isArray(persona?.calendarEvents)
    ? persona.calendarEvents
    : [];
  const events = [
    ...personaEvents,
    ...assignmentEvents.filter((item) =>
      !personaEvents.some((event) => event.title === item.title)
    ),
  ];
  const visiblePrefix = `${visibleMonth.getFullYear()}-${
    String(visibleMonth.getMonth() + 1).padStart(2, "0")
  }`;
  const visibleEventCount = events.filter((event) =>
    event.date.startsWith(visiblePrefix)
  ).length;
  const todayKey = localDateKey(new Date());
  const sortedEvents = [...events].sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      timeSortValue(first.time) - timeSortValue(second.time),
  );
  const upcomingEvents = sortedEvents.filter((event) =>
    event.date >= todayKey
  );
  const agendaEvents = (upcomingEvents.length
    ? upcomingEvents
    : sortedEvents).slice(0, 10);
  const workflowItems = assignments
    .map((item) => ({ item, workflow: deriveCalendarWorkflow(item, now) }))
    .filter(({ item }) => item.status !== "complete")
    .sort(
      (first, second) =>
        first.workflow.rank - second.workflow.rank ||
        new Date(first.item.due).getTime() -
          new Date(second.item.due).getTime(),
    );
  const currentFocus = workflowItems[0] || null;

  function updateReminder(key) {
    setSettings((current) => ({
      version: 1,
      reminders: {
        ...current.reminders,
        [key]: !current.reminders[key],
      },
    }));
  }

  function downloadCalendar() {
    const blob = new Blob([
      buildCalendarIcs(assignments, {
        calendarName: `${
          persona?.shortName || persona?.name || "My"
        } EdNotebook calendar`,
        reminders,
      }),
    ], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      String(persona?.shortName || role).toLowerCase()
    }-ednotebook-calendar.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice(
      "Calendar file created with your alert plan. Import it into Apple Calendar, Google Calendar, Outlook, or another calendar that accepts .ics.",
    );
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotice(
        "This browser does not support desktop notifications. Calendar export alerts still work after import.",
      );
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(
      permission === "granted"
        ? "Browser alerts are enabled while EdNotebook is open. Exported calendar alerts can run through your calendar provider."
        : "Browser alerts remain off. You can still use in-app time-left status and .ics calendar alerts.",
    );
  }

  async function importCalendar(file) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setNotice("Choose an .ics file smaller than 2 MB.");
      return;
    }
    const candidates = parseCalendarIcs(await file.text(), {
      sourceId: `ics-${file.name}-${file.lastModified}`,
    });
    setPendingImports(candidates);
    setApprovedImports([]);
    setNotice(
      candidates.length
        ? `${candidates.length} calendar item${
          candidates.length === 1 ? "" : "s"
        } ready for review. Nothing was added automatically.`
        : "No supported dated events were found in that calendar file.",
    );
  }

  function addApprovedImports() {
    const selected = pendingImports.filter((item) =>
      approvedImports.includes(item.id)
    ).map((item) => approveCalendarCandidate(item));
    setAssignments((current) => {
      const existing = new Set(
        current.map((item) =>
          `${item.importSourceId}:${item.importItemKey}:${item.course}:${item.sourceDue || item.due}`
        ),
      );
      return [
        ...current,
        ...selected.filter((item) => {
          const key =
            `${item.importSourceId}:${item.importItemKey}:${item.course}:${item.sourceDue}`;
          if (existing.has(key)) return false;
          existing.add(key);
          return true;
        }),
      ];
    });
    setPendingImports([]);
    setApprovedImports([]);
    setNotice(
      `${selected.length} reviewed calendar item${
        selected.length === 1 ? "" : "s"
      } approved.`,
    );
  }

  return (
    <div className="workspace-panel-stack">
      <section className="paper-card calendar-control-card">
        <div className="dashboard-card-heading">
          <div>
            <NotebookLabel>SYLLABUS-SYNCED DATE & TIME</NotebookLabel>
            <h1>One editable calendar across every class.</h1>
            <p>
              Approved syllabus dates share one contract on professor and
              student screens. Personal edits remain separate from the source
              deadline.
            </p>
          </div>
          <div className="calendar-export-actions">
            <button
              className="primary-paper-button"
              type="button"
              disabled={!assignments.length}
              onClick={downloadCalendar}
            >
              Download .ics calendar
            </button>
            {canEdit
              ? (
                <>
                  <button type="button" onClick={() => importRef.current?.click()}>
                    Import .ics for review
                  </button>
                  <input
                    ref={importRef}
                    className="sr-only"
                    type="file"
                    tabIndex={-1}
                    accept=".ics,text/calendar"
                    aria-label="Choose an ICS calendar file to review"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      importCalendar(file);
                    }}
                  />
                </>
              )
              : null}
          </div>
        </div>
        <div className="calendar-control-grid">
          <label>
            Time zone
            <select
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
            >
              <option value="America/Chicago">Central Time</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
          <label>
            Time display
            <select
              value={hour12 ? "12" : "24"}
              onChange={(event) => setHour12(event.target.value === "12")}
            >
              <option value="12">12-hour</option>
              <option value="24">24-hour</option>
            </select>
          </label>
          <button type="button" onClick={requestNotifications}>
            {notificationPermission === "granted"
              ? "Browser alerts enabled"
              : "Enable browser alerts"}
          </button>
        </div>
        <div className="calendar-reminder-controls">
          {[
            ["week", "7 days"],
            ["twoDays", "48 hours"],
            ["twoHours", "2 hours"],
            ["rescue", "Overdue rescue"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(reminders[key])}
                onChange={() => updateReminder(key)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <small className="calendar-alert-boundary">
          Browser alerts run while EdNotebook is open. Exported .ics alerts are
          handled by the calendar app you import them into. No calendar account
          is connected without an authenticated provider connection.
        </small>
        {notice ? <p className="inline-notice" role="status">{notice}</p> : null}
      </section>

      {currentFocus
        ? (
          <section
            className={`paper-card calendar-workflow-card is-${currentFocus.workflow.stage}`}
            aria-live="polite"
          >
            <div>
              <NotebookLabel>
                {role === "student" ? "CURRENT STUDENT WORKFLOW" : "CURRENT CALENDAR PRIORITY"}
              </NotebookLabel>
              <h2>
                {currentFocus.item.course} · {currentFocus.item.title}
              </h2>
              <p>{currentFocus.workflow.nextAction}</p>
            </div>
            <strong>{currentFocus.workflow.label}</strong>
          </section>
        )
        : null}

      {pendingImports.length
        ? (
          <section className="paper-card calendar-import-review">
            <div className="dashboard-card-heading">
              <div>
                <NotebookLabel>CALENDAR IMPORT REVIEW</NotebookLabel>
                <h2>Approve imported events one by one.</h2>
                <p>
                  Professor exports and outside calendar files use this same
                  review boundary. Imported dates start unchecked.
                </p>
              </div>
              <button
                type="button"
                disabled={!approvedImports.length}
                onClick={addApprovedImports}
              >
                Add approved imports
              </button>
            </div>
            <div>
              {pendingImports.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={approvedImports.includes(item.id)}
                    onChange={() =>
                      setApprovedImports((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id]
                      )}
                  />
                  <span>
                    <strong>{item.course} · {item.title}</strong>
                    <small>{formatDateTime(item.due, timeZone)}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        )
        : null}

      <section
        className="paper-card calendar-full-card"
        aria-labelledby="calendar-month-heading"
      >
        <div className="calendar-month-header">
          <div className="calendar-month-copy">
            <NotebookLabel>COURSE CALENDAR</NotebookLabel>
            <h2 id="calendar-month-heading">{monthLabel(visibleMonth)}</h2>
            <p>Assignments and class events at a glance.</p>
          </div>
          <div>
            <label className="calendar-month-search">
              Go to month and year
              <input
                type="month"
                value={monthInputValue(visibleMonth)}
                onChange={(event) => {
                  const selectedMonth = monthFromInput(event.target.value);
                  if (selectedMonth) setVisibleMonth(selectedMonth);
                }}
              />
            </label>
            <span className="calendar-month-count">
              {visibleEventCount} item{visibleEventCount === 1 ? "" : "s"} this
              month
            </span>
            <div
              className="calendar-month-navigation"
              aria-label="Calendar month navigation"
            >
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setVisibleMonth((current) => shiftMonth(current, -1))}
              >
                ‹
              </button>
              <button
                className="calendar-today-button"
                type="button"
                onClick={() => setVisibleMonth(monthStart(new Date()))}
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setVisibleMonth((current) => shiftMonth(current, 1))}
              >
                ›
              </button>
            </div>
          </div>
        </div>
        <MonthCalendar
          events={events}
          visibleMonth={visibleMonth}
          onSelectEvent={setSelectedEvent}
        />
        {selectedEvent
          ? (
            <section
              className="calendar-event-detail"
              aria-labelledby="calendar-event-detail-title"
            >
              <div>
                <NotebookLabel>CALENDAR ITEM</NotebookLabel>
                <h3 id="calendar-event-detail-title">
                  {selectedEvent.title}
                </h3>
                <p>
                  {selectedEvent.description ||
                    "No additional description has been added."}
                </p>
                <span>
                  {formatDate(`${selectedEvent.date}T12:00:00`, {
                    year: true,
                  })}
                  {selectedEvent.time ? ` · ${selectedEvent.time}` : ""}
                </span>
              </div>
              <div>
                {selectedEvent.sourceWorkId && onOpenAssignment
                  ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenAssignment(selectedEvent.sourceWorkId)}
                    >
                      {selectedEvent.workType === "media_requirement"
                        ? "Open required media"
                        : "Open assignment details"}
                    </button>
                  )
                  : null}
                <button type="button" onClick={() => setSelectedEvent(null)}>
                  Close
                </button>
              </div>
            </section>
          )
          : null}
      </section>

      {canEdit
        ? (
          <section className="paper-card calendar-edit-card">
            <div className="dashboard-card-heading">
              <div>
                <NotebookLabel>EDITABLE CALENDAR PLAN</NotebookLabel>
                <h2>Plan around a deadline without rewriting it.</h2>
              </div>
              <strong>{assignments.length} approved</strong>
            </div>
            <CalendarItemEditor
              assignments={assignments}
              setAssignments={setAssignments}
              timeZone={timeZone}
              role={role}
              now={now}
              onNotice={setNotice}
            />
          </section>
        )
        : null}

      <section className="calendar-agenda-grid">
        <article className="paper-card">
          <NotebookLabel>UPCOMING AGENDA</NotebookLabel>
          <div className="calendar-agenda is-full">
            {agendaEvents.map((event) => (
              <div key={`${event.date}-${event.title}-${event.time}`}>
                <span className={cx("agenda-icon", `is-${event.type}`)}>
                  {iconForType(event.type)}
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <span>
                    {formatDate(`${event.date}T12:00:00`, { year: true })} ·{" "}
                    {event.time}
                  </span>
                </div>
                {event.workflow
                  ? <i>{event.workflow.label}</i>
                  : null}
              </div>
            ))}
          </div>
        </article>
        <article className="paper-card calendar-legend-card">
          <NotebookLabel>SYNC RULES</NotebookLabel>
          <h2>Review first. Sync second.</h2>
          <ul>
            <li>
              Extracted and imported dates remain drafts until a student or
              professor approves them.
            </li>
            <li>
              Professor exports and student imports use the same versioned
              calendar contract.
            </li>
            <li>
              A personal date or title edit never overwrites the syllabus
              source value.
            </li>
            <li>
              Time remaining determines the visible workflow stage and the
              reminder phase.
            </li>
          </ul>
        </article>
      </section>
    </div>
  );
}

export { CalendarPanel };
