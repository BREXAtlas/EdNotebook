import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260730193830_govern_campus_social_and_educator_verification.sql", import.meta.url),
  "utf8"
);

test("campus social tables use RLS and authenticated-only grants", () => {
  for (const table of [
    "campus_social_profiles",
    "campus_social_posts",
    "campus_social_comments",
    "campus_social_reactions",
    "campus_social_follows",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "u"));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon`, "u"));
  }
  assert.doesNotMatch(migration, /grant\s+(?:select|all)[^;]*\s+to\s+anon/iu);
});

test("university-wide posts are authenticated and cannot receive K-12 content", () => {
  assert.match(migration, /K-12 posts cannot enter the university-wide feed/u);
  assert.match(migration, /post\.education_division='university'/u);
  assert.match(migration, /private\.social_education_division\(\(select auth\.uid\(\)\)\)='university'/u);
  assert.match(migration, /target\.visibility='public_university'/u);
});

test("teacher verification is synchronized with the TOS onboarding queue", () => {
  assert.match(migration, /sync_educator_verification_to_onboarding/u);
  assert.match(migration, /insert into public\.identity_onboarding_requests/u);
  assert.match(migration, /sync_onboarding_review_to_educator/u);
  assert.match(migration, /manage_affiliations/u);
  assert.match(migration, /educator_verification_control_center_sync/u);
});

