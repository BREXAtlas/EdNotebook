import { useMemo, useState } from "react";
import { SCHOOLS } from "./demoData.js";

export default function UniversityFinder() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SCHOOLS;
    return SCHOOLS.filter((school) => `${school.name} ${school.location} ${school.label}`.toLowerCase().includes(needle));
  }, [query]);

  return (
    <section className="university-finder" aria-labelledby="university-finder-title">
      <div><span className="portal-kicker">UNIVERSITY FINDER</span><h2 id="university-finder-title">Start with the school.</h2><p>Search the university directory, then open its published professors and courses.</p></div>
      <label>University name or location<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Example University or West Texas" /></label>
      <div className="university-finder-results" aria-live="polite">
        {matches.map((school) => <a href={`#/students/university?college=${school.id}`} key={school.id}><strong>{school.name}</strong><span>{school.location} · {school.classes.length} published courses</span></a>)}
        {!matches.length && <p>No universities match that search yet.</p>}
      </div>
    </section>
  );
}
