import { useEffect, useMemo, useState } from "react";
import "./fullscreen-surface.css";

function WorkspaceWindowBar({ title, pages, currentPage, addressPrefix = "ednotebook://workspace", canBack, canForward, onBack, onForward, onRefresh, onNavigate, onClose }) {
  return (
    <header className="fullscreen-surface-toolbar">
      <div className="fullscreen-window-mark" aria-hidden="true"><i /><i /><i /></div>
      <div className="fullscreen-history-controls" aria-label="Workspace navigation controls">
        <button type="button" disabled={!canBack} onClick={onBack} aria-label="Go back">←</button>
        <button type="button" disabled={!canForward} onClick={onForward} aria-label="Go forward">→</button>
        <button type="button" onClick={onRefresh} aria-label="Refresh this workspace">↻</button>
      </div>
      <div className="fullscreen-address"><span>{title}</span><strong>{addressPrefix}/{currentPage}</strong></div>
      <nav aria-label={`${title} pages`}>{pages.map((page) => <button type="button" className={currentPage === page.id ? "is-active" : ""} key={page.id} onClick={() => onNavigate(page.id)}>{page.label}</button>)}</nav>
      <button className="fullscreen-surface-close" type="button" onClick={onClose} aria-label={`Close ${title}`}>×</button>
    </header>
  );
}

export default function FullscreenSurface({ title, pages, initialPage, addressPrefix = "ednotebook://workspace", onClose, renderPage }) {
  const [history, setHistory] = useState([initialPage]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const currentPage = history[historyIndex] || initialPage;
  const currentLabel = useMemo(() => pages.find((page) => page.id === currentPage)?.label || currentPage, [currentPage, pages]);

  useEffect(() => {
    setHistory([initialPage]);
    setHistoryIndex(0);
  }, [initialPage]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.altKey && event.key === "ArrowLeft") setHistoryIndex((index) => Math.max(0, index - 1));
      if (event.altKey && event.key === "ArrowRight") setHistoryIndex((index) => Math.min(history.length - 1, index + 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [history.length, onClose]);

  function navigate(pageId) {
    if (pageId === currentPage) return;
    const nextHistory = [...history.slice(0, historyIndex + 1), pageId];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }

  return (
    <div className="fullscreen-surface-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <section className="fullscreen-surface">
        <WorkspaceWindowBar title={title} pages={pages} currentPage={currentPage} addressPrefix={addressPrefix} canBack={historyIndex > 0} canForward={historyIndex < history.length - 1} onBack={() => setHistoryIndex((index) => Math.max(0, index - 1))} onForward={() => setHistoryIndex((index) => Math.min(history.length - 1, index + 1))} onRefresh={() => setRefreshKey((value) => value + 1)} onNavigate={navigate} onClose={onClose} />
        <main className="fullscreen-surface-content" key={`${currentPage}-${refreshKey}`} data-tour-section={`surface-${currentPage}`}>
          <div className="fullscreen-page-heading"><span>EDNOTEBOOK INTERNAL PAGE</span><strong>{currentLabel}</strong><small>Close this window to return exactly where you were.</small></div>
          {renderPage(currentPage, navigate)}
        </main>
      </section>
    </div>
  );
}

export { WorkspaceWindowBar };
