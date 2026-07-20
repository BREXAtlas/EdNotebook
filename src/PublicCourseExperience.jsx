import { useEffect, useState } from "react";
import { CourseRenderer } from "./CoursePublishingStudio.jsx";
import { loadPublicCourse } from "./coursePublishingService.js";

export default function PublicCourseExperience({ shareCode }) {
  const [publication, setPublication] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; loadPublicCourse(shareCode).then((result) => { if (active) { setPublication(result); setLoading(false); } }); return () => { active = false; }; }, [shareCode]);
  if (loading) return <main className="course-live-status"><div><strong>Opening the course…</strong><p>No account is needed.</p></div></main>;
  if (!publication) return <main className="course-live-status"><div><h1>This course link is not available.</h1><p>Ask the professor for a fresh link or open EdNotebook to find the class.</p><a href="#/students">Find classes</a></div></main>;
  return <main className="course-live-page"><header className="course-live-topbar"><div><strong>Live course broadcast</strong><span> · no account required</span></div><a href="#/students">Join EdNotebook</a></header><CourseRenderer course={publication.content_json} lessons={publication.content_json.lessons || {}} appearance={publication.appearance_json || { accent: "#1d4ed8", background: "#f6f7fb", font: "Notebook" }} presentation /></main>;
}
