import { useState } from "react";
import { cx, dateKey, formatDate, formatDateTime, iconForType, NotebookLabel } from "./demoShared.jsx";

function buildIcs(assignments, persona) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = assignments.map((item) => {
    const start = new Date(item.due);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const format = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return [
      "BEGIN:VEVENT",
      `UID:${item.id}@ednotebook.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${format(start)}`,
      `DTEND:${format(end)}`,
      `SUMMARY:${item.course} — ${item.title}`,
      `DESCRIPTION:${item.description.replaceAll("\n", " ")}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EdNotebook//Demo Calendar//EN", `X-WR-CALNAME:${persona.shortName} EdNotebook Demo`, ...events, "END:VCALENDAR"].join("\r\n");
}

function MonthCalendar({ events }) {
  const dates = Array.from({ length: 42 }, (_, index) => {
    const start = new Date("2026-08-30T12:00:00");
    start.setDate(start.getDate() + index);
    return start;
  });
  const eventMap = events.reduce((map, event) => {
    map[event.date] = [...(map[event.date] || []), event];
    return map;
  }, {});
  return (
    <div className="month-calendar">
      <div className="month-calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="month-calendar-grid">{dates.map((date) => {
        const key = date.toISOString().slice(0, 10);
        const dayEvents = eventMap[key] || [];
        return <article className={cx(date.getMonth() !== 8 && "is-muted", dayEvents.length && "has-events")} key={key}><strong>{date.getDate()}</strong>{dayEvents.slice(0, 3).map((event) => <span className={`is-${event.type}`} key={`${event.title}-${event.time}`}>{event.title}</span>)}{dayEvents.length > 3 && <small>+{dayEvents.length - 3} more</small>}</article>;
      })}</div>
    </div>
  );
}

function CalendarPanel({ persona, assignments }) {
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [hour12, setHour12] = useState(true);
  const [notice, setNotice] = useState("");
  const assignmentEvents = assignments.map((item) => ({ date: dateKey(item.due), time: formatDateTime(item.due, timeZone, hour12).split(", ").pop(), title: item.title, type: "assignment" }));
  const events = [...persona.calendarEvents, ...assignmentEvents.filter((item) => !persona.calendarEvents.some((event) => event.title === item.title))];
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
        <div className="dashboard-card-heading"><div><NotebookLabel>DATE & TIME SYNC</NotebookLabel><h1>One calendar across every class.</h1><p>Due dates are built from approved syllabus extractions and can be exported after review.</p></div><button className="primary-paper-button" type="button" onClick={downloadCalendar}>Download .ics calendar</button></div>
        <div className="calendar-control-grid">
          <label>Time zone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}><option value="America/Chicago">Central Time</option><option value="America/New_York">Eastern Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option><option value="UTC">UTC</option></select></label>
          <label>Time display<select value={hour12 ? "12" : "24"} onChange={(event) => setHour12(event.target.value === "12")}><option value="12">12-hour</option><option value="24">24-hour</option></select></label>
          <button type="button" onClick={() => setNotice("Google Calendar connection is shown as a product demonstration. Production sync requires an authenticated calendar connection.")}>Connect Google Calendar</button>
          <button type="button" onClick={() => setNotice("Outlook connection is shown as a product demonstration. Production sync requires an authenticated Microsoft connection.")}>Connect Outlook</button>
        </div>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </section>
      <section className="paper-card calendar-full-card"><div className="dashboard-card-heading"><div><NotebookLabel>SEPTEMBER 2026</NotebookLabel><h2>Assignments and class events share the same view.</h2></div><span>{events.length} scheduled items</span></div><MonthCalendar events={events} /></section>
      <section className="calendar-agenda-grid">
        <article className="paper-card"><NotebookLabel>UPCOMING AGENDA</NotebookLabel><div className="calendar-agenda is-full">{events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10).map((event) => <div key={`${event.date}-${event.title}-${event.time}`}><span className={cx("agenda-icon", `is-${event.type}`)}>{iconForType(event.type)}</span><div><strong>{event.title}</strong><span>{formatDate(`${event.date}T12:00:00`, { year: true })} · {event.time}</span></div></div>)}</div></article>
        <article className="paper-card calendar-legend-card"><NotebookLabel>SYNC RULES</NotebookLabel><h2>Review first. Sync second.</h2><ul><li>Extracted dates remain drafts until the student or professor approves them.</li><li>A time zone is stored with each course or inherited from the account.</li><li>Changes show the original date, new date, and source document.</li><li>Reminder settings remain student-controlled.</li></ul></article>
      </section>
    </div>
  );
}

export { CalendarPanel };
