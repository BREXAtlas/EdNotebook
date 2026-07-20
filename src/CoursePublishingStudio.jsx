import { useMemo, useState } from "react";
import FullscreenSurface from "./FullscreenSurface.jsx";
import { createCourseJoinLink, publishCourse, safeAppearance, safeCoursePayload } from "./coursePublishingService.js";
import "./course-publishing-studio.css";

const PAGES = [
  { id: "customize", label: "Customize" },
  { id: "preview", label: "Preview" },
  { id: "broadcast", label: "Share & present" },
];

const FONT_OPTIONS = {
  Notebook: "Georgia, 'Times New Roman', serif",
  Clean: "Inter, Arial, sans-serif",
  Friendly: "Trebuchet MS, Arial, sans-serif",
  Classic: "Palatino Linotype, Palatino, serif",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function CourseRenderer({ course, lessons, appearance, presentation = false }) {
  const [openLesson, setOpenLesson] = useState(null);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});
  const payload = useMemo(() => safeCoursePayload(course, lessons), [course, lessons]);
  const theme = useMemo(() => safeAppearance(appearance), [appearance]);
  return <article className={`course-public-view ${presentation ? "is-presentation" : ""}`} style={{ "--course-accent": theme.accent, "--course-background": theme.background, "--course-font": FONT_OPTIONS[theme.font] }}>
    <header><span>{presentation ? "PRESENTATION MODE" : "EDNOTEBOOK COURSE"}</span><h1>{payload.courseTitle}</h1><p>{payload.subtitle}</p></header>
    <nav aria-label="Course lessons">{payload.acts.flatMap((act) => act.episodes).map((episode, index) => <button type="button" className={openLesson === episode.id ? "is-active" : ""} onClick={() => setOpenLesson(episode.id)} key={episode.id}><b>{String(index + 1).padStart(2, "0")}</b><span>{episode.title}<small>{episode.type} · {episode.minutes} min</small></span></button>)}</nav>
    <main>
      {!openLesson && <section className="course-start-card"><strong>Ready when you are.</strong><p>Choose a lesson. No EdNotebook account is required to view this shared course or try its knowledge checks.</p><button type="button" disabled={!payload.acts[0]?.episodes[0]} onClick={() => setOpenLesson(payload.acts[0]?.episodes[0]?.id)}>Start the first lesson</button></section>}
      {openLesson && (() => {
        const episode = payload.acts.flatMap((act) => act.episodes).find((item) => item.id === openLesson);
        const lesson = payload.lessons[openLesson];
        return <section className="course-lesson-view"><span>{episode?.type} · {episode?.minutes} min</span><h2>{episode?.title}</h2>{lesson?.sections?.length ? lesson.sections.map((section, index) => <div key={`${section.heading}-${index}`}><h3>{section.heading}</h3><p>{section.body}</p>{lesson.knowledgeChecks?.filter((check) => check.after === index).map((check, checkIndex) => { const key = `${openLesson}-${index}-${checkIndex}`; return <fieldset key={key}><legend>{check.q}</legend>{check.options.map((option, optionIndex) => <label key={option}><input type="radio" name={key} checked={Number(answers[key]) === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [key]: optionIndex }))} />{option}</label>)}<button type="button" onClick={() => setChecked((current) => ({ ...current, [key]: true }))}>Check my answer</button>{checked[key] && <p className={Number(answers[key]) === check.answer ? "is-correct" : "is-try-again"}>{Number(answers[key]) === check.answer ? "That’s it. " : "Try again. "}{check.why}</p>}</fieldset>; })}</div>) : <div className="course-title-only"><strong>This lesson is outlined and ready for the professor to finish.</strong><p>The shared course updates when the professor publishes the completed lesson.</p></div>}</section>;
      })()}
    </main>
  </article>;
}

function buildStandaloneHtml(course, lessons, appearance) {
  const payload = safeCoursePayload(course, lessons);
  const theme = safeAppearance(appearance);
  const lessonCards = payload.acts.map((act) => `<section class="unit"><h2>${escapeHtml(act.title)}</h2>${act.episodes.map((episode) => { const lesson = payload.lessons[episode.id]; return `<details><summary><b>${escapeHtml(episode.title)}</b><span>${escapeHtml(episode.type)} · ${episode.minutes} min</span></summary>${lesson?.sections?.map((section) => `<article><h3>${escapeHtml(section.heading)}</h3><p>${escapeHtml(section.body)}</p></article>`).join("") || "<p>This lesson outline is ready for the professor to complete.</p>"}</details>`; }).join("")}</section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(payload.courseTitle)}</title><style>:root{--accent:${theme.accent};--paper:${theme.background};--font:${FONT_OPTIONS[theme.font]}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:#16233d;font:16px/1.6 var(--font);padding:clamp(18px,5vw,70px)}header,.unit{max-width:980px;margin:auto}header{padding:42px;border-radius:24px;color:white;background:var(--accent);box-shadow:0 22px 60px #14284a26}h1{font-size:clamp(38px,7vw,78px);line-height:1;margin:.2em 0}.unit{margin-top:28px}details{background:white;border:1px solid #d9dfeb;border-radius:14px;margin:10px 0;padding:16px}summary{display:flex;justify-content:space-between;gap:20px;cursor:pointer}summary span{color:#66748a;font-size:13px}article{padding:8px 10px;border-top:1px solid #edf0f5}footer{max-width:980px;margin:28px auto;color:#6a7485;font-size:12px}footer a{color:inherit}</style></head><body><header><small>EDNOTEBOOK STANDALONE COURSE</small><h1>${escapeHtml(payload.courseTitle)}</h1><p>${escapeHtml(payload.subtitle)}</p></header>${lessonCards}<footer>Created with EdNotebook · ednotebook.com · <a href="mailto:hello@transformontologysystems.com">hello@transformontologysystems.com</a></footer></body></html>`;
}

function downloadHtml(course, lessons, appearance) {
  const blob = new Blob([buildStandaloneHtml(course, lessons, appearance)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${String(course.courseTitle || "ednotebook-course").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ednotebook-course"}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CoursePublishingStudio({ course, lessons, courseId, onClose }) {
  const [appearance, setAppearance] = useState({ accent: "#1d4ed8", background: "#f6f7fb", font: "Notebook" });
  const [publication, setPublication] = useState(null);
  const [classInvite, setClassInvite] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const publicationLink = useMemo(() => publication ? `${window.location.origin}${window.location.pathname}#/course-live/${publication.share_code}` : "", [publication]);
  const broadcastLink = publication?.local_only === false || (publication && publication.local_only == null) ? publicationLink : "";
  const localPreviewLink = publication?.local_only ? publicationLink : "";
  const cloudReady = Boolean(courseId);

  async function broadcast() {
    setBusy(true); setNotice("");
    try { const result = await publishCourse({ courseId, course, lessons, appearance }); setPublication(result); setNotice(result.local_only ? "Local preview created on this device. Save the course to your account before sharing it." : "Broadcast link is live."); } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function makeClassInvite() {
    setBusy(true); setNotice("");
    try { const token = await createCourseJoinLink(courseId); setClassInvite(`${window.location.origin}${window.location.pathname}#/join/${encodeURIComponent(token)}`); setNotice("Class signup link created. New students are enrolled after they create their profile."); } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function copy(value, label) { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`); }

  return <FullscreenSurface title="Course Publishing Studio" pages={PAGES} initialPage="customize" addressPrefix="ednotebook://course-studio" onClose={onClose} renderPage={(page, navigate) => {
    if (page === "preview") return <div className="course-studio-preview"><div className="course-studio-preview-actions"><strong>Student preview</strong><span>Try the course exactly as a guest or enrolled student will see it.</span><button type="button" onClick={() => navigate("broadcast")}>{cloudReady ? "Share or present" : "Presentation and export setup"}</button></div><CourseRenderer course={course} lessons={lessons} appearance={appearance} /></div>;
    if (page === "broadcast") return <div className="course-studio-share"><section><span>{cloudReady ? "TEACH FROM EDNOTEBOOK" : "DEVICE PRESENTATION"}</span><h2>{cloudReady ? "Broadcast the course in three clicks." : "Preview here or export a standalone course."}</h2><ol>{cloudReady ? <><li>Publish a view-only course link.</li><li>Text, email, or display it for the room.</li><li>Students open lessons and knowledge checks—no account required.</li></> : <><li>Create a presentation preview stored only on this device.</li><li>Export a standalone HTML file for another website or presentation.</li><li>Save and select a class before creating a shareable EdNotebook link.</li></>}</ol><div className="course-studio-button-row"><button type="button" onClick={broadcast} disabled={busy}>{busy ? "Preparing…" : cloudReady ? "Create broadcast link" : "Create device-only presentation"}</button><button type="button" onClick={() => downloadHtml(course, lessons, appearance)}>Export standalone HTML</button></div>{broadcastLink && <div className="course-link-result"><input readOnly value={broadcastLink} /><button type="button" onClick={() => copy(broadcastLink, "Broadcast link")}>Copy broadcast link</button><a href={broadcastLink}>Open presentation</a></div>}{localPreviewLink && <div className="course-link-result"><strong>Device-only preview</strong><a href={localPreviewLink}>Open local preview</a></div>}</section><section><span>ENROLL THE CLASS</span><h2>{cloudReady ? "One link sets up the student side." : "Save and select this course first."}</h2><p>{cloudReady ? "Students follow the link, create a simple profile, and land inside this class with announcements and due dates already connected." : "A class signup link must be tied to an explicitly selected saved course. This device draft is not connected to a class yet."}</p><button type="button" onClick={makeClassInvite} disabled={busy || !cloudReady}>{cloudReady ? "Create automatic class signup link" : "Class signup link unavailable until course setup"}</button>{classInvite && <div className="course-link-result"><input readOnly value={classInvite} /><button type="button" onClick={() => copy(classInvite, "Class signup link")}>Copy class signup link</button></div>}</section>{notice && <p className="course-studio-notice" role="status">{notice}</p>}</div>;
    return <div className="course-studio-customize"><section><span>COURSE LOOK</span><h2>Keep it recognizable and readable.</h2><p>Choose a restrained style for EdNotebook, a presentation, or a standalone university web page.</p><label>Accent color<input type="color" value={appearance.accent} onChange={(event) => setAppearance((current) => ({ ...current, accent: event.target.value }))} /></label><label>Page color<input type="color" value={appearance.background} onChange={(event) => setAppearance((current) => ({ ...current, background: event.target.value }))} /></label><label>Font<select value={appearance.font} onChange={(event) => setAppearance((current) => ({ ...current, font: event.target.value }))}>{Object.keys(FONT_OPTIONS).map((font) => <option key={font}>{font}</option>)}</select></label><div className="course-studio-button-row"><button type="button" onClick={() => navigate("preview")}>Preview course</button><button type="button" onClick={() => downloadHtml(course, lessons, appearance)}>Export HTML</button></div></section><CourseRenderer course={course} lessons={lessons} appearance={appearance} />{notice && <p className="course-studio-notice" role="status">{notice}</p>}</div>;
  }} />;
}

export { CourseRenderer, buildStandaloneHtml };
