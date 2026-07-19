import { useState } from "react";
import { cx, dateKey, formatDate, formatDateTime, iconForType, NotebookLabel } from "./demoShared.jsx";

function buildIcs(assignments, persona) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = assignments.map((item) => {
    const start = new Date(item.due);
    if (Number.isNaN(start.getTime())) return "";
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const format = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return [
      "BEGIN:VEVENT",
      `UID:${item.id}@ednotebook.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${format(start)}`,
      `DTEND:${format(end)}`,
      `SUMMARY:${item.course} — ${item.title}`,
      `DESCRIPTION:${String(item.description || "Reviewed in EdNotebook").replaceAll("\n", " ")}`,
      "END:VEVENT",
    ].join("\r\n");
  }).filter(Boolean);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EdNotebook//Demo Calendar//EN", `X-WR-CALNAME:${persona.shortName} EdNotebook Demo`, ...events, "END:VCALENDAR"].join("\r\n");
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKeyInTimeZone(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateKey(value);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timeSortValue(value = "") {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
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
  return new Date(value.getFullYear(), value.getMonth() + amount, 1, 12, 0, 0);
}

function monthLabel(value) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(value);
}

function MonthCalendar({ events, visibleMonth }) {
  const firstVisible = monthStart(visibleMonth);
  firstVisible.setDate(firstVisible.getDate() - firstVisible.getDay());
  const dates = Array.from({ length: 42 }, (_, index) => {
    const next = new Date(firstVisible);
    next.setDate(next.getDate() + index);
    return next;
  });
  const eventMap = events.reduce((map, event) => {
    map[event.date] = [...(map[event.date] || []), event];
    return map;
  }, {});
  const todayKey = localDateKey(new Date());
  return (
    <div className="month-calendar">
      <div className="month-calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="month-calendar-grid">{dates.map((date) => {
        const key = localDateKey(date);
        const dayEvents = eventMap[key] || [];
        const today = key === todayKey;
        return <article aria-current={today ? "date" : undefined} aria-label={`${formatDate(`${key}T12:00:00`, { year: true })}${today ? ", today" : ""}`} className={cx(date.getMonth() !== visibleMonth.getMonth() && "is-muted", dayEvents.length && "has-events", today && "is-today")} key={key}><strong>{date.getDate()}</strong>{today && <em>Today</em>}{dayEvents.slice(0, 3).map((event) => <span className={`is-${event.type}`} key={`${event.title}-${event.time}`}>{event.title}</span>)}{dayEvents.length > 3 && <small>+{dayEvents.length - 3} more</small>}</article>;
      })}</div>
    </div>
  );
}

function CalendarPanel({ persona, assignments }) {
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [hour12, setHour12] = useState(true);
  const [notice, setNotice] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const assignmentEvents = assignments.map((item) => ({ date: dateKeyInTimeZone(item.due, timeZone), time: formatDateTime(item.due, timeZone, hour12).split(", ").pop(), title: item.title, type: "assignment" }));
  const events = [...persona.calendarEvents, ...assignmentEvents.filter((item) => !persona.calendarEvents.some((event) => event.title === item.title))];
  const visiblePrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const visibleEventCount = events.filter((event) => event.date.startsWith(visiblePrefix)).length;
  const todayKey = localDateKey(new Date());
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date) || timeSortValue(a.time) - timeSortValue(b.time));
  const upcomingEvents = sortedEvents.filter((event) => event.date >= todayKey);
  const agendaEvents = (upcomingEvents.length ? upcomingEvents : sortedEvents).slice(0, 10);

  function downloadCalendar() {
    const blob = new Blob([buildIcs(assignments, persona)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${persona.shortName.toLowerCase()}-ednotebook-calendar.ics`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Calendar file created. It can be imported into Apple Calendar, Google Calendar, or Outlook.");
  }

  return (
    <div className="workspace-panel-stack">
      <section className="paper-card calendar-control-card">
        <div className="dashboard-card-heading"><div><NotebookLabel>DATE & TIME SYNC</NotebookLabel><h1>One calendar across every class.</h1><p>Due dates are built from reviewed syllabus extractions and can be exported after approval.</p></div><button className="primary-paper-button" type="button" onClick={downloadCalendar}>Download .ics calendar</button></div>
        <div className="calendar-control-grid">
          <label>Time zone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}><option value="America/Chicago">Central Time</option><option value="America/New_York">Eastern Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option><option value="UTC">UTC</option></select></label>
          <label>Time display<select value={hour12 ? "12" : "24"} onChange={(event) => setHour12(event.target.value === "12")}><option value="12">12-hour</option><option value="24">24-hour</option></select></label>
          <button type="button" onClick={() => setNotice("Google Calendar connection is shown as a product demonstration. Production sync requires an authenticated calendar connection.")}>Connect Google Calendar</button>
          <button type="button" onClick={() => setNotice("Outlook connection is shown as a product demonstration. Production sync requires an authenticated Microsoft connection.")}>Connect Outlook</button>
        </div>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </section>
      <section className="paper-card calendar-full-card">
        <div className="dashboard-card-heading"><div><NotebookLabel>{monthLabel(visibleMonth).toUpperCase()}</NotebookLabel><h2>Assignments and class events share the same view.</h2></div><div className="calendar-month-navigation"><span>{visibleEventCount} item{visibleEventCount === 1 ? "" : "s"} this month</span><button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}>←</button><button type="button" onClick={() => setVisibleMonth(monthStart(new Date()))}>Today</button><button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}>→</button></div></div>
        <MonthCalendar events={events} visibleMonth={visibleMonth} />
      </section>
      <section className="calendar-agenda-grid">
        <article className="paper-card"><NotebookLabel>UPCOMING AGENDA</NotebookLabel><div className="calendar-agenda is-full">{agendaEvents.map((event) => <div key={`${event.date}-${event.title}-${event.time}`}><span className={cx("agenda-icon", `is-${event.type}`)}>{iconForType(event.type)}</span><div><strong>{event.title}</strong><span>{formatDate(`${event.date}T12:00:00`, { year: true })} · {event.time}</span></div></div>)}</div></article>
        <article className="paper-card calendar-legend-card"><NotebookLabel>SYNC RULES</NotebookLabel><h2>Review first. Sync second.</h2><ul><li>Extracted dates remain drafts until the student or professor approves them.</li><li>A time zone is stored with each course or inherited from the account.</li><li>Changes show the original source line and editable calendar output.</li><li>The current date is highlighted and the Today button returns to it.</li></ul></article>
      </section>
    </div>
  );
}

export { CalendarPanel };
