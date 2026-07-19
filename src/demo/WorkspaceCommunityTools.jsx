import { useEffect, useMemo, useRef, useState } from "react";
import { readConnectorToken } from "../AccountSettings.jsx";
import { cx, safeRead, formatDateTime, statusLabel, VerifiedBadge, NotebookLabel, OnlineBadge } from "./demoShared.jsx";
import { ProfileHeroCard, StatsCard } from "./WorkspaceOverview.jsx";
import {
  STORY_AUDIENCE_RULES,
  STORY_GUIDES,
  STORY_REACTION_TYPES,
  createStoryReply,
  createWelcomePost,
  filterStoryFeed,
  generateStoryFeed,
  getActiveWeeklyStory,
  getDefaultConnection,
  getStoryBible,
  localCalendarDate,
} from "./storyEngine.js";

const STOP_WORDS = new Set(["about", "after", "again", "also", "before", "could", "from", "have", "into", "just", "next", "that", "their", "then", "there", "they", "this", "what", "when", "where", "which", "with", "would", "your"]);

function messageId(prefix = "message") {
  return `${prefix}-${Date.now()}-${Math.floor(performance.now())}`;
}

function safeSessionRead(key, fallback) {
  try { return JSON.parse(window.sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function assistantSources(accountSettings) {
  const plugins = accountSettings?.plugins || {};
  return [plugins.calendar && "calendar", plugins.documents && "documents", plugins.sources && "sources", plugins.conversations && "conversations"].filter(Boolean);
}

function findCourse(persona, query) {
  const normalized = query.toLowerCase();
  return persona.classes.find((course) => {
    const code = course.code.toLowerCase();
    const title = course.title.toLowerCase();
    const shortCode = code.replace(/\s+/g, "");
    return normalized.includes(code) || normalized.replace(/\s+/g, "").includes(shortCode) || title.split(/\s+/).filter((word) => word.length > 4).some((word) => normalized.includes(word));
  });
}

function isDueDateIntent(query, previousMessages) {
  const normalized = query.toLowerCase();
  const direct = /(next|upcoming|coming|first)\s+(assignment|homework|project|paper|quiz|exam|work)/.test(normalized)
    || /(when|what day|what date|which day).*(assignment|homework|project|paper|quiz|exam)/.test(normalized)
    || /(due|deadline|turn in|submit by)/.test(normalized);
  if (direct) return true;
  const priorIntent = [...previousMessages].reverse().find((message) => message.role === "assistant" && message.intent)?.intent;
  return priorIntent === "due-date" && normalized.split(/\s+/).length <= 7;
}

function dueDateAnswer(persona, assignments, query) {
  const course = findCourse(persona, query);
  const wantsAll = /all (classes|courses)|overall|everything/.test(query.toLowerCase());
  const now = Date.now();
  const sorted = assignments
    .filter((item) => !course || item.course === course.code)
    .filter((item) => new Date(item.due).getTime() >= now)
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  if (!sorted.length) {
    return { intent: "due-date", text: course ? `I do not see an upcoming item saved for ${course.code}. Want me to check another class?` : "I do not see an upcoming assignment in the saved workspace. Which class should I check?", sources: [] };
  }
  const next = sorted[0];
  const sameDay = sorted.filter((item) => item.id !== next.id && item.due.slice(0, 10) === next.due.slice(0, 10)).slice(0, 2);
  const collision = sameDay.length ? ` You also have ${sameDay.map((item) => `${item.title} (${item.course})`).join(" and ")} that day.` : "";
  const followUp = course || wantsAll ? " Want the item after that too?" : ` That is the earliest item across all classes. If you meant one class, tell me the class name or code.`;
  return {
    intent: "due-date",
    text: `${next.title} for ${next.course} is next, due ${formatDateTime(next.due)}.${collision}${followUp}`,
    sources: [`Assignment: ${next.course} — ${next.title}`],
  };
}

function searchMemory(persona, assignments, query, priorMessages, accountSettings = {}) {
  const plugins = accountSettings.plugins || { calendar: true, documents: true, sources: true, conversations: true };
  if (isDueDateIntent(query, priorMessages)) {
    if (!plugins.calendar) return { intent: "due-date", text: "Assignment and calendar access is turned off in Settings. Turn that plugin on, or ask me about a saved document instead.", sources: [] };
    return dueDateAnswer(persona, assignments, query);
  }

  const normalized = query.toLowerCase();
  const rawTerms = normalized.split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !STOP_WORDS.has(term));
  const related = rawTerms.flatMap((term) => ({ assignment: ["due", "deadline", "homework", "project"], teacher: ["professor", "instructor", "educator"], book: ["textbook", "reading", "source"], recommend: ["advisor", "counselor", "suggested"] }[term] || []));
  const terms = [...new Set([...rawTerms, ...related])];
  const records = [
    ...(plugins.documents ? persona.documents.map((item) => ({ title: item.title, type: item.type, text: item.text })) : []),
    ...(plugins.calendar ? assignments.map((item) => ({ title: `${item.course} — ${item.title}`, type: "Assignment", text: `${item.description} Due ${formatDateTime(item.due)}. Status ${statusLabel(item.status, persona.id === "professor")}.` })) : []),
    ...(plugins.sources ? persona.sources.map((item) => ({ title: item.title, type: item.type || "Saved source", text: `${item.author}. ${item.note || ""}` })) : []),
    ...(plugins.conversations ? persona.conversations.map((item) => ({ title: `Conversation with ${item.name}`, type: "Conversation", text: item.preview })) : []),
    ...(plugins.conversations ? priorMessages.filter((item) => item.role === "user").map((item, index) => ({ title: `Past question ${index + 1}`, type: "Past conversation", text: item.text })) : []),
  ];
  const scored = records.map((record) => {
    const title = record.title.toLowerCase();
    const haystack = `${record.title} ${record.text}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 3 : haystack.includes(term) ? 1 : 0), 0);
    return { ...record, score };
  }).filter((record) => record.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  if (!scored.length) {
    return {
      intent: "clarify",
      text: `I did not find a confident match yet. Are you asking about a due date, a class, a person, or a saved source? You can also name the class so I can narrow it down.`,
      sources: [],
    };
  }
  const lead = scored[0];
  return {
    intent: "workspace-search",
    text: `The closest match is “${lead.title}.” ${lead.text} ${scored.length > 1 ? `I found ${scored.length - 1} other related item${scored.length === 2 ? "" : "s"}.` : ""} Want me to narrow this to one class?`,
    sources: scored.map((item) => `${item.type}: ${item.title}`),
  };
}

async function requestConnectedAssistant({ accountSettings, settingsScope, messages, persona, assignments }) {
  const token = readConnectorToken(settingsScope);
  if (!accountSettings.gatewayUrl || !token) throw new Error("Add the secure gateway URL and temporary token in Settings first.");
  const endpoint = new URL(accountSettings.gatewayUrl, window.location.origin);
  const localEndpoint = ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !(localEndpoint && endpoint.protocol === "http:")) throw new Error("Use an HTTPS gateway URL. HTTP is available only for local testing.");
  const plugins = accountSettings.plugins || {};
  const gatewayMessages = plugins.conversations === false ? messages.slice(-1) : messages;
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    credentials: "omit",
    referrerPolicy: "no-referrer",
    body: JSON.stringify({
      provider: accountSettings.assistantProvider,
      model: accountSettings.assistantModel,
      messages: gatewayMessages.map(({ role, text }) => ({ role, content: text })),
      context: {
        accountType: persona.accountType,
        classes: plugins.calendar ? persona.classes.map(({ code, title, instructor }) => ({ code, title, instructor })) : [],
        assignments: plugins.calendar ? assignments.map(({ course, title, due, status }) => ({ course, title, due, status })) : [],
        enabledPlugins: assistantSources(accountSettings),
      },
    }),
  });
  if (!response.ok) throw new Error(`The connected assistant returned ${response.status}.`);
  const data = await response.json();
  const text = data.text || data.output_text || (typeof data.message === "string" ? data.message : data.message?.content) || data.content?.[0]?.text || data.choices?.[0]?.message?.content;
  if (!text) throw new Error("The connected assistant returned no readable message.");
  return { text, sources: [`${accountSettings.assistantProvider} · ${accountSettings.assistantModel}`], intent: "connected-model" };
}

function TypewriterText({ text, active, onDone }) {
  const [visible, setVisible] = useState(active ? "" : text);
  useEffect(() => {
    if (!active) { setVisible(text); return undefined; }
    setVisible("");
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + 3);
      setVisible(text.slice(0, index));
      if (index >= text.length) { window.clearInterval(timer); onDone?.(); }
    }, 18);
    return () => window.clearInterval(timer);
  }, [active, onDone, text]);
  return <p aria-live={active ? "polite" : undefined}>{visible}{active && visible.length < text.length && <span className="typewriter-caret" aria-hidden="true">|</span>}</p>;
}

function ChatPanel({ persona, assignments, accountSettings = {}, settingsScope = `demo-${persona.id}` }) {
  const key = `ed-demo-${persona.id}-chat`;
  const greeting = persona.id === "professor" ? "Ask about your syllabi, review queue, advising notes, research, or earlier conversations." : "Ask about assignments, due dates, syllabi, notes, saved sources, or earlier conversations.";
  const [messages, setMessages] = useState(() => safeSessionRead(key, [{ id: "welcome", role: "assistant", text: greeting, sources: [] }]));
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [typingId, setTypingId] = useState(null);
  const threadRef = useRef(null);
  const external = accountSettings.assistantProvider && accountSettings.assistantProvider !== "builtin";
  useEffect(() => { setMessages(safeSessionRead(key, [{ id: "welcome", role: "assistant", text: greeting, sources: [] }])); setTypingId(null); }, [persona.id, key]);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  async function send(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || thinking) return;
    const userMessage = { id: messageId("user"), role: "user", text: question, sources: [] };
    const contextMessages = [...messages, userMessage];
    setMessages(contextMessages);
    setDraft("");
    setThinking(true);
    let answer;
    if (external) {
      try {
        answer = await requestConnectedAssistant({ accountSettings, settingsScope, messages: contextMessages, persona, assignments });
      } catch (error) {
        const local = searchMemory(persona, assignments, question, messages, accountSettings);
        answer = { ...local, text: `${error.message} I checked the built-in workspace instead: ${local.text}` };
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      answer = searchMemory(persona, assignments, question, messages, accountSettings);
    }
    const assistantMessage = { id: messageId("assistant"), role: "assistant", ...answer };
    const next = [...contextMessages, assistantMessage];
    setMessages(next);
    try { window.sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep the current thread in memory when session storage is blocked. */ }
    setTypingId(assistantMessage.id);
    setThinking(false);
  }

  const prompts = persona.id === "professor" ? ["Which review is next?", "What feedback is due Friday?", "What did Lauren ask me about?", "Find my leadership notes."] : persona.id === "k12" ? ["When is my next assignment?", "What did my counselor recommend?", "Find my college visit date.", "Which source is about accounting careers?"] : ["When is my next assignment?", "What did my advisor recommend?", "Which book is required?", "Find my adjusting entries note."];
  return (
    <div className="chat-layout">
      <section className="paper-card chat-card">
        <div className="dashboard-card-heading"><div><NotebookLabel>WORKSPACE ASSISTANT</NotebookLabel><h1>Ask naturally.</h1><p>It understands assignment and date questions, checks the enabled workspace sources, and asks for a class when that would improve the answer.</p></div><div className="assistant-provider-chip"><strong>{external ? accountSettings.assistantModel : "Built-in workspace"}</strong><span>{external ? "via your gateway" : "ready without a key"}</span></div></div>
        <div className="chat-thread" ref={threadRef}>{messages.map((message) => <article key={message.id || `${message.role}-${message.text}`} className={`is-${message.role}`}><strong>{message.role === "assistant" ? "EdNotebook assistant" : accountSettings.displayName || persona.shortName}</strong>{message.role === "assistant" ? <TypewriterText text={message.text} active={typingId === message.id} onDone={() => setTypingId(null)} /> : <p>{message.text}</p>}{message.sources?.length > 0 && <div>{message.sources.map((source) => <span key={source}>{source}</span>)}</div>}</article>)}{thinking && <article className="is-assistant is-thinking"><strong>EdNotebook assistant</strong><p><span /><span /><span /></p></article>}</div>
        <form onSubmit={send}><textarea rows={3} spellCheck value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Try: When is my next assignment?" /><button type="submit" disabled={thinking}>{thinking ? "Checking…" : "Ask"}</button></form>
      </section>
      <aside className="paper-card chat-side-card"><NotebookLabel>TRY A QUESTION</NotebookLabel>{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}<div><strong>Connected workspace</strong><p>{assistantSources(accountSettings).length ? `Using ${assistantSources(accountSettings).join(", ")}.` : "Turn on a workspace plugin in Settings."}</p><a href="#" onClick={(event) => { event.preventDefault(); document.querySelector(".sidebar-settings-button")?.click(); }}>Open assistant settings</a></div></aside>
    </div>
  );
}

function localSocialRead(key, fallback) {
  return safeRead(key, fallback);
}

function saveSocial(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readSessionSocial(key, fallback) {
  try { return JSON.parse(window.sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function saveSessionSocial(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function startOfWeek(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function guideConnections(persona) {
  const guideIds = persona.id === "k12" ? ["k12"] : persona.id === "professor" ? ["professor"] : ["student", "professor"];
  const guidePeople = guideIds.map((id) => ({ ...getDefaultConnection(id), id: `guide-${id}`, role: STORY_GUIDES[id].role, preview: id === "professor" ? "Teaching, mentoring, and practical course design." : id === "k12" ? "College prep, accounting, training, and school life." : "Campus life, business classes, art, and honest study updates." }));
  const conversationPeople = persona.conversations.map((person, index) => ({ id: `contact-${index}`, name: person.name, shortName: person.name.split(" ")[0], role: persona.id === "professor" ? (index < 2 ? "Student" : "Faculty") : index === 3 ? "Educator" : "Student", image: "", online: index < 2, preview: person.preview, relationship: "connection" }));
  return [...guidePeople, ...conversationPeople];
}

function displayPostDate(post) {
  const date = new Date(`${post.date}T12:00:00`);
  return Number.isNaN(date.getTime()) ? post.date : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function storyWeekForDate(value) {
  const posted = new Date(`${value}T12:00:00`).getTime();
  const anchor = new Date("2026-05-22T12:00:00").getTime();
  if (!Number.isFinite(posted)) return 0;
  return Math.max(1, Math.floor((posted - anchor) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function SocialPanel({ persona, statusLine, setStatusLine, accountSettings = {} }) {
  const rules = STORY_AUDIENCE_RULES[persona.id];
  const baseKey = `ed-demo-${persona.id}-social`;
  const [view, setView] = useState("feed");
  const [posts, setPosts] = useState(() => localSocialRead(`${baseKey}-posts`, []));
  const [selectedReactions, setSelectedReactions] = useState(() => localSocialRead(`${baseKey}-reactions`, {}));
  const [savedPosts, setSavedPosts] = useState(() => localSocialRead(`${baseKey}-saved`, []));
  const [comments, setComments] = useState(() => localSocialRead(`${baseKey}-comments`, {}));
  const [commentDrafts, setCommentDrafts] = useState({});
  const [body, setBody] = useState("");
  const [media, setMedia] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [audience, setAudience] = useState(rules.defaultAudience);
  const [feedAudience, setFeedAudience] = useState("all");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [weekday, setWeekday] = useState("");
  const [week, setWeek] = useState("");
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [following, setFollowing] = useState(() => localSocialRead(`${baseKey}-following`, []));
  const [removedFollowers, setRemovedFollowers] = useState(() => localSocialRead(`${baseKey}-removed-followers`, []));
  const [messageDraft, setMessageDraft] = useState("");
  const [notice, setNotice] = useState("");
  const storyNow = useMinuteClock();

  const storyPosts = useMemo(() => generateStoryFeed({ persona: persona.id, now: storyNow, newestFirst: true }), [persona.id, storyNow]);
  const welcomeKey = `${baseKey}-welcome`;
  const [welcomePost, setWelcomePost] = useState(() => accountSettings.allowWelcomePosts === false ? null : localSocialRead(welcomeKey, null) || createWelcomePost({ persona: persona.id, accountName: accountSettings.displayName || persona.shortName, now: new Date(), allowProfilePosts: true, allowComments: accountSettings.allowComments !== false }));
  const people = useMemo(() => guideConnections(persona), [persona]);
  const visibleStory = useMemo(() => filterStoryFeed(storyPosts, { query, month, weekday, week }), [storyPosts, query, month, weekday, week]);
  const combinedPosts = useMemo(() => {
    const userMatches = posts.filter((post) => (!query || post.body.toLowerCase().includes(query.toLowerCase())) && (!month || post.date.startsWith(month)) && (!weekday || new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(`${post.date}T12:00:00`)).toLowerCase().startsWith(weekday.toLowerCase())) && (!week || storyWeekForDate(post.date) === Number(week)));
    const all = [...userMatches, ...visibleStory, ...(welcomePost ? [welcomePost] : [])];
    const normalizedAudience = feedAudience === "classes" ? "class" : feedAudience;
    return all.filter((post) => feedAudience === "all" || post.audience === normalizedAudience).sort((a, b) => `${b.date}${b.localTime || ""}`.localeCompare(`${a.date}${a.localTime || ""}`));
  }, [posts, visibleStory, welcomePost, query, month, weekday, week, feedAudience]);
  const months = [...new Set(storyPosts.map((post) => post.month))];

  useEffect(() => { setAudience(rules.defaultAudience); setView("feed"); setMedia(""); setBody(""); setNotice(""); }, [persona.id, rules.defaultAudience]);
  useEffect(() => {
    if (accountSettings.allowWelcomePosts === false) { setWelcomePost(null); return; }
    const stored = localSocialRead(welcomeKey, null);
    const next = stored || createWelcomePost({ persona: persona.id, accountName: accountSettings.displayName || persona.shortName, now: new Date(), allowProfilePosts: true, allowComments: accountSettings.allowComments !== false });
    if (!stored) saveSocial(welcomeKey, next);
    setWelcomePost(next);
  }, [welcomeKey, persona.id, persona.shortName, accountSettings.allowWelcomePosts, accountSettings.allowComments, accountSettings.displayName]);

  function readMedia(file) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) { setNotice("Choose a picture or video file."); return; }
    if (file.size > 1024 * 1024) { setNotice("This device preview accepts media up to 1 MB. Larger uploads need the connected storage service."); return; }
    const weekStart = startOfWeek();
    const used = posts.filter((post) => post.media && new Date(post.createdAt || `${post.date}T12:00:00`) >= weekStart).length;
    const limit = accountSettings.plan === "free" ? Number(accountSettings.mediaUploadsPerWeek || 2) : Infinity;
    if (used >= limit) { setNotice(`The free media allowance is ${limit} uploads this week. Text posts still work.`); return; }
    const reader = new FileReader();
    reader.onload = () => { setMedia(String(reader.result || "")); setMediaType(file.type.startsWith("video/") ? "video" : "image"); setNotice(""); };
    reader.onerror = () => setNotice("That media file could not be read. Try another file or publish a text update.");
    reader.readAsDataURL(file);
  }

  function publish(event) {
    event.preventDefault();
    if (!body.trim() && !media) return;
    const now = new Date();
    const newPost = {
      id: messageId("post"),
      date: localCalendarDate(now),
      localTime: now.toTimeString().slice(0, 5),
      timeLabel: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now),
      createdAt: now.toISOString(),
      body: body.trim() || "Shared a new study moment.",
      media,
      mediaType,
      audience,
      author: { name: accountSettings.displayName || persona.name, image: persona.image, role: persona.accountType },
      reactions: { types: STORY_REACTION_TYPES.map((reaction, index) => ({ ...reaction, count: index === 0 ? 1 : 0 })), total: 1 },
      commentsAllowed: accountSettings.allowComments !== false,
    };
    const next = [newPost, ...posts];
    setPosts(next);
    const saved = saveSocial(`${baseKey}-posts`, next);
    if (body.trim()) setStatusLine(body.trim().slice(0, 120));
    setBody("");
    setMedia("");
    setMediaType("");
    setNotice(saved ? "Post published to this device feed." : "Post is visible for this session, but device storage is full. Connect storage before uploading larger media.");
  }

  function react(post, reactionId) {
    const next = { ...selectedReactions, [post.id]: selectedReactions[post.id] === reactionId ? null : reactionId };
    setSelectedReactions(next);
    saveSocial(`${baseKey}-reactions`, next);
  }

  function toggleSaved(postId) {
    const next = savedPosts.includes(postId) ? savedPosts.filter((id) => id !== postId) : [...savedPosts, postId];
    setSavedPosts(next);
    saveSocial(`${baseKey}-saved`, next);
  }

  function addComment(post) {
    const value = (commentDrafts[post.id] || "").trim();
    if (!value || accountSettings.allowComments === false || post.commentsAllowed === false) return;
    const existing = comments[post.id] || [];
    const userComment = { id: messageId("comment"), author: accountSettings.displayName || persona.shortName, body: value, timeLabel: "Now" };
    const reply = createStoryReply({ persona: persona.id, message: value, postId: post.id, replyNumber: existing.length, now: new Date() });
    const next = { ...comments, [post.id]: [...existing, userComment, { ...reply, author: reply.author.name }] };
    setComments(next);
    saveSocial(`${baseKey}-comments`, next);
    setCommentDrafts({ ...commentDrafts, [post.id]: "" });
  }

  function toggleFollow(personId) {
    const next = following.includes(personId) ? following.filter((id) => id !== personId) : [...following, personId];
    setFollowing(next);
    saveSocial(`${baseKey}-following`, next);
  }

  function removeFollower(person) {
    if (removedFollowers.includes(person.id)) return;
    const next = [...removedFollowers, person.id];
    setRemovedFollowers(next);
    saveSocial(`${baseKey}-removed-followers`, next);
    setNotice(`${person.name} was removed from your followers without a notification.`);
  }

  function sendDirectMessage(event) {
    event.preventDefault();
    if (!selectedPerson || !messageDraft.trim()) return;
    const key = `${baseKey}-messages`;
    const current = readSessionSocial(key, []);
    saveSessionSocial(key, [{ id: messageId("dm"), to: selectedPerson.name, body: messageDraft.trim(), createdAt: new Date().toISOString() }, ...current]);
    setMessageDraft("");
    setNotice(`Message saved for ${selectedPerson.shortName || selectedPerson.name}.`);
  }

  const filteredPeople = people.filter((person) => {
    if (peopleFilter === "online" && !person.online) return false;
    if (peopleFilter === "following" && !following.includes(person.id)) return false;
    return !query || `${person.name} ${person.role}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="social-hub">
      <section className="paper-card social-hub-header"><div><NotebookLabel>{persona.id === "professor" ? "FACULTY & SCHOOL COMMUNITY" : persona.id === "k12" ? "SCHOOL COMMUNITY" : "CAMPUS COMMUNITY"}</NotebookLabel><h1>People, classes, and progress.</h1><p>Browse the weekly story feed, find people, open a profile, or send a message without leaving this page.</p></div><div className="segmented-control"><button type="button" className={view === "feed" ? "is-active" : ""} onClick={() => setView("feed")}>Feed</button><button type="button" className={view === "people" ? "is-active" : ""} onClick={() => setView("people")}>Friends & followers</button></div></section>
      {view === "feed" ? <div className="social-layout">
        <main className="paper-card social-feed-card">
          <form className="status-compose" onSubmit={publish}><div className="compose-person"><img src={persona.image} alt="" /><div><strong>Share an update</strong><span>{statusLine}</span></div></div><textarea rows={3} spellCheck value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share class progress, a question, a project, or a study win…" />{media && <div className="image-preview">{mediaType === "video" ? <video src={media} controls /> : <img src={media} alt="Selected upload preview" />}<button type="button" onClick={() => { setMedia(""); setMediaType(""); }}>Remove</button></div>}<footer><label className="upload-button">Add picture or video<input type="file" accept="image/*,video/*" onChange={(event) => readMedia(event.target.files?.[0])} /></label><select value={audience} onChange={(event) => setAudience(event.target.value)}>{rules.availableAudiences.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><button type="submit">Post update</button></footer></form>
          <div className="feed-filter-bar"><select value={feedAudience} onChange={(event) => setFeedAudience(event.target.value)}><option value="all">All feed</option>{rules.feedTabs.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search posts or people" /><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Any month</option>{months.map((item) => <option key={item}>{item}</option>)}</select><select value={weekday} onChange={(event) => setWeekday(event.target.value)}><option value="">Any day</option>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <option key={day}>{day}</option>)}</select><input type="number" min="1" max="50" value={week} onChange={(event) => setWeek(event.target.value)} placeholder="Week" aria-label="Story week" /></div>
          <div className="social-post-list">{combinedPosts.map((post) => {
            const author = post.author || STORY_GUIDES[persona.id];
            const postComments = comments[post.id] || [];
            return <article key={post.id}><header>{author.image ? <img src={author.image} alt="" /> : <span className="social-initial-avatar">{author.name?.slice(0, 1)}</span>}<div><strong>{author.name}</strong><span>{displayPostDate(post)} · {post.timeLabel || ""} · {post.audience}</span></div>{post.personaId && <VerifiedBadge label="Guide" small />}</header>{(post.media || post.image) && (post.mediaType === "video" ? <video className="post-uploaded-image" src={post.media} controls /> : <img className="post-uploaded-image" src={post.media || post.image} alt="Shared post media" />)}<p>{post.body}</p>{post.snapshot && <div className="story-snapshot-strip"><span><strong>{post.snapshot.points}</strong> points</span>{post.snapshot.gradeAverage != null && <span><strong>{post.snapshot.gradeAverage}%</strong> average</span>}<span><strong>{post.snapshot.progressPercent}%</strong> progress</span></div>}<footer className="education-reaction-bar">{STORY_REACTION_TYPES.map((reaction) => { const original = post.reactions?.types?.find((item) => item.id === reaction.id)?.count || 0; const selected = selectedReactions[post.id] === reaction.id; return <button type="button" className={selected ? "is-selected" : ""} key={reaction.id} onClick={() => react(post, reaction.id)}>{reaction.symbol} {reaction.label} · {original + (selected ? 1 : 0)}</button>; })}<button type="button" onClick={() => toggleSaved(post.id)}>{savedPosts.includes(post.id) ? "Saved" : "Save"}</button></footer>{postComments.length > 0 && <div className="post-comment-list">{postComments.map((comment) => <div key={comment.id}><strong>{typeof comment.author === "string" ? comment.author : comment.author?.name}</strong><span>{comment.body}</span></div>)}</div>}{accountSettings.allowComments !== false && post.commentsAllowed !== false && <form className="post-comment-form" onSubmit={(event) => { event.preventDefault(); addComment(post); }}><input value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts({ ...commentDrafts, [post.id]: event.target.value })} placeholder="Write a comment" /><button type="submit">Reply</button></form>}</article>;
          })}{combinedPosts.length === 0 && <div className="empty-social-feed"><strong>No posts match those filters.</strong><span>Clear a month, day, week, or search term.</span></div>}</div>
        </main>
        <aside className="social-side-stack"><article className="paper-card first-follower-card"><NotebookLabel>FIRST FOLLOWER</NotebookLabel><img src={getDefaultConnection(persona.id).image} alt="" /><h2>{getDefaultConnection(persona.id).name}</h2><p>{getDefaultConnection(persona.id).shortName} follows every new {persona.accountType.toLowerCase()} account and keeps the weekly feed moving.</p><button type="button" onClick={() => { setView("people"); setSelectedPerson(people[0]); }}>Open profile</button></article><article className="paper-card"><NotebookLabel>MEDIA THIS WEEK</NotebookLabel><h2>{posts.filter((post) => post.media && new Date(post.createdAt) >= startOfWeek()).length} / {accountSettings.mediaUploadsPerWeek || 2}</h2><p>Text updates are available without a media upload. Expanded storage is coming later.</p></article></aside>
      </div> : <div className="people-directory-layout">
        <section className="paper-card people-directory"><div className="people-directory-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students or professors" /><div className="segmented-control"><button type="button" className={peopleFilter === "all" ? "is-active" : ""} onClick={() => setPeopleFilter("all")}>All</button><button type="button" className={peopleFilter === "online" ? "is-active" : ""} onClick={() => setPeopleFilter("online")}>Online</button><button type="button" className={peopleFilter === "following" ? "is-active" : ""} onClick={() => setPeopleFilter("following")}>Following</button></div></div><div className="people-card-grid">{filteredPeople.map((person) => <button type="button" key={person.id} className={selectedPerson?.id === person.id ? "is-active" : ""} onClick={() => setSelectedPerson(person)}>{person.image ? <img src={person.image} alt="" /> : <span>{person.name.slice(0, 1)}</span>}<strong>{person.name}</strong><small>{person.role}</small><OnlineBadge value={person.online ? "online" : "offline"} /></button>)}</div></section>
        <aside className="paper-card person-profile-popout">{selectedPerson ? <><div className="person-profile-hero">{selectedPerson.image ? <img src={selectedPerson.image} alt="" /> : <span>{selectedPerson.name.slice(0, 1)}</span>}<div><NotebookLabel>{selectedPerson.role}</NotebookLabel><h2>{selectedPerson.name}</h2><p>{selectedPerson.preview}</p></div></div><div className="person-profile-actions"><button type="button" onClick={() => toggleFollow(selectedPerson.id)}>{following.includes(selectedPerson.id) ? "Following" : `Follow ${selectedPerson.shortName || selectedPerson.name.split(" ")[0]}`}</button><button type="button" disabled={removedFollowers.includes(selectedPerson.id)} onClick={() => removeFollower(selectedPerson)}>{removedFollowers.includes(selectedPerson.id) ? "Follower removed" : "Remove follower quietly"}</button></div><form className="person-message-form" onSubmit={sendDirectMessage}><label>Message {selectedPerson.shortName || selectedPerson.name}<textarea rows={4} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} /></label><button type="submit">Send inside EdNotebook</button></form></> : <div className="empty-person-profile"><strong>Choose a person.</strong><p>Open a profile to follow, manage the connection, or send a message.</p></div>}</aside>
      </div>}
      {notice && <p className="social-hub-notice" role="status">{notice}</p>}
    </div>
  );
}

function ExpandableCard({ label, title, children, open = false, className = "" }) {
  return <details className={`paper-card profile-expandable ${className}`} open={open}><summary><div><NotebookLabel>{label}</NotebookLabel><h2>{title}</h2></div><span aria-hidden="true">＋</span></summary><div className="profile-expandable-body">{children}</div></details>;
}

function ProfilePanel({ persona, features, onlineStatus, statusLine, accountSettings = {} }) {
  const guide = getDefaultConnection(persona.id);
  const followingKey = `ed-demo-${persona.id}-social-following`;
  const guideId = `guide-${persona.id}`;
  const [following, setFollowing] = useState(() => localSocialRead(followingKey, []).includes(guideId));
  function toggleGuide() { const current = localSocialRead(followingKey, []); const next = current.includes(guideId) ? current.filter((id) => id !== guideId) : [...current, guideId]; saveSocial(followingKey, next); setFollowing(next.includes(guideId)); }
  const profilePersona = { ...persona, name: accountSettings.displayName || persona.name, profile: { ...persona.profile, bio: accountSettings.bio || persona.profile.bio } };
  const details = [["Age", persona.profile.age], [persona.id === "professor" ? "Role" : "Major / goal", persona.profile.major], ["Hometown", persona.profile.hometown], ["Birthday", persona.profile.birthday]];
  const assignments = persona.assignments.slice(0, 4);
  const links = String(accountSettings.links || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return (
    <div className="workspace-panel-stack immersive-profile-page">
      {features.profile && <ProfileHeroCard persona={profilePersona} onlineStatus={accountSettings.showPresence === false ? "offline" : onlineStatus} statusLine={statusLine} />}
      <section className="paper-card profile-guide-connect"><img src={guide.image} alt="" /><div><NotebookLabel>{guide.role}</NotebookLabel><h2>{guide.name} is your first follower.</h2><p>Weekly posts, study ideas, course updates, and a friendly welcome appear in the matching community.</p></div><button type="button" className={following ? "is-following" : ""} onClick={toggleGuide}>{following ? `Following ${guide.shortName}` : `Follow ${guide.shortName}`}</button></section>
      <section className="profile-bento-grid">
        <ExpandableCard label="ABOUT" title={`Meet ${profilePersona.name.split(" ")[0]}`} open className="profile-bento-about">{accountSettings.showDescriptions !== false && <p>{profilePersona.profile.bio}</p>}<div className="profile-detail-list">{details.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>{links.length > 0 && <div className="profile-link-list">{links.map((link) => <a href={link} target="_blank" rel="noreferrer" key={link}>{link}</a>)}</div>}</ExpandableCard>
        {features.grades && <div className="profile-bento-stats"><StatsCard persona={persona} /></div>}
        <ExpandableCard label={persona.id === "professor" ? "COURSES" : "SEMESTER"} title={persona.id === "professor" ? "Teaching now" : "Classes and work"} open><div className="profile-assignment-list">{assignments.map((item) => <article key={item.id}><span>{item.course}</span><strong>{item.title}</strong><small>{statusLabel(item.status, persona.id === "professor")}</small></article>)}</div></ExpandableCard>
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
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [weekday, setWeekday] = useState("");
  const storyNow = useMinuteClock();
  const posts = useMemo(() => generateStoryFeed({ persona: persona.id, now: storyNow, filters: { query, month, weekday }, newestFirst: false }), [persona.id, storyNow, query, month, weekday]);
  const allVisible = useMemo(() => generateStoryFeed({ persona: persona.id, now: storyNow, newestFirst: true }), [persona.id, storyNow]);
  const current = getActiveWeeklyStory({ persona: persona.id, now: storyNow });
  const bible = getStoryBible(persona.id);
  const months = [...new Set(allVisible.map((post) => post.month))];
  return (
    <div className="story-page-layout">
      <aside className="paper-card story-person-card"><img src={persona.image} alt={`${persona.name} portrait`} /><NotebookLabel>{persona.id === "professor" ? "TEACHING STORY" : "STORY SO FAR"}</NotebookLabel><h1>{persona.name}</h1><p>{bible.premise}</p><div className="story-mini-stats"><span><strong>{allVisible.length}</strong> weekly updates</span><span><strong>50</strong> planned weeks</span><span><strong>{current?.snapshot.points || 0}</strong> points</span></div></aside>
      <main className="paper-card story-timeline-card"><div className="dashboard-card-heading"><div><NotebookLabel>{persona.shortName.toUpperCase()}’S WEEKLY STORY</NotebookLabel><h2>New chapter every Sunday.</h2></div><span>{current ? `Week ${current.storyWeek} · ${current.chapter}` : "Story starts May 22"}</span></div><div className="story-filter-bar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the story" /><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">All months</option>{months.map((item) => <option key={item}>{item}</option>)}</select><select value={weekday} onChange={(event) => setWeekday(event.target.value)}><option value="">Any weekday</option>{["Friday", "Sunday"].map((item) => <option key={item}>{item}</option>)}</select></div><div className="story-timeline">{posts.map((post) => <article key={post.id}><time>{displayPostDate(post)}<small>{post.timeLabel}</small></time><div><span>{String(post.storyWeek).padStart(2, "0")}</span></div><section><strong>{post.chapter}</strong><p>{post.body}</p><div className="story-snapshot-strip"><span>{post.snapshot.points} points</span>{post.snapshot.gradeAverage != null && <span>{post.snapshot.gradeAverage}% average</span>}<span>{post.snapshot.progressPercent}% progress</span></div><small>📖 {post.reactions.total} · {post.audience}</small></section></article>)}</div></main>
      <aside className="story-side-stack"><article className="paper-card"><NotebookLabel>CURRENT WEEK</NotebookLabel><h2>{current?.chapter || "Getting ready"}</h2><p>{current?.chapterFocus || bible.premise}</p>{current && <ul><li>+{current.snapshot.pointsDelta} points</li><li>+{current.snapshot.progressDelta}% progress</li>{current.snapshot.studyStreakDays && <li>{current.snapshot.studyStreakDays}-day streak</li>}{current.snapshot.feedbackCompleted && <li>{current.snapshot.feedbackCompleted} feedback items</li>}</ul>}</article><article className="paper-card story-next-card"><NotebookLabel>STORY BIBLE</NotebookLabel><h2>Ten connected chapters.</h2><ul>{bible.chapters.slice(0, 5).map((chapter) => <li key={chapter.number}>{chapter.title} · weeks {chapter.weeks}</li>)}</ul></article></aside>
    </div>
  );
}

export { ChatPanel, SocialPanel, ProfilePanel, StoryPanel };
