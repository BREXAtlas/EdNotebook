import { useEffect, useState } from "react";
import {
  loadCourseCommunication,
  sendCourseMessage,
  subscribeCourseCommunication,
} from "../communication/courseCommunicationService.js";
import { COURSE_COMMUNICATION_LIMITS } from "../communication/courseCommunicationModel.js";
import { currentCourseId } from "./storageService.js";

export default function CloudCourseRoom({ course, onDownload }) {
  const courseId = currentCourseId();
  const [messages, setMessages] = useState([]);
  const [resources, setResources] = useState([]);
  const [body, setBody] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRoom() {
    if (!courseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await loadCourseCommunication(courseId);
    if (result.error) setError(result.error.message);
    else {
      setMessages(result.data.messages || []);
      setResources(result.data.resources || []);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRoom();
    if (!courseId) return undefined;

    const unsubscribe = subscribeCourseCommunication(courseId, () => loadRoom());
    const refreshTimer = window.setInterval(loadRoom, COURSE_COMMUNICATION_LIMITS.refreshMilliseconds);

    return () => {
      unsubscribe();
      window.clearInterval(refreshTimer);
    };
  }, [courseId]);

  async function send(event) {
    event.preventDefault();
    setError("");
    if (!body.trim()) return;
    try {
      if (!courseId) throw new Error("Save the course shell before opening its cloud room.");
      const { error: sendError } = await sendCourseMessage({
        courseId,
        body,
        kind: "course_note",
        attachmentResourceId: attachmentId || null,
      });
      if (sendError) throw sendError;
      setBody("");
      setAttachmentId("");
      await loadRoom();
    } catch (sendError) {
      setError(sendError.message || "The message could not be sent.");
    }
  }

  return (
    <div className="studio-room-layout">
      <main className="studio-message-thread" aria-live="polite">
        <header>
          <div><strong>{course.name || "Course room"}</strong><small>Authenticated course members only</small></div>
          <div><button type="button" onClick={() => onDownload(messages, "cloud")}>Download</button><button type="button" onClick={loadRoom}>Refresh</button></div>
        </header>
        {!courseId && <div className="studio-warning">Save the course shell once before using the cloud room.</div>}
        {error && <div className="studio-alert is-error">{error}</div>}
        <div className="studio-message-list">
          {loading ? (
            <p className="studio-tool-empty">Loading the private room…</p>
          ) : messages.length === 0 ? (
            <p className="studio-tool-empty">No messages yet. Start with a question, instruction, or course update.</p>
          ) : messages.map((message) => {
            return (
              <article className={message.own ? "is-own" : ""} key={message.id}>
                <div><strong>{message.own ? "You" : message.senderLabel || "Course member"}</strong><time>{new Date(message.createdAt).toLocaleString()}</time></div>
                <p>{message.body}</p>
                {message.attachment && (
                  <span className="studio-message-attachment"><span aria-hidden="true">📎</span>{message.attachment.title}</span>
                )}
              </article>
            );
          })}
        </div>
        <form className="studio-message-composer" onSubmit={send}>
          <textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Message the course room…" />
          <div>
            <label>
              <span aria-hidden="true">📎</span>
              <select value={attachmentId} onChange={(event) => setAttachmentId(event.target.value)}>
                <option value="">No attachment</option>
                {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
              </select>
            </label>
            <button className="studio-primary-button" type="submit" disabled={!body.trim()}>Send privately</button>
          </div>
        </form>
      </main>

      <aside className="studio-room-principles">
        <span className="studio-kicker">COMMUNICATION RULES</span>
        <h3>Private does not mean ungoverned.</h3>
        <ul>
          <li><span>01</span><p>Cloud messages belong to a course tenancy and follow membership access.</p></li>
          <li><span>02</span><p>Attachments retain their original permissions; a message does not make a file public.</p></li>
          <li><span>03</span><p>Course members can download a deliberate transcript for their own records.</p></li>
          <li><span>04</span><p>Moderation, retention, and institutional policy hooks belong to the same message model.</p></li>
        </ul>
      </aside>
    </div>
  );
}
