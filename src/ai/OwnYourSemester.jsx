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

export default function OwnYourSemester({
  profile,
  session,
  track = "university",
  classes = [],
}) {
  const storageKey = `ednotebook-own-semester-${session?.user?.id || "student"}-${track}`;
  const [assignments, setAssignments] = useState(() =>
    readSavedItems(storageKey)
  );
  const persona = useMemo(() => {
    const normalizedClasses = classes.length
      ? classes.map((course) => ({
          code: course.code || course.course_code || "COURSE",
          title: course.title || "My course",
        }))
      : [{ code: "COURSE", title: "My course" }];
    return {
      id: track === "k12" ? "k12" : "student",
      name: profile?.full_name || "Student",
      shortName: profile?.full_name?.split(" ")[0] || "student",
      classes: normalizedClasses,
      assignments,
      calendarEvents: [],
    };
  }, [assignments, classes, profile?.full_name, track]);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, items: assignments }),
    );
  }, [assignments, storageKey]);

  return (
    <div className="own-semester-page">
      <section className="dashboard-card own-semester-intro">
        <span className="portal-kicker">PHASE 4 · OWN YOUR SEMESTER</span>
        <h1>Turn a syllabus into a plan you verify.</h1>
        <p>
          EdNotebook reads obvious dates on this device first. When staging AI
          is available, only the remaining unstructured syllabus passages go
          through the governed TOS router. Student IDs, personal grades, and
          private messages are not allowed.
        </p>
        <div>
          <strong>Nothing here changes an official deadline.</strong>
          <span>
            Every assignment or date starts unchecked and enters this calendar
            only after you approve it.
          </span>
        </div>
      </section>

      <SyllabusPanel
        persona={persona}
        assignments={assignments}
        setAssignments={setAssignments}
        enableGovernedStudentAi
      />

      <CalendarPanel
        persona={persona}
        assignments={assignments}
        setAssignments={setAssignments}
        calendarScope={`${storageKey}-calendar`}
        role="student"
      />
    </div>
  );
}
