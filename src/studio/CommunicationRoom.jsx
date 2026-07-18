import { useMemo, useState } from "react";
import CloudCourseRoom from "./CloudCourseRoom.jsx";
import DeviceNotebook from "./DeviceNotebook.jsx";
import { readCourseDraft } from "./storageService.js";

function downloadTranscript(courseTitle, messages, mode) {
  const lines = [
    `EdNotebook ${mode === "device" ? "device-only notes" : "course room"}`,
    `Course: ${courseTitle || "Untitled course"}`,
    `Exported: ${new Date().toISOString()}`,
    "",
    ...messages.map((message) => (
      `[${new Date(message.created_at || message.createdAt).toLocaleString()}] ${message.sender_label || message.senderLabel || "Member"}: ${message.body}`
    )),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${String(courseTitle || "course-room").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${mode}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CommunicationRoom() {
  const course = useMemo(readCourseDraft, []);
  const [mode, setMode] = useState("cloud");

  const download = (messages, storageMode) => downloadTranscript(course.name, messages, storageMode);

  return (
    <section className="studio-workspace" aria-labelledby="communication-title">
      <div className="studio-section-heading">
        <div>
          <span className="studio-kicker">PRIVATE COURSE COMMUNICATION</span>
          <h2 id="communication-title">A course room for context—not another public social feed.</h2>
          <p>
            Cloud messages stay inside the authenticated course. Device notes are a separate option that never leaves this browser.
          </p>
        </div>
      </div>

      <div className="studio-room-mode" role="tablist" aria-label="Communication storage mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "cloud"}
          className={mode === "cloud" ? "is-active" : ""}
          onClick={() => setMode("cloud")}
        >
          <span aria-hidden="true">☁</span>
          <div><strong>Course room</strong><small>Authenticated, course-scoped cloud record</small></div>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "device"}
          className={mode === "device" ? "is-active" : ""}
          onClick={() => setMode("device")}
        >
          <span aria-hidden="true">▣</span>
          <div><strong>Device-only notebook</strong><small>Local browser storage · not synced</small></div>
        </button>
      </div>

      {mode === "cloud" ? (
        <CloudCourseRoom course={course} onDownload={download} />
      ) : (
        <DeviceNotebook onDownload={download} />
      )}
    </section>
  );
}
