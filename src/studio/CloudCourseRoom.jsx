import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { currentCourseId } from "./storageService.js";

export default function CloudCourseRoom({ course, onDownload }) {
  const courseId = currentCourseId();
  const [messages, setMessages] = useState([]);
  const [resources, setResources] = useState([]);
  const [body, setBody] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRoom() {
    if (!courseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const userResult = await supabase.auth.getUser();
    setUser(userResult.data.user || null);
    const [{ data: profileData }, { data: messageData, error: messageError }, { data: resourceData }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").eq("id", userResult.data.user?.id).maybeSingle(),
      supabase
        .from("learning_messages")
        .select("*,learning_resources(title,resource_type)")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true }),
      supabase
        .from("learning_resources")
        .select("id,title,resource_type")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
    ]);
    setProfile(profileData || null);
    if (messageError) setError(messageError.message);
    else setMessages(messageData || []);
    setResources(resourceData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadRoom();
    if (!courseId) return undefined;

    const channel = supabase
      .channel(`course-room-${courseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "learning_messages", filter: `course_id=eq.${courseId}` },
        (payload) => {
          setMessages((items) => (
            items.some((item) => item.id === payload.new.id) ? items : [...items, payload.new]
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId]);

  async function send(event) {
    event.preventDefault();
    setError("");
    if (!body.trim()) return;
    try {
      if (!courseId) throw new Error("Save the course shell before opening its cloud room.");
      const senderLabel = profile?.full_name || profile?.email || user?.email || "Course member";
      const { error: sendError } = await supabase.from("learning_messages").insert({
        course_id: courseId,
        sender_id: user.id,
        sender_label: senderLabel,
        body: body.trim(),
        attachment_resource_id: attachmentId || null,
      });
      if (sendError) throw sendError;
      setBody("");
      setAttachmentId("");
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
            const own = message.sender_id === user?.id;
            return (
              <article className={own ? "is-own" : ""} key={message.id}>
                <div><strong>{own ? "You" : message.sender_label || "Course member"}</strong><time>{new Date(message.created_at).toLocaleString()}</time></div>
                <p>{message.body}</p>
                {message.learning_resources && (
                  <span className="studio-message-attachment"><span aria-hidden="true">📎</span>{message.learning_resources.title}</span>
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
