const COURSE_DRAFT_KEY = "ednotebook-course-draft";
const COURSE_ID_KEY = "ednotebook-course-id";
const COURSE_STEP_KEY = "ednotebook-course-step";

function courseDraft(course) {
  return {
    id: course.id,
    name: course.title || "",
    code: course.course_code || course.code || "",
    subject: course.subject || "",
    audience: course.audience || "",
    length: course.teaching_window || course.term || "16 weeks",
    status: course.status || course.publicationStatus || "draft",
    createdAt: course.created_at || null,
    updatedAt: course.updated_at || null,
  };
}

export function prepareProfessorCourseBuilder(storage, course) {
  if (course === null) {
    storage.removeItem(COURSE_DRAFT_KEY);
    storage.removeItem(COURSE_ID_KEY);
    storage.removeItem(COURSE_STEP_KEY);
    return "#/app";
  }

  if (course?.id) {
    storage.setItem(COURSE_DRAFT_KEY, JSON.stringify(courseDraft(course)));
    storage.setItem(COURSE_ID_KEY, course.id);
    storage.setItem(COURSE_STEP_KEY, "2");
    return "#/app/builder";
  }

  return storage.getItem(COURSE_ID_KEY) ? "#/app/builder" : "#/app";
}
