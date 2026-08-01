import { useEffect, useMemo, useState } from "react";
import EdNotebookMediaReader from "../media/EdNotebookMediaReader.jsx";
import { normalizeHttpsUrl } from "../media/courseMediaModel.js";
import { deleteMyCourseLink, listMyCourseResources, saveMyCourseLink } from "./courseService.js";

export default function CourseResourcesPanel({ courseId, resources = [] }) {
  const [personal, setPersonal] = useState([]);
  const [form, setForm] = useState({ url: "", title: "", description: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const courseResources = useMemo(
    () => resources.filter((resource) => resource.target_kind === "course"),
    [resources],
  );

  async function refresh() {
    const result = await listMyCourseResources(courseId);
    if (result.error) setNotice(result.error.message);
    else setPersonal(result.data || []);
  }

  useEffect(() => {
    refresh();
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(event) {
    event.preventDefault();
    setNotice("");
    if (!normalizeHttpsUrl(form.url)) {
      setNotice("Use a complete HTTPS resource address.");
      return;
    }
    if (!form.title.trim()) {
      setNotice("Add a title so you can find this resource later.");
      return;
    }
    setBusy(true);
    const result = await saveMyCourseLink(courseId, form);
    setBusy(false);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    setForm({ url: "", title: "", description: "" });
    setPersonal((current) => [result.data, ...current]);
    setNotice("Saved privately. Only you can see this resource.");
  }

  async function remove(resource) {
    const result = await deleteMyCourseLink(resource.id);
    if (result.error) setNotice(result.error.message);
    else {
      setPersonal((current) => current.filter((item) => item.id !== resource.id));
      setNotice("Private resource removed.");
    }
  }

  return (
    <section className="course-resources-view" aria-labelledby="course-resources-title">
      <header>
        <span className="course-kicker">MEDIA &amp; RESOURCES</span>
        <h1 id="course-resources-title">Watch, read, and keep your source trail here.</h1>
        <p>Professor-published media stays attached to this course. Your saved resources remain private.</p>
      </header>
      <section aria-labelledby="professor-course-resources">
        <h2 id="professor-course-resources">From your professor</h2>
        <div className="course-resource-grid">
          {courseResources.map((resource) => <EdNotebookMediaReader key={resource.id} resource={resource} />)}
        </div>
        {!courseResources.length && <p className="course-resource-empty">No course-wide media has been published yet. Lesson media appears inside its lesson.</p>}
      </section>
      <section className="course-personal-resources" aria-labelledby="personal-course-resources">
        <div>
          <span className="course-kicker">PRIVATE TO YOU</span>
          <h2 id="personal-course-resources">My course resources</h2>
          <p>Save a useful HTTPS link or YouTube video without sharing it with the class.</p>
        </div>
        <form onSubmit={save}>
          <label>Resource address<input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://…" /></label>
          <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What will help you recognize it?" /></label>
          <label>Description<textarea rows="2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Why did you save it?" /></label>
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save privately"}</button>
        </form>
        {notice && <p className="course-resource-notice" role="status">{notice}</p>}
        <div className="course-resource-grid">
          {personal.map((resource) => <EdNotebookMediaReader key={resource.id} resource={resource} compact personal onRemove={remove} />)}
        </div>
      </section>
    </section>
  );
}
