import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

export async function listAvailableCourses() {
  if (!isSupabaseConfigured) return { data: [], error: new Error("Cloud classes are not connected.") };
  const { data, error } = await supabase.from("courses")
    .select("id,course_code,title,education_division")
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

export async function listLiveRooms(courseIds = [], roomType) {
  if (!isSupabaseConfigured || !courseIds.length) return { data: [], error: null };
  let request = supabase.from("live_rooms")
    .select("id,course_id,created_by,room_type,title,status,starts_at,max_participants,allow_participant_screen_share,recording_policy")
    .in("course_id", courseIds)
    .in("status", ["scheduled", "live"])
    .order("starts_at", { ascending: true });
  if (roomType) request = request.eq("room_type", roomType);
  const { data, error } = await request;
  return { data: data || [], error };
}

export async function requestLiveRoomSession(payload) {
  if (!isSupabaseConfigured) throw new Error("Live rooms require a signed-in cloud account.");
  const { data, error } = await supabase.functions.invoke("live-room-session", { body: payload });
  if (error) throw new Error(error.message || "The live room service is unavailable.");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function saveScratchpad(roomId, content, userId, version = 1) {
  if (!isSupabaseConfigured || !roomId || !userId) return { error: new Error("Cloud sync is unavailable.") };
  return supabase.from("study_room_scratchpads").upsert({
    room_id: roomId,
    content: { text: String(content || "").slice(0, 200_000) },
    version,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "room_id" });
}

export async function loadScratchpad(roomId) {
  if (!isSupabaseConfigured || !roomId) return { data: null, error: null };
  return supabase.from("study_room_scratchpads").select("content,version,updated_at").eq("room_id", roomId).maybeSingle();
}
