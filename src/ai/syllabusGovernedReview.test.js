import test from "node:test";
import assert from "node:assert/strict";

import { ANGELO_STATE_2026_PROFILE } from "../syllabus/angeloState2026Profile.js";
import {
  extractDeterministicSyllabus,
  mergeSyllabusExtraction,
} from "./syllabusExtractionContract.js";
import {
  buildReturnedGovernedDraft,
  identifyGovernedUncertaintyFieldKeys,
} from "./syllabusGovernedReview.js";

const INCOMPLETE_SYLLABUS_FIXTURE = `
Course Title: Superhero Media Analysis
Course Code: MARV 114
Section: 02
Term: Fall 2026
Credit Hours: 3

Draft Decisions
The final experience may be either a presentation or a written project. The exact format has not yet been selected.
Students may use generative AI for brainstorming when an assignment permits it, but the disclosure expectations are not clearly stated.
`;

test("actual incomplete syllabus keeps the governed draft summary passage-scoped", () => {
  const deterministic = extractDeterministicSyllabus(
    INCOMPLETE_SYLLABUS_FIXTURE,
    ANGELO_STATE_2026_PROFILE,
  );
  assert.deepEqual(
    identifyGovernedUncertaintyFieldKeys(deterministic.uncertainSections),
    ["finalAssessmentType", "aiUsePolicy"],
  );

  const routerValidatedArtifact = {
    fields: {
      finalAssessmentType: {
        value:
          "Either a presentation or a written project. The exact format has not yet been selected.",
        confidence: 0.85,
        sourceExcerpt:
          "The final experience may be either a presentation or a written project. The exact format has not yet been selected.",
      },
      aiUsePolicy: {
        value:
          "Students may use generative AI for brainstorming when an assignment permits it, but disclosure expectations are not clearly stated.",
        confidence: 0.8,
        sourceExcerpt:
          "Students may use generative AI for brainstorming when an assignment permits it, but the disclosure expectations are not clearly stated.",
      },
    },
    missingInformation: [
      "finalAssessmentType: Final assessment format: presentation versus written project",
      "aiUsePolicy: Generative AI disclosure expectations",
    ],
    conflictingInformation: [],
    proposedCourseOutline: null,
  };
  const merged = mergeSyllabusExtraction(
    deterministic,
    routerValidatedArtifact,
    ANGELO_STATE_2026_PROFILE,
  );
  const appliedFields = Object.entries(routerValidatedArtifact.fields)
    .filter(([key]) => merged.fields[key]?.method === "ai_uncertainty_resolution")
    .map(([key, field]) => ({ key, ...field }));
  const returnedDraft = buildReturnedGovernedDraft({
    appliedFields,
    artifact: routerValidatedArtifact,
  });

  assert.deepEqual(returnedDraft.missingInformation, [
    "Final assessment format: presentation versus written project",
    "Generative AI disclosure expectations",
  ]);
  assert.equal(returnedDraft.missingInformation.includes("Course description"), false);
  assert.equal(returnedDraft.missingInformation.includes("Instructor information"), false);
  assert.equal(returnedDraft.missingInformation.includes("Meeting times and location"), false);

  const completeRequirementList = merged.requirementReview.missingRequired.map(
    (item) => item.key,
  );
  assert.equal(completeRequirementList.includes("courseDescription"), true);
  assert.equal(completeRequirementList.includes("instructorName"), true);
  assert.equal(completeRequirementList.includes("gradingScale"), true);
  assert.equal(completeRequirementList.includes("courseOutcomes"), true);
  assert.equal(completeRequirementList.includes("accessibilityProcess"), true);
});
