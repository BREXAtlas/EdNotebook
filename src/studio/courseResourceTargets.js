export function lessonTargetsFromManifest(manifest = {}) {
  const paths = Array.isArray(manifest?.paths) ? manifest.paths : [];
  return paths.flatMap((path) => {
    const lessons = Array.isArray(path?.nodes) ? path.nodes : [];
    return lessons
      .filter((lesson) => lesson?.id)
      .map((lesson) => ({ ...lesson, pathLabel: path.label || "Course path" }));
  });
}
