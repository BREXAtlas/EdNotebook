import LayoutViewToggle from "./LayoutViewToggle.jsx";

const YEAR = new Date().getFullYear();

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="EdNotebook site directory">
      <div className="site-footer-grid">
        <section className="site-footer-brand">
          <img src="/brand/ednotebook-logo-monochrome.svg" alt="EdNotebook" />
          <p>Course creation, student planning, teaching tools, and learning communities in one clear workspace.</p>
          <a className="site-footer-contact" href="mailto:hello@transformontologysystems.com">Email EdNotebook at hello@transformontologysystems.com</a>
          <span>© {YEAR} EdNotebook</span>
        </section>
        <nav aria-label="Start with EdNotebook"><strong>Start here</strong><a href="#/students/university">University student portal</a><a href="#/students/k12">K–12 student portal</a><a href="#/professors">Professor and teacher portal</a><a href="#/publishers">Learning publisher portal</a><a href="#/professor/dashboard">Educator sign in</a></nav>
        <nav aria-label="Create and teach with EdNotebook"><strong>Create and teach</strong><a href="#/professors?tool=syllabus">Review a syllabus</a><a href="#/professors?tool=lesson">Build a lesson starter</a><a href="#/professors?section=creator-content">Text, visual, and interactive content</a><a href="#/professors?section=creator-status">Advanced customization and AI roadmap</a><a href="#/professors?section=creator-workflow">Create, refine, and share</a></nav>
        <nav aria-label="Student planning tools"><strong>Learn and plan</strong><a href="#/students/university?tool=syllabus">University syllabus scanner</a><a href="#/students/k12?tool=syllabus">K–12 handout scanner</a><a href="#/students/university?section=student-ai-tools">Student AI assistant status</a><a href="#/students/university?section=class-search">Find a university class</a><a href="#/student/university/app">Student sign in</a></nav>
        <nav aria-label="EdNotebook company and help"><strong>EdNotebook</strong><a href="#/presentation">How EdNotebook works</a><a href="#/tour">Choose an interactive tour</a><a href="#/about">About and values</a><a href="#/careers">Work with EdNotebook</a><a href="#/tour/professor">Tour with Atlas</a></nav>
      </div>
      <div className="site-footer-view"><div><strong>Choose how this device shows EdNotebook</strong><span>Auto is recommended. Compact stacks the page. Full keeps the desktop layout at readable size and lets you pan.</span></div><LayoutViewToggle /></div>
    </footer>
  );
}
