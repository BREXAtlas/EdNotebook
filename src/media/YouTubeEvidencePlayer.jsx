import { useEffect, useRef, useState } from "react";
import { boundedPlaybackEvidence, mediaProgressLabel, shouldReportPlayback } from "./mediaEvidenceModel.js";

let youtubeApiPromise;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("The in-platform video player did not initialize."));
    };
    const existing = document.getElementById("ednotebook-youtube-api");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "ednotebook-youtube-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("The in-platform video player could not be loaded."));
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

export default function YouTubeEvidencePlayer({
  videoId,
  title,
  language = "en",
  captionsEnabled = false,
  initialProgress = null,
  onEvidence,
}) {
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const lastReportRef = useRef(null);
  const evidenceRef = useRef(onEvidence);
  const initialProgressRef = useRef(initialProgress);
  const [message, setMessage] = useState(mediaProgressLabel(initialProgress));
  const [error, setError] = useState("");

  useEffect(() => {
    evidenceRef.current = onEvidence;
  }, [onEvidence]);

  useEffect(() => {
    let cancelled = false;

    async function report(type) {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const event = boundedPlaybackEvidence({
        type,
        positionSeconds: player.getCurrentTime(),
        durationSeconds: player.getDuration(),
      });
      lastReportRef.current = {
        positionSeconds: event.positionSeconds,
        reportedAt: Date.now(),
      };
      try {
        const progress = await evidenceRef.current?.(event);
        if (!cancelled && progress) setMessage(mediaProgressLabel(progress));
      } catch {
        if (!cancelled) setMessage("Viewing continues; progress sync will retry on the next player event.");
      }
    }

    function stopTimer() {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    function startTimer() {
      stopTimer();
      timerRef.current = window.setInterval(() => {
        const player = playerRef.current;
        if (!player?.getCurrentTime) return;
        const current = { playing: true, positionSeconds: player.getCurrentTime() };
        if (shouldReportPlayback(lastReportRef.current, current)) report("progress");
      }, 5000);
    }

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;
        playerRef.current = new YT.Player(mountRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 0,
            cc_lang_pref: language,
            cc_load_policy: captionsEnabled ? 1 : 0,
            enablejsapi: 1,
            modestbranding: 1,
            origin: window.location.origin,
            rel: 0,
          },
          events: {
            onReady: () => {
              const resumeAt = Number(initialProgressRef.current?.last_position_seconds) || 0;
              const duration = Number(playerRef.current?.getDuration?.()) || 0;
              if (
                initialProgressRef.current?.status !== "completed" &&
                resumeAt > 1 &&
                (!duration || resumeAt < duration - 1)
              ) {
                playerRef.current?.seekTo?.(resumeAt, true);
                setMessage(`Resume ready at ${Math.floor(resumeAt / 60)}:${String(Math.floor(resumeAt % 60)).padStart(2, "0")}.`);
              }
              if (captionsEnabled) evidenceRef.current?.({ type: "captions_enabled" });
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                report(lastReportRef.current ? "progress" : "started");
                startTimer();
              } else if (event.data === YT.PlayerState.PAUSED) {
                stopTimer();
                report("paused");
              } else if (event.data === YT.PlayerState.ENDED) {
                stopTimer();
                report("completed");
              }
            },
            onError: () => setError("This video could not be played inside EdNotebook."),
          },
        });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      });

    return () => {
      cancelled = true;
      stopTimer();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [captionsEnabled, language, videoId]);

  return (
    <div className="ed-media-evidence-player">
      <div className="ed-media-frame" aria-label={title}>
        <div ref={mountRef} />
      </div>
      <small role="status">{message}</small>
      <small>Viewing position is supporting evidence only—not proof of attention or learning.</small>
      {error && <p className="ed-media-error" role="alert">{error}</p>}
    </div>
  );
}
