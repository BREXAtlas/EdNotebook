const CITATION_STYLES = ["APA", "MLA"];

const SOURCE_TYPES = [
  "Journal article",
  "Book",
  "Book chapter",
  "Website",
  "Video",
  "Report",
  "Government resource",
  "Other",
];

const OPTIONAL_FIELD_DEFINITIONS = {
  publishedDate: { label: "Publication date", placeholder: "2026-05-22", type: "date" },
  containerTitle: { label: "Journal, website, or collection", placeholder: "Journal or website name" },
  publisher: { label: "Publisher", placeholder: "Publisher or sponsoring organization" },
  volume: { label: "Volume", placeholder: "12" },
  issue: { label: "Issue", placeholder: "3" },
  pages: { label: "Pages", placeholder: "41-58" },
  edition: { label: "Edition", placeholder: "3rd ed." },
  doi: { label: "DOI", placeholder: "10.1000/example" },
  url: { label: "Link", placeholder: "https://", type: "url" },
  accessedDate: { label: "Date accessed", placeholder: "2026-07-19", type: "date" },
};

const TYPE_FIELDS = {
  "Journal article": ["publishedDate", "containerTitle", "volume", "issue", "pages", "doi", "url"],
  Book: ["publishedDate", "publisher", "edition", "doi", "url"],
  "Book chapter": ["publishedDate", "containerTitle", "publisher", "edition", "pages", "doi", "url"],
  Website: ["publishedDate", "containerTitle", "publisher", "url", "accessedDate"],
  Video: ["publishedDate", "containerTitle", "publisher", "url", "accessedDate"],
  Report: ["publishedDate", "publisher", "doi", "url", "accessedDate"],
  "Government resource": ["publishedDate", "publisher", "url", "accessedDate"],
  Other: ["publishedDate", "containerTitle", "publisher", "volume", "issue", "pages", "edition", "doi", "url", "accessedDate"],
};

const DEFAULT_COLLECTIONS = ["Course research", "Assignment sources", "Reading list", "Independent research"];

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripEnding(value) {
  return trimValue(value).replace(/[.,;:]+$/u, "");
}

function withPeriod(value) {
  const clean = trimValue(value);
  if (!clean) return "";
  return /[.!?]$/u.test(clean) ? clean : `${clean}.`;
}

function publicationYear(value) {
  const match = trimValue(value).match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/u);
  return match ? match[0] : "n.d.";
}

function readableDate(value, style = "APA") {
  const clean = trimValue(value);
  if (!clean) return "";
  const parsed = new Date(`${clean.length === 10 ? `${clean}T12:00:00Z` : clean}`);
  if (Number.isNaN(parsed.getTime())) return clean;
  return new Intl.DateTimeFormat(style === "MLA" ? "en-GB" : "en-US", style === "MLA"
    ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
    : { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
  ).format(parsed);
}

function doiOrUrl(source) {
  const doi = stripEnding(source.doi);
  if (doi) return doi.startsWith("http") ? doi : `https://doi.org/${doi.replace(/^doi:\s*/iu, "")}`;
  return stripEnding(source.url);
}

function customElementText(source) {
  return (source.customElements || [])
    .filter((item) => trimValue(item.label) && trimValue(item.value))
    .map((item) => `${stripEnding(item.label)}: ${withPeriod(item.value)}`)
    .join(" ");
}

function formatApa(source) {
  const type = source.sourceType || "Website";
  const author = withPeriod(source.author || source.organization || "Unknown author");
  const year = publicationYear(source.publishedDate);
  const fullDate = readableDate(source.publishedDate, "APA");
  const title = withPeriod(source.title || "Untitled source");
  const container = stripEnding(source.containerTitle);
  const publisher = withPeriod(source.publisher);
  const edition = stripEnding(source.edition);
  const pages = stripEnding(source.pages);
  const link = doiOrUrl(source);
  const custom = customElementText(source);
  const dateText = (type === "Website" || type === "Video") && fullDate ? fullDate : year;
  const parts = [author, `(${dateText}).`, title];

  if (type === "Journal article") {
    const journalDetails = [container, stripEnding(source.volume) && `${stripEnding(source.volume)}${stripEnding(source.issue) ? `(${stripEnding(source.issue)})` : ""}`, pages]
      .filter(Boolean)
      .join(", ");
    if (journalDetails) parts.push(withPeriod(journalDetails));
  } else if (type === "Book") {
    if (edition) parts.push(`(${edition}).`);
    if (publisher) parts.push(publisher);
  } else if (type === "Book chapter") {
    if (container) parts.push(`In ${withPeriod(container)}`);
    if (edition) parts.push(`(${edition}).`);
    if (pages) parts.push(`(pp. ${pages}).`);
    if (publisher) parts.push(publisher);
  } else {
    if (container) parts.push(withPeriod(container));
    if (publisher && stripEnding(publisher).toLowerCase() !== container.toLowerCase()) parts.push(publisher);
  }

  if (link) parts.push(link);
  if (custom) parts.push(custom);
  return parts.filter(Boolean).join(" ").replace(/\s+/gu, " ").trim();
}

function formatMla(source) {
  const author = withPeriod(source.author || source.organization || "Unknown author");
  const title = trimValue(source.title) || "Untitled source";
  const type = source.sourceType || "Website";
  const titleText = type === "Book" || type === "Report" ? withPeriod(title) : `“${stripEnding(title)}.”`;
  const container = stripEnding(source.containerTitle);
  const publisher = stripEnding(source.publisher);
  const published = readableDate(source.publishedDate, "MLA");
  const link = doiOrUrl(source);
  const accessed = readableDate(source.accessedDate, "MLA");
  const custom = customElementText(source);
  const details = [];

  if (container) details.push(container);
  if (stripEnding(source.volume)) details.push(`vol. ${stripEnding(source.volume)}`);
  if (stripEnding(source.issue)) details.push(`no. ${stripEnding(source.issue)}`);
  if (publisher) details.push(publisher);
  if (published) details.push(published);
  if (stripEnding(source.pages)) details.push(`pp. ${stripEnding(source.pages)}`);

  const parts = [author, titleText];
  if (details.length) parts.push(withPeriod(details.join(", ")));
  if (stripEnding(source.edition)) parts.push(`${withPeriod(source.edition)}`);
  if (link) parts.push(withPeriod(link));
  if (accessed) parts.push(`Accessed ${withPeriod(accessed)}`);
  if (custom) parts.push(custom);
  return parts.filter(Boolean).join(" ").replace(/\s+/gu, " ").trim();
}

function formatCitation(source) {
  const visible = Array.isArray(source.visibleFields) ? new Set(source.visibleFields) : null;
  const scoped = visible ? Object.keys(OPTIONAL_FIELD_DEFINITIONS).reduce((result, field) => ({ ...result, [field]: visible.has(field) ? source[field] : "" }), { ...source }) : source;
  return scoped.citationStyle === "MLA" ? formatMla(scoped) : formatApa(scoped);
}

function fieldsForType(sourceType) {
  return TYPE_FIELDS[sourceType] || TYPE_FIELDS.Other;
}

function createSourceDraft(persona) {
  const sourceType = "Website";
  return {
    id: "",
    citationStyle: "APA",
    sourceType,
    course: persona?.classes?.[0]?.code || "General",
    collection: DEFAULT_COLLECTIONS[0],
    title: "",
    author: "",
    note: "",
    publishedDate: "",
    containerTitle: "",
    publisher: "",
    volume: "",
    issue: "",
    pages: "",
    edition: "",
    doi: "",
    url: "",
    accessedDate: "",
    visibleFields: fieldsForType(sourceType),
    customElements: [],
  };
}

function normalizeSource(source, persona, index = 0) {
  const mappedType = {
    "Peer-reviewed research": "Journal article",
    "State guidance": "Government resource",
    "Career source": "Government resource",
    "Library database": "Journal article",
  }[source.type];
  const sourceType = SOURCE_TYPES.includes(source.sourceType)
    ? source.sourceType
    : SOURCE_TYPES.includes(source.type)
      ? source.type
      : mappedType || "Website";
  const normalized = {
    ...createSourceDraft(persona),
    ...source,
    id: source.id || `starter-source-${persona.id}-${index}`,
    sourceType,
    citationStyle: source.citationStyle === "MLA" ? "MLA" : "APA",
    course: source.course || persona.classes?.[0]?.code || "General",
    collection: source.collection || DEFAULT_COLLECTIONS[0],
    visibleFields: Array.isArray(source.visibleFields) ? source.visibleFields : fieldsForType(sourceType),
    customElements: Array.isArray(source.customElements) ? source.customElements : [],
    savedAt: source.savedAt || "Starter source",
  };
  normalized.citation = source.citation || formatCitation(normalized);
  return normalized;
}

export {
  CITATION_STYLES,
  SOURCE_TYPES,
  OPTIONAL_FIELD_DEFINITIONS,
  DEFAULT_COLLECTIONS,
  createSourceDraft,
  fieldsForType,
  formatCitation,
  normalizeSource,
};
