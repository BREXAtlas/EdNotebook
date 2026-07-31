import { useEffect, useState } from "react";
import BrandLogo from "../Brand.jsx";
import { supabase } from "../supabaseClient.js";
import InteractiveReader from "./InteractiveReader.jsx";
import "./studio.css";

export default function LibraryBookPage({ publicationId, onBack }) {
  const [publication, setPublication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("publications")
      .select("*")
      .eq("id", publicationId)
      .eq("status", "published")
      .maybeSingle();
    setPublication(data || null);
    setError(loadError?.message || (!data ? "This book is not available to this student account." : ""));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [publicationId]);

  return <div className="learning-studio-page library-book-page">
    <header className="studio-topbar">
      <button className="studio-brand-button" type="button" onClick={onBack} aria-label="Return to Alex B. Morrison Library">
        <BrandLogo size={40} tagline="Alex B. Morrison Library" />
      </button>
      <div className="studio-course-context"><small>LIBRARY BOOK</small><strong>{publication?.title || "Opening book…"}</strong><span>{publication?.reading_mode === "interactive" ? "Interactive EduBook" : "Read-only edition"}</span></div>
      <div className="studio-topbar-actions"><button className="is-primary" type="button" onClick={onBack}>Back to Library</button></div>
    </header>
    <main className="library-book-reader-shell">
      {error && <div className="studio-alert is-error" role="alert">{error}</div>}
      <InteractiveReader publications={publication ? [publication] : []} loading={loading} onRefresh={load} libraryMode />
    </main>
  </div>;
}
