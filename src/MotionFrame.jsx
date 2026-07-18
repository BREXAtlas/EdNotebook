import { useEffect, useRef, useState } from "react";

const MOTION_LABELS = new Set([
  "Learner",
  "Professor",
  "Admin",
  "★ Mastermind",
  "Forge",
  "Course",
  "Grader",
  "Classes",
  "Quest map",
  "Find classes",
  "Paper writer",
  "Discussion",
  "Story mode",
  "Focus mode",
  "Map",
  "Back to quest map",
  "Back to editor",
]);

export default function MotionFrame({ children, routeKey }) {
  const [entering, setEntering] = useState(true);
  const rafRef = useRef(null);
  const timeoutRef = useRef(null);

  const play = () => {
    if (typeof window === "undefined") return;
    setEntering(false);
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = window.requestAnimationFrame(() => {
        setEntering(true);
        timeoutRef.current = window.setTimeout(() => setEntering(false), 560);
      });
    });
  };

  useEffect(() => {
    play();
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [routeKey]);

  const handleCapture = (event) => {
    const target = event.target.closest("button, a, [role='tab'], [data-motion]");
    if (!target || target.disabled) return;
    const label = target.textContent?.replace(/\s+/g, " ").trim();
    if (target.dataset.motion === "true" || MOTION_LABELS.has(label)) play();
  };

  return (
    <div
      className={`ed-motion-frame${entering ? " is-entering" : ""}`}
      onClickCapture={handleCapture}
    >
      {children}
    </div>
  );
}
