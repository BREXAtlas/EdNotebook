import { useEffect, useState } from "react";
import { cx, safeRead, formatDateTime, statusLabel, VerifiedBadge, NotebookLabel } from "./demoShared.jsx";
import { ProfileHeroCard, StatsCard } from "./WorkspaceOverview.jsx";

function searchMemory(persona, assignments, query, priorMessages) {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  const records = [
    ...persona.documents.map((item) => ({ title: item.title, type: item.type, text: item.text })),
    ...assignments.map((item) => ({ title: `${item.course} — ${item.title}`, type: "Assignment", text: `${item.description} Due ${formatDateTime(item.due)}. Status ${statusLabel(item.status, persona.id === "professor")}.` })),
    ...persona.conversations.map((item) => ({ title: `Conversation with ${item.name}`, type: "Conversation", text: item.preview })),
    ...priorMessages.filter((item) => item.role === "user").map((item, index) => ({ title: `Past chat question ${index + 1}`, type: "Past conversation", text: item.text })),
  ];
  const scored = records.map((record) => ({ ...record, score: terms.reduce((sum, term) => sum + ((record.title + " " + record.text).toLowerCase().includes(term) ? 1 : 0), 0) })).filter((record) => record.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  if (!scored.length) {
    return {
      text: `I did not find a strong match in ${persona.shortName}’s saved demo documents or conversations. Try a course code, assignment title, person’s name, “due,” “book,” “college,” or “research.”`,
      sources: [],
    };
  }
  const lead = scored[0];
  return {
    text: `I found ${scored.length} relevant memory item${scored.length === 1 ? "" : "s"}. The strongest match is “${lead.title}.” ${lead.text} I would verify the source document before making a final academic decision.`,
    sources: scored.map((item) => `${item.type}: ${item.title}`),
  };
}

function ChatPanel({ persona, assignments }) {
  const key = `ed-demo-${persona.id}-chat`;
  const [messages, setMessages] = useState(() => safeRead(key, [{ role: "assistant", text: persona.id === "professor" ? "Ask me to search your syllabi, review queue, advising memory, research notes, or prior conversations." : "Ask me to search your syllabi, assignments, notes, saved sources, or past conversations.", sources: [] }]));
  const [draft, setDraft] = useState("");
  useEffect(() => { setMessages(safeRead(key, [{ role: "assistant", text: `Welcome to ${persona.shortName}’s document-aware ${persona.id === "professor" ? "memory" : "chat"} demo.`, sources: [] }])); }, [persona.id, key, persona.shortName]);
  function send(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    const userMessage = { role: "user", text: draft.trim(), sources: [] };
    const answer = searchMemory(persona, assignments, draft, messages);
    const next = [...messages, userMessage, { role: "assistant", ...answer }];
    setMessages(next);
    window.localStorage.setItem(key, JSON.stringify(next));
    setDraft("");
  }
  const prompts = persona.id === "professor" ? ["What feedback is due Friday?", "What did Lauren ask me about?", "Find my transformative leadership notes.", "Which course has the heaviest review queue?"] : persona.id === "k12" ? ["What is due on September 22?", "What did my counselor recommend?", "Find my Prairie View visit date.", "Which saved source is about accounting careers?"] : ["What is due Friday?", "What did my advisor recommend?", "Which required book was extracted?", "Find my note about adjusting entries."];
  return (
    <div className="chat-layout">
      <section className="paper-card chat-card">
        <div className="dashboard-card-heading"><div><NotebookLabel>{persona.id === "professor" ? "AI ORGANIZATION MEMORY" : "DOCUMENT-AWARE AI CHAT"}</NotebookLabel><h1>Ask the workspace—not the open internet.</h1><p>This front-end demonstration searches only seeded documents, assignments, notes, and prior conversation text.</p></div><button type="button" onClick={() => { setMessages([]); window.localStorage.removeItem(key); }}>Clear memory</button></div>
        <div className="chat-thread">{messages.map((message, index) => <article key={`${message.role}-${index}`} className={`is-${message.role}`}><strong>{message.role === "assistant" ? "EdNotebook AI" : persona.shortName}</strong><p>{message.text}</p>{message.sources?.length > 0 && <div>{message.sources.map((source) => <span key={source}>{source}</span>)}</div>}</article>)}</div>
        <form onSubmit={send}><textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about a document, date, assignment, source, or past conversation…" /><button type="submit">Search my workspace</button></form>
      </section>
      <aside className="paper-card chat-side-card"><NotebookLabel>TRY A GROUNDED QUESTION</NotebookLabel>{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}<div><strong>Memory boundary</strong><p>University student, K–12 student, and professor memories remain separate in the demo. Production access would also follow account, class, and institution permissions.</p></div></aside>
    </div>
  );
}

function SocialPanel({ persona, statusLine, setStatusLine }) {
  const [posts, setPosts] = useState(persona.posts);
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [audience, setAudience] = useState(persona.id === "k12" ? "School" : persona.id === "professor" ? "Students & colleagues" : "Campus");
  useEffect(() => { setPosts(persona.posts); setImage(""); setBody(""); setAudience(persona.id === "k12" ? "School" : persona.id === "professor" ? "Students & colleagues" : "Campus"); }, [persona.id, persona.posts]);
  function readImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  function publish(event) {
    event.preventDefault();
    if (!body.trim() && !image) return;
    const next = [{ date: "Now", body: body.trim() || "Shared a new photo.", reactions: 0, image, audience }, ...posts];
    setPosts(next);
    if (body.trim()) setStatusLine(body.trim().slice(0, 120));
    setBody("");
    setImage("");
  }
  return (
    <div className="social-layout">
      <main className="paper-card social-feed-card">
        <NotebookLabel>{persona.id === "professor" ? "PROFESSIONAL COMMUNITY" : "SOCIAL-ACADEMIC FEED"}</NotebookLabel>
        <form className="status-compose" onSubmit={publish}><div className="compose-person"><img src={persona.image} alt="" /><div><strong>Update your status</strong><span>Choose the audience before posting.</span></div></div><textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder={statusLine} />{image && <div className="image-preview"><img src={image} alt="Preview of selected upload" /><button type="button" onClick={() => setImage("")}>Remove</button></div>}<footer><label className="upload-button">Add picture<input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} /></label><select value={audience} onChange={(event) => setAudience(event.target.value)}><option>{persona.id === "professor" ? "Students & colleagues" : persona.id === "k12" ? "School" : "Campus"}</option><option>Class</option><option>Close connections</option>{persona.id !== "k12" && <option>Public</option>}</select><button type="submit">Post update</button></footer></form>
        <div className="social-post-list">{posts.map((post, index) => <article key={`${post.date}-${index}`}><header><img src={persona.image} alt="" /><div><strong>{persona.name}</strong><span>{post.date} · {post.audience || audience}</span></div><VerifiedBadge label="Verified" small /></header>{post.image && <img className="post-uploaded-image" src={post.image} alt="User-selected demonstration upload" />}<p>{post.body}</p><footer><span>♡ {post.reactions}</span><span>Reply</span><span>Save</span></footer></article>)}</div>
      </main>
      <aside className="social-side-stack">
        <article className="paper-card"><NotebookLabel>ONLINE PRESENCE</NotebookLabel><h2>Status should help, not pressure.</h2><p>Users can show Online, Away, Focus mode, or Offline. Presence can be hidden independently from profile content.</p></article>
        <article className="paper-card"><NotebookLabel>SHARING RULES</NotebookLabel><ul><li>Grades never post automatically.</li><li>K–12 audiences remain school-scoped.</li><li>Students choose each highlight.</li><li>Photo uploads need moderation and removal controls in production.</li></ul></article>
      </aside>
    </div>
  );
}

function ProfilePanel({ persona, features, onlineStatus, statusLine }) {
  const details = [
    ["Age", persona.profile.age],
    [persona.id === "professor" ? "Role" : "Major / goal", persona.profile.major],
    ["Hometown", persona.profile.hometown],
    ["Birthday", persona.profile.birthday],
  ];
  return (
    <div className="workspace-panel-stack">
      {features.profile && <ProfileHeroCard persona={persona} onlineStatus={onlineStatus} statusLine={statusLine} />}
      <section className="profile-detail-grid">
        <article className="paper-card"><NotebookLabel>PROFILE</NotebookLabel>{details.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</article>
        {features.activities && <article className="paper-card"><NotebookLabel>SPORTS, CLUBS & ACTIVITIES</NotebookLabel><div className="pill-list">{persona.profile.activities.map((item) => <span key={item}>{item}</span>)}</div>{persona.id === "k12" && <div className="brown-belt-note"><strong>MMA · Brown belt</strong><p>Trains four to five days a week. Discipline, control, respect, and school first.</p></div>}</article>}
        {features.family && <article className="paper-card"><NotebookLabel>FAMILY & SUPPORT</NotebookLabel><h2>Support system</h2><p>{persona.profile.support}</p><div className="support-heart">♡</div></article>}
        {features.relationships && <article className="paper-card"><NotebookLabel>{persona.id === "professor" ? "WORK-LIFE & GROWTH" : "DATING & PERSONAL GROWTH"}</NotebookLabel><p>{persona.profile.relationship}</p><blockquote>{persona.id === "student" ? "One chapter closed. A better one ahead." : persona.id === "k12" ? "Discipline today. Freedom tomorrow." : "Automate the repetitive. Protect the relational."}</blockquote></article>}
        <article className="paper-card"><NotebookLabel>INTERESTS</NotebookLabel><div className="pill-list">{persona.profile.interests.map((item) => <span key={item}>{item}</span>)}</div></article>
        {features.grades && <StatsCard persona={persona} />}
      </section>
      <section className="paper-card profile-history-card"><div className="dashboard-card-heading"><div><NotebookLabel>{persona.shortName.toUpperCase()}’S STORY</NotebookLabel><h2>A lived-in account with fictional history.</h2></div><span>Demo data</span></div><div className="history-strip">{persona.posts.map((post, index) => <article key={`${post.date}-${index}`}><img src={persona.image} alt="" /><span>{post.date}</span><p>{post.body}</p><small>♡ {post.reactions}</small></article>)}</div></section>
    </div>
  );
}

export { ChatPanel, SocialPanel, ProfilePanel };
