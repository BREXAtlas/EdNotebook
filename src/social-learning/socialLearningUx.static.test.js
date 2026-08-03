import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panels = readFileSync(new URL("./SocialLearningPanels.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./social-learning.css", import.meta.url), "utf8");
const professor = readFileSync(new URL("../portal/ProfessorDashboard.jsx", import.meta.url), "utf8");
const student = readFileSync(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");

test("professor and student portals expose the Social Education Learning workflow", () => {
  assert.match(professor, /\["rewards", "Social learning"\]/u);
  assert.match(student, /\["rewards", "Social learning"\]/u);
  assert.match(professor, /ProfessorSocialLearningPanel/u);
  assert.match(student, /StudentSocialLearningPanel/u);
});

test("front end includes celebration, trophy shelf, visuals, and a transparent ledger", () => {
  assert.match(panels, /STUDENT CELEBRATION PREVIEW/u);
  assert.match(panels, /TROPHY SHELF/u);
  assert.match(panels, /Friendly visual/u);
  assert.match(panels, /TRANSPARENT LEDGER/u);
  assert.match(panels, /Recognition, not a grade/u);
  assert.match(panels, /Try this/u);
  assert.match(panels, /SOURCE ORGANIZER LAYOUT · ON/u);
  assert.match(panels, /Completed course badges/u);
  assert.match(panels, /separate from learning points and never change a grade/u);
  assert.match(student, /courseBadges=\{demoMode \? \[\] : courseBadges\}/u);
});

test("experience has no autoplay, audio, public leaderboard, or purchase path", () => {
  assert.doesNotMatch(panels, /autoplay|<audio|leaderboard|buy points|purchase points/iu);
  assert.match(panels, /There are no mystery prizes or purchasable points/iu);
  assert.match(panels, /private by default/iu);
});

test("motion is responsive to the operating-system reduced-motion preference", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(styles, /transition: none/u);
});
