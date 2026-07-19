import { useState } from "react";
import BrandLogo from "../Brand.jsx";

const SHARE_TITLE = "Join me on EdNotebook";
const SHARE_TEXT = "Find your classes. Find your people. Keep learning in one place. Join free at EdNotebook.";

export default function ShareEdNotebook({ buttonLabel = "Share EdNotebook", className = "", targetPath = "#/students/university" }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const pageUrl = typeof window === "undefined" ? "https://ednotebook.com" : `${window.location.origin}${window.location.pathname}${targetPath}`;
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(`${SHARE_TEXT} ${pageUrl}`);

  async function sharePage() {
    try {
      if (navigator.share) {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: pageUrl });
        setNotice("Share options opened.");
      } else {
        await navigator.clipboard.writeText(pageUrl);
        setNotice("EdNotebook link copied.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Choose a social option below or copy the link.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setNotice("EdNotebook link copied.");
    } catch {
      setNotice("Copy the link from the field below.");
    }
  }

  return <>
    <button className={`share-ednotebook-button ${className}`.trim()} type="button" onClick={() => { setOpen(true); setNotice(""); }}>{buttonLabel}</button>
    {open && <div className="share-ednotebook-overlay" role="dialog" aria-modal="true" aria-labelledby="share-ednotebook-title"><section className="share-ednotebook-modal"><header><BrandLogo size={40} tagline="Learning, teaching, and campus life" /><button type="button" onClick={() => setOpen(false)} aria-label="Close sharing options">×</button></header><div><span className="portal-kicker">INVITE YOUR PEOPLE</span><h2 id="share-ednotebook-title">Learn together on EdNotebook.</h2><p>Share the student page with friends, classmates, or professors. They can create a free account and find their university, classes, and people.</p></div><img src="/ednotebook-share-card.png" alt="EdNotebook invitation card with the website and an invitation to join free" /><div className="share-primary-actions"><button className="primary" type="button" onClick={sharePage}>Open device sharing</button><a href="/ednotebook-share-card.png" download="ednotebook-invitation.png">Download share graphic</a></div><div className="share-social-options" aria-label="Social sharing links"><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer">Facebook</a><a href={`https://twitter.com/intent/tweet?text=${encodedText}`} target="_blank" rel="noreferrer">X / Twitter</a><a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noreferrer">LinkedIn</a><a href={`https://wa.me/?text=${encodedText}`} target="_blank" rel="noreferrer">WhatsApp</a><a href={`mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodedText}`}>Email</a></div><label>Share link<div><input readOnly value={pageUrl} onFocus={(event) => event.target.select()} /><button type="button" onClick={copyLink}>Copy</button></div></label>{notice && <div className="portal-form-notice" role="status">{notice}</div>}</section></div>}
  </>;
}
