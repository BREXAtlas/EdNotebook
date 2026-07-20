import { useEffect, useState } from "react";
import StudentDashboard from "./StudentDashboard.jsx";
import { listCurrentStudentCourses } from "./portalService.js";
import { loadLearnerProgress, loadStudentCourseLinks } from "../course-runtime/courseService.js";

export default function ConnectedStudentDashboard(props) {
  const { session, track = "university" } = props;
  const [courses, setCourses] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const courseResult = await listCurrentStudentCourses();
      if (!active) return;
      if (courseResult.error) { setNotice(courseResult.error.message); return; }
      const courseRows = courseResult.data || [];
      const publicationResult = await loadStudentCourseLinks(courseRows.map((course) => course.id));
      if (!active) return;
      const links = publicationResult.data || [];
      const connected = await Promise.all(links.map(async (link) => {
        const course = courseRows.find((item) => item.id === link.course_id);
        const progressResult = await loadLearnerProgress(link.id, session?.user?.id);
        return { ...link, course, progress: progressResult.data?.summary || null };
      }));
      if (active) setCourses(connected.filter((item) => item.course));
    })();
    return () => { active = false; };
  }, [session?.user?.id]);

  return <>
    {courses.length > 0 && <section className="connected-course-strip" aria-labelledby="connected-course-title">
      <div><span>CONNECTED COURSES</span><h1 id="connected-course-title">Continue learning inside EdNotebook.</h1><p>Published lessons, due work, progress, completion, and grades remain connected to your professor.</p></div>
      <div>{courses.map((item) => <article key={item.id}><span>{item.course.course_code || "COURSE"}</span><strong>{item.course.title}</strong><small>{item.progress ? `${item.progress.completion_percent}% complete · ${item.progress.grade_status.replaceAll("_", " ")}` : "Ready to begin"}</small><a href={`#/student/${track}/course/${item.id}`}>{item.progress ? "Continue course" : "Open course"}</a></article>)}</div>
    </section>}
    {notice && <div className="portal-form-notice" role="status">Course links will retry: {notice}</div>}
    <StudentDashboard {...props} />
  </>;
}
