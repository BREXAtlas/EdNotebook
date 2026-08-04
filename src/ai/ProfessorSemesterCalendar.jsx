import { useEffect, useMemo, useState } from "react";
import { CalendarPanel } from "../demo/WorkspaceCalendar.jsx";
import { SyllabusPanel } from "../demo/WorkspaceSyllabus.jsx";
import "./own-your-semester.css";

function readSavedItems(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
    if (Array.isArray(parsed)) return parsed;
    return parsed.version === 1 && Array.isArray(parsed.items)
      ? parsed.items
      : [];
  } catch {
    return [];
  }
}

export default function ProfessorSemesterCalendar({
  profile,
  session,
  classes = [],
}) {
  const storageKey =
    `ednotebook-professor-semester-${session?.user?.id || "educator"}`;
  const [assignments, setAssignments] = useState(() =>
    readSavedItems(storageKey)
  );
  const persona = useMemo(() => ({
    id: "professor",
    name: profile?.full_name || "Educator",
    shortName: profile?.full_name?.split(" ")[0] || "educator",
    classes: classes.length
      ? classes.map((course) => ({
        code: course.code || course.course_code || "COURSE",
        title: course.title || "My course",
      }))
      : [{ code: "COURSE", title: "My course" }],
    assignments,
    calendarEvents: [],
  }), [assignments, classes, profile?.full_name]);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, items: assignments }),
    );
  }, [assignments, storageKey]);

  return (
    <div className="own-semester-page">
      <section className="dashboard-card own-semester-intro">
        <span className="portal-kicker">SYLLABUS TOOLS &amp; CALENDAR</span>
        <h1>One syllabus workflow, followed by its calendar.</h1>
        <p>
          First upload, scan, or paste one syllabus and review the extracted
          details. Then approve selected dates for the course calendar below.
          Calendar .ics import and export are optional exchange tools—not a
          second syllabus upload.
        </p>
        <div>
          <strong>Personal calendar edits do not revise the syllabus.</strong>
          <span>
            To change the source deadline, edit the syllabus text and sync it
            again. Personal planning dates remain a separate overlay.
          </span>
        </div>
      </section>

      <SyllabusPanel
        persona={persona}
        assignments={assignments}
        setAssignments={setAssignments}
      />

      <CalendarPanel
        persona={persona}
        assignments={assignments}
        setAssignments={setAssignments}
        calendarScope={`${storageKey}-calendar`}
        role="professor"
      />
    </div>
  );
}
