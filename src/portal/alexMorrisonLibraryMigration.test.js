import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260731034000_connect_alex_morrison_course_library.sql",
    import.meta.url,
  ),
  "utf8",
);
const commercialMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20260731043000_governed_commercial_publishing.sql",
    import.meta.url,
  ),
  "utf8",
);
const gate = readFileSync(
  new URL(
    "../../supabase/tests/alex_morrison_library_gate.sql",
    import.meta.url,
  ),
  "utf8",
);

test("courses can enter the Library without changing enrollment or universal assignment", () => {
  assert.match(migration, /library_access_model in \('not_listed','open_free','purchase','rental'\)/u);
  assert.match(migration, /set_course_library_listing/u);
  assert.match(gate, /universal_assignment=false/u);
  assert.match(gate, /Free Library listing changed or lost its separate universal-assignment state/u);
});

test("books keep one record across private, assigned, open, and commercial-review placement", () => {
  assert.match(migration, /set_publication_library_access/u);
  assert.match(migration, /reading_mode in \('read_only','interactive'\)/u);
  assert.match(migration, /p_access_model='assigned' and p_course_id is null/u);
  assert.match(gate, /Assigned book leaked to a student outside the linked course/u);
  assert.match(gate, /Open read-only book was not available/u);
});

test("the public catalog keeps previews safe and exposes only governed checkout", () => {
  assert.match(migration, /list_alex_morrison_catalog/u);
  assert.match(migration, /false as checkout_available/u);
  assert.match(migration, /grant execute on function public\.list_alex_morrison_catalog\(text\)\s+to anon,authenticated/u);
  assert.match(commercialMigration, /private\.marketplace_listing_is_ready\(listing\.id\)/u);
  assert.match(commercialMigration, /marketplace_listing_id/u);
  assert.match(gate, /Commercial review record granted book-content access without an entitlement/u);
  assert.match(gate, /Commercial publication governance is not approved/u);
});

test("Digital Literacy becomes the free pilot Library course", () => {
  assert.match(migration, /lower\(directory\.title\) like 'digital literacy%'/u);
  assert.match(migration, /library_access_model='open_free'/u);
  assert.match(migration, /enrollment_policy='open_self_enroll'/u);
});
