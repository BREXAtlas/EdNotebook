import { useEffect, useMemo, useState } from "react";
import { K12_SCHOOLS, SCHOOLS } from "./demoData.js";
import { educationTrack } from "./educationTracks.js";
import { listPublishedCourses } from "./portalService.js";

function liveSchools(rows) {
  const schools = new Map();
  rows.forEach((row) => {
    const id = row.institution_id || row.institution_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!schools.has(id)) {
      schools.set(id, {
        id,
        name: row.institution_name,
        location: "Published directory",
        label: "Live classes",
        classes: [],
      });
    }
    schools.get(id).classes.push({
      id: row.course_id,
      code: row.course_code,
      title: row.title,
      professor: row.professor_display_name,
      professorId: row.professor_id,
      subject: row.subject || "Course",
      term: row.term || "Current term",
      schedule: row.schedule || "See class details",
      summary: row.summary || "The professor has published this class for student discovery.",
      enrolled: null,
      seats: null,
      enrollmentOpen: row.enrollment_open,
      educatorVerificationStatus: row.educator_verification_status || "unverified",
    });
  });
  return [...schools.values()];
}

function initialSchool(schools) {
  const query = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(query).get("college") || schools[0].id;
}

export default function ClassDirectory({ onOpen, compact = false, track = "university" }) {
  const copy = educationTrack(track);
  const demoSchools = track === "k12" ? K12_SCHOOLS : SCHOOLS;
  const [schoolId, setSchoolId] = useState(() => initialSchool(demoSchools));
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState(demoSchools);
  const [source, setSource] = useState("demo");
  const school = schools.find((item) => item.id === schoolId) || schools[0];

  useEffect(() => {
    let active = true;
    listPublishedCourses(track).then((result) => {
      if (!active || result.source !== "live") return;
      const nextSchools = liveSchools(result.data);
      if (nextSchools.length) {
        setSchools(nextSchools);
        setSchoolId(nextSchools[0].id);
        setSource("live");
      }
    });
    return () => { active = false; };
  }, [track]);
  const classes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return school.classes;
    return school.classes.filter((course) => (
      `${course.code} ${course.title} ${course.professor} ${course.subject}`.toLowerCase().includes(needle)
    ));
  }, [query, school]);

  return (
    <section className={`class-directory ${compact ? "is-compact" : ""}`} aria-labelledby="directory-title">
      <div className="directory-heading">
        <div>
          <span className="portal-kicker">PUBLIC CLASS DIRECTORY</span>
          <h2 id="directory-title">Find your {copy.schoolLabel.toLowerCase()}, {copy.classLabel}, or {copy.teacherLabel}.</h2>
          <p>Browsing is open. Sign-in starts only when you join a class or open protected course work.</p>
        </div>
        <span className="demo-data-label">{source === "live" ? "Live published listings" : "Demonstration listings"}</span>
      </div>
      <div className="directory-controls">
        <label>
          {copy.schoolLabel}
          <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)}>
            {schools.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          {copy.classLabel[0].toUpperCase() + copy.classLabel.slice(1)} or {copy.teacherLabel}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={track === "k12" ? "Try ALG I or Ms. Carter" : "Try SCI 101 or Dr. Nguyen"} />
        </label>
      </div>
      <div className="school-directory-summary">
        <div><strong>{school.name}</strong><span>{school.location} · {school.label}</span></div>
        <span>{classes.length} published {classes.length === 1 ? "class" : "classes"}</span>
      </div>
      <div className="directory-results" aria-live="polite">
        {classes.map((course) => (
          <article className="directory-course" key={course.id}>
            <div className="course-code-tile"><strong>{course.code}</strong><span>{course.subject}</span></div>
            <div className="directory-course-copy">
              <h3>{course.title}</h3>
              <p>{course.summary}</p>
              <div><span>{course.professor}</span><span>{course.term}</span><span>{course.schedule}</span></div>
              <span className={`educator-verification-badge is-${course.educatorVerificationStatus || "unverified"}`}>{course.educatorVerificationStatus === "approved" ? `Verified ${copy.teacherLabel}` : course.educatorVerificationStatus === "pending" ? "Affiliation review pending" : "Affiliation unverified"}</span>
            </div>
            <div className="directory-course-action">
              <span>{course.seats == null ? (course.enrollmentOpen ? "Linking open" : "Linking paused") : `${course.enrolled} / ${course.seats} seats`}</span>
              <button type="button" onClick={() => onOpen?.({ ...course, school })}>View class</button>
            </div>
          </article>
        ))}
        {classes.length === 0 && <div className="directory-empty">No published classes match that search at {school.name}.</div>}
      </div>
    </section>
  );
}
