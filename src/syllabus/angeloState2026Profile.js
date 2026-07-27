export const ANGELO_STATE_2026_PROFILE = Object.freeze({
  profileKey: "angelo-state-2026",
  title: "Angelo State University syllabus requirements",
  version: "2026.1",
  effectiveFrom: "2026-02-03",
  effectiveTo: "2027-02-03",
  sourceDocuments: [
    "Syllabus Checklist 2026 · modified 2026-06-26",
    "Syllabus Content Guidelines 2022 · effective 2025-07-01 through 2026-06-30 · modified 2026-07-22",
  ],
  authorities: [
    "HB 2504 Section 51.974",
    "Texas Administrative Code Title 19, Chapter 4",
    "Texas Higher Education Coordinating Board",
    "SACSCOC",
    "AACSB, where applicable",
    "ASU OP 04.11, OP 06.14, OP 10.10, OP 10.19, OP 10.24, OP 10.26, OP 16.03, and OP 24.03",
    "ASU Catalog academic regulations",
    "Academic Course Guide Manual, where applicable",
  ],
  operationalMetadata: [
    { key: "courseTitle", label: "Course title", valueKind: "text" },
    { key: "courseCode", label: "Course code", valueKind: "text" },
    { key: "sectionNumber", label: "Section", valueKind: "text" },
    { key: "term", label: "Term", valueKind: "text" },
    { key: "creditHours", label: "Credit hours", valueKind: "text" },
    { key: "blackboardCourseId", label: "Blackboard course identifier", valueKind: "text" },
  ],
  sections: [
    {
      id: "description",
      title: "Description and requisites",
      requirement: "required",
      managedBy: "professor",
      headingAliases: ["description", "course description", "catalog description", "requisites", "prerequisites", "technical requirements"],
      fields: [
        {
          key: "courseDescription",
          label: "Aligned course description",
          required: true,
          valueKind: "long_text",
          guidance: "Use the ACGM description word for word for applicable lower-division courses; otherwise match the approved catalog description.",
          references: ["ACGM", "approved course catalog", "accreditation alignment"],
        },
        {
          key: "prerequisites",
          label: "Prerequisite knowledge or courses",
          required: true,
          valueKind: "list",
          guidance: "State required preparation, knowledge, and prior courses, or explicitly state that there are none.",
          references: ["ASU OP 04.11"],
        },
        {
          key: "technicalCompetencies",
          label: "Technical skills or other competencies",
          required: true,
          valueKind: "list",
          guidance: "State technical skills and other competencies required for participation, or explicitly state that there are none.",
          references: ["ASU OP 04.11"],
        },
      ],
    },
    {
      id: "contact",
      title: "Contact information",
      requirement: "required",
      managedBy: "professor",
      headingAliases: ["contact information", "instructor information", "faculty information", "professor information", "office hours"],
      fields: [
        { key: "instructorTitle", label: "Instructor title", required: true, valueKind: "text" },
        { key: "instructorName", label: "Instructor name", required: true, valueKind: "text" },
        { key: "instructorPhone", label: "Phone number", required: true, valueKind: "text" },
        {
          key: "instructorEmail",
          label: "ASU email address",
          required: true,
          valueKind: "text",
          guidance: "Official electronic communication must use the assigned ASU email address.",
          references: ["ASU OP 24.03"],
        },
        { key: "officeLocation", label: "Office location", required: true, valueKind: "text" },
        { key: "otherContact", label: "Other means of contact", required: false, valueKind: "text" },
        {
          key: "officeHours",
          label: "Dedicated office hours or outside-of-class contact hours",
          required: true,
          valueKind: "long_text",
          references: ["ASU OP 06.14"],
        },
      ],
    },
    {
      id: "delivery",
      title: "Course delivery",
      requirement: "required",
      managedBy: "professor",
      headingAliases: ["course delivery", "delivery method", "course format", "modality", "meeting information", "class meetings"],
      fields: [
        {
          key: "deliveryModality",
          label: "Teaching modality",
          required: true,
          valueKind: "text",
          guidance: "Identify in-person, online asynchronous, online synchronous, mixed online, or hybrid delivery and explain how class meetings occur.",
        },
        { key: "meetingTimes", label: "Meeting days and times", required: "conditional", valueKind: "text", condition: "Required for face-to-face or synchronous meetings." },
        { key: "meetingLocation", label: "Meeting location or synchronous meeting destination", required: "conditional", valueKind: "text", condition: "Required for face-to-face or synchronous meetings." },
        {
          key: "lmsUse",
          label: "Learning Management System use",
          required: true,
          valueKind: "long_text",
          guidance: "State whether and how the course uses Blackboard or another LMS.",
          references: ["ASU OP 06.14"],
        },
        {
          key: "onlineInteractionPlan",
          label: "Regular and substantive interaction plan",
          required: "conditional",
          valueKind: "long_text",
          condition: "Required for online courses.",
          references: ["SACSCOC", "ASU OP 04.11"],
        },
      ],
    },
    {
      id: "materials",
      title: "Texts and materials",
      requirement: "required",
      managedBy: "professor",
      headingAliases: ["texts and materials", "required materials", "course materials", "required readings", "recommended readings", "textbook", "technology requirements"],
      fields: [
        { key: "requiredReadings", label: "Required readings", required: true, valueKind: "list", references: ["TAC 19", "HB 2504", "ASU OP 06.14"] },
        { key: "recommendedReadings", label: "Recommended readings", required: true, valueKind: "list", references: ["TAC 19", "HB 2504", "ASU OP 06.14"] },
        { key: "requiredHardware", label: "Required hardware", required: true, valueKind: "list", references: ["HB 2504", "ASU OP 04.11"] },
        { key: "requiredSoftware", label: "Required software", required: true, valueKind: "list", references: ["HB 2504", "ASU OP 04.11"] },
        { key: "requiredSubscriptions", label: "Required subscriptions or services", required: true, valueKind: "list", references: ["HB 2504"] },
        { key: "supplementalMaterials", label: "Supplemental materials and supplies", required: true, valueKind: "list", references: ["HB 2504", "ASU OP 04.11"] },
        { key: "materialAccess", label: "Where students obtain materials", required: true, valueKind: "long_text" },
      ],
    },
    {
      id: "outcomes",
      title: "Course-level outcomes",
      requirement: "required",
      managedBy: "professor_and_program",
      headingAliases: ["outcomes", "course outcomes", "student learning outcomes", "learning outcomes", "expected learning outcomes"],
      fields: [
        {
          key: "courseOutcomes",
          label: "Measurable course-level outcomes",
          required: true,
          valueKind: "list",
          guidance: "Describe what students will demonstrate in knowledge, skills, and attitudes. Applicable lower-division core courses must address ACGM outcomes.",
          references: ["TAC 19", "SACSCOC", "ASU OP 06.14", "THECB", "ACGM"],
        },
        {
          key: "outcomeAssessmentMethods",
          label: "Methods used to assess outcomes",
          required: true,
          valueKind: "list",
          references: ["ASU OP 06.14"],
        },
      ],
    },
    {
      id: "objectives",
      title: "Course-level objectives",
      requirement: "optional_by_program",
      managedBy: "professor_and_program",
      headingAliases: ["objectives", "course objectives", "learning objectives"],
      fields: [
        {
          key: "courseObjectives",
          label: "Measurable course objectives",
          required: false,
          valueKind: "list",
          guidance: "Use measurable and attainable active verbs such as demonstrate, explain, identify, list, and describe.",
        },
      ],
    },
    {
      id: "grading",
      title: "Grading criteria",
      requirement: "required",
      managedBy: "professor",
      headingAliases: ["grading criteria", "grading", "evaluation", "grade scale", "grade breakdown", "assessment", "final exam", "culminating activity"],
      fields: [
        { key: "gradingScale", label: "ASU grading scale", required: true, valueKind: "structured", references: ["ASU OP 06.14", "ASU Catalog"] },
        { key: "gradingBreakdown", label: "Weighted or point-based grade breakdown", required: true, valueKind: "structured", references: ["TAC 19", "HB 2504"] },
        { key: "gradingPolicies", label: "Grading policies", required: true, valueKind: "long_text", guidance: "Explain curves, extra credit, dropped grades, participation, and other course-specific grading rules." },
        { key: "majorAssignments", label: "Major assignments with brief descriptions", required: true, valueKind: "list", references: ["TAC 19", "HB 2504", "THECB"] },
        { key: "majorExaminations", label: "Major examinations with brief descriptions", required: true, valueKind: "list", references: ["TAC 19", "HB 2504", "THECB"] },
        { key: "finalAssessmentType", label: "Final examination or culminating experience", required: true, valueKind: "text", references: ["ASU OP 10.10"] },
        { key: "finalExamDate", label: "Final exam date", required: "conditional", valueKind: "text", condition: "Required when a final examination is used.", references: ["ASU OP 10.10", "ASU OP 06.14"] },
        { key: "finalExamTime", label: "Final exam time", required: "conditional", valueKind: "text", condition: "Required when a final examination is used.", references: ["ASU OP 10.10", "ASU OP 06.14"] },
        { key: "finalExamLocation", label: "Final exam location", required: "conditional", valueKind: "text", condition: "Required when a final examination is used.", references: ["ASU OP 10.10"] },
      ],
    },
    {
      id: "expectations",
      title: "Course expectations",
      requirement: "required",
      managedBy: "professor",
      headingAliases: ["course expectations", "expectations", "course policies", "attendance", "participation", "communication", "netiquette", "ai policy", "accessibility"],
      fields: [
        { key: "attendanceExpectations", label: "Attendance expectations", required: true, valueKind: "long_text" },
        { key: "participationExpectations", label: "Participation expectations", required: true, valueKind: "long_text" },
        { key: "communicationExpectations", label: "Communication and response expectations", required: true, valueKind: "long_text" },
        { key: "academicBehaviorExpectations", label: "Academic behavior expectations", required: true, valueKind: "long_text" },
        { key: "onlineConductExpectations", label: "Online conduct or netiquette", required: true, valueKind: "long_text" },
        {
          key: "aiUsePolicy",
          label: "Course-specific generative AI use policy",
          required: true,
          valueKind: "long_text",
          guidance: "State the faculty member's specific policy for student AI use.",
          references: ["ASU OP 10.26", "Faculty Senate and Dean's Council 2025 guidance"],
        },
        { key: "accessibilityProcess", label: "Accessibility and accommodation process", required: true, valueKind: "long_text" },
      ],
    },
    {
      id: "program",
      title: "Program information",
      requirement: "optional_by_program",
      managedBy: "program_or_department",
      headingAliases: ["program information", "department information", "degree information", "accreditation information"],
      fields: [
        { key: "programInformation", label: "Program or department-specific information", required: false, valueKind: "long_text" },
      ],
    },
    {
      id: "institutionalPolicies",
      title: "Institutional policies and procedures",
      requirement: "required_institution_managed",
      managedBy: "institution",
      headingAliases: ["institutional policies and procedures", "university policies", "academic integrity", "students with disabilities", "title ix", "religious holy day", "student handbook"],
      fields: [
        { key: "institutionalAcademicIntegrity", label: "Academic Integrity and Honor Code", required: true, valueKind: "institution_block", references: ["ASU OP 06.14"] },
        { key: "institutionalDisability", label: "Students with Disabilities / reasonable accommodation", required: true, valueKind: "institution_block", references: ["ASU OP 10.24"] },
        { key: "institutionalTitleIX", label: "Title IX and sexual misconduct policy", required: true, valueKind: "institution_block", references: ["ASU OP 16.03"] },
        { key: "institutionalReligiousHolyDay", label: "Religious Holy Day absence policy", required: true, valueKind: "institution_block", references: ["ASU OP 10.19"] },
        { key: "studentHandbookLink", label: "ASU Student Handbook link", required: true, valueKind: "institution_block", references: ["ASU OP 06.14"] },
      ],
    },
    {
      id: "additionalItems",
      title: "Additional items",
      requirement: "optional_by_program",
      managedBy: "professor_and_program",
      headingAliases: ["additional items", "additional policies", "support services", "technical support", "academic support", "library services", "turnitin", "copyright", "grade appeal"],
      fields: [
        {
          key: "additionalItems",
          label: "Additional policies, procedures, resources, and support services",
          required: false,
          valueKind: "list",
          guidance: "May include course evaluations, TurnItIn, plagiarism, copyright, incomplete grades, course drops, grade appeals, basic needs, syllabus changes, server unavailability, technical support, academic support, and library services.",
        },
      ],
    },
    {
      id: "courseOutline",
      title: "Course outline",
      requirement: "required",
      managedBy: "professor",
      headingAliases: ["course outline", "course schedule", "weekly schedule", "schedule", "calendar", "topics and assignments", "lecture schedule"],
      fields: [
        {
          key: "courseOutline",
          label: "Lecture or discussion outline with major assignments and examinations",
          required: true,
          valueKind: "structured_list",
          guidance: "Provide the most accurate and useful description reasonably possible for each lecture or discussion, including major assignments and examinations.",
          references: ["TAC 19", "THECB", "HB 2504", "ASU OP 06.14"],
        },
      ],
    },
  ],
});

export function syllabusFieldDefinitions(profile = ANGELO_STATE_2026_PROFILE) {
  return [
    ...profile.operationalMetadata.map((field) => ({ ...field, sectionId: "identity", sectionTitle: "Course identity and Blackboard mapping", sectionRequirement: "operational" })),
    ...profile.sections.flatMap((section) => section.fields.map((field) => ({
      ...field,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionRequirement: section.requirement,
      managedBy: section.managedBy,
    }))),
  ];
}

export function isSyllabusValuePresent(value) {
  if (Array.isArray(value)) return value.some((item) => isSyllabusValuePresent(item));
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return String(value ?? "").trim().length > 0;
}

export function evaluateSyllabusRequirements(fields = {}, profile = ANGELO_STATE_2026_PROFILE) {
  const items = syllabusFieldDefinitions(profile).map((definition) => {
    const field = fields[definition.key];
    const present = isSyllabusValuePresent(field?.value);
    let status = present ? "present" : "missing";
    if (definition.managedBy === "institution" && !present) status = "institution_managed";
    else if (definition.required === false && !present) status = "optional";
    else if (definition.required === "conditional" && !present) status = "conditional_review";
    else if (definition.sectionRequirement === "operational" && !present) status = "operational_missing";
    return { ...definition, field: field || null, present, status };
  });

  const requiredItems = items.filter((item) => item.required === true && item.managedBy !== "institution" && item.sectionRequirement !== "operational");
  const requiredComplete = requiredItems.filter((item) => item.present).length;
  return {
    items,
    requiredComplete,
    requiredTotal: requiredItems.length,
    missingRequired: items.filter((item) => item.status === "missing"),
    conditionalReview: items.filter((item) => item.status === "conditional_review"),
    institutionManaged: items.filter((item) => item.status === "institution_managed"),
    optional: items.filter((item) => item.status === "optional"),
    readyForApproval: requiredItems.length > 0 && requiredComplete === requiredItems.length,
  };
}
