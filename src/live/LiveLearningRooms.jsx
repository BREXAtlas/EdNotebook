import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { listAvailableCourses, listLiveRooms, loadScratchpad, requestLiveRoomSession, saveScratchpad } from "./liveRoomService.js";
import "./live-learning-rooms.css";

const LIVE_ROOMS_ENABLED = String(import.meta.env.VITE_LIVE_ROOMS_ENABLED || "").toLowerCase() === "true";

function formatStart(value) {
  if (!value) return "Start now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Scheduled" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function MediaRoom({ sessionData, userId, onLeave }) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true }));
  const [connection, setConnection] = useState(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState([]);
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [scratchpad, setScratchpad] = useState("");
  const [scratchVersion, setScratchVersion] = useState(1);
  const mediaRef = useRef(null);
  const isStudyRoom = sessionData.room.room_type === "study_room";

  useEffect(() => {
    let active = true;
    const updateParticipants = () => {
      if (!active) return;
      setParticipants([room.localParticipant, ...room.remoteParticipants.values()].filter(Boolean));
      setConnection(room.state);
    };
    const attachTrack = (track) => {
      if (!active || !mediaRef.current) return;
      const element = track.attach();
      element.dataset.livekitTrack = track.sid || "remote";
      element.controls = false;
      if (track.kind === Track.Kind.Audio) element.hidden = true;
      mediaRef.current.appendChild(element);
    };
    const detachTrack = (track) => track.detach().forEach((element) => element.remove());
    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.ConnectionStateChanged, updateParticipants);
    room.on(RoomEvent.TrackSubscribed, attachTrack);
    room.on(RoomEvent.TrackUnsubscribed, detachTrack);
    const attachLocalTrack = (publication) => { if (publication?.track?.source === Track.Source.ScreenShare) attachTrack(publication.track); updateParticipants(); };
    const detachLocalTrack = (publication) => { if (publication?.track) detachTrack(publication.track); updateParticipants(); };
    room.on(RoomEvent.LocalTrackPublished, attachLocalTrack);
    room.on(RoomEvent.LocalTrackUnpublished, detachLocalTrack);
    (async () => {
      try {
        await room.connect(sessionData.serverUrl, sessionData.token, { autoSubscribe: true });
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setMicrophoneEnabled(true);
        updateParticipants();
      } catch (connectError) {
        setError(connectError.message || "The room could not connect.");
      }
    })();
    return () => {
      active = false;
      room.disconnect();
      room.removeAllListeners();
    };
  }, [room, sessionData]);

  useEffect(() => {
    if (!isStudyRoom) return;
    loadScratchpad(sessionData.room.id).then(({ data }) => {
      if (!data) return;
      setScratchpad(data.content?.text || "");
      setScratchVersion(Number(data.version || 1));
    });
  }, [isStudyRoom, sessionData.room.id]);

  async function toggleMute() {
    try {
      await room.localParticipant.setMicrophoneEnabled(muted);
      setMuted(!muted);
    } catch (mediaError) { setError(mediaError.message); }
  }

  async function toggleShare() {
    if (!sessionData.mediaPolicy.screenShare) return;
    try {
      await room.localParticipant.setScreenShareEnabled(!sharing, { audio: false });
      setSharing(!sharing);
    } catch (mediaError) { setError(mediaError.message || "Screen sharing was not started."); }
  }

  async function leave() {
    try { await requestLiveRoomSession({ action: "leave", roomId: sessionData.room.id }); } catch { /* disconnect still wins */ }
    room.disconnect();
    onLeave();
  }

  async function syncScratchpad() {
    const nextVersion = scratchVersion + 1;
    const { error: saveError } = await saveScratchpad(sessionData.room.id, scratchpad, userId, nextVersion);
    if (saveError) setError("The scratchpad could not sync. Your text remains on this screen.");
    else setScratchVersion(nextVersion);
  }

  return <section className="live-learning-room" aria-label={sessionData.room.title}>
    <header><div><span>{isStudyRoom ? "STUDY ROOM" : "LIVE OFFICE HOURS"}</span><h2>{sessionData.room.title}</h2><p>{connection === ConnectionState.Connected ? "Connected" : "Connecting…"} · audio only · camera off</p></div><button type="button" onClick={leave}>Leave room</button></header>
    <div className="live-room-stage">
      <main><div className="screen-share-stage" ref={mediaRef}><div><strong>{sharing ? "You are sharing your screen." : "Shared material appears here."}</strong><span>No webcam video is used in EdNotebook rooms.</span></div></div>{isStudyRoom && <label className="room-scratchpad">Shared scratchpad<textarea spellCheck="true" rows={9} value={scratchpad} onChange={(event) => setScratchpad(event.target.value)} onBlur={syncScratchpad} /><small>Version {scratchVersion} · syncs when you leave the field</small></label>}</main>
      <aside><span>PEOPLE · {participants.length}</span>{participants.map((person) => <article key={person.identity}><i className={person.isSpeaking ? "is-speaking" : ""}>{(person.name || person.identity || "?").slice(0, 1).toUpperCase()}</i><div><strong>{person.name || (person.isLocal ? "You" : "Class member")}</strong><small>{person.isLocal ? sessionData.role : person.isSpeaking ? "Speaking" : "Listening"}</small></div></article>)}</aside>
    </div>
    <footer><button type="button" className={muted ? "is-muted" : ""} onClick={toggleMute}>{muted ? "Turn microphone on" : "Mute microphone"}</button>{sessionData.mediaPolicy.screenShare && <button type="button" className={sharing ? "is-sharing" : ""} onClick={toggleShare}>{sharing ? "Stop sharing" : "Share screen"}</button>}<span>Camera access is disabled</span></footer>
    {error && <div className="live-room-error" role="alert">{error}</div>}
  </section>;
}

function EnabledLiveLearningRooms({ mode = "student", session }) {
  const roomType = mode === "professor" ? "office_hours" : "study_room";
  const [courses, setCourses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState(mode === "professor" ? "Drop-in office hours" : "Study together");
  const [participantSharing, setParticipantSharing] = useState(mode !== "professor");
  const [sessionData, setSessionData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const courseIds = useMemo(() => courses.map((course) => course.id), [courses]);

  async function refreshRooms(nextCourseIds = courseIds) {
    const { data } = await listLiveRooms(nextCourseIds, roomType);
    setRooms(data || []);
  }

  useEffect(() => {
    let active = true;
    listAvailableCourses().then(({ data, error: courseError }) => {
      if (!active) return;
      setCourses(data || []);
      setCourseId(data?.[0]?.id || "");
      if (courseError) setError("Live rooms will appear after a class is linked.");
      refreshRooms((data || []).map((course) => course.id));
    });
    return () => { active = false; };
  }, [roomType]);

  async function createRoom(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await requestLiveRoomSession({ action: "create", courseId, roomType, title, allowParticipantScreenShare: participantSharing, recordingPolicy: "off" });
      setSessionData(result);
      refreshRooms();
    } catch (createError) { setError(createError.message); }
    finally { setBusy(false); }
  }

  async function joinRoom(roomId) {
    setBusy(true); setError("");
    try { setSessionData(await requestLiveRoomSession({ action: "join", roomId })); }
    catch (joinError) { setError(joinError.message); }
    finally { setBusy(false); }
  }

  if (sessionData) return <MediaRoom sessionData={sessionData} userId={session?.user?.id} onLeave={() => { setSessionData(null); refreshRooms(); }} />;
  return <div className="live-learning-lobby"><section className="dashboard-card"><span className="portal-kicker">{mode === "professor" ? "LIVE OFFICE HOURS" : "STUDENT STUDY ROOMS"}</span><h1>{mode === "professor" ? "Talk and teach without a webcam." : "Meet around the work, not the camera."}</h1><p>Audio, a participant list, and screen sharing live inside EdNotebook. Recording starts off and never turns on silently.</p><form onSubmit={createRoom}><label>Class<select required value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Choose a linked class</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.course_code || "CLASS"} · {course.title}</option>)}</select></label><label>Room name<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>{mode === "student" && <label className="live-room-check"><input type="checkbox" checked={participantSharing} onChange={(event) => setParticipantSharing(event.target.checked)} />Let class members share their screen</label>}<button type="submit" disabled={busy || !courseId}>{busy ? "Opening…" : mode === "professor" ? "Start office hours" : "Create study room"}</button></form>{!courses.length && <div className="live-room-empty"><strong>No linked cloud class yet.</strong><span>Join or publish a class first. Live rooms always inherit class access.</span></div>}{error && <div className="live-room-error" role="alert">{error}</div>}</section><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">OPEN NOW</span><h2>Available rooms</h2></div><button type="button" onClick={() => refreshRooms()}>Refresh available rooms</button></div><div className="live-room-list">{rooms.length ? rooms.map((room) => <article key={room.id}><div><strong>{room.title}</strong><span>{formatStart(room.starts_at)} · {room.recording_policy === "off" ? "not recorded" : "consent required"}</span></div><button type="button" disabled={busy} onClick={() => joinRoom(room.id)}>Join room</button></article>) : <p>No open room for your linked classes.</p>}</div></section></div>;
}

function LiveRoomsSetupPending({ mode }) {
  const professor = mode === "professor";
  return <section className="dashboard-card live-room-setup-pending"><span className="portal-kicker">{professor ? "LIVE OFFICE HOURS" : "STUDENT STUDY ROOMS"}</span><h1>{professor ? "Live office hours are being connected." : "Study rooms are being connected."}</h1><p>Your other class tools are ready. This feature will appear after the private room service finishes setup and testing.</p><div className="live-room-empty"><strong>No room action is available yet.</strong><span>EdNotebook will show the class list and room controls here when the service is enabled.</span></div></section>;
}

export default function LiveLearningRooms({ mode = "student", session }) {
  if (!LIVE_ROOMS_ENABLED) return <LiveRoomsSetupPending mode={mode} />;
  return <EnabledLiveLearningRooms mode={mode} session={session} />;
}
