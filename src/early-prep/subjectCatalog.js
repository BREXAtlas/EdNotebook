export const EARLY_PREP_DIVISION = "k12";
export const EARLY_PREP_WORKSPACE_VERSION = "early-prep-subject-workspace-v1";

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

const SUBJECT_WORKSPACES = Object.freeze({
  english: {
    title: "Read, support, revise",
    summary: "Move from close reading to a supported claim and a deliberate revision.",
    tools: ["Reading annotation", "Claim and evidence", "Revision checklist", "Citation check"],
    workflow: ["Annotate the text", "Choose evidence", "Draft the claim", "Revise and cite"],
    starter: {
      title: "Text Evidence and Revision",
      instructions: "Use the guided sections to develop a supported response, then revise the full draft.",
      sections: [
        { type: "short", prompt: "What claim will your response make?", helpText: "Write one focused, defensible sentence." },
        { type: "long", prompt: "Which details from the text support that claim?", helpText: "Quote or paraphrase accurately and identify the source.", wordTarget: 140 },
        { type: "reflection", prompt: "What did you improve during revision?", helpText: "Name a change to reasoning, organization, clarity, grammar, or citations.", wordTarget: 100 },
      ],
    },
  },
  math: {
    title: "Show the model and the steps",
    summary: "Keep equations, graphs, units, calculations, and reasoning together.",
    tools: ["Equation work", "Graph or model", "Units check", "Step evidence"],
    workflow: ["Identify what is known", "Choose a model", "Show each step", "Check units and reasonableness"],
    starter: {
      title: "Mathematical Model and Step Evidence",
      instructions: "Solve the problem with a visible model, complete steps, and a reasonableness check.",
      sections: [
        { type: "short", prompt: "What information is given, and what must you find?", helpText: "Include quantities, variables, and units." },
        { type: "long", prompt: "Show the equation, graph, or model and every important step.", helpText: "Explain why each operation or transformation is valid.", wordTarget: 100 },
        { type: "reflection", prompt: "How do you know the result is reasonable?", helpText: "Check the result using estimation, substitution, units, or another method.", wordTarget: 80 },
      ],
    },
  },
  science: {
    title: "Investigate with evidence",
    summary: "Connect hypotheses, variables, safety, observations, data, and scientific sources.",
    tools: ["Hypothesis", "Variables and controls", "Safety check", "Data table", "Scientific citation"],
    workflow: ["Ask and predict", "Plan safely", "Record data", "Analyze and cite"],
    starter: {
      title: "Scientific Investigation Record",
      instructions: "Document the question, safe method, evidence, and conclusion without inventing observations.",
      sections: [
        { type: "short", prompt: "What question or hypothesis are you investigating?", helpText: "State a testable relationship when the task is experimental." },
        { type: "checklist", prompt: "List variables, controls, materials, and safety steps.", helpText: "Separate what changes, what is measured, and what stays consistent." },
        { type: "long", prompt: "What do the data support, and what are the limits?", helpText: "Refer to recorded evidence and cite any scientific sources.", wordTarget: 150 },
      ],
    },
  },
  history: {
    title: "Place sources in context",
    summary: "Use timelines, maps, and primary and secondary sources to build an evidence-based interpretation.",
    tools: ["Timeline", "Map and context", "Primary-source analysis", "Secondary-source comparison", "Evidence check"],
    workflow: ["Set time and place", "Examine the source", "Compare perspectives", "Support an interpretation"],
    starter: {
      title: "Historical Source Analysis",
      instructions: "Place the source in context, examine perspective, and support an interpretation with evidence.",
      sections: [
        { type: "short", prompt: "When and where was this source created?", helpText: "Add the event, location, or timeline context that matters." },
        { type: "long", prompt: "What does the source show, and whose perspective does it represent?", helpText: "Distinguish observation from interpretation and identify limitations.", wordTarget: 140 },
        { type: "reflection", prompt: "How does another source confirm, complicate, or challenge it?", helpText: "Compare evidence rather than ranking sources by popularity.", wordTarget: 120 },
      ],
    },
  },
  "world-languages": {
    title: "Communicate in context",
    summary: "Practice vocabulary, comprehension, expression, and cultural context together.",
    tools: ["Vocabulary in context", "Reading or listening evidence", "Speaking or writing practice", "Cultural source check"],
    workflow: ["Notice key language", "Interpret meaning", "Create a response", "Review accuracy and context"],
    starter: {
      title: "Language in Context",
      instructions: "Use the target language where directed and explain the context behind your choices.",
      sections: [
        { type: "checklist", prompt: "Record the key words or structures you will use.", helpText: "Include meaning and an example in context." },
        { type: "long", prompt: "Create your spoken or written response.", helpText: "Match the audience, purpose, and language level requested by your teacher.", wordTarget: 120 },
        { type: "reflection", prompt: "What did you revise for accuracy or cultural context?", helpText: "Identify one specific change and why it matters.", wordTarget: 80 },
      ],
    },
  },
  "fine-arts": {
    title: "Create, document, critique",
    summary: "Keep the creative brief, process evidence, technique, critique, and revision connected.",
    tools: ["Creative brief", "Process evidence", "Technique reflection", "Critique and revision"],
    workflow: ["Interpret the brief", "Plan the process", "Create and document", "Critique and revise"],
    starter: {
      title: "Creative Process Portfolio",
      instructions: "Document the idea, process, artistic choices, feedback, and revision for this work.",
      sections: [
        { type: "short", prompt: "What is your creative goal or interpretation?", helpText: "Connect the idea to the assignment brief." },
        { type: "checklist", prompt: "Document materials, techniques, and process evidence.", helpText: "Include drafts, rehearsals, studies, or checkpoints requested by your teacher." },
        { type: "reflection", prompt: "How did critique or self-review change the work?", helpText: "Describe a specific revision and its effect.", wordTarget: 120 },
      ],
    },
  },
  "health-pe": {
    title: "Plan safely and reflect",
    summary: "Connect health or activity goals with safe practice, evidence, and reflection.",
    tools: ["Goal and plan", "Safety check", "Activity or health evidence", "Reflection"],
    workflow: ["Set an appropriate goal", "Plan safely", "Record approved evidence", "Reflect and adjust"],
    starter: {
      title: "Health and Activity Reflection",
      instructions: "Use only the non-sensitive evidence requested by your teacher; do not include private medical details.",
      sections: [
        { type: "short", prompt: "What skill, concept, or goal are you working on?", helpText: "Keep the goal specific and appropriate for the assignment." },
        { type: "checklist", prompt: "List the plan, safety steps, and approved evidence.", helpText: "Do not include diagnoses, treatment details, or other private health information." },
        { type: "reflection", prompt: "What did you learn, and what would you adjust?", helpText: "Base the reflection on the activity or learning evidence.", wordTarget: 100 },
      ],
    },
  },
  cte: {
    title: "Build workplace-ready evidence",
    summary: "Connect the task, safe process, finished artifact, and career or trade context.",
    tools: ["Workplace task", "Process and safety", "Artifact or portfolio", "Career connection"],
    workflow: ["Understand the task", "Plan the process", "Build and document", "Evaluate against the standard"],
    starter: {
      title: "Career and Technical Project Record",
      instructions: "Document the workplace task, process, safety requirements, artifact, and evaluation.",
      sections: [
        { type: "short", prompt: "What workplace problem or task are you addressing?", helpText: "Identify the audience, need, and success criteria." },
        { type: "checklist", prompt: "List process steps, tools, and safety requirements.", helpText: "Use the procedures approved by your teacher or program." },
        { type: "reflection", prompt: "How does the artifact meet the standard, and what would you improve?", helpText: "Point to portfolio or performance evidence.", wordTarget: 120 },
      ],
    },
  },
  "digital-literacy": {
    title: "Create and verify responsibly",
    summary: "Combine source checking, privacy, security, digital creation, and responsible publishing.",
    tools: ["Source check", "Privacy and security", "Digital artifact", "Responsible publishing review"],
    workflow: ["Define the digital task", "Verify sources", "Protect people and data", "Create and review"],
    starter: {
      title: "Digital Source and Creation Check",
      instructions: "Verify the information, protect private data, and explain the choices behind the digital artifact.",
      sections: [
        { type: "short", prompt: "What are you creating or deciding, and for whom?", helpText: "Identify the purpose and intended audience." },
        { type: "checklist", prompt: "Record source, privacy, security, and accessibility checks.", helpText: "Do not paste passwords, private records, or identifying student information." },
        { type: "reflection", prompt: "Why is the final result responsible and trustworthy?", helpText: "Point to evidence, revisions, and publishing choices.", wordTarget: 110 },
      ],
    },
  },
  "financial-literacy": {
    title: "Compare choices and consequences",
    summary: "Use budgets, calculations, risk checks, and sourced information to explain a financial decision.",
    tools: ["Budget or calculation", "Choice comparison", "Risk and fraud check", "Source check", "Decision reflection"],
    workflow: ["Define the scenario", "Calculate and compare", "Check risks and sources", "Explain the decision"],
    starter: {
      title: "Personal Finance Decision Record",
      instructions: "Analyze the fictional or teacher-approved scenario; do not enter account numbers or other private financial information.",
      sections: [
        { type: "short", prompt: "What goal, constraint, or decision does the scenario present?", helpText: "Separate needs, wants, deadlines, and available resources." },
        { type: "long", prompt: "Show the budget, calculation, or comparison.", helpText: "Label assumptions, units, rates, and the source of any outside figures.", wordTarget: 120 },
        { type: "reflection", prompt: "Which option is best supported, and what risk remains?", helpText: "Include fraud warning signs or uncertainty when relevant.", wordTarget: 100 },
      ],
    },
  },
  "approved-elective": {
    title: "Plan, create, show evidence",
    summary: "Use a flexible question-plan-evidence-reflection structure for an approved elective.",
    tools: ["Guiding question", "Work plan", "Evidence or artifact", "Reflection"],
    workflow: ["Clarify the question", "Plan the work", "Create evidence", "Reflect and revise"],
    starter: {
      title: "Elective Project Evidence",
      instructions: "Follow the teacher-approved process and connect the finished work to clear evidence.",
      sections: [
        { type: "short", prompt: "What question, goal, or task are you addressing?", helpText: "State the expected outcome in your own words." },
        { type: "checklist", prompt: "List your plan and the evidence or artifact you will produce.", helpText: "Include checkpoints or requirements from your teacher." },
        { type: "reflection", prompt: "What does the evidence show, and what would you revise?", helpText: "Use the assignment criteria to evaluate the work.", wordTarget: 100 },
      ],
    },
  },
});

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

export function earlyPrepWorkspaceConfig(subjectId) {
  const subject = earlyPrepSubject(subjectId);
  if (!subject) return null;
  const workspace = SUBJECT_WORKSPACES[subject.adapterKey];
  if (!workspace) return null;
  return {
    subjectId: subject.id,
    subjectLabel: subject.label,
    adapterKey: subject.adapterKey,
    standardsLabel: subject.texasAlignment,
    version: EARLY_PREP_WORKSPACE_VERSION,
    ...workspace,
  };
}

export function earlyPrepAssignmentStarter(subjectId) {
  const workspace = earlyPrepWorkspaceConfig(subjectId);
  if (!workspace) return null;
  return {
    subjectId: workspace.subjectId,
    adapterKey: workspace.adapterKey,
    version: workspace.version,
    title: workspace.starter.title,
    instructions: workspace.starter.instructions,
    sections: workspace.starter.sections.map((section) => ({ ...section })),
    editorConfig: {
      full_page_editor: true,
      spellcheck: true,
      allow_word_export: true,
      allow_pdf_export: true,
      word_limit: 0,
      subject_workspace: {
        subject_id: workspace.subjectId,
        adapter_key: workspace.adapterKey,
        version: workspace.version,
      },
    },
  };
}
