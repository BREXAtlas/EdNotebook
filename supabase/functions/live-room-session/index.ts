import { AccessToken, TrackSource } from "npm:livekit-server-sdk@2.17.0";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  requirePost,
  requireUser,
} from "../_shared/runtime.ts";

type SessionRequest = {
  action: "create" | "join" | "leave";
  roomId?: string;
  courseId?: string;
  roomType?: "office_hours" | "study_room";
  title?: string;
  startsAt?: string | null;
  allowParticipantScreenShare?: boolean;
  recordingPolicy?: "off" | "host_opt_in" | "everyone_opt_in";
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, `${name} is not configured.`);
  return value;
}

function cleanTitle(value: unknown): string {
  const title = String(value || "").trim().slice(0, 120);
  if (!title) throw new HttpError(400, "A room title is required.");
  return title;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  try {
    requirePost(req);
    const { user, client } = await requireUser(req);
    const body = await parseJson<SessionRequest>(req, 20_000);

    if (body.action === "leave") {
      if (!body.roomId) throw new HttpError(400, "roomId is required.");
      const { error } = await client.from("live_room_participants").update({
        left_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }).eq("room_id", body.roomId).eq("user_id", user.id);
      if (error) throw new HttpError(403, "The room could not be left.");
      return jsonResponse(req, { left: true });
    }

    let roomId = body.roomId;
    if (body.action === "create") {
      if (!body.courseId) throw new HttpError(400, "courseId is required.");
      const roomType = body.roomType === "study_room" ? "study_room" : "office_hours";
      const providerRoomName = `edn-${body.courseId}-${crypto.randomUUID()}`;
      const { data, error } = await client.from("live_rooms").insert({
        course_id: body.courseId,
        created_by: user.id,
        room_type: roomType,
        title: cleanTitle(body.title),
        provider_room_name: providerRoomName,
        status: body.startsAt ? "scheduled" : "live",
        starts_at: body.startsAt || new Date().toISOString(),
        allow_participant_screen_share: roomType === "study_room" && body.allowParticipantScreenShare === true,
        recording_policy: body.recordingPolicy || "off",
      }).select("*").single();
      if (error || !data) throw new HttpError(403, "You cannot create a room for this class.", error?.message);
      roomId = data.id;
    }

    if (!roomId) throw new HttpError(400, "roomId is required.");
    const { data: room, error: roomError } = await client.from("live_rooms").select("*").eq("id", roomId).single();
    if (roomError || !room || ["ended", "cancelled"].includes(room.status)) {
      throw new HttpError(404, "This room is not available.");
    }

    const isHost = room.created_by === user.id;
    const { count } = await client.from("live_room_participants").select("user_id", { count: "exact", head: true })
      .eq("room_id", room.id).is("left_at", null);
    if (!isHost && Number(count || 0) >= room.max_participants) throw new HttpError(409, "This room is full.");

    const { error: participantError } = await client.from("live_room_participants").upsert({
      room_id: room.id,
      user_id: user.id,
      room_role: isHost ? "host" : "participant",
      joined_at: new Date().toISOString(),
      left_at: null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "room_id,user_id" });
    if (participantError) throw new HttpError(403, "You cannot join this class room.");

    const publishSources = [TrackSource.MICROPHONE];
    if (isHost || room.allow_participant_screen_share) {
      publishSources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
    }
    const accessToken = new AccessToken(requiredEnv("LIVEKIT_API_KEY"), requiredEnv("LIVEKIT_API_SECRET"), {
      identity: user.id,
      name: String(user.user_metadata?.full_name || user.email?.split("@")[0] || "EdNotebook member").slice(0, 80),
      ttl: "10m",
      metadata: JSON.stringify({ roomId: room.id, role: isHost ? "host" : "participant" }),
    });
    accessToken.addGrant({
      roomJoin: true,
      room: room.provider_room_name,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: publishSources,
    });

    return jsonResponse(req, {
      room,
      role: isHost ? "host" : "participant",
      token: await accessToken.toJwt(),
      serverUrl: requiredEnv("LIVEKIT_URL"),
      mediaPolicy: { camera: false, microphone: true, screenShare: isHost || room.allow_participant_screen_share },
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
