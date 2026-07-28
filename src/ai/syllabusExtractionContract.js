import { buildReturnedGovernedDraft } from "./syllabusGovernedReview.js";
import { mergeSyllabusExtraction as mergeBaseSyllabusExtraction } from "./syllabusExtractionContractBase.js";

export {
  extractDeterministicSyllabus,
  normalizeSyllabusSourceText,
} from "./syllabusExtractionContractBase.js";

export function mergeSyllabusExtraction(deterministic, aiArtifact, profile) {
  const merged = profile === undefined
    ? mergeBaseSyllabusExtraction(deterministic, aiArtifact)
    : mergeBaseSyllabusExtraction(deterministic, aiArtifact, profile);
  const aiFields = aiArtifact?.fields || {};
  const appliedFields = Object.entries(aiFields)
    .filter(
      ([key]) =>
        merged.fields?.[key]?.method === "ai_uncertainty_resolution",
    )
    .map(([key, field]) => ({ key, ...field }));
  const governedDraft = buildReturnedGovernedDraft({
    appliedFields,
    artifact: aiArtifact,
  });

  if (aiArtifact && typeof aiArtifact === "object") {
    aiArtifact.missingInformation = governedDraft.missingInformation;
  }
  merged.missingInformation = Array.from(
    new Set([
      ...(merged.requirementReview?.missingRequired || []).map(
        (item) => item.label,
      ),
      ...governedDraft.missingInformation,
    ]),
  );
  return merged;
}
