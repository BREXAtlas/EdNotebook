import { useEffect, useMemo, useState } from "react";
import { listPublishedCourses } from "./portalService.js";
import { TEXAS_UNIVERSITIES, TEXAS_UNIVERSITY_SOURCE } from "./texasUniversities.js";
import { scrollWithinHashRoute } from "../scrollWithinHashRoute.js";

export default function UniversityFinder({ onOpenCourse }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(null);
  const [liveCourses, setLiveCourses] = useState([]);

  useEffect(() => {
    let active = true;
    listPublishedCourses("university").then((result) => {
      if (active && result.source === "live") setLiveCourses(result.data);
    });
    return () => { active = false; };
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return TEXAS_UNIVERSITIES;
    return TEXAS_UNIVERSITIES.filter((school) => `${school.name} ${school.location} ${school.category}`.toLowerCase().includes(needle));
  }, [query]);

  const displayed = query.trim() || showAll ? matches : matches.slice(0, 12);
  const selectedCourses = selected
    ? liveCourses.filter((course) => course.institution_name.trim().toLowerCase() === selected.name.trim().toLowerCase())
    : [];

  function openCourse(course) {
    onOpenCourse?.({
      ...course,
      id: course.course_id,
      code: course.course_code,
      professor: course.professor_display_name,
      school: selected,
    });
  }

  return (
    <section className="university-finder" aria-labelledby="university-finder-title">
      <div><span className="portal-kicker">TEXAS UNIVERSITY FINDER</span><h2 id="university-finder-title">Start with your university.</h2><p>Search all 85 public and independent universities in the current Texas Higher Education Coordinating Board directory. Published EdNotebook classes appear under the selected school.</p></div>
      <label>University name or type<input spellCheck value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(false); }} placeholder="Try Texas A&M, UT Austin, Rice, or public university" /></label>
      <div className="university-finder-results" aria-live="polite">
        {displayed.map((school) => {
          const courseCount = liveCourses.filter((course) => course.institution_name.trim().toLowerCase() === school.name.trim().toLowerCase()).length;
          return <button className={selected?.id === school.id ? "is-selected" : ""} type="button" onClick={() => setSelected(school)} key={school.id}><strong>{school.name}</strong><span>{school.category} · {courseCount ? `${courseCount} published EdNotebook ${courseCount === 1 ? "class" : "classes"}` : "directory listing"}</span></button>;
        })}
        {!matches.length && <p>No Texas universities match that search.</p>}
      </div>
      {!query.trim() && !showAll && <button className="university-show-all" type="button" onClick={() => setShowAll(true)}>Show all {TEXAS_UNIVERSITIES.length} Texas universities</button>}
      {selected && <div className="university-selected-card"><div><span className="portal-kicker">SELECTED UNIVERSITY</span><h3>{selected.name}</h3><p>{selectedCourses.length ? "Choose a published EdNotebook class below." : "This university is in the Texas directory. No EdNotebook classes have been published for it yet."}</p></div>{selectedCourses.length ? <div>{selectedCourses.map((course) => <button type="button" onClick={() => openCourse(course)} key={course.course_id}><strong>{course.course_code} · {course.title}</strong><span>{course.professor_display_name} · {course.term || "Term to be announced"}</span></button>)}</div> : <a href="#share-ednotebook" onClick={(event) => scrollWithinHashRoute(event, "share-ednotebook")}>Invite a friend or professor to EdNotebook</a>}</div>}
      <small className="university-source-note">Directory verified July 2026 from the <a href={TEXAS_UNIVERSITY_SOURCE} target="_blank" rel="noreferrer">Texas Higher Education Coordinating Board</a>. A directory listing does not mean the university has joined EdNotebook.</small>
    </section>
  );
}
