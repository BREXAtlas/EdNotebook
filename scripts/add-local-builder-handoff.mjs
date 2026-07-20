import { readFileSync, writeFileSync } from "node:fs";

const path = "src/course-runtime/CoursePackageStudio.jsx";
let source = readFileSync(path, "utf8");

const importBefore = 'import { addLessonToManifest, cloneManifest, COURSE_PRESETS, createStarterManifest, flattenLessons, removeLessonFromManifest, validateCourseManifest } from "./courseManifest.js";\n';
const importAfter = `${importBefore}import { adaptBuilderCourseToManifest, readBuilderCourseDraft } from "./builderCourseAdapter.js";\n`;
if (!source.includes(importBefore)) throw new Error("Course manifest import was not found.");
source = source.replace(importBefore, importAfter);

const loadBefore = `      const result = await loadPublicationForCourse(courseId);\n      const nextManifest = result.data?.draft_manifest?.format ? result.data.draft_manifest : createStarterManifest(course);\n      setPublication(result.data || null); setManifest(nextManifest); setSelected(null); setNotice("");`;
const loadAfter = `      const result = await loadPublicationForCourse(courseId);\n      const cloudManifest = result.data?.draft_manifest?.format ? result.data.draft_manifest : null;\n      const localBuilderDraft = readBuilderCourseDraft();\n      const localUpdatedAt = Date.parse(localBuilderDraft?.updatedAt || "") || 0;\n      const cloudBuilderUpdatedAt = Date.parse(cloudManifest?.builderSource?.updatedAt || "") || 0;\n      const nextManifest = localBuilderDraft?.course && (!cloudManifest || localUpdatedAt > cloudBuilderUpdatedAt)\n        ? adaptBuilderCourseToManifest({\n            builderCourse: localBuilderDraft.course,\n            builderLessons: localBuilderDraft.lessons || {},\n            platformCourse: course,\n            existingManifest: cloudManifest,\n            updatedAt: localBuilderDraft.updatedAt,\n          })\n        : cloudManifest || createStarterManifest(course);\n      setPublication(result.data || null); setManifest(nextManifest); setSelected(null); setNotice(\n        localBuilderDraft?.course && (!cloudManifest || localUpdatedAt > cloudBuilderUpdatedAt)\n          ? "Latest Course Forge lessons loaded from this device. Save the draft to synchronize them to the class."\n          : ""\n      );`;
if (!source.includes(loadBefore)) throw new Error("Course publication loading block was not found.");
source = source.replace(loadBefore, loadAfter);
writeFileSync(path, source);
console.log("Course Output now falls back to the latest local Course Forge draft.");
