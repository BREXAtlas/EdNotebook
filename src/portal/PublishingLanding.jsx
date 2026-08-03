import { useCallback, useEffect, useMemo, useState } from "react";
import PortalNav from "./PortalNav.jsx";
import { listAlexMorrisonCatalog } from "./portalService.js";
import { supabase } from "../supabaseClient.js";
import {
  beginMarketplaceCheckout,
  loadMarketplaceDashboard,
  loadMarketplaceReceipt,
  requestMarketplaceRefund,
} from "../marketplace/marketplaceService.js";
import { downloadMarketplaceReceiptPdf } from "../marketplace/marketplaceReceiptDocument.js";
import {
  formatMarketplaceDate,
  formatMarketplaceMoney,
  hasActiveMarketplaceAccess,
  marketplaceAccessHref,
  marketplaceAccessSummary,
  marketplaceReceiptLabel,
  marketplaceStatusLabel,
  marketplaceStatusTone,
} from "../marketplace/marketplacePresentation.js";

function money(cents) {
  return Number.isFinite(cents) ? formatMarketplaceMoney(cents) : "";
}

function accessLabel(item) {
  if (item.access_model === "open_free" || item.access_model === "open") return "Free";
  if (item.access_model === "purchase") return `Purchase ${money(item.price_cents)}`.trim();
  if (item.access_model === "rental") return `Rental ${money(item.price_cents)}`.trim();
  return "Course access";
}

function CatalogPreview({ item, ownedOrder, onClose, onOpenCourse, onCheckout, checkoutBusy }) {
  if (!item) return null;
  const freeCourse = item.item_kind === "course" && item.access_model === "open_free";
  const openBook = item.item_kind === "book" && item.access_model === "open";
  const commercial = item.access_model === "purchase" || item.access_model === "rental";
  const ownedHref = marketplaceAccessHref(ownedOrder);
  return <div className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="library-preview-title">
    <div className="portal-modal-card library-preview-card">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close Library preview">×</button>
      <span className="portal-kicker">ALEX B. MORRISON {item.item_kind === "course" ? "COURSE" : "BOOK"}</span>
      <h2 id="library-preview-title">{item.title}</h2>
      <p>{item.description || "A professor-published EdNotebook learning resource."}</p>
      <dl>
        <div><dt>Creator</dt><dd>{item.creator_name}</dd></div>
        <div><dt>Access</dt><dd>{accessLabel(item)}</dd></div>
        <div><dt>Experience</dt><dd>{item.item_kind === "course" || item.reading_mode === "interactive" ? "Interactive learning" : "Read-only book"}</dd></div>
        {item.access_model === "rental" && <div><dt>Rental</dt><dd>{item.rental_days} days</dd></div>}
      </dl>
      {freeCourse && <button className="portal-modal-primary" type="button" onClick={() => onOpenCourse?.(item)}>
        {item.enrollment_policy === "open_self_enroll" ? "Start this free course" : "Request this free course"}
      </button>}
      {openBook && <a className="portal-modal-primary library-modal-link" href={`#/library/book/${item.item_id}`}>Open this free book</a>}
      {commercial && ownedOrder ? <div className="library-commerce-ready is-owned"><strong>{ownedOrder.access_model === "rental" ? "Rented and ready" : "Owned and ready"}</strong>{ownedHref ? <a className="portal-modal-primary library-modal-link" href={ownedHref}>{ownedOrder.item_kind === "book" ? "Open book" : "Continue course"}</a> : null}<span>{marketplaceAccessSummary(ownedOrder)}</span></div> : null}
      {commercial && !ownedOrder && item.checkout_available ? <div className="library-commerce-ready"><button className="portal-modal-primary" type="button" disabled={checkoutBusy} onClick={() => onCheckout?.(item)}>{checkoutBusy ? "Opening secure checkout…" : item.access_model === "rental" ? "Rent securely" : "Buy securely"}</button><span>Stripe calculates applicable tax. Access begins only after the verified payment webhook confirms the order.</span></div> : null}
      {commercial && !ownedOrder && !item.checkout_available ? <div className="library-commerce-gate"><strong>Catalog preview only</strong><span>Checkout is unavailable until seller identity, rights, tax, refund, dispute, and payout controls pass review.</span></div> : null}
      {item.universal_assignment && <div className="library-assignment-note"><strong>Also assigned to eligible new students</strong><span>Automatic assignment is a professor-controlled course setting; it is separate from this free Library listing.</span></div>}
    </div>
  </div>;
}

function MarketplaceReceipt({ receipt, busy, error, onClose }) {
  const [downloading, setDownloading] = useState(false);
  if (!receipt && !busy && !error) return null;

  async function download() {
    setDownloading(true);
    try {
      await downloadMarketplaceReceiptPdf(receipt);
    } finally {
      setDownloading(false);
    }
  }

  return <div className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="marketplace-receipt-title">
    <div className="portal-modal-card marketplace-receipt-card">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close transaction receipt">×</button>
      <span className="portal-kicker">ALEX B. MORRISON BOOKSTORE RECORD</span>
      <h2 id="marketplace-receipt-title">Transaction receipt</h2>
      {busy ? <div className="directory-empty">Loading the governed receipt…</div> : null}
      {error ? <div className="portal-form-notice" role="alert">{error}</div> : null}
      {receipt ? <>
        <div className="marketplace-receipt-heading"><div><strong>{receipt.receipt_number}</strong><span>Issued {formatMarketplaceDate(receipt.issued_at)}</span></div><span className={marketplaceStatusTone(receipt.order_status)}>{marketplaceStatusLabel(receipt.order_status)}</span></div>
        <dl className="marketplace-receipt-details">
          <div><dt>Item</dt><dd>{receipt.title_snapshot}</dd></div>
          <div><dt>Seller</dt><dd>{receipt.seller_name}</dd></div>
          <div><dt>Access</dt><dd>{receipt.access_model === "rental" ? `${receipt.rental_days} day rental` : "Permanent purchase"}</dd></div>
          <div><dt>Subtotal</dt><dd>{formatMarketplaceMoney(receipt.subtotal_cents, receipt.currency)}</dd></div>
          <div><dt>Tax</dt><dd>{formatMarketplaceMoney(receipt.tax_cents, receipt.currency)}</dd></div>
          <div><dt>Total</dt><dd>{formatMarketplaceMoney(receipt.total_cents, receipt.currency)}</dd></div>
          {Number(receipt.refunded_cents) > 0 ? <div><dt>Refunded</dt><dd>{formatMarketplaceMoney(receipt.refunded_cents, receipt.currency)}</dd></div> : null}
        </dl>
        <p>Stripe processed the payment. This EdNotebook receipt confirms the marketplace transaction and learning access; it is not a tax invoice.</p>
        <div className="marketplace-receipt-actions"><button type="button" onClick={download} disabled={downloading}>{downloading ? "Preparing PDF…" : "Download PDF receipt"}</button><button type="button" onClick={onClose}>Close</button></div>
      </> : null}
    </div>
  </div>;
}

function PurchaseLibrary({ dashboard, onRefresh }) {
  const [refundOrderId, setRefundOrderId] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const purchases = dashboard?.purchases || [];
  if (!purchases.length) return null;

  async function requestRefund(event) {
    event.preventDefault();
    const order = purchases.find((item) => item.id === refundOrderId);
    if (!order) return;
    setBusy(true);
    setNotice("");
    const result = await requestMarketplaceRefund({
      orderId: order.id,
      amountCents: order.total_cents - order.refunded_cents,
      reason: refundReason.trim(),
    });
    if (result.error) setNotice(result.error.message || "The refund request could not be submitted.");
    else {
      setNotice("Refund request submitted for platform review. Access changes only after Stripe confirms a full refund.");
      setRefundOrderId("");
      setRefundReason("");
      await onRefresh?.();
    }
    setBusy(false);
  }

  async function openReceipt(orderId) {
    setReceipt(null);
    setReceiptError("");
    setReceiptBusy(true);
    const result = await loadMarketplaceReceipt(orderId);
    if (result.error) setReceiptError(result.error.message || "The receipt could not be loaded.");
    else setReceipt(result.data || null);
    setReceiptBusy(false);
  }

  return <section className="library-purchase-section" aria-labelledby="library-purchases-title">
    <div className="student-section-heading"><span className="portal-kicker">YOUR BOOKSTORE RECORDS</span><h2 id="library-purchases-title">Purchases &amp; rentals</h2><p>Open owned work, check rental time, and follow the same receipt through refunds or disputes.</p><button type="button" className="library-record-refresh" disabled={busy} onClick={() => onRefresh?.()}>{busy ? "Refreshing…" : "Refresh records"}</button></div>
    <div className="library-purchase-grid">{purchases.map((order) => {
      const accessHref = marketplaceAccessHref(order);
      const canRequestRefund = ["fulfilled", "paid", "partially_refunded"].includes(order.status)
        && order.total_cents > order.refunded_cents
        && !["requested", "reviewing", "approved", "processing"].includes(order.refund_status);
      return <article key={order.id} className="library-purchase-card">
        <header><div><span>{order.item_kind} · {order.access_model}</span><h3>{order.title_snapshot || "Library purchase"}</h3><small>{marketplaceReceiptLabel(order.id)} · {formatMarketplaceDate(order.created_at)}</small></div><span className={marketplaceStatusTone(order.status)}>{marketplaceStatusLabel(order.status)}</span></header>
        <dl className="library-receipt-grid"><div><dt>Item</dt><dd>{formatMarketplaceMoney(order.subtotal_cents, order.currency)}</dd></div><div><dt>Tax</dt><dd>{formatMarketplaceMoney(order.tax_cents, order.currency)}</dd></div><div><dt>Total</dt><dd>{formatMarketplaceMoney(order.total_cents, order.currency)}</dd></div><div><dt>Refunded</dt><dd>{formatMarketplaceMoney(order.refunded_cents, order.currency)}</dd></div></dl>
        <p>{marketplaceAccessSummary(order)}</p>
        {order.refund_status ? <div className="library-order-event"><strong>Refund</strong><span>{marketplaceStatusLabel(order.refund_status)} · {formatMarketplaceMoney(order.refund_amount_cents, order.currency)}</span></div> : null}
        {order.dispute_status ? <div className="library-order-event"><strong>Dispute</strong><span>{marketplaceStatusLabel(order.dispute_status)}</span></div> : null}
        <footer>{accessHref ? <a href={accessHref}>{order.item_kind === "book" ? "Open book" : "Continue course"}</a> : <span>{hasActiveMarketplaceAccess(order) ? "Published learning experience is being prepared" : "No active access from this order"}</span>}<div><button type="button" onClick={() => openReceipt(order.id)}>View receipt</button>{canRequestRefund ? <button type="button" onClick={() => setRefundOrderId(order.id)}>Request refund</button> : null}</div></footer>
      </article>;
    })}</div>
    {refundOrderId && <form className="library-refund-form" onSubmit={requestRefund}><h3>Request a full refund</h3><p>The platform owner reviews the reason before Stripe reverses the seller transfer and platform fee. A full confirmed refund revokes this order’s access.</p><label>Reason<textarea required minLength={10} rows={3} value={refundReason} onChange={(event) => setRefundReason(event.target.value)} /></label><div><button type="button" onClick={() => setRefundOrderId("")}>Cancel</button><button type="submit" disabled={busy || refundReason.trim().length < 10}>{busy ? "Submitting…" : "Submit refund request"}</button></div></form>}
    {notice && <div className="portal-form-notice" role="status">{notice}</div>}
    <MarketplaceReceipt receipt={receipt} busy={receiptBusy} error={receiptError} onClose={() => { setReceipt(null); setReceiptError(""); setReceiptBusy(false); }} />
  </section>;
}

export default function PublishingLanding({ onEnter, onOpenCourse }) {
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [marketplace, setMarketplace] = useState(null);

  useEffect(() => {
    let active = true;
    listAlexMorrisonCatalog().then((result) => {
      if (!active) return;
      setCatalog(result.data || []);
      setNotice(result.error ? "The governed Library catalog is not connected in this environment yet." : "");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!catalog.length) return;
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const courseId = params.get("course");
    if (courseId) setSelected(catalog.find((item) => item.item_kind === "course" && item.course_id === courseId) || null);
  }, [catalog]);

  const refreshPurchases = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return null;
    const result = await loadMarketplaceDashboard();
    if (!result.error) setMarketplace(result.data);
    return result;
  }, []);

  useEffect(() => {
    refreshPurchases();
  }, [refreshPurchases]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const checkoutResult = params.get("checkout");
    if (checkoutResult === "canceled") {
      setNotice("Checkout was canceled. No Library access was granted.");
      return undefined;
    }
    if (checkoutResult !== "success") return undefined;
    setNotice("Payment returned successfully. Stripe is confirming your Library access now.");
    const timers = [1800, 4500].map((delay) => window.setTimeout(refreshPurchases, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [refreshPurchases]);

  async function checkout(item) {
    setCheckoutBusy(true);
    setNotice("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      window.sessionStorage.setItem("ednotebook-marketplace-listing", item.marketplace_listing_id);
      setNotice("Sign in through the student portal, then return to the Library to purchase or rent this item.");
      setCheckoutBusy(false);
      return;
    }
    const result = await beginMarketplaceCheckout(item.marketplace_listing_id);
    if (result.error || !result.data?.checkoutUrl) {
      setNotice(result.error?.message || result.data?.error || "Secure checkout could not be opened.");
      setCheckoutBusy(false);
      return;
    }
    window.location.assign(result.data.checkoutUrl);
  }

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return catalog.filter((item) => {
      const kindMatch = kind === "all"
        || item.item_kind === kind
        || (kind === "free" && ["open_free", "open"].includes(item.access_model))
        || (kind === "commercial" && ["purchase", "rental"].includes(item.access_model));
      const queryMatch = !clean || `${item.title} ${item.creator_name} ${item.description}`.toLowerCase().includes(clean);
      return kindMatch && queryMatch;
    });
  }, [catalog, kind, query]);
  const ownedByListing = useMemo(() => new Map(
    (marketplace?.purchases || [])
      .filter((order) => hasActiveMarketplaceAccess(order))
      .map((order) => [order.listing_id, order]),
  ), [marketplace]);
  const selectedOwnedOrder = selected?.marketplace_listing_id
    ? ownedByListing.get(selected.marketplace_listing_id)
    : null;

  return (
    <div className="portal-page publishing-landing-page">
      <PortalNav active="publishing" action={onEnter} actionLabel="Professor publishing studio" />
      <main>
        <section className="publishing-hero">
          <span className="portal-kicker">ALEX B. MORRISON LIBRARY &amp; BOOKSTORE</span>
          <h1>Find a free course, open a professor’s book, or preview what is coming to the bookstore.</h1>
          <p>One governed catalog connects approved courses, read-only books, interactive EduBooks, and assigned readings. Digital Literacy is the first free course example; professor assignment remains a separate choice.</p>
          <div><a href="#library-catalog">Browse the Library</a><button type="button" onClick={onEnter}>Professor publishing studio</button></div>
          <figure className="publishing-hero-image">
            <img src="/landing/landing-publishing-materials.png" alt="Course books and manuscript pages being reviewed for publication" width="1536" height="1024" fetchPriority="high" />
            <figcaption><strong>Courses and books, connected.</strong><span>Publish one approved source, then choose Library, class assignment, open access, or governed commercial review.</span></figcaption>
          </figure>
        </section>

        <section id="library-catalog" className="library-catalog-section" aria-labelledby="library-catalog-title">
          <div className="student-section-heading"><span className="portal-kicker">SEARCHABLE CATALOG</span><h2 id="library-catalog-title">Alex B. Morrison Library</h2><p>Free items open now. Approved bookstore items use governed Stripe Connect checkout and webhook-confirmed access.</p></div>
          <div className="library-catalog-controls">
            <label>Search Library<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, professor, author, or topic" /></label>
            <label>Show<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">All courses and books</option><option value="free">Free</option><option value="course">Courses</option><option value="book">Books</option><option value="commercial">Bookstore previews</option></select></label>
          </div>
          {notice && <div className="portal-form-notice" role="status">{notice}</div>}
          {loading ? <div className="directory-empty">Opening the Library catalog…</div> : visible.length === 0 ? <div className="directory-empty">No Library items match this search yet.</div> : <div className="library-catalog-grid">{visible.map((item) => <article key={`${item.item_kind}-${item.item_id}`}>
            <div className="library-item-heading"><span>{item.item_kind === "course" ? "COURSE" : item.reading_mode === "interactive" ? "INTERACTIVE EDUBOOK" : "READ-ONLY BOOK"}</span><i className={item.listing_status === "review" ? "is-review" : "is-ready"}>{item.listing_status === "review" ? "under review" : "available"}</i></div>
            <h3>{item.title}</h3>
            <strong>{item.creator_name}</strong>
            <p>{item.description || "Professor-published learning material in EdNotebook."}</p>
            <footer><span>{ownedByListing.has(item.marketplace_listing_id) ? item.access_model === "rental" ? "Rented" : "Owned" : accessLabel(item)}</span><button type="button" onClick={() => setSelected(item)}>{ownedByListing.has(item.marketplace_listing_id) ? "Open details" : "View details"}</button></footer>
          </article>)}</div>}
        </section>
        <PurchaseLibrary dashboard={marketplace} onRefresh={refreshPurchases} />

        <section id="publishing-path" className="publishing-path-grid">
          <article><span>01</span><h2>Bring one source</h2><p>Start with an approved course package, original book, licensed reading, or structured publisher file.</p></article>
          <article><span>02</span><h2>Choose the experience</h2><p>Keep a book read-only or build an interactive EduBook with progress, annotations, checks, quizzes, and discussion.</p></article>
          <article><span>03</span><h2>Choose placement</h2><p>Keep it private, assign the same book to a course, make it openly available, or prepare a commercial listing.</p></article>
          <article><span>04</span><h2>Govern release</h2><p>The professor releases free and assigned material. Commercial checkout waits for marketplace review and controls.</p></article>
        </section>
        <section className="publishing-audience-grid">
          <article><span className="portal-kicker">PROFESSOR AUTHORS</span><h2>Publish courses and books.</h2><p>List the approved course itself, publish a standalone book, or link the same book to a course without creating another source copy.</p></article>
          <article><span className="portal-kicker">STUDENTS</span><h2>Browse before enrolling.</h2><p>Search the Library, preview the learning experience, start free courses, and open free books from one familiar place.</p></article>
          <article><span className="portal-kicker">BOOKSTORE GOVERNANCE</span><h2>Prepare commerce honestly.</h2><p>Pricing and catalog previews can be reviewed now. Live charging and payouts remain off until the production marketplace gate passes.</p></article>
        </section>
      </main>
      <CatalogPreview item={selected} ownedOrder={selectedOwnedOrder} onClose={() => setSelected(null)} onOpenCourse={onOpenCourse} onCheckout={checkout} checkoutBusy={checkoutBusy} />
      <footer className="portal-simple-footer"><span>© {new Date().getFullYear()} EdNotebook</span><a href="#/">Portal home</a><a href="#/students">Student portal</a><a href="#/professors">Professor portal</a></footer>
    </div>
  );
}
