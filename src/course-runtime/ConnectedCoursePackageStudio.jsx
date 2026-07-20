import { useEffect, useState } from "react";
import CoursePackageStudio from "./CoursePackageStudio.jsx";
import EnrollmentManager from "./EnrollmentManager.jsx";

export default function ConnectedCoursePackageStudio(props) {
  const [courseId, setCourseId] = useState(() => window.localStorage.getItem("ednotebook-course-id") || "");

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = window.localStorage.getItem("ednotebook-course-id") || "";
      setCourseId((current) => current === next ? current : next);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="connected-course-studio">
    <CoursePackageStudio {...props} />
    {courseId && <div style={{ maxWidth: 1200, margin: "20px auto 110px", padding: "0 20px" }}><EnrollmentManager courseId={courseId} /></div>}
  </div>;
}
