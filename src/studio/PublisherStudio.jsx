import { useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { textToEduBook } from "./edubook.js";
import {
  buildDigitalLiteracyName,
  checksumFile,
  currentCourseId,
  readCourseDraft,
  uploadCloudFile,
  validateFile,
} from "./storageService.js";

const SOURCE_ACCEPT = ".txt,.md,.pdf,.doc,.docx,.epub,.zip";

function inferSourceFormat(file) {
  const name = file?.name?.toLowerCase() || "";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".epub")) return "application/epub+zip";
  if (name.endsWith(".zip")) return "application/zip";
  return file?.type || "application/octet-stream";
}

export function BookImporter({ onSaved }) {
  const course = useMemo(readCourseDraft, []);
  const [title, setTitle] = useState("Teaching Digital Systems");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("An interactive reading built for annotation, verification, and discussion.");
  const [sourceText, setSourceText] = useState("# Opening\n\nPaste original or licensed text here. Blank lines create paragraphs. Markdown headings create chapters.\n\n# Chapter One\n\nThe converted book can include reading progress, annotations, checks, and discussion prompts.");
  const [sourceFile, setSourceFile] = useState(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [rightsStatement, setRightsStatement] = useState("I own this material or have permission to upload and distribute it through EdNotebook.");
  const [accessModel, setAccessModel] = useState("private");
  const [price, setPrice] = useState("");
  const [rentalDays, setRentalDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const instantManifest = useMemo(() => textToEduBook({ title, author, sourceText, description }), [title, author, sourceText, description]);

  async function importBook(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (!rightsConfirmed) throw new Error("Confirm your ownership or distribution rights before uploading publication material.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const publicationId = crypto.randomUUID();
      let target = null;
      let manifest = sourceText.trim() ? instantManifest : {};
      let conversionStatus = sourceText.trim() ? "ready" : "queued";
      let sourceFormat = sourceText.trim() ? "text/plain" : null;

      if (sourceFile) {
        validateFile(sourceFile);
        sourceFormat = inferSourceFormat(sourceFile);
        const safeName = buildDigitalLiteracyName({
          file: sourceFile,
          courseCode: course.code || "publisher",
          category: "book-source",
          title: title || sourceFile.name,
          version: 1,
        });
        const checksumSha256 = await checksumFile(sourceFile);
        target = await uploadCloudFile(sourceFile, {
          userId: userData.user.id,
          scope: "publication",
          publicationId,
          safeName,
          checksumSha256,
          title,
          category: "book-source",
          courseCode: course.code || "publisher",
        });
        if (!["text/plain", "text/markdown"].includes(sourceFormat)) {
          manifest = {
            format: "EduBook/1.0",
            title,
            author,
            description,
            source: {
              type: sourceFormat,
              originalName: sourceFile.name,
              safeName,
              checksumSha256,
              importedAt: new Date().toISOString(),
            },
            chapters: [],
            conversion: {
              status: "queued",
              pipeline: ["extract", "structure", "rights-check", "learning-design", "quality-review"],
            },
          };
          conversionStatus = "queued";
        }
      }

      manifest.rights = { confirmed: true, statement: rightsStatement.trim() };
      const priceCents = price === "" ? null : Math.max(0, Math.round(Number(price) * 100));
      const { error: publicationError } = await supabase.from("publications").insert({
        id: publicationId,
        owner_id: userData.user.id,
        course_id: currentCourseId(),
        title: title.trim() || sourceFile?.name || "Untitled publication",
        author_name: author.trim(),
        description: description.trim(),
        source_format: sourceFormat,
        bucket_id: target?.bucket || null,
        storage_path: target?.path || null,
        rights_confirmed: true,
        rights_statement: rightsStatement.trim(),
        conversion_status: conversionStatus,
        edubook_manifest: manifest,
        access_model: accessModel,
        price_cents: ["purchase", "rental"].includes(accessModel) ? priceCents : null,
        rental_days: accessModel === "rental" ? Number(rentalDays) || 30 : null,
        status: "draft",
      });
      if (publicationError) throw publicationError;
      setNotice(conversionStatus === "ready" ? "Interactive book created and opened in the reader library." : "Source file secured. The server-side conversion job is queued in the publication record.");
      setSourceFile(null);
      const input = document.getElementById("book-source-input");
      if (input) input.value = "";
      onSaved?.();
    } catch (saveError) {
      setError(saveError.message || "The publication could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="studio-book-importer" onSubmit={importBook}>
      <div className="studio-import-grid">
        <div className="studio-form">
          <div className="studio-field-grid">
            <label>Book or reading title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Author / creator<input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Author, professor, or publisher" /></label>
          </div>
          <label>Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>
            Original or licensed text
            <textarea rows={12} value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste text or Markdown for immediate conversion. Clear this field when the uploaded file should be the sole source." />
          </label>
          <label className="studio-file-drop" htmlFor="book-source-input">
            <span aria-hidden="true">📖</span>
            <strong>{sourceFile ? sourceFile.name : "Or upload a publication source"}</strong>
            <small>Text and Markdown convert now. PDF, Word, EPUB, and publisher packages enter the secure conversion queue.</small>
            <input id="book-source-input" type="file" accept={SOURCE_ACCEPT} onChange={(event) => setSourceFile(event.target.files?.[0] || null)} />
          </label>
        </div>

        <aside className="studio-conversion-preview">
          <span className="studio-kicker">EDUBOOK / 1.0 PREVIEW</span>
          <h3>{instantManifest.title}</h3>
          <p>{instantManifest.author} · {instantManifest.source.words} words</p>
          <div className="studio-chapter-preview-list">
            {instantManifest.chapters.slice(0, 6).map((chapter, index) => (
              <div key={chapter.id}><span>{index + 1}</span><div><strong>{chapter.title}</strong><small>{chapter.blocks.length} reading blocks</small></div></div>
            ))}
          </div>
          <p className="studio-conversion-note">The manifest is the portable teaching layer: chapters, reading progress, annotations, knowledge checks, discussion prompts, rights, and access rules.</p>
        </aside>
      </div>

      <section className="studio-rights-panel">
        <div><span className="studio-kicker">RIGHTS & ACCESS</span><h3>Uploading a book is also a publishing decision.</h3></div>
        <div className="studio-field-grid">
          <label>Access model<select value={accessModel} onChange={(event) => setAccessModel(event.target.value)}><option value="private">Private draft</option><option value="assigned">Assigned to a course</option><option value="open">Open access</option><option value="purchase">Purchase</option><option value="rental">Rental</option></select></label>
          {["purchase", "rental"].includes(accessModel) && <label>Price (USD)<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>}
          {accessModel === "rental" && <label>Rental days<input type="number" min="1" max="365" value={rentalDays} onChange={(event) => setRentalDays(event.target.value)} /></label>}
        </div>
        <label>Rights statement<textarea rows={3} value={rightsStatement} onChange={(event) => setRightsStatement(event.target.value)} /></label>
        <label className="studio-check-label"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /><span>I confirm I own this material or have the rights needed for the selected use.</span></label>
      </section>

      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}
      <button className="studio-primary-button" type="submit" disabled={busy || !rightsConfirmed}>{busy ? "Securing source and creating record…" : "Create publication record"}</button>
    </form>
  );
}

export function PublisherApplication() {
  const [organizationName, setOrganizationName] = useState("");
  const [applicantType, setApplicantType] = useState("publisher");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [catalogSummary, setCatalogSummary] = useState("");
  const [rightsAttestation, setRightsAttestation] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (!rightsAttestation) throw new Error("The rights attestation is required for partner review.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const { error: applicationError } = await supabase.from("publisher_applications").insert({
        applicant_id: userData.user.id,
        organization_name: organizationName.trim(),
        applicant_type: applicantType,
        website_url: websiteUrl.trim() || null,
        catalog_summary: catalogSummary.trim(),
        rights_attestation: true,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      if (applicationError) throw applicationError;
      setNotice("Partner application submitted for rights, catalog, payment, and quality review.");
    } catch (submitError) {
      setError(submitError.message || "The partner application could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="studio-publisher-application" onSubmit={submit}>
      <div className="studio-section-heading">
        <div><span className="studio-kicker">PUBLISHER & SUPPLIER PARTNERS</span><h2>Apply before listing books or learning supplies.</h2><p>Professors can author their own material. Commercial catalogs add a partner review for identity, rights, pricing, accessibility, and support.</p></div>
      </div>
      <div className="studio-field-grid">
        <label>Organization or imprint<input required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label>
        <label>Applicant type<select value={applicantType} onChange={(event) => setApplicantType(event.target.value)}><option value="publisher">Publisher</option><option value="author">Independent author</option><option value="professor">Professor-author</option><option value="institution">Institution</option><option value="supplier">Learning supplier</option></select></label>
      </div>
      <label>Website or catalog URL<input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://…" /></label>
      <label>Catalog and intended learner use<textarea required rows={6} value={catalogSummary} onChange={(event) => setCatalogSummary(event.target.value)} placeholder="Describe the titles or supplies, audience, rights territory, accessibility status, and how professors would assign them." /></label>
      <label className="studio-check-label"><input type="checkbox" checked={rightsAttestation} onChange={(event) => setRightsAttestation(event.target.checked)} /><span>I attest that the applicant owns or is authorized to distribute the proposed catalog.</span></label>
      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}
      <button className="studio-primary-button" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit partner application"}</button>
    </form>
  );
}
