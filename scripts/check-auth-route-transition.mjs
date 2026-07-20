import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/AuthGate.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /const nextUserId = data\.session\?\.user\?\.id \|\| null;\s*if \(profileUserId\.current !== nextUserId\) \{[\s\S]*?setProfileLoading\(Boolean\(nextUserId\)\);\s*}/,
  "Session reloads may start profile loading only when the authenticated user changes.",
);

assert.doesNotMatch(
  source,
  /setSession\(data\.session \?\? null\);\s*setProfileLoading\(Boolean\(data\.session\?\.user\)\);/,
  "Do not restart profile loading for the same user; the profile effect will not rerun.",
);

console.log("Auth route-transition regression check passed.");
