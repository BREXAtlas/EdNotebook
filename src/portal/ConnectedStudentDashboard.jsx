import { useEffect, useState } from "react";
import StudentDashboard from "./StudentDashboard.jsx";
import { listCurrentStudentCourses } from "./portalService.js";
import { loadLearnerProgress, loadStudentCourseLinks } from "../course-runtime/courseService.js";
import "./connected-student.css";

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

  return (
    <StudentDashboard
      {...props}
      connectedCourses={courses}
      connectedCourseNotice={notice}
    />
  );
}
