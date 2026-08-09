import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EARLY_PREP_TRANSITION_ITEMS,
  confirmSyntheticTransitionManifest,
  previewEducationPathTransition,
} from "./portfolioTransition.js";

const migration = await readFile(new URL("../../supabase/migrations/20260808211028_early_prep_foundation.sql", import.meta.url), "utf8");

test("transition inventory separates nine selectable or reviewed artifacts from five archived categories", () => {
  assert.equal(EARLY_PREP_TRANSITION_ITEMS.filter(({ disposition }) => disposition !== "archive_only").length, 9);
  assert.equal(EARLY_PREP_TRANSITION_ITEMS.filter(({ disposition }) => disposition === "archive_only").length, 5);
  assert.ok(Object.isFrozen(EARLY_PREP_TRANSITION_ITEMS));
  assert.ok(EARLY_PREP_TRANSITION_ITEMS.every(Object.isFrozen));
});

test("preview selects only explicit student choices and changes no account or record", () => {
  const preview = previewEducationPathTransition({ selectedItemIds: ["selected-learning-note", "digital-literacy-evidence"] });
  assert.deepEqual(preview.selected.map(({ id }) => id), ["selected-learning-note", "digital-literacy-evidence"]);
  assert.equal(preview.counts.selected, 2);
  assert.equal(preview.counts.requiringReview, 1);
  assert.equal(preview.writeAuthorized, false);
  assert.equal(preview.applyAuthorized, false);
  assert.equal(preview.currentDivisionChanged, false);
  assert.equal(preview.universityAccountCreated, false);
  assert.equal(preview.socialAudiencesMerged, false);
  assert.equal(preview.previewHash, previewEducationPathTransition({ selectedItemIds: ["selected-learning-note", "digital-literacy-evidence"] }).previewHash);
});

test("preview rejects University sources, unknown items, and protected school records", () => {
  assert.throws(() => previewEducationPathTransition({ sourceDivision: "university", selectedItemIds: ["selected-learning-note"] }), /route_required/u);
  assert.throws(() => previewEducationPathTransition({ selectedItemIds: ["unknown-item"] }), /unknown_transition_item/u);
  assert.throws(() => previewEducationPathTransition({ selectedItemIds: ["official-high-school-grades"] }), /not_transferable/u);
  assert.throws(() => previewEducationPathTransition({ selectedItemIds: ["private-school-communication"] }), /not_transferable/u);
});

test("manifest requires selection plus every student boundary confirmation", () => {
  const empty = previewEducationPathTransition();
  assert.throws(() => confirmSyntheticTransitionManifest(empty, { itemSelection: true, archiveBoundary: true, reviewBoundary: true }), /selection_required/u);
  const preview = previewEducationPathTransition({ selectedItemIds: ["selected-project"] });
  assert.throws(() => confirmSyntheticTransitionManifest(preview, { itemSelection: true, archiveBoundary: true }), /all_transition_confirmations_required/u);
});

test("manifest confirmation rejects a preview changed after it was built", () => {
  const preview = previewEducationPathTransition({ selectedItemIds: ["selected-learning-note"] });
  const tampered = {
    ...preview,
    selected: [{ ...preview.selected[0], category: "official_school_record" }],
  };
  assert.throws(
    () => confirmSyntheticTransitionManifest(tampered, { itemSelection: true, archiveBoundary: true, reviewBoundary: true }),
    /transition_preview_integrity_failed/u,
  );
});

test("confirmed manifest remains synthetic, review-gated, and unable to modify University records", () => {
  const preview = previewEducationPathTransition({ selectedItemIds: ["selected-writing-document", "financial-literacy-evidence"] });
  const result = confirmSyntheticTransitionManifest(preview, { itemSelection: true, archiveBoundary: true, reviewBoundary: true });
  assert.equal(result.status, "synthetic_manifest_ready");
  assert.equal(result.manifest.studentConfirmedSelection, true);
  assert.equal(result.manifest.institutionReviewRequired, true);
  assert.equal(result.manifest.applyAuthorized, false);
  assert.equal(result.requestSubmitted, false);
  assert.equal(result.recordsCopied, 0);
  assert.equal(result.currentDivisionChanged, false);
  assert.equal(result.universityRecordsModified, false);
  assert.equal(result.socialAudiencesMerged, false);
  assert.doesNotMatch(JSON.stringify(result), /grade_value|message_body|district_student_id|research_response/iu);
});

test("existing Supabase foundation is owner-scoped request evidence, not an automatic apply path", () => {
  assert.match(migration, /create table public\.education_path_transition_requests/u);
  assert.match(migration, /manifest_version text not null default 'EdNotebookEducationTransition\/1\.0'/u);
  assert.match(migration, /source_division text not null default 'k12'/u);
  assert.match(migration, /target_division text not null default 'university'/u);
  assert.match(migration, /alter table public\.education_path_transition_requests enable row level security/u);
  assert.match(migration, /user_id=\(select auth\.uid\(\)\).*private\.user_has_education_division\(\(select auth\.uid\(\)\),'k12'\)/su);
  assert.match(migration, /Applying a transition requires a later reviewed unit and never merges social audiences automatically/u);
  assert.doesNotMatch(migration, /education_transition.*update|education_transition.*delete/iu);
});
