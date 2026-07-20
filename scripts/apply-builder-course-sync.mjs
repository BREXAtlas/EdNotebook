import { readFileSync, writeFileSync } from "node:fs";

const path = "src/Builder.jsx";
let source = readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Builder sync codemod could not find: ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  'import { useState, useEffect, useMemo } from "react";\n',
  'import { useState, useEffect, useMemo } from "react";\nimport { syncBuilderCoursePackage } from "./course-runtime/builderCourseAdapter.js";\n',
  "React import",
);

replaceOnce(
  'function ProfessorView({ t, plan, setPlan, courseLength, setCourseLength, manuscript, setManuscript }) {',
  'function ProfessorView({ t, plan, setPlan, courseLength, setCourseLength, manuscript, setManuscript, session }) {',
  "ProfessorView signature",
);

replaceOnce(
  '  const [showUpgrade, setShowUpgrade] = useState(false);\n\n  const currentPlan = PLANS.find((p) => p.key === plan);',
  `  const [showUpgrade, setShowUpgrade] = useState(false);\n  const [courseSync, setCourseSync] = useState("");\n\n  useEffect(() => {\n    if (!course) { setCourseSync(""); return undefined; }\n    const timer = window.setTimeout(async () => {\n      setCourseSync("Syncing to Course Output…");\n      const result = await syncBuilderCoursePackage({ course, lessons, session });\n      if (result.error) setCourseSync("Saved on device · cloud sync will retry");\n      else if (result.source === "cloud") setCourseSync("Synced to Course Output");\n      else setCourseSync("Ready in Course Output");\n    }, 850);\n    return () => window.clearTimeout(timer);\n  }, [course, lessons, session?.user?.id]);\n\n  const currentPlan = PLANS.find((p) => p.key === plan);`,
  "ProfessorView sync effect",
);

replaceOnce(
  '          <Pill t={t} tone={t.slate}>{Object.keys(lessons).length} written</Pill>\n',
  '          <Pill t={t} tone={t.slate}>{Object.keys(lessons).length} written</Pill>\n          {courseSync && <Pill t={t} tone={courseSync.includes("Synced") ? t.good : t.accentDark}>{courseSync}</Pill>}\n',
  "course map sync status",
);

replaceOnce(
  'export default function Builder() {',
  'export default function Builder({ session }) {',
  "Builder signature",
);

replaceOnce(
  '        {view === "professor" && <ProfessorView t={t} plan={plan} setPlan={setPlan} courseLength={courseLength} setCourseLength={setCourseLength} manuscript={manuscript} setManuscript={setManuscript} />}',
  '        {view === "professor" && <ProfessorView t={t} plan={plan} setPlan={setPlan} courseLength={courseLength} setCourseLength={setCourseLength} manuscript={manuscript} setManuscript={setManuscript} session={session} />}',
  "ProfessorView invocation",
);

writeFileSync(path, source);
console.log("Builder course-package synchronization applied.");
