import { useEffect } from "react";
import BrandLogo from "./Brand.jsx";
import "./course-publishing-studio.css";

export default function CourseJoinExperience({ token }) {
  useEffect(() => {
    if (token) window.sessionStorage.setItem("ednotebook-course-join-token", token);
  }, [token]);
  return <main className="course-live-status"><section className="course-join-card"><BrandLogo size={54} tagline="One link. Your class is ready." /><span>CLASS INVITATION</span><h1>Your professor has already set up the class.</h1><p>Create your free profile or sign in. EdNotebook will connect the class, announcements, and due dates automatically.</p><a href="#/student/university/app?signup=1">Create profile and join class</a><a href="#/student/university/app">I already have an account</a><small>You can review the class before adding any optional profile details.</small></section></main>;
}
