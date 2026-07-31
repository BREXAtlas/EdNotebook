import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

const emptyFeed = { profile: null, profiles: [], posts: [], source: "device" };

function cleanUrl(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function cleanText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

export async function ensureCampusSocialProfile({
  userId,
  displayName,
  avatarUrl = "",
  bio = "",
  visibility = "campus",
  discoverable = true,
}) {
  if (!isSupabaseConfigured || !userId) return { data: null, source: "device" };
  return supabase
    .from("campus_social_profiles")
    .upsert({
      user_id: userId,
      account_type: "student",
      education_division: "university",
      institution_name: "Independent",
      display_name: cleanText(displayName || "EdNotebook member", 120),
      avatar_url: cleanUrl(avatarUrl),
      bio: cleanText(bio, 500),
      visibility: ["private", "campus", "public_university"].includes(visibility) ? visibility : "campus",
      discoverable: Boolean(discoverable),
    }, { onConflict: "user_id" })
    .select()
    .single();
}

export async function loadCampusSocialFeed({ userId, audience = "public_university", limit = 30 }) {
  if (!isSupabaseConfigured || !userId) return emptyFeed;

  const profileResult = await supabase
    .from("campus_social_profiles")
    .select("user_id,account_type,education_division,institution_id,institution_name,display_name,avatar_url,bio,visibility,discoverable")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileResult.error) return { ...emptyFeed, error: profileResult.error };

  let postQuery = supabase
    .from("campus_social_posts")
    .select("id,author_id,education_division,institution_id,audience,body,media_url,media_kind,comments_enabled,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (audience === "private") postQuery = postQuery.eq("author_id", userId).eq("audience", "private");
  if (audience === "institution") postQuery = postQuery.eq("audience", "institution");
  if (audience === "public_university") postQuery = postQuery.eq("audience", "public_university");
  const postResult = await postQuery;
  if (postResult.error) return { ...emptyFeed, profile: profileResult.data, error: postResult.error };

  const posts = postResult.data || [];
  const postIds = posts.map((post) => post.id);
  const authorIds = [...new Set(posts.map((post) => post.author_id))];

  const [profileListResult, commentsResult, reactionsResult, followsResult] = await Promise.all([
    authorIds.length
      ? supabase
          .from("campus_social_profiles")
          .select("user_id,account_type,education_division,institution_id,institution_name,display_name,avatar_url,bio,visibility,discoverable")
          .in("user_id", authorIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase
          .from("campus_social_comments")
          .select("id,post_id,author_id,body,created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase
          .from("campus_social_reactions")
          .select("post_id,user_id,reaction_type")
          .in("post_id", postIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("campus_social_follows")
      .select("followed_id")
      .eq("follower_id", userId),
  ]);

  const comments = commentsResult.data || [];
  const commentAuthorIds = comments.map((comment) => comment.author_id);
  const missingCommentAuthorIds = [...new Set(commentAuthorIds.filter((id) => !authorIds.includes(id)))];
  const commentProfilesResult = missingCommentAuthorIds.length
    ? await supabase
        .from("campus_social_profiles")
        .select("user_id,account_type,education_division,institution_id,institution_name,display_name,avatar_url,bio,visibility,discoverable")
        .in("user_id", missingCommentAuthorIds)
    : { data: [], error: null };
  const profiles = [...(profileListResult.data || []), ...(commentProfilesResult.data || [])];
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const reactions = reactionsResult.data || [];
  const following = new Set((followsResult.data || []).map((follow) => follow.followed_id));

  return {
    profile: profileResult.data,
    profiles,
    posts: posts.map((post) => {
      const postReactions = reactions.filter((reaction) => reaction.post_id === post.id);
      return {
        ...post,
        author: profileMap.get(post.author_id) || null,
        comments: comments
          .filter((comment) => comment.post_id === post.id)
          .map((comment) => ({ ...comment, author: profileMap.get(comment.author_id) || null })),
        reactionCount: postReactions.length,
        myReaction: postReactions.find((reaction) => reaction.user_id === userId)?.reaction_type || null,
        followingAuthor: following.has(post.author_id),
      };
    }),
    source: "cloud",
    error: profileListResult.error || commentsResult.error || reactionsResult.error || followsResult.error || commentProfilesResult.error || null,
  };
}

export async function createCampusSocialPost({ userId, audience, body, mediaUrl = "", mediaKind = null }) {
  return supabase
    .from("campus_social_posts")
    .insert({
      author_id: userId,
      education_division: "university",
      audience,
      body: cleanText(body, 4000),
      media_url: cleanUrl(mediaUrl),
      media_kind: mediaKind || (cleanUrl(mediaUrl) ? "image" : null),
    })
    .select()
    .single();
}

export async function addCampusSocialComment({ postId, userId, body }) {
  return supabase
    .from("campus_social_comments")
    .insert({ post_id: postId, author_id: userId, body: cleanText(body, 1200) })
    .select()
    .single();
}

export async function setCampusSocialReaction({ postId, userId, reactionType, active }) {
  if (!active) {
    return supabase
      .from("campus_social_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
  }
  return supabase
    .from("campus_social_reactions")
    .upsert(
      { post_id: postId, user_id: userId, reaction_type: reactionType },
      { onConflict: "post_id,user_id" }
    );
}

export async function setCampusSocialFollow({ userId, followedId, active }) {
  if (!active) {
    return supabase
      .from("campus_social_follows")
      .delete()
      .eq("follower_id", userId)
      .eq("followed_id", followedId);
  }
  return supabase
    .from("campus_social_follows")
    .insert({ follower_id: userId, followed_id: followedId });
}
