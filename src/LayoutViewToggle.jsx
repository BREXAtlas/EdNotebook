import { useEffect, useState } from "react";

const STORAGE_KEY = "ednotebook-layout-mode";
const MODES = [
  ["auto", "Auto", "Matches the current screen"],
  ["compact", "Compact", "Stacks content into one easy column"],
  ["full", "Full", "Keeps the desktop layout and allows horizontal panning"],
];

function readLayoutMode() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return MODES.some(([id]) => id === saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}

function applyLayoutMode(mode) {
  document.documentElement.dataset.layoutMode = mode;
  try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* The layout still works for this page. */ }
  window.dispatchEvent(new CustomEvent("ednotebook:layout-mode", { detail: mode }));
}

export default function LayoutViewToggle({ compact = false }) {
  const [mode, setMode] = useState(readLayoutMode);

  useEffect(() => {
    applyLayoutMode(mode);
  }, [mode]);

  useEffect(() => {
    const sync = (event) => setMode(event.detail || readLayoutMode());
    window.addEventListener("ednotebook:layout-mode", sync);
    return () => window.removeEventListener("ednotebook:layout-mode", sync);
  }, []);

  return (
    <fieldset className={`layout-view-toggle ${compact ? "is-compact" : ""}`}>
      <legend>Page view</legend>
      <div>
        {MODES.map(([id, label, description]) => (
          <button
            className={mode === id ? "is-active" : ""}
            type="button"
            key={id}
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            title={description}
          >
            {label}
          </button>
        ))}
      </div>
      {!compact && <p>{MODES.find(([id]) => id === mode)?.[2]}</p>}
    </fieldset>
  );
}

export { applyLayoutMode, readLayoutMode };
