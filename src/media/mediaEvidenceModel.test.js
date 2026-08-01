import assert from "node:assert/strict";
import test from "node:test";
import {
  accessibilityLabel,
  boundedPlaybackEvidence,
  mediaProgressLabel,
  shouldReportPlayback,
} from "./mediaEvidenceModel.js";

test("bounds player telemetry without collecting device or network identity", () => {
  assert.deepEqual(
    boundedPlaybackEvidence({ type: "progress", positionSeconds: -5, durationSeconds: 999999 }),
    { type: "progress", positionSeconds: 0, durationSeconds: 172800 },
  );
});

test("throttles progress evidence by time or meaningful playback movement", () => {
  const previous = { positionSeconds: 20, reportedAt: 1000 };
  assert.equal(shouldReportPlayback(previous, { playing: true, positionSeconds: 25 }, 5000), false);
  assert.equal(shouldReportPlayback(previous, { playing: true, positionSeconds: 31 }, 5000), true);
  assert.equal(shouldReportPlayback(previous, { playing: true, positionSeconds: 25 }, 17000), true);
});

test("explains progress and accessibility without claiming learning", () => {
  assert.equal(mediaProgressLabel({ status: "in_progress", percent_complete: 42.2 }), "42% viewed · saved");
  assert.equal(accessibilityLabel({ accessibility_status: "ready", caption_mode: "transcript" }), "Reviewed transcript");
});
