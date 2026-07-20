import { readFileSync, writeFileSync } from "node:fs";

const path = "src/Builder.jsx";
let source = readFileSync(path, "utf8");

const signatureBefore = "function CourseWorkspace({ t, course, setCourse, lessons, setLessons, history, hIdx, undo, redo, pushHistory, onPreview }) {";
const signatureAfter = "function CourseWorkspace({ t, course, setCourse, lessons, setLessons, history, hIdx, undo, redo, pushHistory, onPreview, courseSync }) {";
const callBefore = '<CourseWorkspace t={t} course={course} setCourse={setCourse} lessons={lessons} setLessons={setLessons} history={history} hIdx={hIdx} undo={undo} redo={redo} pushHistory={pushHistory} onPreview={(ep, lesson) => setPreview({ ep, lesson })} />';
const callAfter = '<CourseWorkspace t={t} course={course} setCourse={setCourse} lessons={lessons} setLessons={setLessons} history={history} hIdx={hIdx} undo={undo} redo={redo} pushHistory={pushHistory} onPreview={(ep, lesson) => setPreview({ ep, lesson })} courseSync={courseSync} />';

if (!source.includes(signatureBefore)) throw new Error("CourseWorkspace signature was not found.");
if (!source.includes(callBefore)) throw new Error("CourseWorkspace call was not found.");
source = source.replace(signatureBefore, signatureAfter).replace(callBefore, callAfter);
writeFileSync(path, source);
console.log("CourseWorkspace now receives courseSync explicitly.");
