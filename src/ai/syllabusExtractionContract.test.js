import assert from "node:assert/strict";
import test from "node:test";

import {
  extractDeterministicSyllabus,
  mergeSyllabusExtraction,
  normalizeSyllabusSourceText,
} from "./syllabusExtractionContract.js";

const COMPLETE_SAMPLE = `
Course Title: Introduction to Media Studies
Course Code: COMM 1307
Section: 010
Term: Fall 2026
Credit Hours: 3

Course Description
This course examines media institutions, visual communication, audiences, and the social effects of media. The description matches the approved catalog description.
Prerequisite: None.
Technical skills: Students must be able to use a web browser and upload files.

Contact Information
Instructor Title: Professor
Instructor: Avery Morgan
Phone: 325-555-1212
ASU Email: avery.morgan@angelo.edu
Office Location: Library 210
Office Hours: Monday and Wednesday 2:00-4:00 p.m.

Course Delivery
Modality: Hybrid with in-person meetings and asynchronous Blackboard activities.
Meeting Times: Tuesday and Thursday 9:30-10:45 a.m.
Meeting Location: Academic Building 101
Blackboard is the learning management system for announcements, assignments, and grades.

Texts and Materials
Required Reading: Media and Culture, 13th edition
Recommended Reading: The Associated Press Stylebook
Required hardware: Laptop or desktop computer
Required software: Current browser and word processor
Required subscription: None
Supplemental materials: Course worksheets
Materials are available through the ASU Bookstore and the library.

Outcomes
Explain how media industries shape culture.
Analyze visual and audio messages using evidence.
Assessment methods include scene analyses, discussions, and the final project.

Objectives
Identify major media forms.
Compare competing interpretations of media effects.

Grading Criteria
A = 90-100; B = 80-89; C = 70-79; D = 60-69; F = below 60
Scene analyses 25%
Discussion boards 20%
Midterm examination 20%
Final project 35%
Late work receives a deduction unless an accommodation applies.
Final Assessment: Culminating media-analysis project.

Course Expectations
Attendance is required for scheduled in-person meetings.
Participation includes weekly discussion and peer response.
Communication: Use ASU email; the instructor responds within two business days.
Academic behavior follows the Honor Code.
Online conduct must remain respectful and evidence-based.
Generative AI may be used only when an assignment explicitly permits it and must be disclosed.
Students seeking accommodations should contact the appropriate ASU office and notify the instructor.

Institutional Policies and Procedures
Academic Integrity and Honor Code information is provided through the Student Handbook.
Students with Disabilities and reasonable accommodation information is included.
Title IX and sexual misconduct reporting information is included.
Student absence for observance of a religious holy day is included.

Course Outline
Week 1: Introduction to media studies and course expectations
Week 2: Visual language; Scene Analysis 1 assigned
Week 3: Media industries and ownership
Week 4: Audience theories; Midterm examination
Week 5: Representation and identity
Week 6: Digital platforms and algorithms
Week 7: Final project workshop
Week 8: Culminating project presentations
`;

const PDF_REGRESSION_SAMPLE = `
MARV 113 | Superhero 101: Marvel Heroes in Film | Fall 2026 | MOCK
EdNotebook staging demonstration - not an official university syllabus Page 2
Course MARV 113-01: Superhero 101 - Marvel Heroes in Film
Term Fall 2026, 8-Week Session: September 1 through October 22, 2026
Credit Hours 3 semester credit hours
Description
This course surveys principal Marvel superheroes who have appeared in theatrically released feature films and examines how film and media techniques construct their identities.
Requisites
Prerequisite Knowledge or Courses
No formal course prerequisite. Students should be prepared for college-level reading and analytical writing.
Technical Skills and Other Competencies
Use a web browser, Blackboard, EdNotebook, PDF annotation, presentation software, and basic image-editing tools.
Instructor Contact Information
Title and Name Professor Lawrence McGaffie (mock course demonstration)
ASU-Style Email lmcgaffie@angelo.example.edu - mock address
Phone (325) 555-0113
Office Media Arts Building 318
Office Hours Tuesday and Thursday, 3:00-5:00 p.m.; Wednesday, 10:00 a.m.-12:00 p.m.; and by
appointment
Other Contact Blackboard course messages
Course Delivery
Modality In-person with required Blackboard and EdNotebook support
Meeting Time Tuesday and Thursday, 5:30-7:00 p.m.
Room Media Arts Building 204
 Blackboard is the official learning management system for announcements and grades.
 Regular and substantive interaction includes two instructor-led meetings each week and individualized feedback.
Texts and Materials
Required Readings and Media
 MARV 113 Course Media Reader (2026), provided through Blackboard at no additional charge.
 Assigned feature films or legally provided excerpts; library access or alternate viewing arrangements are provided.
Recommended Resources
 A film-studies glossary and citation guide.
 University library film databases and streaming collections.
Required Hardware, Software, and Supplies
 Laptop or tablet capable of web access, PDF viewing, and video playback.
 Current web browser; access to Blackboard and EdNotebook; presentation software; and an image-editing tool.
 Digital or physical sketchbook and scene-analysis worksheets.
 No paid software subscription is required.
Course-Level Outcomes and Objectives
Course-Level Outcomes
1. Identify and contextualize principal Marvel superheroes who have appeared in theatrical films.
2. Analyze how costume, color, cinematography, editing, performance, music, and effects communicate character.
Assessment of Outcomes
 Outcomes 1 and 2: weekly checks, scene-analysis memos, and a final project.
Course-Level Objectives
1. Identify at least 40 principal Marvel film heroes.
2. Compare two versions of a Marvel hero using evidence.
Grading Criteria
Grading Scale
A 90-100%: Excellent achievement
B 80-89%: Good achievement
C 70-79%: Satisfactory achievement
D 60-69%: Limited achievement
F Below 60%: Unsatisfactory achievement
Grade Breakdown
Weekly Hero and Film Checks 10% 100
Scene Analysis Memos 20% 200
Original Superhero Concept Portfolio 20% 200
Final Media Presentation 15% 150
Major Assignment Summary
 Scene Analysis Memos: Two evidence-based analyses.
 Original Superhero Concept Portfolio: An original design and rationale.
Final Examination / Culminating Activity
The course uses a culminating presentation rather than a traditional written final examination. It will occur Thursday, October 22, 2026, from 5:30-7:30 p.m. in Media Arts Building 204.
Course Expectations
Attendance
Because the course is compressed into eight weeks, students should attend every meeting.
Preparation and Participation
Complete assigned viewing before class and contribute respectfully.
Communication
Use Blackboard messages; the instructor responds within two business days.
Late Work
Major assignments may be submitted up to 72 hours late with a 10% deduction.
Academic Behavior
Disagreement must remain evidence-based and respectful.
Online Conduct
Use professional language in discussion boards and messages.
Course-Specific Generative AI Policy
AI USE: LIMITED AND DISCLOSED. Generative AI may be used for brainstorming but may not replace the student's own analysis.
Accessibility and Accommodation Process
Students who need reasonable accommodations should contact the university accessibility office.
Institutional Policies and Procedures
Academic Integrity and Student Handbook
Mock handbook link: https://example.edu/student-handbook
Students with Disabilities
Reasonable accommodation information is included.
Title IX and Nondiscrimination
Title IX reporting information is included.
Religious Holy Day Absence
Religious observance absence information is included.
Additional Items, Resources, and Procedures
TurnItIn and plagiarism guidance; copyright guidance; technical support; library services.
Eight-Week Course Outline
Wk Date Lecture / Discussion Film and Hero Focus Assignments / Due
1 Tue 9/1 Course orientation and visual iconography. Iron Man and Captain America. Hero Check 1.
1 Thu 9/3 Film form, editing, sound, performance, and evidence. Spider-Man and X-Men. Visual annotation due.
8 Thu 10/22 Culminating media presentations and reflection. Final Presentation due.
COURSE SCOPE REFERENCE
Mock technology help desk: (325) 555-0199.
`;

const PDF_WITH_FONT_ARTIFACTS = PDF_REGRESSION_SAMPLE.replaceAll("\u007f", "\uf0b7");

test("extracts the ASU syllabus checklist fields before AI", () => {
  const result = extractDeterministicSyllabus(COMPLETE_SAMPLE);

  assert.equal(result.profile.profileKey, "angelo-state-2026");
  assert.equal(result.fields.courseCode.value, "COMM 1307");
  assert.equal(result.fields.instructorEmail.value, "avery.morgan@angelo.edu");
  assert.match(String(result.fields.lmsUse.value), /Blackboard/i);
  assert.ok(result.fields.courseOutcomes.value.length >= 2);
  assert.ok(result.fields.gradingBreakdown.value.length >= 3);
  assert.match(String(result.fields.aiUsePolicy.value), /Generative AI/i);
  assert.ok(result.fields.institutionalTitleIX);
  assert.ok(result.fields.courseOutline.value.length >= 8);
  assert.ok(result.requirementReview.requiredTotal > 20);
});

test("normalizes PDF font artifacts and repeated page furniture", () => {
  const normalized = normalizeSyllabusSourceText(PDF_WITH_FONT_ARTIFACTS);
  assert.doesNotMatch(normalized, /\uf0b7|\ufffd/u);
  assert.doesNotMatch(normalized, /EdNotebook staging demonstration.*Page 2/i);
  assert.doesNotMatch(normalized, /MARV 113 \| Superhero 101.*MOCK/i);
  assert.match(normalized, /• Blackboard is the official learning management system/i);
});

test("extracts the realistic eight-week PDF without false phone conflicts", () => {
  const result = extractDeterministicSyllabus(PDF_WITH_FONT_ARTIFACTS);

  assert.equal(result.fields.courseTitle.value, "Superhero 101 - Marvel Heroes in Film");
  assert.equal(result.fields.courseCode.value, "MARV 113");
  assert.equal(result.fields.sectionNumber.value, "01");
  assert.equal(result.fields.instructorName.value, "Lawrence McGaffie");
  assert.equal(result.fields.instructorPhone.value, "(325) 555-0113");
  assert.equal(
    result.fields.officeHours.value,
    "Tuesday and Thursday, 3:00-5:00 p.m.; Wednesday, 10:00 a.m.-12:00 p.m.; and by appointment",
  );
  assert.ok(result.fields.recommendedReadings.value.length >= 2);
  assert.ok(result.fields.supplementalMaterials.value.length >= 1);
  assert.ok(result.fields.materialAccess.value.length >= 1);
  assert.ok(result.fields.courseOutcomes.value.length >= 2);
  assert.ok(result.fields.outcomeAssessmentMethods.value.length >= 1);
  assert.ok(result.fields.courseOutline.value.length >= 3);
  assert.equal(result.fields.finalExamDate.value, "October 22, 2026");
  assert.equal(result.fields.finalExamTime.value, "5:30-7:30 p.m.");
  assert.equal(result.fields.finalExamLocation.value, "Media Arts Building 204");
  assert.match(String(result.fields.aiUsePolicy.value), /LIMITED AND DISCLOSED/i);
  assert.equal(result.conflictingInformation.length, 0);
});

test("reports missing required professor-managed sections while separating institution-managed blocks", () => {
  const result = extractDeterministicSyllabus(
    "Course Title: Test Course\nCourse Code: TEST 1000",
  );

  assert.ok(
    result.requirementReview.missingRequired.some(
      (item) => item.key === "courseDescription",
    ),
  );
  assert.ok(
    result.requirementReview.institutionManaged.some(
      (item) => item.key === "institutionalAcademicIntegrity",
    ),
  );
  assert.ok(
    result.requirementReview.optional.some(
      (item) => item.key === "programInformation",
    ),
  );
  assert.ok(result.missingInformation.includes("Aligned course description"));
});

test("AI merging accepts only known syllabus fields and recalculates requirements", () => {
  const deterministic = extractDeterministicSyllabus(
    "Course Title: Test Course\nCourse Code: TEST 1000",
  );
  const merged = mergeSyllabusExtraction(deterministic, {
    fields: {
      courseDescription: {
        value: "An approved course description.",
        confidence: 0.91,
        sourceExcerpt: "An approved course description.",
      },
      unsupportedInventedField: {
        value: "must not be stored",
        confidence: 1,
        sourceExcerpt: "none",
      },
    },
    missingInformation: [],
    conflictingInformation: [],
    proposedCourseOutline: null,
  });

  assert.equal(merged.fields.courseDescription.method, "ai_uncertainty_resolution");
  assert.equal(merged.fields.unsupportedInventedField, undefined);
  assert.ok(
    !merged.requirementReview.missingRequired.some(
      (item) => item.key === "courseDescription",
    ),
  );
});


test("recovers office hours when the PDF puts the value on following lines", () => {
  const result = extractDeterministicSyllabus(`
Course Title: Test Course
Course Code: TEST 1000
Contact Information
Instructor Title: Professor
Instructor: Taylor Morgan
Phone: 325-555-0100
ASU Email: taylor.morgan@angelo.example.edu
Office Location: Media Arts 318
Office Hours
Tuesday and Thursday, 3:00-5:00 p.m.; Wednesday, 10:00 a.m.-12:00 p.m.; and by
appointment
Other Contact: Blackboard course messages
`);

  assert.equal(
    result.fields.officeHours.value,
    "Tuesday and Thursday, 3:00-5:00 p.m.; Wednesday, 10:00 a.m.-12:00 p.m.; and by appointment",
  );
});

test("recovers office hours when a PDF separates the plural suffix", () => {
  const result = extractDeterministicSyllabus(`
Course Title: Test Course
Course Code: TEST 1000
Contact Information
Instructor Title: Professor
Instructor: Taylor Morgan
Phone: 325-555-0100
ASU Email: taylor.morgan@angelo.example.edu
Office Location: Media Arts 318
Office Hour s
Tuesday and Thursday, 3:00-5:00 p.m.; and by appointment
Other Contact: Blackboard course messages
`);

  assert.equal(
    result.fields.officeHours.value,
    "Tuesday and Thursday, 3:00-5:00 p.m.; and by appointment",
  );
});
