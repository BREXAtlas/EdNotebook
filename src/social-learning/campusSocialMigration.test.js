import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = [
  "20260730193830_govern_campus_social_and_educator_verification.sql",
  "20260731014500_fix_campus_social_self_visibility.sql",
].map((filename) => readFileSync(
  new URL(`../../supabase/migrations/${filename}`, import.meta.url),
  "utf8"
)).join("\n");
const returningGate = readFileSync(
  new URL("../../supabase/tests/campus_social_returning_gate.sql", import.meta.url),
  "utf8",
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

test("the signed-in account can read its own newly returned social profile and post", () => {
  assert.match(
    migration,
    /user_id\s*=\s*\(select auth\.uid\(\)\)\s*or\s*private\.can_view_campus_social_profile\(user_id\)/u,
  );
  assert.match(
    migration,
    /author_id\s*=\s*\(select auth\.uid\(\)\)\s*or\s*private\.can_view_campus_social_post\(id\)/u,
  );
  assert.match(returningGate, /insert into public\.campus_social_profiles/iu);
  assert.match(returningGate, /returning user_id,display_name,visibility/iu);
  assert.match(returningGate, /insert into public\.campus_social_posts/iu);
  assert.match(returningGate, /returning id,author_id,audience,body/iu);
  assert.match(returningGate, /set local role authenticated/iu);
});

test("teacher verification is synchronized with the TOS onboarding queue", () => {
  assert.match(migration, /sync_educator_verification_to_onboarding/u);
  assert.match(migration, /insert into public\.identity_onboarding_requests/u);
  assert.match(migration, /sync_onboarding_review_to_educator/u);
  assert.match(migration, /manage_affiliations/u);
  assert.match(migration, /educator_verification_control_center_sync/u);
});
