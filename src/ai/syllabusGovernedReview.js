const GOVERNED_UNRESOLVED_RULES = Object.freeze([
  Object.freeze({
    key: "finalAssessmentType",
    label: "Final assessment format: presentation versus written project",
    identifies(source) {
      return (
        /\b(?:final|culminating)\b[\s\S]{0,220}\b(?:experience|assessment|exam(?:ination)?|project|presentation)\b/i.test(source)
        || (/\bpresentation\b/i.test(source) && /\bwritten\s+(?:project|paper|assessment)\b/i.test(source))
      );
    },
    remainsUnresolved(source) {
      return (
        /\bpresentation\b/i.test(source)
        && /\bwritten\s+(?:project|paper|assessment)\b/i.test(source)
        && /\b(?:either|may\s+be|not\s+yet\s+(?:been\s+)?selected|not\s+selected|undecided|unclear|to\s+be\s+determined|tbd|versus|vs\.?)\b/i.test(source)
      );
    },
  }),
  Object.freeze({
    key: "aiUsePolicy",
    label: "Generative AI disclosure expectations",
    identifies(source) {
      return /\b(?:generative\s+ai|artificial\s+intelligence|ai\s+(?:use|policy|disclosure|expectations?))\b/i.test(source);
    },
    remainsUnresolved(source) {
      return (
        /\b(?:generative\s+ai|artificial\s+intelligence|ai)\b/i.test(source)
        && /\bdisclos(?:e|ed|ing|ure|ures)\b/i.test(source)
        && /\b(?:not\s+(?:clearly\s+)?stated|unclear|unspecified|not\s+defined|not\s+yet\s+determined|to\s+be\s+determined|tbd)\b/i.test(source)
      );
    },
  }),
]);

function textFromValue(value) {
  if (Array.isArray(value)) return value.map(textFromValue).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value).map(textFromValue).join(" ");
  }
  return String(value ?? "");
}

function normalizedText(value) {
  return textFromValue(value).replace(/\s+/g, " ").trim();
}

export function identifyGovernedUncertaintyFieldKeys(uncertainSections = []) {
  const source = normalizedText(Array.isArray(uncertainSections) ? uncertainSections : []);
  return GOVERNED_UNRESOLVED_RULES
    .filter((rule) => rule.identifies(source))
    .map((rule) => rule.key);
}

export function buildReturnedGovernedDraft({ appliedFields = [], artifact = null } = {}) {
  const safeAppliedFields = Array.isArray(appliedFields) ? appliedFields : [];
  const appliedByKey = new Map(
    safeAppliedFields
      .filter((field) => field && typeof field === "object" && typeof field.key === "string")
      .map((field) => [field.key, field]),
  );

  const missingInformation = GOVERNED_UNRESOLVED_RULES
    .filter((rule) => {
      const field = appliedByKey.get(rule.key);
      if (!field) return false;
      const evidence = normalizedText([field.value, field.sourceExcerpt]);
      return rule.remainsUnresolved(evidence);
    })
    .map((rule) => rule.label);

  return {
    fields: safeAppliedFields,
    missingInformation,
    conflictingInformation: Array.isArray(artifact?.conflictingInformation)
      ? artifact.conflictingInformation
      : [],
  };
}
