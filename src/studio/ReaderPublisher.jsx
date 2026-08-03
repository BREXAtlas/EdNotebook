import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import InteractiveReader from "./InteractiveReader.jsx";
import { BookImporter, PublisherApplication } from "./PublisherStudio.jsx";
import { listProfessorPublicationCourses } from "./publishingService.js";

const TABS = [
  ["reader", "Interactive reader", "📖"],
  ["import", "Import & convert", "⇩"],
  ["partner", "Commercial publishing", "◎"],
];

export default function ReaderPublisher() {
  const [tab, setTab] = useState("reader");
  const [publications, setPublications] = useState([]);
  const [courses, setCourses] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    const [publicationResult, courseResult, userResult] = await Promise.all([
      supabase
        .from("publications")
        .select("*")
        .order("created_at", { ascending: false }),
      listProfessorPublicationCourses(),
      supabase.auth.getUser(),
    ]);
    if (publicationResult.error || courseResult.error || userResult.error) setError(publicationResult.error?.message || courseResult.error?.message || userResult.error?.message);
    else {
      setPublications(publicationResult.data || []);
      setCourses(courseResult.data || []);
      setCurrentUserId(userResult.data.user?.id || "");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function saved() {
    refresh();
    setTab("reader");
  }

  return (
    <section className="studio-workspace" aria-labelledby="reader-publisher-title">
      <div className="studio-section-heading">
        <div>
          <span className="studio-kicker">EDUBOOK READER & PUBLISHING</span>
          <h2 id="reader-publisher-title">Do not only upload a book. Convert it into something that can be taught.</h2>
          <p>
            EduBook/1.0 is the portable layer for chapters, progress, annotations, knowledge checks, discussion, rights, and access models.
          </p>
        </div>
        <span className="studio-paid-badge">Publisher marketplace · paid feature foundation</span>
      </div>

      <div className="studio-subtabs" role="tablist" aria-label="Reading and publishing tools">
        {TABS.map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "is-active" : ""}
            onClick={() => setTab(value)}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="studio-alert is-error">{error}</div>}
      {tab === "reader" && <InteractiveReader publications={publications} courses={courses} currentUserId={currentUserId} loading={loading} onRefresh={refresh} />}
      {tab === "import" && <BookImporter onSaved={saved} />}
      {tab === "partner" && <PublisherApplication />}
    </section>
  );
}
