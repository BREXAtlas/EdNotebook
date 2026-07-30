import { useMemo, useRef, useState } from "react";
import { communicationModeAfterKey } from "../communication/courseCommunicationModel.js";
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
      `[${new Date(message.created_at || message.createdAt).toLocaleString()}] ${message.own ? "You" : message.sender_label || message.senderLabel || "Member"}: ${message.body}`
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
  const modeTabRefs = useRef({});

  const download = (messages, storageMode) => downloadTranscript(course.name, messages, storageMode);
  function handleModeKeyDown(event) {
    const nextMode = communicationModeAfterKey(mode, event.key);
    if (!nextMode) return;
    event.preventDefault();
    setMode(nextMode);
    modeTabRefs.current[nextMode]?.focus();
  }

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

      <div className="studio-room-mode" role="tablist" aria-label="Communication storage mode" onKeyDown={handleModeKeyDown}>
        <button
          id="studio-course-room-tab"
          ref={(element) => { modeTabRefs.current.cloud = element; }}
          type="button"
          role="tab"
          aria-controls="studio-course-room-panel"
          aria-selected={mode === "cloud"}
          tabIndex={mode === "cloud" ? 0 : -1}
          className={mode === "cloud" ? "is-active" : ""}
          onClick={() => setMode("cloud")}
        >
          <span aria-hidden="true">☁</span>
          <div><strong>Course room</strong><small>Authenticated, course-scoped cloud record</small></div>
        </button>
        <button
          id="studio-device-notebook-tab"
          ref={(element) => { modeTabRefs.current.device = element; }}
          type="button"
          role="tab"
          aria-controls="studio-device-notebook-panel"
          aria-selected={mode === "device"}
          tabIndex={mode === "device" ? 0 : -1}
          className={mode === "device" ? "is-active" : ""}
          onClick={() => setMode("device")}
        >
          <span aria-hidden="true">▣</span>
          <div><strong>Device-only notebook</strong><small>Local browser storage · not synced</small></div>
        </button>
      </div>

      <div
        id="studio-course-room-panel"
        role="tabpanel"
        aria-labelledby="studio-course-room-tab"
        tabIndex={0}
        hidden={mode !== "cloud"}
      >
        {mode === "cloud" && <CloudCourseRoom course={course} onDownload={download} />}
      </div>
      <div
        id="studio-device-notebook-panel"
        role="tabpanel"
        aria-labelledby="studio-device-notebook-tab"
        tabIndex={0}
        hidden={mode !== "device"}
      >
        {mode === "device" && <DeviceNotebook onDownload={download} />}
      </div>
    </section>
  );
}
