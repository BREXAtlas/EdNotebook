import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { textToEduBook } from "./edubook.js";
import {
  listProfessorPublicationCourses,
  loadMarketplaceDashboard,
  startSellerOnboarding,
  submitCommercialListing,
  submitRightsReview,
  submitSellerApplication,
} from "./publishingService.js";
import {
  buildDigitalLiteracyName,
  checksumFile,
  currentCourseId,
  readCourseDraft,
  uploadCloudFile,
  validateFile,
} from "./storageService.js";
import {
  formatMarketplaceDate,
  formatMarketplaceMoney,
  marketplaceReceiptLabel,
  marketplaceStatusLabel,
  marketplaceStatusTone,
} from "../marketplace/marketplacePresentation.js";

function SellerCommerceLedger({ dashboard }) {
  const sales = dashboard.sales || [];
  const payouts = dashboard.payouts || [];
  const summary = dashboard.seller_summary || {};
  return <section className="marketplace-step-card marketplace-seller-ledger">
    <div><span>OPERATIONS</span><h3>Sales, access, refunds, and payouts</h3><p>Each row follows the same governed order the student sees. Buyer identity and payment credentials remain private.</p></div>
    <dl className="seller-commerce-summary">
      <div><dt>Orders</dt><dd>{summary.order_count || 0}</dd></div>
      <div><dt>Gross processed</dt><dd>{formatMarketplaceMoney(summary.gross_processed_cents || 0)}</dd></div>
      <div><dt>Platform fees</dt><dd>{formatMarketplaceMoney(summary.platform_fees_cents || 0)}</dd></div>
      <div><dt>Seller allocation</dt><dd>{formatMarketplaceMoney(summary.seller_allocation_cents || 0)}</dd></div>
      <div><dt>Refunded</dt><dd>{formatMarketplaceMoney(summary.refunded_cents || 0)}</dd></div>
      <div><dt>Paid payouts</dt><dd>{formatMarketplaceMoney(summary.paid_payout_cents || 0)}</dd></div>
    </dl>
    {sales.length ? <div className="seller-order-ledger">{sales.map((order) => <article key={order.id}>
      <header><div><span>{order.item_kind} · {order.access_model}</span><strong>{order.title_snapshot}</strong><small>{marketplaceReceiptLabel(order.id)} · {formatMarketplaceDate(order.created_at)}</small></div><span className={marketplaceStatusTone(order.status)}>{marketplaceStatusLabel(order.status)}</span></header>
      <dl><div><dt>Customer total</dt><dd>{formatMarketplaceMoney(order.total_cents, order.currency)}</dd></div><div><dt>Tax</dt><dd>{formatMarketplaceMoney(order.tax_cents, order.currency)}</dd></div><div><dt>Platform fee</dt><dd>{formatMarketplaceMoney(order.platform_fee_cents, order.currency)}</dd></div><div><dt>Seller allocation</dt><dd>{formatMarketplaceMoney(order.seller_net_cents, order.currency)}</dd></div></dl>
      <footer><span>Access: {marketplaceStatusLabel(order.entitlement_status || "pending")}{order.entitlement_expires_at ? ` through ${formatMarketplaceDate(order.entitlement_expires_at)}` : ""}</span>{order.refund_status ? <span>Refund: {marketplaceStatusLabel(order.refund_status)}</span> : null}{order.dispute_status ? <span>Dispute: {marketplaceStatusLabel(order.dispute_status)}</span> : null}<a href={order.course_id ? `#/publishers?course=${order.course_id}` : "#/publishers"}>View Library</a></footer>
    </article>)}</div> : <div className="studio-commerce-empty">No completed bookstore activity yet. Published listings will reconcile here after a verified checkout event.</div>}
    {payouts.length ? <div className="seller-payout-ledger"><h4>Connected-account payouts</h4>{payouts.slice(0, 10).map((payout) => <article key={payout.id}><strong>{formatMarketplaceMoney(payout.amount_cents, payout.currency)}</strong><span>{marketplaceStatusLabel(payout.status)}</span><small>{payout.arrival_at ? `Arrival ${formatMarketplaceDate(payout.arrival_at)}` : formatMarketplaceDate(payout.created_at)}</small></article>)}</div> : null}
  </section>;
}

const SOURCE_ACCEPT = ".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.epub,.zip";

function inferSourceFormat(file) {
  const name = file?.name?.toLowerCase() || "";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (name.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (name.endsWith(".epub")) return "application/epub+zip";
  if (name.endsWith(".zip")) return "application/zip";
  return file?.type || "application/octet-stream";
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
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
  const [readingMode, setReadingMode] = useState("interactive");
  const [price, setPrice] = useState("");
  const [rentalDays, setRentalDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadController, setUploadController] = useState(null);

  const instantManifest = useMemo(
    () => textToEduBook({ title, author, sourceText, description, readingMode }),
    [title, author, sourceText, description, readingMode]
  );

  async function importBook(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    setUploadProgress(null);
    setUploadStatus("");
    let publicationId = null;
    try {
      if (!rightsConfirmed) throw new Error("Confirm your ownership or distribution rights before uploading publication material.");
      if (!sourceFile && !sourceText.trim()) throw new Error("Paste original or licensed text, or select a publication source file.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      publicationId = crypto.randomUUID();
      const sourceFormat = sourceFile ? inferSourceFormat(sourceFile) : "text/plain";
      const conversionStatus = sourceFile ? "queued" : "ready";
      const manifest = sourceFile
        ? {
            format: "EduBook/1.0",
            title,
            author,
            description,
            source: {
              type: sourceFormat,
              originalName: sourceFile.name,
              importedAt: new Date().toISOString(),
            },
            chapters: [],
            conversion: {
              status: "queued",
              pipeline: ["malware-scan", "archive-inspection", "extract", "structure", "preview", "quality-review"],
            },
            learningDesign: {
              mode: readingMode === "read_only" ? "read-only" : "interactive-reading",
              annotations: true,
              bookmarks: true,
              progress: true,
              checks: readingMode !== "read_only",
              quizzes: readingMode !== "read_only",
              discussion: readingMode !== "read_only",
            },
            rights: { confirmed: true, statement: rightsStatement.trim() },
          }
        : {
            ...instantManifest,
            rights: { confirmed: true, statement: rightsStatement.trim() },
          };
      const priceCents = price === "" ? null : Math.max(0, Math.round(Number(price) * 100));

      const { error: publicationError } = await supabase.from("publications").insert({
        id: publicationId,
        owner_id: userData.user.id,
        course_id: currentCourseId(),
        title: title.trim() || sourceFile?.name || "Untitled publication",
        author_name: author.trim(),
        description: description.trim(),
        source_format: sourceFormat,
        bucket_id: null,
        storage_path: null,
        secure_file_id: null,
        rights_confirmed: true,
        rights_statement: rightsStatement.trim(),
        conversion_status: conversionStatus,
        preview_status: sourceFile ? "pending" : "not_requested",
        edubook_manifest: manifest,
        access_model: accessModel,
        reading_mode: readingMode,
        price_cents: ["purchase", "rental"].includes(accessModel) ? priceCents : null,
        rental_days: accessModel === "rental" ? Number(rentalDays) || 30 : null,
        status: "draft",
      });
      if (publicationError) throw publicationError;

      if (sourceFile) {
        validateFile(sourceFile);
        const safeName = buildDigitalLiteracyName({
          file: sourceFile,
          courseCode: course.code || "publisher",
          category: "book-source",
          title: title || sourceFile.name,
          version: 1,
        });
        const checksumSha256 = await checksumFile(sourceFile);
        const target = await uploadCloudFile(sourceFile, {
          scope: "publication",
          publicationId,
          safeName,
          checksumSha256,
          title,
          category: "book-source",
          courseCode: course.code || "publisher",
          metadata: {
            author,
            description,
            rightsConfirmed: true,
            accessModel,
          },
          onProgress: setUploadProgress,
          onStatus: setUploadStatus,
          onController: setUploadController,
        });
        const { error: updateError } = await supabase.from("publications").update({
          secure_file_id: target.secureFileId,
          conversion_status: "queued",
          preview_status: "pending",
          edubook_manifest: {
            ...manifest,
            source: {
              ...manifest.source,
              safeName,
              checksumSha256,
              secureFileId: target.secureFileId,
            },
          },
        }).eq("id", publicationId);
        if (updateError) throw updateError;
        setNotice("Publication source uploaded to quarantine. Malware, archive, preview, and EduBook conversion must complete before release.");
      } else {
        setNotice("Interactive text book created immediately. The original text and teaching layer remain separately identifiable in EduBook/1.0.");
      }

      setSourceFile(null);
      setUploadController(null);
      const input = document.getElementById("book-source-input");
      if (input) input.value = "";
      onSaved?.();
    } catch (saveError) {
      if (publicationId) {
        await supabase.from("publications").update({
          conversion_status: "failed",
          preview_status: "error",
        }).eq("id", publicationId).catch(() => {});
      }
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
            <textarea rows={12} value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste text or Markdown for immediate conversion. A selected source file takes precedence and enters the secure worker pipeline." />
          </label>
          <label className="studio-file-drop" htmlFor="book-source-input">
            <span aria-hidden="true">📖</span>
            <strong>{sourceFile ? sourceFile.name : "Or upload a publication source"}</strong>
            <small>PDF, Word, PowerPoint, EPUB, text, Markdown, and publisher ZIP packages upload resumably to quarantine.</small>
            <input id="book-source-input" type="file" accept={SOURCE_ACCEPT} onChange={(event) => setSourceFile(event.target.files?.[0] || null)} />
          </label>

          {uploadProgress && (
            <div className="studio-upload-progress">
              <div><strong>{uploadStatus || "uploading"}</strong><span>{uploadProgress.percentage.toFixed(1)}%</span></div>
              <div><span style={{ width: `${uploadProgress.percentage}%` }} /></div>
              <small>{formatBytes(uploadProgress.bytesUploaded)} of {formatBytes(uploadProgress.bytesTotal)}</small>
              {busy && uploadController && <div><button type="button" onClick={() => uploadController.pause()}>Pause</button><button type="button" onClick={() => uploadController.resume()}>Resume</button></div>}
            </div>
          )}
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
          <p className="studio-conversion-note">For uploaded files, the same format is generated server-side only after malware and archive checks. Source text is preserved; teaching prompts remain a separate layer.</p>
        </aside>
      </div>

      <section className="studio-rights-panel">
        <div><span className="studio-kicker">RIGHTS & ACCESS</span><h3>Uploading a book is also a publishing decision.</h3></div>
        <div className="studio-field-grid">
          <label>Access model<select value={accessModel} onChange={(event) => setAccessModel(event.target.value)}><option value="private">Private draft</option><option value="assigned">Assigned to a course</option><option value="open">Open access</option><option value="purchase">Purchase</option><option value="rental">Rental</option></select></label>
          <label>Book experience<select value={readingMode} onChange={(event) => setReadingMode(event.target.value)}><option value="read_only">Read-only book</option><option value="interactive">Interactive EduBook · checks, quizzes, notes, progress</option></select></label>
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
  const [applicantType, setApplicantType] = useState("professor");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [catalogSummary, setCatalogSummary] = useState("");
  const [rightsAttestation, setRightsAttestation] = useState(false);
  const [dashboard, setDashboard] = useState({});
  const [items, setItems] = useState([]);
  const [rightsItem, setRightsItem] = useState("");
  const [rightsOwnerName, setRightsOwnerName] = useState("");
  const [rightsBasis, setRightsBasis] = useState("original_owner");
  const [rightsStatement, setRightsStatement] = useState("");
  const [rightsEvidenceUrl, setRightsEvidenceUrl] = useState("");
  const [purchaseAllowed, setPurchaseAllowed] = useState(true);
  const [rentalAllowed, setRentalAllowed] = useState(false);
  const [listingRightsId, setListingRightsId] = useState("");
  const [listingAccess, setListingAccess] = useState("purchase");
  const [listingPrice, setListingPrice] = useState("");
  const [listingRentalDays, setListingRentalDays] = useState(30);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshMarketplace() {
    const [marketplace, courses, publications] = await Promise.all([
      loadMarketplaceDashboard(),
      listProfessorPublicationCourses(),
      supabase.from("publications").select("id,title,status,access_model").order("updated_at", { ascending: false }),
    ]);
    if (marketplace.error || courses.error || publications.error) {
      setError(marketplace.error?.message || courses.error?.message || publications.error?.message || "Commercial publishing could not be loaded.");
      return;
    }
    setDashboard(marketplace.data || {});
    const nextItems = [
      ...(courses.data || []).map((course) => ({ kind: "course", id: course.id, title: course.title })),
      ...(publications.data || []).map((book) => ({ kind: "book", id: book.id, title: book.title })),
    ];
    setItems(nextItems);
    setRightsItem((current) => current || (nextItems[0] ? `${nextItems[0].kind}:${nextItems[0].id}` : ""));
    const application = marketplace.data?.seller_application;
    if (application) {
      setOrganizationName((current) => current || application.organization_name || "");
      setApplicantType(application.applicant_type || "professor");
      setWebsiteUrl((current) => current || application.website_url || "");
      setCatalogSummary((current) => current || application.catalog_summary || "");
      setRightsAttestation(Boolean(application.rights_attestation));
    }
    const reviews = marketplace.data?.rights_reviews || [];
    setListingRightsId((current) => current || reviews.find((review) => review.status === "approved")?.id || "");
  }

  useEffect(() => {
    refreshMarketplace();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (!rightsAttestation) throw new Error("The rights attestation is required for partner review.");
      const { error: applicationError } = await submitSellerApplication({
        organizationName: organizationName.trim(),
        applicantType,
        websiteUrl: websiteUrl.trim(),
        catalogSummary: catalogSummary.trim(),
        rightsAttestation,
      });
      if (applicationError) throw applicationError;
      setNotice("Seller application submitted. Complete Stripe verification next; EdNotebook approval remains separate.");
      await refreshMarketplace();
    } catch (submitError) {
      setError(submitError.message || "The partner application could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function openStripeOnboarding() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: onboardingError } = await startSellerOnboarding({
        refresh: dashboard.seller_application?.verification_status !== "not_started",
      });
      if (onboardingError) throw onboardingError;
      if (data?.onboardingUrl) {
        window.location.assign(data.onboardingUrl);
        return;
      }
      setNotice("Stripe seller identity, charging, and payout readiness are verified. EdNotebook review is still required.");
      await refreshMarketplace();
    } catch (onboardingError) {
      setError(onboardingError.message || "Stripe seller verification could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRights(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const [itemKind, itemId] = rightsItem.split(":");
      if (!itemKind || !itemId) throw new Error("Choose a course or book for rights review.");
      const result = await submitRightsReview({
        itemKind,
        itemId,
        rightsOwnerName: rightsOwnerName.trim(),
        rightsBasis,
        rightsStatement: rightsStatement.trim(),
        evidenceUrl: rightsEvidenceUrl.trim(),
        purchaseAllowed,
        rentalAllowed,
      });
      if (result.error) throw result.error;
      setNotice("Rights evidence submitted. A platform owner must approve its scope before the listing can go live.");
      await refreshMarketplace();
    } catch (rightsError) {
      setError(rightsError.message || "Rights evidence could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function submitListing(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const review = (dashboard.rights_reviews || []).find((item) => item.id === listingRightsId);
      if (!review) throw new Error("Choose an approved rights review.");
      const result = await submitCommercialListing({
        itemKind: review.course_id ? "course" : "book",
        itemId: review.course_id || review.publication_id,
        rightsReviewId: review.id,
        accessModel: listingAccess,
        priceCents: Math.round(Number(listingPrice) * 100),
        rentalDays: listingAccess === "rental" ? Number(listingRentalDays) : null,
      });
      if (result.error) throw result.error;
      setNotice("Commercial listing submitted. Checkout stays off until seller, rights, tax, and listing review all pass.");
      await refreshMarketplace();
    } catch (listingError) {
      setError(listingError.message || "The commercial listing could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  const application = dashboard.seller_application;
  const approvedRights = (dashboard.rights_reviews || []).filter((review) => review.status === "approved");

  return (
    <div className="studio-publisher-application commercial-publishing-workflow">
      <div className="studio-section-heading">
        <div><span className="studio-kicker">COMMERCIAL PUBLISHING CONTROLLED UNIT</span><h2>Verify the seller, prove the rights, then submit the listing.</h2><p>Stripe Connect handles identity, charging, tax calculation, transfers, refunds, disputes, and payouts. EdNotebook separately approves seller and publication evidence before checkout can appear.</p></div>
      </div>

      <ol className="marketplace-gate-summary">
        <li className={application ? "is-complete" : ""}><strong>Seller application</strong><span>{application?.status || "not started"}</span></li>
        <li className={application?.verification_status === "verified" ? "is-complete" : ""}><strong>Stripe verification</strong><span>{application?.verification_status || "not started"}</span></li>
        <li className={approvedRights.length ? "is-complete" : ""}><strong>Rights approval</strong><span>{approvedRights.length} approved</span></li>
        <li className={(dashboard.listings || []).some((listing) => listing.status === "published") ? "is-complete" : ""}><strong>Bookstore release</strong><span>{(dashboard.listings || []).filter((listing) => listing.status === "published").length} live</span></li>
      </ol>

      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}

      <form className="marketplace-step-card" onSubmit={submit}>
        <div><span>STEP 1</span><h3>Professor / seller application</h3><p>This record is reviewed in the TOS Control Center. It does not become approved merely because Stripe accepts identity details.</p></div>
        <div className="studio-field-grid">
          <label>Seller, organization, or imprint<input required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label>
          <label>Applicant type<select value={applicantType} onChange={(event) => setApplicantType(event.target.value)}><option value="professor">Professor-author</option><option value="author">Independent author</option><option value="publisher">Publisher</option><option value="institution">Institution</option><option value="supplier">Learning supplier</option></select></label>
        </div>
        <label>Website or catalog URL<input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://…" /></label>
        <label>Catalog and intended learner use<textarea required minLength={20} rows={4} value={catalogSummary} onChange={(event) => setCatalogSummary(event.target.value)} placeholder="Describe the titles, audience, rights territory, accessibility, and intended course use." /></label>
        <label className="studio-check-label"><input type="checkbox" checked={rightsAttestation} onChange={(event) => setRightsAttestation(event.target.checked)} /><span>I attest that the applicant owns or is authorized to distribute the proposed catalog.</span></label>
        <button className="studio-primary-button" type="submit" disabled={busy || !rightsAttestation}>{busy ? "Saving…" : application ? "Update seller application" : "Submit seller application"}</button>
      </form>

      <section className="marketplace-step-card">
        <div><span>STEP 2</span><h3>Stripe Connect verification and payouts</h3><p>Stripe collects sensitive identity and bank information on its hosted form. EdNotebook stores readiness flags and the connected-account ID—not bank or identity documents.</p></div>
        <dl className="marketplace-readiness-grid">
          <div><dt>Identity details</dt><dd>{application?.details_submitted ? "submitted" : "not complete"}</dd></div>
          <div><dt>Charges</dt><dd>{application?.charges_enabled ? "enabled" : "blocked"}</dd></div>
          <div><dt>Payouts</dt><dd>{application?.payouts_enabled ? "enabled" : "blocked"}</dd></div>
          <div><dt>EdNotebook review</dt><dd>{application?.status || "not started"}</dd></div>
        </dl>
        {application?.requirements_due?.length ? <p className="studio-commerce-review-note">Stripe still requires: {application.requirements_due.join(", ")}</p> : null}
        <button className="studio-primary-button" type="button" disabled={busy || !application} onClick={openStripeOnboarding}>{application?.verification_status === "verified" ? "Refresh Stripe readiness" : "Continue secure Stripe verification"}</button>
      </section>

      <form className="marketplace-step-card" onSubmit={submitRights}>
        <div><span>STEP 3</span><h3>Rights scope and evidence</h3><p>Book and course rights are reviewed separately. Choose whether the evidence permits permanent purchase, time-limited rental, or both.</p></div>
        <div className="studio-field-grid">
          <label>Course or book<select required value={rightsItem} onChange={(event) => setRightsItem(event.target.value)}><option value="">Choose an item</option>{items.map((item) => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.kind === "course" ? "Course" : "Book"} · {item.title}</option>)}</select></label>
          <label>Rights owner<input required value={rightsOwnerName} onChange={(event) => setRightsOwnerName(event.target.value)} /></label>
          <label>Rights basis<select value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value)}><option value="original_owner">Original owner</option><option value="exclusive_license">Exclusive license</option><option value="nonexclusive_license">Nonexclusive license</option><option value="open_license">Open license</option><option value="public_domain">Public domain</option></select></label>
          <label>Evidence URL<input type="url" value={rightsEvidenceUrl} onChange={(event) => setRightsEvidenceUrl(event.target.value)} placeholder="Optional contract or rights record URL" /></label>
        </div>
        <label>Rights explanation<textarea required minLength={20} rows={4} value={rightsStatement} onChange={(event) => setRightsStatement(event.target.value)} placeholder="Identify ownership, license scope, territory, and any restrictions." /></label>
        <div className="marketplace-rights-options"><label className="studio-check-label"><input type="checkbox" checked={purchaseAllowed} onChange={(event) => setPurchaseAllowed(event.target.checked)} /><span>Permanent purchase is allowed</span></label><label className="studio-check-label"><input type="checkbox" checked={rentalAllowed} onChange={(event) => setRentalAllowed(event.target.checked)} /><span>Time-limited rental is allowed</span></label></div>
        <button className="studio-primary-button" type="submit" disabled={busy || !application || (!purchaseAllowed && !rentalAllowed)}>Submit rights evidence</button>
        {(dashboard.rights_reviews || []).length ? <div className="marketplace-status-list">{dashboard.rights_reviews.map((review) => <article key={review.id}><strong>{review.course_id ? "Course rights" : "Book rights"}</strong><span>{review.rights_basis.replaceAll("_", " ")}</span><em>{review.status}</em></article>)}</div> : null}
      </form>

      <form className="marketplace-step-card" onSubmit={submitListing}>
        <div><span>STEP 4</span><h3>Price and submit the governed listing</h3><p>Only approved rights appear here. Platform tax responsibility and final listing release are approved in the TOS Control Center.</p></div>
        <div className="studio-field-grid">
          <label>Approved rights<select required value={listingRightsId} onChange={(event) => setListingRightsId(event.target.value)}><option value="">No approved rights yet</option>{approvedRights.map((review) => <option key={review.id} value={review.id}>{review.course_id ? "Course" : "Book"} · {review.rights_owner_name}</option>)}</select></label>
          <label>Access<select value={listingAccess} onChange={(event) => setListingAccess(event.target.value)}><option value="purchase">Permanent purchase</option><option value="rental">Rental</option></select></label>
          <label>Price (USD)<input required type="number" min="0.50" step="0.01" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} /></label>
          {listingAccess === "rental" && <label>Rental days<input required type="number" min="1" max="365" value={listingRentalDays} onChange={(event) => setListingRentalDays(event.target.value)} /></label>}
        </div>
        <button className="studio-primary-button" type="submit" disabled={busy || !listingRightsId || Number(listingPrice) < 0.5}>Submit commercial listing</button>
        {(dashboard.listings || []).length ? <div className="marketplace-status-list">{dashboard.listings.map((listing) => <article key={listing.id}><strong>{listing.title_snapshot}</strong><span>{listing.access_model} · ${(listing.price_cents / 100).toFixed(2)}</span><em>{listing.status}</em></article>)}</div> : null}
      </form>

      <SellerCommerceLedger dashboard={dashboard} />
    </div>
  );
}
