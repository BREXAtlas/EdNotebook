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
        <div className="dashboard-card-heading"><div><NotebookLabel>{persona.id === "professor" ? "WORKSPACE MEMORY" : "DOCUMENT-AWARE ASSISTANT"}</NotebookLabel><h1>Ask your workspace.</h1><p>This demonstration searches only the documents, assignments, notes, and conversations saved here.</p></div><button type="button" onClick={() => { setMessages([]); window.localStorage.removeItem(key); }}>Clear memory</button></div>
        <div className="chat-thread">{messages.map((message, index) => <article key={`${message.role}-${index}`} className={`is-${message.role}`}><strong>{message.role === "assistant" ? "EdNotebook assistant" : persona.shortName}</strong><p>{message.text}</p>{message.sources?.length > 0 && <div>{message.sources.map((source) => <span key={source}>{source}</span>)}</div>}</article>)}</div>
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

function ExpandableCard({ label, title, children, open = false, className = "" }) {
  return <details className={`paper-card profile-expandable ${className}`} open={open}><summary><div><NotebookLabel>{label}</NotebookLabel><h2>{title}</h2></div><span aria-hidden="true">＋</span></summary><div className="profile-expandable-body">{children}</div></details>;
}

function ProfilePanel({ persona, features, onlineStatus, statusLine }) {
  const details = [
    ["Age", persona.profile.age],
    [persona.id === "professor" ? "Role" : "Major / goal", persona.profile.major],
    ["Hometown", persona.profile.hometown],
    ["Birthday", persona.profile.birthday],
  ];
  const assignments = persona.assignments.slice(0, 4);
  return (
    <div className="workspace-panel-stack immersive-profile-page">
      {features.profile && <ProfileHeroCard persona={persona} onlineStatus={onlineStatus} statusLine={statusLine} />}
      <section className="profile-bento-grid">
        <ExpandableCard label="ABOUT" title={`Meet ${persona.shortName}`} open className="profile-bento-about">
          <p>{persona.profile.bio}</p>
          <div className="profile-detail-list">{details.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        </ExpandableCard>
        {features.grades && <div className="profile-bento-stats"><StatsCard persona={persona} /></div>}
        <ExpandableCard label={persona.id === "professor" ? "COURSES" : "SEMESTER"} title={persona.id === "professor" ? "Teaching now" : "Classes and work"} open>
          <div className="profile-assignment-list">{assignments.map((item) => <article key={item.id}><span>{item.course}</span><strong>{item.title}</strong><small>{statusLabel(item.status, persona.id === "professor")}</small></article>)}</div>
        </ExpandableCard>
        {features.conversations && <ExpandableCard label="PEOPLE" title="Conversations"><div className="profile-people-list">{persona.conversations.slice(0, 5).map((item) => <article key={item.name}><span>{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.preview}</small></div></article>)}</div></ExpandableCard>}
        {features.activities && <ExpandableCard label="LIFE" title={persona.id === "professor" ? "Communities and interests" : "Clubs, sports, and activities"} open><div className="pill-list">{persona.profile.activities.map((item) => <span key={item}>{item}</span>)}</div>{persona.id === "k12" && <div className="brown-belt-note"><strong>MMA · Brown belt</strong><p>Discipline, control, respect, and school first.</p></div>}</ExpandableCard>}
        <ExpandableCard label="INTERESTS" title="Favorites and skills"><div className="pill-list">{persona.profile.interests.map((item) => <span key={item}>{item}</span>)}</div></ExpandableCard>
        {features.family && <ExpandableCard label="SUPPORT" title="Family and people who help"><p>{persona.profile.support}</p><div className="support-heart">♡</div></ExpandableCard>}
        {features.relationships && <ExpandableCard label="GROWTH" title={persona.id === "professor" ? "Work and life" : "Personal growth"}><p>{persona.profile.relationship}</p><blockquote>{persona.id === "student" ? "One chapter closed. A better one ahead." : persona.id === "k12" ? "Discipline today. Freedom tomorrow." : "Protect the time that belongs to people."}</blockquote></ExpandableCard>}
      </section>
    </div>
  );
}

function StoryPanel({ persona }) {
  return (
    <div className="story-page-layout">
      <aside className="paper-card story-person-card">
        <img src={persona.image} alt={`${persona.name} portrait`} />
        <NotebookLabel>{persona.id === "professor" ? "TEACHING STORY" : "STORY SO FAR"}</NotebookLabel>
        <h1>{persona.name}</h1>
        <p>{persona.profile.bio}</p>
        <div className="story-mini-stats"><span><strong>{persona.posts.length}</strong> updates</span><span><strong>{persona.profile.activities.length}</strong> groups</span><span><strong>{persona.assignments.length}</strong> work items</span></div>
      </aside>
      <main className="paper-card story-timeline-card">
        <div className="dashboard-card-heading"><div><NotebookLabel>{persona.shortName.toUpperCase()}’S TIMELINE</NotebookLabel><h2>Moments, progress, and people.</h2></div><span>Demo story</span></div>
        <div className="story-timeline">{persona.posts.map((post, index) => <article key={`${post.date}-${index}`}><time>{post.date}</time><div><span>{String(index + 1).padStart(2, "0")}</span></div><section>{post.image && <img src={post.image} alt="" />}<p>{post.body}</p><small>♡ {post.reactions} · {post.audience || "Connections"}</small></section></article>)}</div>
      </main>
      <aside className="story-side-stack">
        <article className="paper-card"><NotebookLabel>HIGHLIGHTS</NotebookLabel><h2>What is moving forward</h2><ul>{persona.profile.traits.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul></article>
        <article className="paper-card story-next-card"><NotebookLabel>NEXT CHAPTER</NotebookLabel><h2>Keep going.</h2><ul><li>Finish the next priority</li><li>Check in with someone helpful</li><li>Save one moment worth remembering</li></ul></article>
      </aside>
    </div>
  );
}

export { ChatPanel, SocialPanel, ProfilePanel, StoryPanel };
