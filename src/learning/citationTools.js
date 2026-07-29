const CITATION_STYLES = ["APA", "MLA"];

const CITATION_STYLE_METADATA = {
  APA: {
    id: "apa-7",
    label: "APA 7th edition",
    edition: 7,
    publisher: "American Psychological Association",
    manualUrl: "https://www.apa.org/pubs/books/publication-manual-7th-edition-paperback",
    examplesUrl: "https://apastyle.apa.org/style-grammar-guidelines/references/examples",
  },
  MLA: {
    id: "mla-9",
    label: "MLA 9th edition",
    edition: 9,
    publisher: "Modern Language Association",
    manualUrl: "https://style.mla.org/mla-handbook-ninth-edition/",
    examplesUrl: "https://style.mla.org/works-cited/citations-by-format/",
  },
};

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

const CONTRIBUTOR_ROLES = [
  ["editor", "Editor"],
  ["translator", "Translator"],
  ["director", "Director"],
  ["performer", "Performer"],
  ["compiler", "Compiler"],
];

const OPTIONAL_FIELD_DEFINITIONS = {
  publishedDate: { label: "Publication date", placeholder: "2026-05-22", type: "date" },
  containerTitle: { label: "Journal, website, book, or collection", placeholder: "Container title" },
  publisher: { label: "Publisher or sponsoring organization", placeholder: "Publisher" },
  volume: { label: "Volume", placeholder: "12" },
  issue: { label: "Issue", placeholder: "3" },
  pages: { label: "Pages", placeholder: "41–58" },
  edition: { label: "Edition", placeholder: "3rd" },
  reportNumber: { label: "Report number", placeholder: "Report No. 24-17" },
  doi: { label: "DOI", placeholder: "10.1000/example" },
  url: { label: "URL", placeholder: "https://", type: "url" },
  accessedDate: { label: "Date accessed", placeholder: "2026-07-19", type: "date" },
};

const TYPE_FIELDS = {
  "Journal article": ["publishedDate", "containerTitle", "volume", "issue", "pages", "doi", "url"],
  Book: ["publishedDate", "publisher", "edition", "doi", "url"],
  "Book chapter": ["publishedDate", "containerTitle", "publisher", "edition", "pages", "doi", "url"],
  Website: ["publishedDate", "containerTitle", "publisher", "url", "accessedDate"],
  Video: ["publishedDate", "containerTitle", "publisher", "url", "accessedDate"],
  Report: ["publishedDate", "publisher", "reportNumber", "doi", "url", "accessedDate"],
  "Government resource": ["publishedDate", "publisher", "reportNumber", "url", "accessedDate"],
  Other: Object.keys(OPTIONAL_FIELD_DEFINITIONS),
};

const SOURCE_TYPE_DEFINITIONS = Object.fromEntries(
  SOURCE_TYPES.map((type) => [
    type,
    {
      label: type,
      fields: TYPE_FIELDS[type],
      required: type === "Journal article"
        ? ["title", "authors", "publishedDate", "containerTitle"]
        : type === "Book"
          ? ["title", "authors", "publishedDate", "publisher"]
          : type === "Book chapter"
            ? ["title", "authors", "publishedDate", "containerTitle", "publisher"]
            : type === "Website" || type === "Video"
              ? ["title", "authors", "url"]
              : ["title", "authors", "publishedDate"],
    },
  ])
);

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#039;");
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

function readableApaDate(value) {
  const clean = trimValue(value);
  if (!clean) return "";
  const parsed = new Date(`${clean.length === 10 ? `${clean}T12:00:00Z` : clean}`);
  if (Number.isNaN(parsed.getTime())) return clean;
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }).format(parsed);
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
  return `${year}, ${monthDay}`;
}

function editionLabel(value) {
  const clean = stripEnding(value);
  if (!clean) return "";
  return /\bed(?:ition)?$/iu.test(clean) ? `${clean.replace(/\bedition$/iu, "ed")}.` : `${clean} ed.`;
}

function doiOrUrl(source) {
  const doi = stripEnding(source.doi);
  if (doi) return doi.startsWith("http") ? doi : `https://doi.org/${doi.replace(/^doi:\s*/iu, "")}`;
  return stripEnding(source.url);
}

function createContributor(kind = "person") {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `contributor-${Date.now()}-${Math.random()}`,
    kind,
    given: "",
    family: "",
    literal: "",
    role: "author",
  };
}

function normalizedPeople(source, key = "authors") {
  const people = Array.isArray(source?.[key]) ? source[key] : [];
  const normalized = people
    .map((person) => ({
      id: person.id || "",
      kind: person.kind === "organization" ? "organization" : "person",
      given: trimValue(person.given),
      family: trimValue(person.family),
      literal: trimValue(person.literal),
      role: trimValue(person.role) || (key === "authors" ? "author" : "editor"),
    }))
    .filter((person) => person.literal || person.family || person.given);
  if (normalized.length) return normalized;

  const legacy = trimValue(source?.author || source?.organization);
  return legacy ? [{ id: "", kind: "organization", given: "", family: "", literal: legacy, role: key === "authors" ? "author" : "editor" }] : [];
}

function initials(value) {
  return trimValue(value)
    .split(/[\s-]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}.`)
    .join(" ");
}

function apaPerson(person) {
  if (person.kind === "organization" || person.literal) return person.literal || [person.given, person.family].filter(Boolean).join(" ");
  const family = person.family || person.given || "Unknown author";
  const givenInitials = initials(person.given);
  return givenInitials ? `${family}, ${givenInitials}` : family;
}

function apaAuthorList(source) {
  const authors = normalizedPeople(source);
  if (!authors.length) return "Unknown author";
  const names = authors.map(apaPerson);
  if (names.length === 1) return names[0];
  if (names.length <= 20) return `${names.slice(0, -1).join(", ")}, & ${names.at(-1)}`;
  return `${names.slice(0, 19).join(", ")}, … ${names.at(-1)}`;
}

function mlaPerson(person, invert = false) {
  if (person.kind === "organization" || person.literal) return person.literal || [person.given, person.family].filter(Boolean).join(" ");
  if (invert && person.family) return [person.family, person.given].filter(Boolean).join(", ");
  return [person.given, person.family].filter(Boolean).join(" ") || "Unknown author";
}

function mlaAuthorList(source) {
  const authors = normalizedPeople(source);
  if (!authors.length) return "Unknown author";
  if (authors.length === 1) return mlaPerson(authors[0], true);
  if (authors.length === 2) return `${mlaPerson(authors[0], true)}, and ${mlaPerson(authors[1])}`;
  return `${mlaPerson(authors[0], true)}, et al.`;
}

function contributorText(source, style, role = "editor") {
  const people = normalizedPeople(source, "contributors").filter((person) => person.role === role);
  if (!people.length) return "";
  if (style === "APA") {
    const names = people.map((person) => person.kind === "organization" || person.literal
      ? person.literal
      : [initials(person.given), person.family].filter(Boolean).join(" "));
    const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} & ${names.at(-1)}`;
    if (role === "translator") return `${joined}, Trans.`;
    const suffix = role === "editor" ? (people.length > 1 ? "Eds." : "Ed.") : role === "director" ? "Director" : role === "performer" ? "Performer" : "Comp.";
    return `${joined} (${suffix})`;
  }
  const names = people.map((person) => mlaPerson(person));
  const prefix = role === "editor" ? "edited by" : role === "translator" ? "translated by" : role === "director" ? "directed by" : role === "performer" ? "performance by" : "compiled by";
  return `${prefix} ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`}`;
}

function mlaAdditionalContributors(source, excludedRoles = []) {
  return CONTRIBUTOR_ROLES
    .map(([role]) => role)
    .filter((role) => !excludedRoles.includes(role))
    .map((role) => contributorText(source, "MLA", role))
    .filter(Boolean);
}

function customElementText(source) {
  return (source.customElements || [])
    .filter((item) => trimValue(item.label) && trimValue(item.value))
    .map((item) => `${stripEnding(item.label)}: ${withPeriod(item.value)}`)
    .join(" ");
}

function segmentsOutput(segments) {
  const visible = segments.filter((segment) => trimValue(segment?.text));
  const plain = visible.map((segment, index) => `${index && !segment.attach ? " " : ""}${segment.text}`).join("").replace(/\s+/gu, " ").trim();
  const html = visible.map((segment, index) => {
    const text = segment.italic ? `<em>${escapeHtml(segment.text)}</em>` : escapeHtml(segment.text);
    return `${index && !segment.attach ? " " : ""}${text}`;
  }).join("").replace(/\s+/gu, " ").trim();
  return { plain, html };
}

function formatApaOutput(source) {
  const type = source.sourceType || "Website";
  const year = publicationYear(source.publishedDate);
  const fullDate = readableApaDate(source.publishedDate);
  const dateText = (type === "Website" || type === "Video") && fullDate ? fullDate : year;
  const title = stripEnding(source.title || "Untitled source");
  const container = stripEnding(source.containerTitle);
  const publisher = stripEnding(source.publisher);
  const edition = stripEnding(source.edition);
  const pages = stripEnding(source.pages);
  const reportNumber = stripEnding(source.reportNumber);
  const link = doiOrUrl(source);
  const custom = customElementText(source);
  const segments = [
    { text: withPeriod(apaAuthorList(source)) },
    { text: `(${dateText}).` },
  ];

  if (type === "Journal article") {
    segments.push({ text: withPeriod(title) });
    if (container) {
      const journal = `${container}${source.volume ? `, ${stripEnding(source.volume)}` : ""}`;
      segments.push({ text: journal, italic: true });
      if (source.issue) segments.push({ text: `(${stripEnding(source.issue)})${pages ? `, ${pages}` : ""}.`, attach: true });
      else if (pages) segments.push({ text: `, ${pages}.`, attach: true });
      else segments.push({ text: ".", attach: true });
    }
  } else if (type === "Book") {
    const translator = contributorText(source, "APA", "translator");
    const details = [translator, edition ? editionLabel(edition) : ""].filter(Boolean).join("; ");
    segments.push({ text: details ? title : withPeriod(title), italic: true });
    if (details) segments.push({ text: `(${details}).` });
    if (publisher) segments.push({ text: withPeriod(publisher) });
  } else if (type === "Book chapter") {
    segments.push({ text: withPeriod(title) });
    const editors = contributorText(source, "APA", "editor");
    const parenthetical = [edition ? editionLabel(edition) : "", pages ? `pp. ${pages}` : ""].filter(Boolean).join(", ");
    if (container) segments.push({ text: `In ${editors ? `${editors}, ` : ""}` });
    if (container) segments.push({ text: parenthetical ? container : withPeriod(container), italic: true });
    if (parenthetical) segments.push({ text: `(${parenthetical}).` });
    if (publisher) segments.push({ text: withPeriod(publisher) });
  } else if (type === "Video") {
    segments.push({ text: title, italic: true });
    segments.push({ text: "[Video]." });
    if (container) segments.push({ text: withPeriod(container) });
    else if (publisher) segments.push({ text: withPeriod(publisher) });
  } else if (type === "Report" || type === "Government resource") {
    segments.push({ text: reportNumber ? title : withPeriod(title), italic: true });
    if (reportNumber) segments.push({ text: `(${reportNumber}).` });
    if (publisher && publisher.toLowerCase() !== apaAuthorList(source).toLowerCase()) segments.push({ text: withPeriod(publisher) });
  } else {
    segments.push({ text: withPeriod(title), italic: true });
    if (container && container.toLowerCase() !== apaAuthorList(source).toLowerCase()) segments.push({ text: withPeriod(container) });
    if (publisher && publisher.toLowerCase() !== container.toLowerCase()) segments.push({ text: withPeriod(publisher) });
  }

  if (link) segments.push({ text: link });
  if (custom) segments.push({ text: custom });
  return segmentsOutput(segments);
}

function formatMlaOutput(source) {
  const type = source.sourceType || "Website";
  const title = stripEnding(source.title || "Untitled source");
  const container = stripEnding(source.containerTitle);
  const publisher = stripEnding(source.publisher);
  const published = readableDate(source.publishedDate, "MLA");
  const accessed = readableDate(source.accessedDate, "MLA");
  const link = doiOrUrl(source);
  const pages = stripEnding(source.pages);
  const edition = stripEnding(source.edition);
  const reportNumber = stripEnding(source.reportNumber);
  const custom = customElementText(source);
  const standalone = ["Book", "Report", "Government resource"].includes(type);
  const segments = [
    { text: withPeriod(mlaAuthorList(source)) },
    standalone
      ? { text: withPeriod(title), italic: true }
      : { text: `“${title}.”` },
  ];

  if (type === "Book chapter") {
    if (container) segments.push({ text: `${container},`, italic: true });
    const editors = contributorText(source, "MLA", "editor");
    if (editors) segments.push({ text: `${editors},` });
    mlaAdditionalContributors(source, ["editor"]).forEach((contributor) => segments.push({ text: `${contributor},` }));
  } else if (!standalone && container) {
    segments.push({ text: `${container},`, italic: true });
  }
  if (type !== "Book chapter") mlaAdditionalContributors(source).forEach((contributor) => segments.push({ text: `${contributor},` }));
  if (edition) segments.push({ text: `${editionLabel(edition).replace(/\.$/u, "")},` });
  if (source.volume) segments.push({ text: `vol. ${stripEnding(source.volume)},` });
  if (source.issue) segments.push({ text: `no. ${stripEnding(source.issue)},` });
  if (publisher) segments.push({ text: `${publisher},` });
  if (published) segments.push({ text: `${published},` });
  if (reportNumber) segments.push({ text: `${reportNumber},` });
  if (pages) segments.push({ text: `pp. ${pages}.` });
  if (link) segments.push({ text: withPeriod(link) });
  if (accessed) segments.push({ text: `Accessed ${withPeriod(accessed)}` });
  if (custom) segments.push({ text: custom });
  return segmentsOutput(segments);
}

function visibleSourceFields(source) {
  if (!Array.isArray(source?.visibleFields)) return source || {};
  const visible = new Set(source.visibleFields);
  return Object.keys(OPTIONAL_FIELD_DEFINITIONS).reduce(
    (scoped, field) => ({ ...scoped, [field]: visible.has(field) ? source[field] : "" }),
    { ...source }
  );
}

function formatCitationOutput(source) {
  const scoped = visibleSourceFields(source);
  return scoped.citationStyle === "MLA" ? formatMlaOutput(scoped) : formatApaOutput(scoped);
}

function formatCitation(source) {
  return formatCitationOutput(source).plain;
}

function authorLabels(source) {
  return normalizedPeople(source).map((person) => person.family || person.literal || person.given).filter(Boolean);
}

function formatInTextCitation(source, options = {}) {
  const labels = authorLabels(source);
  const year = publicationYear(source?.publishedDate);
  const page = stripEnding(options.page || "");
  if (source?.citationStyle === "MLA") {
    const author = labels.length > 2 ? `${labels[0]} et al.` : labels.length === 2 ? `${labels[0]} and ${labels[1]}` : labels[0] || stripEnding(source?.title) || "Untitled";
    return options.narrative ? `${author}${page ? ` ${page}` : ""}` : `(${author}${page ? ` ${page}` : ""})`;
  }
  const author = labels.length > 2 ? `${labels[0]} et al.` : labels.length === 2 ? `${labels[0]} & ${labels[1]}` : labels[0] || "Unknown author";
  return options.narrative ? `${author} (${year})` : `(${author}, ${year}${page ? `, p. ${page}` : ""})`;
}

function fieldsForType(sourceType) {
  return TYPE_FIELDS[sourceType] || TYPE_FIELDS.Other;
}

function createSourceDraft(personaOrContext = {}) {
  const sourceType = "Website";
  const firstClass = personaOrContext?.classes?.[0];
  const courseCode = personaOrContext.courseCode || firstClass?.code || "DIGL-101";
  return {
    id: "",
    rootId: "",
    version: 1,
    citationStyle: "APA",
    sourceType,
    course: courseCode,
    courseId: personaOrContext.courseId || firstClass?.id || null,
    lessonId: personaOrContext.lessonId || "",
    lessonTitle: personaOrContext.lessonTitle || "",
    collection: DEFAULT_COLLECTIONS[0],
    title: "",
    author: "",
    authors: [createContributor()],
    contributors: [],
    note: "",
    publishedDate: "",
    containerTitle: "",
    publisher: "",
    volume: "",
    issue: "",
    pages: "",
    edition: "",
    reportNumber: "",
    doi: "",
    url: "",
    accessedDate: "",
    visibleFields: fieldsForType(sourceType),
    customElements: [],
  };
}

function normalizeSource(source, personaOrContext = {}, index = 0) {
  const mappedType = {
    "Peer-reviewed research": "Journal article",
    "State guidance": "Government resource",
    "Career source": "Government resource",
    "Library database": "Journal article",
  }[source?.type];
  const sourceType = SOURCE_TYPES.includes(source?.sourceType)
    ? source.sourceType
    : SOURCE_TYPES.includes(source?.type)
      ? source.type
      : mappedType || "Website";
  const fallbackPersona = { id: personaOrContext?.id || "student", classes: personaOrContext?.classes || [] };
  const normalized = {
    ...createSourceDraft(personaOrContext),
    ...source,
    id: source?.id || `starter-source-${fallbackPersona.id}-${index}`,
    rootId: source?.rootId || source?.id || `starter-source-${fallbackPersona.id}-${index}`,
    version: Math.max(1, Number(source?.version) || 1),
    sourceType,
    citationStyle: source?.citationStyle === "MLA" ? "MLA" : "APA",
    course: source?.course || personaOrContext?.courseCode || fallbackPersona.classes?.[0]?.code || "DIGL-101",
    collection: source?.collection || DEFAULT_COLLECTIONS[0],
    authors: normalizedPeople(source).length ? normalizedPeople(source) : [createContributor()],
    contributors: normalizedPeople(source, "contributors"),
    visibleFields: Array.isArray(source?.visibleFields) ? source.visibleFields : fieldsForType(sourceType),
    customElements: Array.isArray(source?.customElements) ? source.customElements : [],
    savedAt: source?.savedAt || "Starter source",
  };
  const output = formatCitationOutput(normalized);
  normalized.citation = source?.citation || output.plain;
  normalized.citationHtml = source?.citationHtml || output.html;
  normalized.inTextCitation = source?.inTextCitation || formatInTextCitation(normalized);
  return normalized;
}

function checkCitationFormat(value, style = "APA") {
  const citation = trimValue(value);
  const normalizedStyle = style === "MLA" ? "MLA" : "APA";
  const diagnostics = [];
  const add = (code, severity, message, teachingTip) => diagnostics.push({ code, severity, message, teachingTip });

  if (!citation) {
    add("empty", "error", "Paste a citation before running the format check.", "Use the formatted citation builder or paste one complete reference.");
  } else {
    if (citation.length < 24) add("short", "warning", "This looks too short to contain the main source elements.", "Check for creator, title, date, container or publisher, and a DOI or URL when available.");
    if (!/[.!?]$/u.test(citation) && !/https?:\/\/\S+$/u.test(citation)) add("ending", "warning", "The ending punctuation or link may be incomplete.", "Compare the final element with an official example for this source type.");
    if (/doi:\s*10\./iu.test(citation)) add("doi-label", "warning", "The DOI uses the older “doi:” label.", "APA 7 and MLA 9 examples normally present a DOI as https://doi.org/…");

    if (normalizedStyle === "APA") {
      if (!/\((?:n\.d\.|(?:1[5-9]|20|21)\d{2}(?:,\s*[A-Za-z]+\s+\d{1,2})?)\)\./u.test(citation)) {
        add("apa-date", "error", "The APA date element was not found in its expected parentheses.", "After the author, use (Year)., (n.d.)., or a full date where the source type calls for one.");
      }
      if (/Retrieved from\s+https?:/iu.test(citation)) add("apa-retrieved-from", "warning", "“Retrieved from” is usually unnecessary in APA 7.", "Keep it only when an official APA example calls for a retrieval date or changing content.");
      if (/“[^”]+”/u.test(citation)) add("apa-title-quotes", "warning", "APA reference titles normally do not use quotation marks.", "Article and webpage titles use sentence case without quotation marks; source titles may require italics.");
    } else {
      if (!/^[^.!?]{2,}[.!]/u.test(citation)) add("mla-author", "warning", "The opening creator element may be missing its ending punctuation.", "MLA entries usually begin with the author or organization followed by a period.");
      if (!/[“"][^”"]+[”"]/u.test(citation) && !/(?:\bet al\.|\bedited by\b|\bvol\.|\bno\.|\bpp\.)/iu.test(citation)) {
        add("mla-title-container", "warning", "The title or container pattern is not easy to recognize.", "Short works normally use quotation marks; self-contained works and containers use italics.");
      }
      if (/\(\d{4}\)\./u.test(citation)) add("mla-apa-date", "error", "This has an APA-style parenthesized year.", "MLA usually places publication details later in the entry without APA year parentheses.");
    }
  }

  const errorCount = diagnostics.filter((item) => item.severity === "error").length;
  const warningCount = diagnostics.filter((item) => item.severity === "warning").length;
  return {
    style: normalizedStyle,
    status: !citation ? "needs-input" : errorCount ? "review-required" : warningCount ? "review-suggested" : "looks-consistent",
    diagnostics,
    disclaimer: `This is a ${CITATION_STYLE_METADATA[normalizedStyle].label} format check, not authoritative proof that the source details are complete or correct.`,
  };
}

export {
  CITATION_STYLES,
  CITATION_STYLE_METADATA,
  SOURCE_TYPES,
  SOURCE_TYPE_DEFINITIONS,
  CONTRIBUTOR_ROLES,
  OPTIONAL_FIELD_DEFINITIONS,
  DEFAULT_COLLECTIONS,
  createContributor,
  createSourceDraft,
  fieldsForType,
  formatCitation,
  formatCitationOutput,
  formatInTextCitation,
  checkCitationFormat,
  normalizeSource,
};
