import assert from "node:assert/strict";
import test from "node:test";
import { mediaKind, normalizeHttpsUrl, resourceTargetForPlacement, resourcesForTarget, youtubePrivacyEmbedUrl, youtubeVideoId } from "./courseMediaModel.js";

test("accepts governed YouTube forms and rejects lookalikes", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(youtubeVideoId(`https://youtu.be/${id}?t=12`), id);
  assert.equal(youtubeVideoId(`https://www.youtube.com/watch?v=${id}&list=abc`), id);
  assert.equal(youtubeVideoId(`https://youtube.com/shorts/${id}`), id);
  assert.equal(youtubeVideoId(`https://www.youtube-nocookie.com/embed/${id}`), id);
  assert.equal(youtubeVideoId("https://youtube.example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeVideoId("https://youtube.com/watch?v=too-short"), null);
});

test("builds a privacy-enhanced non-autoplay player address", () => {
  const result = youtubePrivacyEmbedUrl("dQw4w9WgXcQ");
  assert.match(result, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.match(result, /autoplay=0/);
  assert.equal(result.includes("youtube.com/watch"), false);
});

test("only accepts HTTPS external resources", () => {
  assert.equal(normalizeHttpsUrl("example.edu/lesson").href, "https://example.edu/lesson");
  assert.equal(normalizeHttpsUrl("http://example.edu/lesson"), null);
  assert.equal(normalizeHttpsUrl("javascript:alert(1)"), null);
});

test("maps placements to exact publication targets", () => {
  assert.deepEqual(resourceTargetForPlacement("lesson", "lesson-1"), { target_kind: "lesson", target_key: "lesson-1" });
  assert.deepEqual(resourceTargetForPlacement("assignment", "assignment-1"), { target_kind: "assignment", target_key: "assignment-1" });
  assert.deepEqual(resourceTargetForPlacement("course-library", "ignored"), { target_kind: "course", target_key: null });
  assert.deepEqual(resourceTargetForPlacement("private-vault"), { target_kind: "personal", target_key: null });
});

test("filters immutable snapshots for the requested lesson", () => {
  const resources = [
    { id: "course", target_kind: "course" },
    { id: "one", target_kind: "lesson", target_key: "lesson-1" },
    { id: "two", target_kind: "lesson", target_key: "lesson-2" },
  ];
  assert.deepEqual(resourcesForTarget(resources, "lesson", "lesson-1").map((item) => item.id), ["one"]);
  assert.deepEqual(resourcesForTarget(resources, "course").map((item) => item.id), ["course"]);
  assert.equal(mediaKind({ embed_provider: "youtube" }), "youtube");
});
