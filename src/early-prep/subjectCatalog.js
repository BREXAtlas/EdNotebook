export const EARLY_PREP_DIVISION = "k12";

export const EARLY_PREP_SUBJECTS = Object.freeze([
  { id: "english-language-arts", label: "English Language Arts", texasAlignment: "TEKS: English Language Arts and Reading", adapterKey: "english" },
  { id: "mathematics", label: "Mathematics", texasAlignment: "TEKS: Mathematics", adapterKey: "math" },
  { id: "science", label: "Science", texasAlignment: "TEKS: Science", adapterKey: "science" },
  { id: "social-studies-history", label: "Social Studies / History", texasAlignment: "TEKS: Social Studies", adapterKey: "history" },
  { id: "world-languages", label: "World Languages", texasAlignment: "TEKS: Languages Other Than English", adapterKey: "world-languages" },
  { id: "fine-arts", label: "Fine Arts", texasAlignment: "TEKS: Fine Arts", adapterKey: "fine-arts" },
  { id: "physical-education-health", label: "Physical Education / Health", texasAlignment: "TEKS: Health and Physical Education", adapterKey: "health-pe" },
  { id: "career-technical-education", label: "Career and Technical Education", texasAlignment: "TEKS: Career and Technical Education", adapterKey: "cte" },
  { id: "computer-science-digital-literacy", label: "Computer Science / Digital Literacy", texasAlignment: "TEKS: Technology Applications", adapterKey: "digital-literacy" },
  { id: "financial-literacy-personal-finance", label: "Financial Literacy / Personal Finance", texasAlignment: "TEKS: Personal Financial Literacy", adapterKey: "financial-literacy" },
  { id: "other-approved-elective", label: "Other Approved Elective", texasAlignment: "District-approved course standards", adapterKey: "approved-elective" },
]);

const SUBJECTS_BY_ID = new Map(EARLY_PREP_SUBJECTS.map((subject) => [subject.id, subject]));

export function earlyPrepSubject(subjectId) {
  return SUBJECTS_BY_ID.get(subjectId) || null;
}

export function earlyPrepSubjectLabel(subjectId) {
  return earlyPrepSubject(subjectId)?.label || "Other Approved Elective";
}

export function isEarlyPrepSubject(subjectId) {
  return SUBJECTS_BY_ID.has(subjectId);
}

export function earlyPrepAdapterConfig(subjectId) {
  const subject = earlyPrepSubject(subjectId);
  if (!subject) return null;
  return {
    adapterKey: subject.adapterKey,
    subjectId: subject.id,
    standardsAuthority: "Texas Education Agency",
    standardsLabel: subject.texasAlignment,
    status: "configuration-ready",
  };
}
