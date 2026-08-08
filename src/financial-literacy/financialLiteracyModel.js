export const FINANCIAL_LITERACY_RELEASE_ID = "2026.08.08.1";
export const FINANCIAL_LITERACY_COURSE_KEY = "brexatlas.financial-literacy-course";
export const FINANCIAL_LITERACY_SOURCE_ORIGIN = "https://brexatlas.github.io";

export function groupFinancialLiteracyUnits(units = []) {
  const groups = new Map();
  for (const unit of units) {
    const key = `${unit.path}:${unit.group_number}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        path: unit.path,
        groupNumber: unit.group_number,
        title: unit.group_title,
        units: [],
      });
    }
    groups.get(key).units.push(unit);
  }
  return [...groups.values()].sort((left, right) => {
    const leftPath = left.path === "foundations" ? 0 : 1;
    const rightPath = right.path === "foundations" ? 0 : 1;
    return leftPath - rightPath || left.groupNumber - right.groupNumber;
  });
}

export function financialLiteracyProgressSummary(course) {
  const units = Array.isArray(course?.units) ? course.units : [];
  const completed = units.filter((unit) => unit.completed).length;
  return {
    completed,
    total: units.length,
    percent: units.length ? Math.round((completed / units.length) * 100) : 0,
  };
}

export function nextFinancialLiteracyUnit(course) {
  const units = Array.isArray(course?.units) ? course.units : [];
  return units.find((unit) => !unit.completed) || units.at(-1) || null;
}

export function buildFinancialLiteracyUnitUrl(course, unit) {
  if (!course?.source_home || !unit?.relative_url) return "";
  const destination = new URL(unit.relative_url, course.source_home);
  destination.searchParams.set("embedded", "1");
  destination.searchParams.set("source", "ednotebook-early-prep");
  return destination.toString();
}

export function isCanonicalFinancialLiteracyUrl(value) {
  try {
    return new URL(value).origin === FINANCIAL_LITERACY_SOURCE_ORIGIN;
  } catch {
    return false;
  }
}
