/**
 * Canonical, framework-independent feature definitions for EdNotebook.
 *
 * This catalog describes controls; it does not grant access by itself. Sensitive
 * capabilities must still be enforced by the database, server functions, and
 * institution-aware authorization checks.
 */

export const FEATURE_PATHWAYS = Object.freeze([
  "shared",
  "student",
  "professor",
  "publisher",
  "security",
  "accessibility",
  "theme",
  "integration",
]);

export const FEATURE_READINESS = Object.freeze([
  "demonstration",
  "built_in_part",
  "implemented",
  "deployment_required",
  "pilot_testing",
  "planned",
]);

export const CONTROL_TYPES = Object.freeze(["boolean", "number", "select", "text"]);
export const CONTROL_SCOPES = Object.freeze(["platform", "institution", "pathway", "course", "account"]);
export const FEATURE_SENSITIVITY = Object.freeze(["standard", "sensitive", "critical"]);
export const DISABLE_BEHAVIORS = Object.freeze(["hide", "read_only", "block", "degrade"]);

const SHARED_SCOPES = ["platform", "institution", "pathway", "course", "account"];
const TENANT_SCOPES = ["platform", "institution", "pathway", "course"];
const PLATFORM_INSTITUTION_SCOPES = ["platform", "institution"];
const PLATFORM_ONLY = ["platform"];

function feature({
  key,
  name,
  pathway,
  category,
  description,
  helpText,
  readiness = "built_in_part",
  controlType = "boolean",
  defaultValue = false,
  allowedScopes = SHARED_SCOPES,
  institutionDelegable = allowedScopes.includes("institution"),
  sensitivity = "standard",
  disableBehavior = "hide",
  affectedPathways = pathway === "shared" ? ["student", "professor", "publisher"] : [pathway],
  dependencies = [],
  tags = [],
  options = [],
  minimum = null,
  maximum = null,
  alwaysOn = false,
}) {
  return {
    key,
    name,
    pathway,
    category,
    description,
    helpText,
    readiness,
    controlType,
    defaultValue,
    allowedScopes,
    institutionDelegable,
    sensitivity,
    disableBehavior,
    affectedPathways,
    dependencies,
    tags,
    options,
    minimum,
    maximum,
    alwaysOn,
  };
}

const DEFINITIONS = [
  // Shared platform controls
  feature({
    key: "shared.authentication",
    name: "Account sign-in",
    pathway: "shared",
    category: "Accounts and access",
    description: "Allows approved people to sign in to EdNotebook and open their permitted workspace.",
    helpText: "Turning this off blocks ordinary account access. Use it only for a planned maintenance window or a confirmed security incident.",
    readiness: "implemented",
    defaultValue: true,
    allowedScopes: PLATFORM_ONLY,
    institutionDelegable: false,
    sensitivity: "critical",
    disableBehavior: "block",
    tags: ["login", "account", "maintenance"],
  }),
  feature({
    key: "shared.institution_selection",
    name: "Institution selection",
    pathway: "shared",
    category: "Accounts and access",
    description: "Shows the institution choice used to place students, professors, and administrators in the correct school environment.",
    helpText: "Institution selection is the first tenant boundary. Free independent use can remain available, but institutional enrollment requires an approved school relationship.",
    defaultValue: true,
    sensitivity: "critical",
    disableBehavior: "block",
    dependencies: ["shared.authentication"],
    tags: ["institution", "signup", "tenant"],
  }),
  feature({
    key: "shared.institution_affiliation",
    name: "Institution affiliation",
    pathway: "shared",
    category: "Accounts and access",
    description: "Links an account to one approved institution for institutional courses, rosters, grades, and school-only services.",
    helpText: "Affiliation must use an approved institution record, not a typed school name. Changing schools should use a reviewed transfer request.",
    defaultValue: true,
    sensitivity: "critical",
    disableBehavior: "block",
    dependencies: ["shared.institution_selection"],
    tags: ["institution", "identity", "privacy"],
  }),
  feature({
    key: "shared.course_access",
    name: "Course access",
    pathway: "shared",
    category: "Courses",
    description: "Allows an enrolled learner or authorized educator to open protected course content.",
    helpText: "The visible control must be backed by course membership and institution-aware server authorization.",
    readiness: "implemented",
    defaultValue: true,
    sensitivity: "critical",
    disableBehavior: "read_only",
    dependencies: ["shared.authentication", "shared.institution_affiliation"],
    tags: ["course", "enrollment", "membership"],
  }),
  feature({
    key: "shared.account_settings",
    name: "Account settings",
    pathway: "shared",
    category: "Accounts and access",
    description: "Lets a person manage profile, visibility, assistant, social, and account preferences.",
    helpText: "Some current settings are device-only. Institution controls can set safe limits without silently changing personal profile content.",
    readiness: "implemented",
    defaultValue: true,
    disableBehavior: "read_only",
    tags: ["profile", "preferences", "privacy"],
  }),
  feature({
    key: "shared.people_search",
    name: "People search",
    pathway: "shared",
    category: "Community",
    description: "Lets users find visible student and educator profiles inside an allowed audience.",
    helpText: "Institution deployments should limit results to the active institution and respect every profile's discoverability setting.",
    defaultValue: false,
    sensitivity: "sensitive",
    disableBehavior: "hide",
    dependencies: ["shared.institution_affiliation"],
    tags: ["search", "profiles", "privacy"],
  }),
  feature({
    key: "shared.community",
    name: "Community spaces",
    pathway: "shared",
    category: "Community",
    description: "Provides class, institution, and approved public discussion spaces with visible audience labels.",
    helpText: "Turning this off should preserve required professor, support, and appeal communication channels.",
    defaultValue: false,
    sensitivity: "sensitive",
    disableBehavior: "read_only",
    dependencies: ["shared.authentication"],
    tags: ["posts", "groups", "messages"],
  }),
  feature({
    key: "shared.private_files",
    name: "Private file storage",
    pathway: "shared",
    category: "Files and storage",
    description: "Stores course, assignment, and publication files outside the public website in protected storage.",
    helpText: "Disabling new uploads should not remove existing files. Existing approved files should become read-only unless a security hold requires blocking them.",
    readiness: "deployment_required",
    defaultValue: true,
    sensitivity: "critical",
    disableBehavior: "read_only",
    dependencies: ["shared.authentication", "security.row_level_access"],
    tags: ["storage", "files", "privacy"],
  }),
  feature({
    key: "shared.audit_history",
    name: "Audit history",
    pathway: "shared",
    category: "Governance",
    description: "Records important administrative, security, file, course, roster, grade, and integration changes.",
    helpText: "Audit history is an accountability control and must not be disabled by an institution administrator.",
    readiness: "implemented",
    defaultValue: true,
    allowedScopes: PLATFORM_ONLY,
    institutionDelegable: false,
    sensitivity: "critical",
    disableBehavior: "block",
    alwaysOn: true,
    tags: ["audit", "accountability", "security"],
  }),
  feature({
    key: "shared.data_export",
    name: "Approved data exports",
    pathway: "shared",
    category: "Governance",
    description: "Creates scoped reports for authorized users without exposing records from another institution.",
    helpText: "Exports should be logged, time-limited, protected from spreadsheet formula injection, and limited to the administrator's assigned institution.",
    defaultValue: false,
    sensitivity: "critical",
    disableBehavior: "block",
    dependencies: ["shared.audit_history"],
    tags: ["report", "download", "privacy"],
  }),
  feature({
    key: "shared.retention",
    name: "Retention rules",
    pathway: "shared",
    category: "Governance",
    description: "Keeps or removes records according to approved institution, course, and legal requirements.",
    helpText: "Changing retention can affect future deletion dates. Existing legal holds must always take priority.",
    readiness: "implemented",
    defaultValue: true,
    sensitivity: "critical",
    disableBehavior: "block",
    dependencies: ["shared.audit_history"],
    tags: ["retention", "records", "deletion"],
  }),
  feature({
    key: "research.human_subjects_collection",
    name: "Human-subjects research collection",
    pathway: "shared",
    category: "Governance",
    description: "Permits a course-scoped research pilot to collect only the approved instrument version after every independent research gate passes.",
    helpText: "This control never grants approval by itself. Written institutional determination, explicit activation, participant choice, and database enforcement remain required.",
    readiness: "pilot_testing",
    defaultValue: false,
    allowedScopes: ["platform", "institution", "course"],
    sensitivity: "critical",
    disableBehavior: "block",
    dependencies: ["shared.audit_history", "shared.retention"],
    tags: ["research", "human subjects", "irb", "pilot"],
  }),
  feature({
    key: "shared.ai_assistant",
    name: "AI assistant",
    pathway: "shared",
    category: "AI and automation",
    description: "Provides approved assistance through the built-in experience or an institution-approved server gateway.",
    helpText: "No provider key belongs in the browser. Institutions can turn off external AI while leaving ordinary course tools available.",
    readiness: "demonstration",
    defaultValue: false,
    sensitivity: "sensitive",
    disableBehavior: "hide",
    dependencies: ["integration.ai_gateway"],
    tags: ["ai", "assistant", "gateway"],
  }),
  feature({
    key: "shared.notifications",
    name: "Course notifications",
    pathway: "shared",
    category: "Communication",
    description: "Sends approved course and account notices using configured delivery channels.",
    helpText: "Required security and account notices must remain available even when optional reminders are disabled.",
    readiness: "planned",
    defaultValue: false,
    sensitivity: "sensitive",
    disableBehavior: "degrade",
    tags: ["email", "push", "reminders"],
  }),
  feature({
    key: "shared.billing",
    name: "Paid services",
    pathway: "shared",
    category: "Billing and plans",
    description: "Applies verified subscription and purchase entitlements without storing card information in EdNotebook.",
    helpText: "Turning paid services off must preserve already-authorized records and must not invent or remove a payment status.",
    defaultValue: false,
    sensitivity: "critical",
    disableBehavior: "read_only",
    dependencies: ["integration.stripe"],
    tags: ["billing", "subscription", "entitlement"],
  }),

  // Student pathway
  feature({ key: "student.dashboard", name: "Student dashboard", pathway: "student", category: "Student workspace", description: "Shows the learner's classes, progress, due work, and account tools in one place.", helpText: "Institution controls can simplify the dashboard without exposing another school's records.", readiness: "implemented", defaultValue: true, dependencies: ["shared.authentication"], tags: ["overview", "student"] }),
  feature({ key: "student.course_search", name: "Course search", pathway: "student", category: "Student workspace", description: "Finds public course listings by institution, course, subject, or professor.", helpText: "Public listings contain directory information only; lessons, rosters, files, and grades stay protected.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", dependencies: ["shared.institution_selection"], tags: ["directory", "classes"] }),
  feature({ key: "student.enrollment", name: "Enrollment requests", pathway: "student", category: "Student workspace", description: "Lets a student request a course link that an authorized professor can approve.", helpText: "An institutional course request requires the same active institution and a protected roster match.", readiness: "implemented", defaultValue: true, sensitivity: "critical", disableBehavior: "block", dependencies: ["shared.institution_affiliation", "student.course_search"], tags: ["enrollment", "roster"] }),
  feature({ key: "student.course_runtime", name: "Interactive course player", pathway: "student", category: "Learning", description: "Opens published lessons, decisions, knowledge checks, progress, and course completion.", helpText: "Disabling this feature should preserve learner records and show a plain-language access message.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["shared.course_access"], tags: ["lessons", "progress"] }),
  feature({ key: "student.assignments", name: "Student assignments", pathway: "student", category: "Learning", description: "Shows assigned work and provides the approved student work area.", helpText: "Existing submissions must remain preserved when new assignment work is paused.", defaultValue: true, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["shared.course_access"], tags: ["assignment", "submission"] }),
  feature({ key: "student.grade_report", name: "Student grade report", pathway: "student", category: "Grades", description: "Shows only the signed-in student's finalized grades and the professor's published scale.", helpText: "This control must never broaden grade visibility. Turning it off hides the report but does not delete grades.", defaultValue: true, sensitivity: "critical", disableBehavior: "hide", dependencies: ["shared.course_access"], tags: ["grades", "report"] }),
  feature({ key: "student.notes", name: "Student notes", pathway: "student", category: "Learning", description: "Keeps personal study notes beside the relevant course.", helpText: "Current notes may be device-only. A control should clearly distinguish device notes from cloud-synchronized notes.", readiness: "implemented", defaultValue: true, disableBehavior: "read_only", tags: ["notes", "device"] }),
  feature({ key: "student.community", name: "Student community", pathway: "student", category: "Community", description: "Provides class and institution learning groups with clear audience boundaries.", helpText: "An institution can make community spaces read-only while preserving professor and support communication.", defaultValue: false, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["shared.community", "shared.institution_affiliation"], tags: ["groups", "posts"] }),
  feature({ key: "student.people_search", name: "Student people search", pathway: "student", category: "Community", description: "Searches discoverable people within the student's approved institution and audience.", helpText: "Private or undiscoverable profiles and people from another institution must never appear.", defaultValue: false, sensitivity: "critical", dependencies: ["shared.people_search", "shared.institution_affiliation"], tags: ["friends", "profiles"] }),
  feature({ key: "student.messaging", name: "Student messaging", pathway: "student", category: "Communication", description: "Lets a learner use permitted class, educator, and peer conversations.", helpText: "Peer messaging may be restricted while required professor, support, safety, and appeal channels remain open.", defaultValue: false, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["shared.authentication"], tags: ["messages", "communication"] }),
  feature({ key: "student.public_page", name: "Student profile page", pathway: "student", category: "Community", description: "Lets a learner publish only the profile details and work they choose.", helpText: "New pages should remain private and hidden from search until the learner changes both settings.", readiness: "implemented", defaultValue: false, sensitivity: "critical", dependencies: ["shared.account_settings"], tags: ["profile", "portfolio"] }),
  feature({ key: "student.opportunities", name: "Student opportunities", pathway: "student", category: "Opportunities", description: "Shows approved advisory, internship, literacy, and future-work opportunities.", helpText: "Do not activate broad matching until privacy terms, moderation, and partner verification are ready.", readiness: "planned", defaultValue: false, sensitivity: "sensitive", tags: ["internship", "career"] }),
  feature({ key: "student.demo_workspace", name: "Student demonstration workspace", pathway: "student", category: "Demonstration", description: "Provides clearly labeled sample records so a user can explore without affecting an account.", helpText: "Demonstration records must remain visibly separate from live institutional records.", readiness: "implemented", defaultValue: true, allowedScopes: ["platform", "institution", "pathway"], tags: ["demo", "testing"] }),
  feature({ key: "student.institution_transfer", name: "Institution transfer request", pathway: "student", category: "Accounts and access", description: "Moves a learner to another institution through a reviewed request instead of an immediate school switch.", helpText: "Approval should end prior environment access while preserving historical records and a complete change log.", readiness: "implemented", defaultValue: true, sensitivity: "critical", disableBehavior: "block", dependencies: ["shared.institution_affiliation", "shared.audit_history"], tags: ["transfer", "institution"] }),

  // Professor pathway
  feature({ key: "professor.dashboard", name: "Professor dashboard", pathway: "professor", category: "Professor workspace", description: "Shows the educator's classes, pending links, grades, and teaching tools.", helpText: "Every count and search must be limited to courses the educator is authorized to manage.", readiness: "built_in_part", defaultValue: true, dependencies: ["shared.authentication"], tags: ["overview", "educator"] }),
  feature({ key: "professor.course_builder", name: "Course builder", pathway: "professor", category: "Course creation", description: "Builds a structured course from professor-approved content and templates.", helpText: "Generated material remains a draft until the professor reviews and publishes it.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", disableBehavior: "read_only", tags: ["builder", "course"] }),
  feature({ key: "professor.course_publish", name: "Course publishing", pathway: "professor", category: "Course creation", description: "Publishes an approved course version to enrolled learners.", helpText: "Turning publishing off should leave existing published versions readable unless a separate emergency control blocks them.", readiness: "implemented", defaultValue: true, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["professor.course_builder", "shared.audit_history"], tags: ["publish", "course"] }),
  feature({ key: "professor.assignment_templates", name: "Assignment templates", pathway: "professor", category: "Assignments", description: "Creates reusable assignment structures, rubrics, limits, and learner instructions.", helpText: "Templates do not publish themselves; the professor controls placement and release.", readiness: "implemented", defaultValue: true, dependencies: ["shared.course_access"], tags: ["assignment", "rubric"] }),
  feature({ key: "professor.roster", name: "Roster and account linking", pathway: "professor", category: "Rosters", description: "Imports or reviews institution-scoped learners and approves account-to-roster matches.", helpText: "Raw identifiers must remain protected, and educators must not search the platform-wide student population.", readiness: "built_in_part", defaultValue: true, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["shared.institution_affiliation", "shared.audit_history"], tags: ["roster", "identity"] }),
  feature({ key: "professor.gradebook", name: "Professor gradebook", pathway: "professor", category: "Grades", description: "Lets an authorized professor manage grades only for courses they control.", helpText: "This area should require recent verification and must never display grades from another educator's course.", readiness: "built_in_part", defaultValue: true, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["security.sensitive_area_reauth", "shared.course_access"], tags: ["grades", "professor"] }),
  feature({ key: "professor.grade_publish", name: "Grade publishing", pathway: "professor", category: "Grades", description: "Makes finalized grades visible to the correct learner after professor confirmation.", helpText: "Pending or missing grades must not be released as final results.", readiness: "built_in_part", defaultValue: true, sensitivity: "critical", disableBehavior: "block", dependencies: ["professor.gradebook", "shared.audit_history"], tags: ["grades", "release"] }),
  feature({ key: "professor.attendance", name: "Attendance", pathway: "professor", category: "Class management", description: "Records attendance for an authorized class and date.", helpText: "Local attendance can remain available even when an external SIS connection is off.", readiness: "demonstration", defaultValue: false, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["shared.course_access"], tags: ["attendance", "class"] }),
  feature({ key: "professor.announcements", name: "Professor announcements", pathway: "professor", category: "Communication", description: "Sends an announcement to a selected class, institution, faculty, or approved public audience.", helpText: "The selected audience must be shown before publishing and enforced by course or institution membership.", readiness: "built_in_part", defaultValue: false, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["shared.community"], tags: ["announcement", "faculty"] }),
  feature({ key: "professor.verification", name: "Educator affiliation verification", pathway: "professor", category: "Accounts and access", description: "Reviews evidence for a public verified institution-affiliation badge.", helpText: "Verification affects the badge and institutional trust; it must not silently grant platform-wide administrator access.", readiness: "implemented", defaultValue: true, sensitivity: "critical", disableBehavior: "block", dependencies: ["shared.institution_affiliation", "security.secure_uploads"], tags: ["verification", "badge"] }),
  feature({ key: "professor.studio_materials", name: "Learning Studio materials", pathway: "professor", category: "Learning Studio", description: "Adds files, links, videos, quotations, and course-library resources.", helpText: "Cloud files must pass security review before learners can open them.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["shared.private_files"], tags: ["materials", "files"] }),
  feature({ key: "professor.studio_assignments", name: "Learning Studio assignments", pathway: "professor", category: "Learning Studio", description: "Builds assignment instructions, rubrics, files, and syllabus placement.", helpText: "A disabled editor should not remove existing assignments or student submissions.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["professor.assignment_templates"], tags: ["assignment", "studio"] }),
  feature({ key: "professor.studio_tools", name: "Subject tools", pathway: "professor", category: "Learning Studio", description: "Provides calculators, tables, maps, and subject-specific learning builders.", helpText: "Institutions can turn off individual tool families without disabling the course itself.", readiness: "implemented", defaultValue: true, tags: ["calculator", "table", "map"] }),
  feature({ key: "professor.studio_reader", name: "Reader and publishing tools", pathway: "professor", category: "Learning Studio", description: "Creates and assigns interactive readings and professor-authored publications.", helpText: "Commercial publishing controls remain separate from class-only professor authoring.", readiness: "built_in_part", defaultValue: true, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["publisher.interactive_reader"], tags: ["reader", "publication"] }),
  feature({ key: "professor.studio_slides", name: "Slide studio", pathway: "professor", category: "Learning Studio", description: "Creates structured academic presentations and exportable slide packages.", helpText: "External design connections must preserve course placement, ownership, and accessibility metadata.", readiness: "implemented", defaultValue: true, tags: ["slides", "presentation"] }),
  feature({ key: "professor.studio_room", name: "Private course room", pathway: "professor", category: "Learning Studio", description: "Provides course conversations or clearly labeled device-only notes.", helpText: "Cloud conversations require course membership; device notes never represent an official course message.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["shared.course_access"], tags: ["room", "messages"] }),

  // Publisher pathway
  feature({ key: "publisher.application", name: "Publisher application", pathway: "publisher", category: "Publisher access", description: "Collects an application from a publisher, author, professor-author, institution, or supplier.", helpText: "Submitting an application does not grant catalog, sales, or institution-administrator access.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", dependencies: ["shared.authentication"], tags: ["application", "partner"] }),
  feature({ key: "publisher.account_pathway", name: "Publisher account pathway", pathway: "publisher", category: "Publisher access", description: "Provides an approved publisher with a dedicated workspace separate from professor-only tools.", helpText: "Publisher approval and institution membership must be checked independently from professor status.", readiness: "planned", defaultValue: false, sensitivity: "critical", dependencies: ["publisher.application"], tags: ["account", "role"] }),
  feature({ key: "publisher.source_import", name: "Publication source import", pathway: "publisher", category: "Publishing", description: "Uploads a source document into private quarantine and creates a publication record.", helpText: "Source files remain unavailable until security, rights, and conversion checks allow release.", readiness: "implemented", defaultValue: false, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["publisher.account_pathway", "security.secure_uploads"], tags: ["upload", "book"] }),
  feature({ key: "publisher.conversion", name: "EduBook conversion", pathway: "publisher", category: "Publishing", description: "Converts approved source files into an interactive teaching publication.", helpText: "Conversion requires the document-security worker and human review of the result.", readiness: "deployment_required", defaultValue: false, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["publisher.source_import", "integration.railway_worker"], tags: ["edubook", "conversion"] }),
  feature({ key: "publisher.interactive_reader", name: "Interactive reader", pathway: "publisher", category: "Publishing", description: "Reads approved publications with chapters, notes, highlights, bookmarks, and questions.", helpText: "Access still depends on the publication's open, assigned, purchased, or rental entitlement.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", disableBehavior: "read_only", dependencies: ["shared.course_access"], tags: ["reader", "annotation"] }),
  feature({ key: "publisher.editorial_workflow", name: "Editorial and accessibility review", pathway: "publisher", category: "Publishing", description: "Tracks rights, accessibility, editorial status, revisions, and approval before publication.", helpText: "A publication must not bypass required review simply because its source conversion succeeded.", readiness: "built_in_part", defaultValue: false, sensitivity: "critical", disableBehavior: "block", dependencies: ["publisher.conversion", "accessibility.reporting"], tags: ["review", "rights"] }),
  feature({ key: "publisher.course_assignment", name: "Assign publications to courses", pathway: "publisher", category: "Distribution", description: "Makes an approved publication or chapter available in an authorized course.", helpText: "Course assignment creates a scoped entitlement; it does not make the source file public.", readiness: "built_in_part", defaultValue: false, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["publisher.editorial_workflow", "shared.course_access"], tags: ["assignment", "entitlement"] }),
  feature({ key: "publisher.catalog", name: "Publisher catalog", pathway: "publisher", category: "Distribution", description: "Lists approved publications for professor review and course selection.", helpText: "Only reviewed records should appear, and institutions may restrict catalogs available to their users.", readiness: "planned", defaultValue: false, sensitivity: "sensitive", dependencies: ["publisher.editorial_workflow"], tags: ["catalog", "library"] }),
  feature({ key: "publisher.commerce", name: "Publication purchases and rentals", pathway: "publisher", category: "Commerce", description: "Creates access after a verified purchase or rental event.", helpText: "The browser never grants paid access. Tax, refund, seller, and mobile-store rules must be approved first.", readiness: "planned", defaultValue: false, sensitivity: "critical", disableBehavior: "read_only", dependencies: ["publisher.catalog", "shared.billing"], tags: ["purchase", "rental"] }),
  feature({ key: "publisher.analytics", name: "Publisher analytics", pathway: "publisher", category: "Reporting", description: "Shows privacy-protected adoption and usage summaries to an approved publisher.", helpText: "Reports require minimum group sizes and must never reveal individual student activity or grades.", readiness: "planned", defaultValue: false, sensitivity: "critical", dependencies: ["shared.data_export"], tags: ["analytics", "privacy"] }),

  // Security controls
  feature({ key: "security.row_level_access", name: "Database access boundaries", pathway: "security", category: "Security", description: "Limits each account to rows allowed by its identity, institution, course, and role.", helpText: "This is a required server-side boundary. A screen-level switch is never a substitute for database authorization.", readiness: "implemented", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], alwaysOn: true, tags: ["rls", "authorization"] }),
  feature({ key: "security.secure_uploads", name: "Secure upload pipeline", pathway: "security", category: "Security", description: "Reserves storage, uploads to quarantine, and releases a file only after approved checks.", helpText: "If the security pipeline is unavailable, new cloud uploads should fail closed while existing approved files remain readable.", readiness: "deployment_required", defaultValue: true, allowedScopes: PLATFORM_INSTITUTION_SCOPES, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], dependencies: ["shared.private_files"], tags: ["upload", "quarantine"] }),
  feature({ key: "security.malware_scanning", name: "Malware and archive scanning", pathway: "security", category: "Security", description: "Inspects files and archives before learners or educators can open them.", helpText: "Do not mark scanning active until the deployed worker has passed health, malware, archive, timeout, and callback tests.", readiness: "deployment_required", defaultValue: false, allowedScopes: PLATFORM_INSTITUTION_SCOPES, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], dependencies: ["security.secure_uploads", "integration.railway_worker"], tags: ["malware", "scanner"] }),
  feature({ key: "security.retention_and_legal_hold", name: "Retention and legal holds", pathway: "security", category: "Security", description: "Prevents deletion when an approved retention date or legal hold still applies.", helpText: "Institution controls may add scoped rules but cannot release a platform or legal hold they do not own.", readiness: "implemented", defaultValue: true, allowedScopes: PLATFORM_INSTITUTION_SCOPES, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], dependencies: ["shared.retention", "shared.audit_history"], tags: ["legal hold", "records"] }),
  feature({ key: "security.sensitive_area_reauth", name: "Sensitive-area verification", pathway: "security", category: "Security", description: "Requires recent account verification before opening sensitive student and grade tools.", helpText: "The short unlock is an extra protection; normal course and database authorization still applies to every action.", readiness: "implemented", defaultValue: true, allowedScopes: PLATFORM_INSTITUTION_SCOPES, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["professor"], tags: ["reauth", "grades"] }),
  feature({ key: "security.admin_change_log", name: "Administrative change log", pathway: "security", category: "Security", description: "Records who changed a control, what changed, who was affected, and when it happened.", helpText: "Rollback creates another logged change; administrators must not erase prior versions.", readiness: "built_in_part", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], dependencies: ["shared.audit_history"], alwaysOn: true, tags: ["change log", "version"] }),
  feature({ key: "security.emergency_shutdown", name: "Emergency feature shutdown", pathway: "security", category: "Security", description: "Lets the platform owner stop a risky feature across every institution while preserving evidence and records.", helpText: "This master-only control requires recent verification, a reason, impact preview, and multiple confirmations.", readiness: "built_in_part", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], dependencies: ["security.admin_change_log"], tags: ["kill switch", "incident"] }),

  // Accessibility controls
  feature({ key: "accessibility.keyboard_navigation", name: "Keyboard navigation", pathway: "accessibility", category: "Accessibility", description: "Keeps interactive controls usable without a mouse.", helpText: "Keyboard access is a required product behavior and cannot be disabled by a platform or institution setting.", readiness: "implemented", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], alwaysOn: true, tags: ["keyboard", "focus"] }),
  feature({ key: "accessibility.reduced_motion", name: "Reduced motion", pathway: "accessibility", category: "Accessibility", description: "Removes nonessential animation when the user's device requests reduced motion.", helpText: "An institution may require reduced motion, but it must not force animation on for a user who requested less motion.", readiness: "implemented", defaultValue: true, allowedScopes: ["platform", "institution", "account"], sensitivity: "sensitive", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], alwaysOn: true, tags: ["motion", "preference"] }),
  feature({ key: "accessibility.text_alternatives", name: "Text alternatives", pathway: "accessibility", category: "Accessibility", description: "Requires meaningful text alternatives for instructional figures and important images.", helpText: "Decorative images may use an empty alternative; instructional meaning must always have a readable equivalent.", readiness: "implemented", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], alwaysOn: true, tags: ["alt text", "images"] }),
  feature({ key: "accessibility.contrast_mode", name: "High-contrast appearance", pathway: "accessibility", category: "Accessibility", description: "Offers a readable high-contrast appearance without changing course records or content.", helpText: "Theme locks must preserve contrast and may not block a user's required accessibility setting.", readiness: "built_in_part", defaultValue: false, allowedScopes: ["platform", "institution", "account"], affectedPathways: ["student", "professor", "publisher"], dependencies: ["theme.account_choice"], tags: ["contrast", "theme"] }),
  feature({ key: "accessibility.reporting", name: "Accessibility reporting", pathway: "accessibility", category: "Accessibility", description: "Tracks test evidence, findings, owners, status, and retest dates for platform and course experiences.", helpText: "A report documents evidence and open work; it does not by itself certify compliance.", readiness: "planned", defaultValue: false, allowedScopes: PLATFORM_INSTITUTION_SCOPES, sensitivity: "sensitive", disableBehavior: "read_only", affectedPathways: ["student", "professor", "publisher"], dependencies: ["shared.audit_history"], tags: ["audit", "wcag", "testing"] }),

  // Theme controls
  feature({ key: "theme.course_preset", name: "Course theme preset", pathway: "theme", category: "Themes", description: "Applies an approved course color and layout preset inside the unchanged EdNotebook account shell.", helpText: "A course theme must preserve navigation, warnings, accessibility controls, and sufficient contrast.", readiness: "implemented", controlType: "select", defaultValue: "ednotebook-default", options: ["ednotebook-default", "angelo-state-inspired", "ram-ready"], sensitivity: "sensitive", disableBehavior: "degrade", affectedPathways: ["student", "professor"], tags: ["course", "preset"] }),
  feature({ key: "theme.account_choice", name: "Personal theme choice", pathway: "theme", category: "Themes", description: "Lets a user choose from approved visual themes without changing records or permissions.", helpText: "A platform or institution lock may narrow visual choices, but accessibility preferences retain priority.", readiness: "built_in_part", controlType: "select", defaultValue: "classic", options: ["classic", "ram-ready", "nightshift", "letterpress"], affectedPathways: ["student", "professor", "publisher"], tags: ["appearance", "personal"] }),
  feature({ key: "theme.institution_brand", name: "Institution theme", pathway: "theme", category: "Themes", description: "Applies approved institution colors, name, and brand assets to that institution's environment.", helpText: "Institution branding must not mimic a false login page or hide EdNotebook security and accessibility controls.", readiness: "planned", controlType: "select", defaultValue: "inherit", allowedScopes: PLATFORM_INSTITUTION_SCOPES, sensitivity: "sensitive", affectedPathways: ["student", "professor", "publisher"], tags: ["brand", "institution"] }),
  feature({ key: "theme.platform_campaign", name: "Platform campaign theme", pathway: "theme", category: "Themes", description: "Schedules an approved seasonal or platform-wide visual treatment.", helpText: "Campaign themes should change appearance only and must have a start date, end date, rollback, and accessibility review.", readiness: "planned", controlType: "select", defaultValue: "none", options: ["none", "seasonal", "awareness", "institution-event"], allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "sensitive", affectedPathways: ["student", "professor", "publisher"], dependencies: ["accessibility.reporting"], tags: ["holiday", "schedule"] }),
  feature({ key: "theme.platform_lock", name: "Theme lock", pathway: "theme", category: "Themes", description: "Temporarily locks users to an approved platform or institution theme.", helpText: "The lock cannot override reduced motion, readable contrast, zoom, or other accessibility needs.", readiness: "planned", defaultValue: false, allowedScopes: PLATFORM_INSTITUTION_SCOPES, sensitivity: "sensitive", affectedPathways: ["student", "professor", "publisher"], dependencies: ["theme.account_choice"], tags: ["lock", "appearance"] }),

  // Integration controls. These expose readiness and enablement, never secrets.
  feature({ key: "integration.supabase_auth", name: "Supabase account service", pathway: "integration", category: "Core services", description: "Provides authenticated sessions used by EdNotebook account and access controls.", helpText: "Only public browser configuration may appear in the client; privileged keys stay server-side.", readiness: "implemented", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], tags: ["supabase", "auth"] }),
  feature({ key: "integration.supabase_database", name: "Supabase database", pathway: "integration", category: "Core services", description: "Stores authoritative institutions, courses, memberships, grades, publications, and audit records.", helpText: "This connection cannot be controlled as a cosmetic switch; an outage requires a read-only or maintenance response.", readiness: "implemented", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "read_only", affectedPathways: ["student", "professor", "publisher"], dependencies: ["security.row_level_access"], tags: ["supabase", "postgres"] }),
  feature({ key: "integration.supabase_storage", name: "Supabase private storage", pathway: "integration", category: "Core services", description: "Stores protected files and approved derived artifacts in private buckets.", helpText: "Connection status should come from deployed storage configuration and a safe health test, not from a manual label.", readiness: "deployment_required", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "read_only", affectedPathways: ["student", "professor", "publisher"], dependencies: ["security.secure_uploads"], tags: ["supabase", "storage"] }),
  feature({ key: "integration.supabase_functions", name: "Supabase server functions", pathway: "integration", category: "Core services", description: "Runs secure uploads, previews, retention, billing, and LMS integration endpoints.", helpText: "Each function has separate deployment, secret, health, and authorization requirements.", readiness: "deployment_required", defaultValue: true, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "degrade", affectedPathways: ["student", "professor", "publisher"], tags: ["supabase", "functions"] }),
  feature({ key: "integration.railway_worker", name: "Document security worker", pathway: "integration", category: "Files and documents", description: "Inspects, scans, previews, and converts protected documents in an isolated server worker.", helpText: "Mark active only after deployment, health, malware, archive, timeout, callback, and cleanup tests pass.", readiness: "deployment_required", defaultValue: false, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], tags: ["railway", "scanner"] }),
  feature({ key: "integration.blackboard_csv", name: "Blackboard grade CSV", pathway: "integration", category: "Learning systems", description: "Lets a professor safely prepare finalized EdNotebook grades in a Blackboard-compatible CSV file.", helpText: "This remains a professor-confirmed fallback. Raw Blackboard files stay in browser memory during processing.", readiness: "pilot_testing", defaultValue: false, sensitivity: "critical", disableBehavior: "hide", affectedPathways: ["professor"], dependencies: ["professor.grade_publish", "shared.audit_history"], tags: ["blackboard", "csv", "grades"] }),
  feature({ key: "integration.blackboard_lti_launch", name: "Blackboard LTI launch", pathway: "integration", category: "Learning systems", description: "Opens EdNotebook from a validated Blackboard instructor or learner launch.", helpText: "Activation requires real instructor and learner launch evidence. A saved registration is not an active connection.", readiness: "pilot_testing", defaultValue: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor"], dependencies: ["integration.supabase_functions", "shared.institution_affiliation"], tags: ["blackboard", "lti", "launch"] }),
  feature({ key: "integration.blackboard_deep_link", name: "Blackboard content placement", pathway: "integration", category: "Learning systems", description: "Returns professor-selected EdNotebook content to the correct Blackboard course.", helpText: "Content must belong to the mapped institution and course before it can be returned.", readiness: "pilot_testing", defaultValue: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["professor"], dependencies: ["integration.blackboard_lti_launch"], tags: ["blackboard", "deep linking"] }),
  feature({ key: "integration.blackboard_nrps", name: "Blackboard roster sync", pathway: "integration", category: "Learning systems", description: "Synchronizes permitted course membership information through LTI Names and Roles.", helpText: "Only approved fields and scopes should be retained, and stale memberships must be reconciled without crossing institutions.", readiness: "pilot_testing", defaultValue: false, sensitivity: "critical", disableBehavior: "read_only", affectedPathways: ["professor"], dependencies: ["integration.blackboard_lti_launch", "professor.roster"], tags: ["blackboard", "nrps", "roster"] }),
  feature({ key: "integration.blackboard_ags", name: "Blackboard grade passback", pathway: "integration", category: "Learning systems", description: "Sends a professor-confirmed finalized grade to the mapped Blackboard line item.", helpText: "Passback requires course, learner, line-item, score, status, freshness, idempotency, and professor-release checks.", readiness: "pilot_testing", defaultValue: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["professor"], dependencies: ["integration.blackboard_lti_launch", "professor.grade_publish"], tags: ["blackboard", "ags", "grades"] }),
  feature({ key: "integration.blackboard_rest", name: "Blackboard REST connection", pathway: "integration", category: "Learning systems", description: "Reserves a server-side adapter for Blackboard-specific courses, users, content, and grade operations.", helpText: "Use only when LTI or standardized roster exchange cannot provide an approved operation.", readiness: "planned", defaultValue: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["professor"], tags: ["blackboard", "rest"] }),
  feature({ key: "integration.powerschool", name: "PowerSchool SIS", pathway: "integration", category: "Learning systems", description: "Reserves institution-approved attendance, roster, and grade exchange with PowerSchool.", helpText: "Local EdNotebook attendance and grades must remain clearly separate until a district connection passes testing.", readiness: "planned", defaultValue: false, sensitivity: "critical", affectedPathways: ["professor"], tags: ["powerschool", "sis"] }),
  feature({ key: "integration.stripe", name: "Stripe billing connection", pathway: "integration", category: "Billing", description: "Processes verified server-side payment events and maps them to EdNotebook entitlements.", helpText: "Card details never enter EdNotebook. Live billing requires finance, legal, refund, tax, and support approval.", readiness: "built_in_part", defaultValue: false, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", disableBehavior: "read_only", affectedPathways: ["student", "professor", "publisher"], tags: ["stripe", "billing"] }),
  feature({ key: "integration.youtube", name: "YouTube privacy-enhanced embeds", pathway: "integration", category: "Media", description: "Recognizes YouTube links and uses privacy-enhanced lesson embeds without a basic API key.", helpText: "Institutions can disable embeds while leaving the source link and readable lesson context available.", readiness: "implemented", defaultValue: true, sensitivity: "sensitive", disableBehavior: "degrade", affectedPathways: ["student", "professor"], tags: ["youtube", "video"] }),
  feature({ key: "integration.microsoft_word", name: "Microsoft Word and EduSync", pathway: "integration", category: "Documents", description: "Reserves an approved Microsoft 365 add-in for document import, export, comments, and versions.", helpText: "Activation requires institution-owned Entra registration, approved scopes, and a server sync service.", readiness: "planned", defaultValue: false, sensitivity: "sensitive", affectedPathways: ["student", "professor", "publisher"], tags: ["microsoft", "word"] }),
  feature({ key: "integration.canva", name: "Canva connection", pathway: "integration", category: "Design", description: "Reserves approved slide and image exchange through a Canva application.", helpText: "Activation requires partner approval, OAuth review, and server retrieval of short-lived exports.", readiness: "planned", defaultValue: false, sensitivity: "sensitive", affectedPathways: ["student", "professor", "publisher"], tags: ["canva", "slides"] }),
  feature({ key: "integration.cengage", name: "Cengage LTI connection", pathway: "integration", category: "Learning systems", description: "Reserves partner-managed content placement, course context, roster, and grade return through LTI.", helpText: "This cannot become active without publisher and institution onboarding credentials and test evidence.", readiness: "planned", defaultValue: false, sensitivity: "critical", affectedPathways: ["student", "professor", "publisher"], tags: ["cengage", "lti"] }),
  feature({ key: "integration.google_drive", name: "Google Drive connection", pathway: "integration", category: "Documents", description: "Reserves approved document import and export from institution-managed Google Drive.", helpText: "Activation requires OAuth consent, minimum scopes, permission mapping, and administrator policy review.", readiness: "planned", defaultValue: false, sensitivity: "critical", affectedPathways: ["student", "professor", "publisher"], tags: ["google", "drive"] }),
  feature({ key: "integration.cloudflare_r2", name: "Cloudflare R2 storage adapter", pathway: "integration", category: "Files and documents", description: "Reserves private overflow or publication storage through the existing file adapter contract.", helpText: "Write credentials stay server-side and every object remains subject to EdNotebook metadata and access rules.", readiness: "planned", defaultValue: false, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", affectedPathways: ["student", "professor", "publisher"], tags: ["cloudflare", "storage"] }),
  feature({ key: "integration.ai_gateway", name: "Institution-approved AI gateway", pathway: "integration", category: "AI and automation", description: "Routes approved AI requests through a server service with provider, privacy, evaluation, and spending controls.", helpText: "A no-external-AI option must remain supported. Provider tokens and private course content never belong in browser settings.", readiness: "planned", defaultValue: false, sensitivity: "critical", disableBehavior: "block", affectedPathways: ["student", "professor", "publisher"], tags: ["ai", "gateway"] }),
  feature({ key: "integration.monitoring", name: "Production monitoring", pathway: "integration", category: "Operations", description: "Collects approved availability, error, job, and security signals without logging student content.", helpText: "Activation requires a redaction policy, retention period, alerts, ownership, and incident procedures.", readiness: "planned", defaultValue: false, allowedScopes: PLATFORM_ONLY, institutionDelegable: false, sensitivity: "critical", affectedPathways: ["student", "professor", "publisher"], tags: ["monitoring", "alerts"] }),
];

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateFeatureDefinition(definition) {
  const requiredText = ["key", "name", "pathway", "category", "description", "helpText"];
  for (const field of requiredText) {
    if (typeof definition[field] !== "string" || !definition[field].trim()) {
      throw new TypeError(`Feature definition is missing ${field}.`);
    }
  }
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(definition.key)) throw new TypeError(`Invalid feature key: ${definition.key}`);
  if (!FEATURE_PATHWAYS.includes(definition.pathway)) throw new TypeError(`Invalid pathway for ${definition.key}.`);
  if (!FEATURE_READINESS.includes(definition.readiness)) throw new TypeError(`Invalid readiness for ${definition.key}.`);
  if (!CONTROL_TYPES.includes(definition.controlType)) throw new TypeError(`Invalid control type for ${definition.key}.`);
  if (!FEATURE_SENSITIVITY.includes(definition.sensitivity)) throw new TypeError(`Invalid sensitivity for ${definition.key}.`);
  if (!DISABLE_BEHAVIORS.includes(definition.disableBehavior)) throw new TypeError(`Invalid disable behavior for ${definition.key}.`);
  if (!definition.allowedScopes.length || definition.allowedScopes.some((scope) => !CONTROL_SCOPES.includes(scope))) {
    throw new TypeError(`Invalid control scope for ${definition.key}.`);
  }
  if (definition.institutionDelegable && !definition.allowedScopes.includes("institution")) {
    throw new TypeError(`${definition.key} is institution-delegable without institution scope.`);
  }
}

const seenKeys = new Set();
for (const definition of DEFINITIONS) {
  validateFeatureDefinition(definition);
  if (seenKeys.has(definition.key)) throw new TypeError(`Duplicate feature key: ${definition.key}`);
  seenKeys.add(definition.key);
}

export const FEATURE_CATALOG = deepFreeze(DEFINITIONS.map((definition) => ({ ...definition })));

export const FEATURE_CATALOG_BY_KEY = deepFreeze(Object.fromEntries(FEATURE_CATALOG.map((definition) => [definition.key, definition])));

export function getFeatureDefinition(featureKey) {
  return FEATURE_CATALOG_BY_KEY[String(featureKey || "").trim()] || null;
}

export function requireFeatureDefinition(featureKey) {
  const definition = getFeatureDefinition(featureKey);
  if (!definition) throw new RangeError(`Unknown feature: ${featureKey}`);
  return definition;
}

export function validateFeatureCatalog(catalog = FEATURE_CATALOG) {
  const keys = new Set();
  for (const definition of catalog) {
    validateFeatureDefinition(definition);
    if (keys.has(definition.key)) throw new TypeError(`Duplicate feature key: ${definition.key}`);
    keys.add(definition.key);
  }
  return true;
}
