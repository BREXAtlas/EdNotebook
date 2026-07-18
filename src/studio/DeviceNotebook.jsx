import { useState } from "react";
import { currentCourseId } from "./storageService.js";

function deviceThreadKey(courseId) {
  return `ednotebook-device-thread-${courseId || "private"}`;
}

function loadMessages(courseId) {
  try {
    return JSON.parse(window.localStorage.getItem(deviceThreadKey(courseId))) || [];
  } catch {
    return [];
  }
}

export default function DeviceNotebook({ onDownload }) {
  const courseId = currentCourseId();
  const [messages, setMessages] = useState(() => loadMessages(courseId));
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");

  function save(event) {
    event.preventDefault();
    if (!body.trim()) return;
    const next = [
      ...messages,
      {
        id: crypto.randomUUID(),
        body: body.trim(),
        senderLabel: "Private note",
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(next);
    window.localStorage.setItem(deviceThreadKey(courseId), JSON.stringify(next));
    setBody("");
    setNotice("Saved to this browser only. Nothing was sent to the course room.");
  }

  function remove(id) {
    const next = messages.filter((message) => message.id !== id);
    setMessages(next);
    window.localStorage.setItem(deviceThreadKey(courseId), JSON.stringify(next));
  }

  return (
    <div className="studio-room-layout">
      <main className="studio-message-thread">
        <header>
          <div><strong>Private device notebook</strong><small>Only this browser</small></div>
          <button type="button" onClick={() => onDownload(messages, "device")}>Download</button>
        </header>
        {notice && <div className="studio-alert is-success">{notice}</div>}
        <div className="studio-message-list">
          {messages.length === 0 ? (
            <p className="studio-tool-empty">No private notes yet. These notes never enter the course cloud.</p>
          ) : messages.map((message) => (
            <article className="is-own" key={message.id}>
              <div><strong>Private note</strong><time>{new Date(message.createdAt).toLocaleString()}</time></div>
              <p>{message.body}</p>
              <button className="studio-message-delete" type="button" onClick={() => remove(message.id)}>Delete local note</button>
            </article>
          ))}
        </div>
        <form className="studio-message-composer" onSubmit={save}>
          <textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a note that remains on this device…" />
          <div><small>Browser storage is not a backup. Download anything you need to retain.</small><button className="studio-primary-button" type="submit" disabled={!body.trim()}>Save on device</button></div>
        </form>
      </main>

      <aside className="studio-room-principles">
        <span className="studio-kicker">DEVICE-ONLY OPTION</span>
        <h3>Local by choice, not by accident.</h3>
        <ul>
          <li><span>01</span><p>No message row is created in Supabase.</p></li>
          <li><span>02</span><p>The notes do not sync to another browser, computer, or phone.</p></li>
          <li><span>03</span><p>Clearing site data removes the notebook unless it was downloaded first.</p></li>
          <li><span>04</span><p>This is best for private scratch notes—not assessed course communication.</p></li>
        </ul>
      </aside>
    </div>
  );
}
