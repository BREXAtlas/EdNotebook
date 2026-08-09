const COURSE_DRAFT_KEY = "ednotebook-course-draft";
const COURSE_ID_KEY = "ednotebook-course-id";
const COURSE_STEP_KEY = "ednotebook-course-step";

function courseDraft(course) {
  return {
    id: course.id,
    name: course.title || "",
    code: course.course_code || course.code || "",
    educationDivision: course.education_division || course.division || "university",
    subjectId: course.subject_id || course.subjectId || null,
    subject: course.subject || "",
    audience: course.audience || "",
    length: course.teaching_window || course.term || "16 weeks",
    status: course.status || course.publicationStatus || "draft",
    createdAt: course.created_at || null,
    updatedAt: course.updated_at || null,
  };
}

export function prepareProfessorCourseBuilder(storage, course, educationDivision = null) {
  if (course === null) {
    storage.removeItem(COURSE_DRAFT_KEY);
    storage.removeItem(COURSE_ID_KEY);
    storage.removeItem(COURSE_STEP_KEY);
    if (educationDivision) storage.setItem("ednotebook-course-division", educationDivision);
    return "#/app";
  }

  if (course?.id) {
    storage.setItem(COURSE_DRAFT_KEY, JSON.stringify(courseDraft(course)));
    storage.setItem(COURSE_ID_KEY, course.id);
    storage.setItem(COURSE_STEP_KEY, "2");
    storage.setItem("ednotebook-course-division", course.education_division || course.division || educationDivision || "university");
    return "#/app/builder";
  }

  return storage.getItem(COURSE_ID_KEY) ? "#/app/builder" : "#/app";
}
