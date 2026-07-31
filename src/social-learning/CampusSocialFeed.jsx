import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addCampusSocialComment,
  createCampusSocialPost,
  ensureCampusSocialProfile,
  loadCampusSocialFeed,
  setCampusSocialFollow,
  setCampusSocialReaction,
} from "./campusSocialService.js";

const REACTIONS = [
  ["support", "♡", "Support"],
  ["insightful", "✦", "Insightful"],
  ["celebrate", "👏", "Celebrate"],
];

function Avatar({ profile, large = false }) {
  const initial = (profile?.display_name || "E").trim().slice(0, 1).toUpperCase();
  if (profile?.avatar_url) {
    return <img className={large ? "campus-avatar is-large" : "campus-avatar"} src={profile.avatar_url} alt="" />;
  }
  return <span className={large ? "campus-avatar is-large is-fallback" : "campus-avatar is-fallback"} aria-hidden="true">{initial}</span>;
}

function formatMoment(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function CampusSocialFeed({
  session,
  role = "student",
  educationDivision = "university",
  displayName = "",
  onOpenMessages,
}) {
  const userId = session?.user?.id;
  const university = educationDivision !== "k12";
  const scopes = useMemo(() => university
    ? [
        ["public_university", "All universities"],
        ["institution", "My campus"],
        ["private", "Private page"],
      ]
    : [
        ["institution", "My school"],
        ["private", "Private page"],
      ], [university]);
  const [scope, setScope] = useState(scopes[0][0]);
  const [feed, setFeed] = useState({ profile: null, profiles: [], posts: [] });
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    displayName,
    avatarUrl: "",
    bio: "",
    visibility: university ? "public_university" : "campus",
    discoverable: true,
  });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!userId) return;
    setError("");
    const result = await loadCampusSocialFeed({ userId, audience: scope });
    if (result.error) {
      setError(result.error.message || "The campus feed could not be loaded.");
      return;
    }
    setFeed(result);
    if (result.profile) {
      setProfileDraft({
        displayName: result.profile.display_name || displayName,
        avatarUrl: result.profile.avatar_url || "",
        bio: result.profile.bio || "",
        visibility: result.profile.visibility || (university ? "public_university" : "campus"),
        discoverable: result.profile.discoverable !== false,
      });
    }
  }, [displayName, scope, university, userId]);

  useEffect(() => {
    let active = true;
    async function connect() {
      if (!userId) return;
      setBusy("connect");
      setProfileReady(false);
      const profileResult = await ensureCampusSocialProfile({
        userId,
        displayName: displayName || session?.user?.email?.split("@")[0] || "EdNotebook member",
        visibility: university ? "public_university" : "campus",
      });
      if (!active) return;
      if (profileResult.error) {
        setError(profileResult.error.message || "The campus social profile could not be connected.");
        setBusy("");
        return;
      }
      setProfileReady(true);
    }
    connect();
    return () => { active = false; };
  }, [displayName, session?.user?.email, university, userId]);

  useEffect(() => {
    if (!profileReady) return undefined;
    let active = true;
    setBusy("connect");
    refresh().finally(() => { if (active) setBusy(""); });
    return () => { active = false; };
  }, [profileReady, refresh]);

  async function publish(event) {
    event.preventDefault();
    if (!body.trim() || !userId) return;
    setBusy("post");
    setError("");
    const result = await createCampusSocialPost({
      userId,
      audience: scope,
      body,
      mediaUrl,
      mediaKind: mediaUrl ? "image" : null,
    });
    if (result.error) setError(result.error.message);
    else {
      setBody("");
      setMediaUrl("");
      setNotice(scope === "private" ? "Saved to your private page." : "Your post is live in the selected education feed.");
      await refresh();
    }
    setBusy("");
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!userId) return;
    setBusy("profile");
    setError("");
    const result = await ensureCampusSocialProfile({
      userId,
      displayName: profileDraft.displayName,
      avatarUrl: profileDraft.avatarUrl,
      bio: profileDraft.bio,
      visibility: profileDraft.visibility,
      discoverable: profileDraft.discoverable,
    });
    if (result.error) setError(result.error.message);
    else {
      setNotice("Social profile saved.");
      setProfileOpen(false);
      await refresh();
    }
    setBusy("");
  }

  async function react(post) {
    if (!userId) return;
    const active = post.myReaction !== "support";
    const result = await setCampusSocialReaction({ postId: post.id, userId, reactionType: "support", active });
    if (result.error) setError(result.error.message);
    else await refresh();
  }

  async function comment(event, post) {
    event.preventDefault();
    const commentBody = commentDrafts[post.id]?.trim();
    if (!commentBody || !userId) return;
    setBusy(`comment:${post.id}`);
    const result = await addCampusSocialComment({ postId: post.id, userId, body: commentBody });
    if (result.error) setError(result.error.message);
    else {
      setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
      await refresh();
    }
    setBusy("");
  }

  async function follow(post) {
    if (!userId || post.author_id === userId) return;
    const result = await setCampusSocialFollow({
      userId,
      followedId: post.author_id,
      active: !post.followingAuthor,
    });
    if (result.error) setError(result.error.message);
    else await refresh();
  }

  const storyProfiles = useMemo(() => {
    const unique = new Map();
    if (feed.profile) unique.set(feed.profile.user_id, feed.profile);
    feed.profiles.forEach((profile) => unique.set(profile.user_id, profile));
    return [...unique.values()].slice(0, 10);
  }, [feed.profile, feed.profiles]);

  if (!userId) {
    return <section className="dashboard-card empty-dashboard-card"><span className="portal-kicker">CAMPUS SOCIAL</span><h1>Sign in to open your education feed.</h1></section>;
  }

  return (
    <div className="campus-social-page">
      <header className="dashboard-card campus-social-heading">
        <div>
          <span className="portal-kicker">{university ? "SOCIAL EDUCATION LEARNING" : "SCHOOL COMMUNITY"}</span>
          <h1>Learn in public. Keep private work private.</h1>
          <p>Students and professors share the same education community. Course messages and protected feedback stay in their governed class rooms.</p>
        </div>
        <div className="campus-social-heading-actions">
          <button type="button" onClick={() => setProfileOpen((value) => !value)}>Edit profile</button>
          <button type="button" onClick={onOpenMessages}>Course messages</button>
        </div>
      </header>

      <nav className="campus-social-scope" aria-label="Social feed">
        {scopes.map(([id, label]) => <button type="button" className={scope === id ? "is-active" : ""} key={id} onClick={() => setScope(id)}>{label}</button>)}
      </nav>

      {error && <div className="portal-form-error" role="alert">{error}</div>}
      {notice && <div className="portal-form-notice" role="status">{notice}</div>}

      {profileOpen && (
        <form className="dashboard-card campus-profile-editor" onSubmit={saveProfile}>
          <div className="dashboard-card-heading"><div><span className="portal-kicker">YOUR PROFILE</span><h2>Choose how you appear.</h2></div><Avatar profile={{ ...feed.profile, avatar_url: profileDraft.avatarUrl, display_name: profileDraft.displayName }} large /></div>
          <div className="interest-field-grid">
            <label>Display name<input required maxLength={120} value={profileDraft.displayName} onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })} /></label>
            <label>Profile picture URL<input type="url" value={profileDraft.avatarUrl} onChange={(event) => setProfileDraft({ ...profileDraft, avatarUrl: event.target.value })} placeholder="https://…" /></label>
            <label>Profile visibility<select value={profileDraft.visibility} onChange={(event) => setProfileDraft({ ...profileDraft, visibility: event.target.value })}><option value="private">Private</option><option value="campus">{university ? "My campus" : "My school"}</option>{university && <option value="public_university">University community</option>}</select></label>
            <label className="campus-discoverable"><input type="checkbox" checked={profileDraft.discoverable} onChange={(event) => setProfileDraft({ ...profileDraft, discoverable: event.target.checked })} />Allow people in this audience to find me</label>
          </div>
          <label>Short bio<textarea rows={3} maxLength={500} value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} /></label>
          <button type="submit" disabled={busy === "profile"}>{busy === "profile" ? "Saving…" : "Save social profile"}</button>
        </form>
      )}

      <section className="dashboard-card campus-story-rail" aria-label="People in this feed">
        {storyProfiles.map((person) => <article key={person.user_id}><div><Avatar profile={person} large /></div><strong>{person.display_name.split(" ")[0]}</strong><span>{person.account_type}</span></article>)}
        {!storyProfiles.length && <p>Profile circles will appear as students and professors join this feed.</p>}
      </section>

      <div className="campus-social-layout">
        <main>
          <form className="dashboard-card campus-social-composer" onSubmit={publish}>
            <div><Avatar profile={feed.profile || { display_name: displayName }} /><label><span className="sr-only">Social post</span><textarea rows={3} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} placeholder={role === "professor" ? "Share a teaching idea, class milestone, or campus question…" : "Share a study idea, useful source, question, or milestone…"} /></label></div>
            <div className="campus-composer-tools">
              <label>Picture URL<input type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Optional https://…" /></label>
              <span>{scope === "public_university" ? "All signed-in universities" : scope === "institution" ? (university ? "Your campus" : "Your school") : "Only you"}</span>
              <button type="submit" disabled={busy === "post" || !body.trim()}>{busy === "post" ? "Posting…" : scope === "private" ? "Save privately" : "Share post"}</button>
            </div>
          </form>

          <div className="campus-post-list">
            {feed.posts.map((post) => (
              <article className="dashboard-card campus-post" key={post.id}>
                <header>
                  <Avatar profile={post.author} />
                  <div><strong>{post.author?.display_name || "EdNotebook member"}</strong><span>{post.author?.account_type || "member"} · {post.author?.institution_name || "Independent"} · {formatMoment(post.created_at)}</span></div>
                  {post.author_id !== userId && <button type="button" onClick={() => follow(post)}>{post.followingAuthor ? "Following" : "Follow"}</button>}
                </header>
                <p>{post.body}</p>
                {post.media_url && <img className="campus-post-media" src={post.media_url} alt="Shared with this education post" />}
                <footer>
                  <button type="button" className={post.myReaction ? "is-active" : ""} onClick={() => react(post)}>♡ {post.reactionCount}</button>
                  <span>{post.comments.length} comment{post.comments.length === 1 ? "" : "s"}</span>
                  <span>{post.audience === "public_university" ? "All universities" : post.audience === "institution" ? "Campus" : "Private"}</span>
                </footer>
                {post.comments_enabled && (
                  <div className="campus-comments">
                    {post.comments.map((item) => <div key={item.id}><Avatar profile={item.author} /><p><strong>{item.author?.display_name || "Member"}</strong> {item.body}</p></div>)}
                    <form onSubmit={(event) => comment(event, post)}>
                      <input aria-label={`Comment on ${post.author?.display_name || "post"}`} value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Add a respectful comment…" />
                      <button type="submit" disabled={busy === `comment:${post.id}` || !commentDrafts[post.id]?.trim()}>Post</button>
                    </form>
                  </div>
                )}
              </article>
            ))}
            {!feed.posts.length && busy !== "connect" && <section className="dashboard-card campus-feed-empty"><strong>This feed is ready for its first post.</strong><p>Choose the audience above, then share a learning update or save a private reflection.</p></section>}
            {busy === "connect" && <section className="dashboard-card campus-feed-empty" role="status">Connecting your governed campus feed…</section>}
          </div>
        </main>

        <aside className="campus-social-sidebar">
          <section className="dashboard-card">
            <Avatar profile={feed.profile || { display_name: displayName }} large />
            <h2>{feed.profile?.display_name || displayName || "Your profile"}</h2>
            <span>{feed.profile?.account_type || role} · {feed.profile?.institution_name || "Independent"}</span>
            <p>{feed.profile?.bio || "Add a short bio so classmates and educators know what you are learning or teaching."}</p>
            <button type="button" onClick={() => setProfileOpen(true)}>Complete profile</button>
          </section>
          <section className="dashboard-card campus-social-boundary">
            <span className="portal-kicker">CLEAR BOUNDARIES</span>
            <h2>Social is not the gradebook.</h2>
            <ul><li>No grades or private feedback appear here.</li><li>Direct class communication stays in Course messages.</li><li>K–12 and university feeds never mix.</li></ul>
            <button type="button" onClick={onOpenMessages}>Open course messages</button>
          </section>
          <section className="dashboard-card campus-reaction-key"><h2>Learning reactions</h2>{REACTIONS.map(([id, symbol, label]) => <div key={id}><span>{symbol}</span><strong>{label}</strong></div>)}</section>
        </aside>
      </div>
    </div>
  );
}
