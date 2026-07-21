import { useEffect, useId, useMemo, useState } from "react";
import { searchInstitutionDirectory } from "./adminControlService.js";

/**
 * Safe, non-authoritative directory entries used while the server directory is
 * unavailable or has not yet been populated. Selecting an entry never grants
 * access; affiliation is established only by an approved institutional record.
 */
export const TEXAS_INSTITUTION_FALLBACK = Object.freeze([
  ["angelo-state-university", "Angelo State University", "Texas Tech University System", "San Angelo"],
  ["austin-community-college", "Austin Community College District", "Independent public college district", "Austin", "college"],
  ["dallas-college", "Dallas College", "Dallas County Community College District", "Dallas", "college"],
  ["houston-community-college", "Houston Community College", "Houston Community College System", "Houston", "college"],
  ["lamar-university", "Lamar University", "Texas State University System", "Beaumont"],
  ["lone-star-college", "Lone Star College System", "Lone Star College System", "The Woodlands", "college"],
  ["midwestern-state-university", "Midwestern State University", "Texas Tech University System", "Wichita Falls"],
  ["prairie-view-am-university", "Prairie View A&M University", "Texas A&M University System", "Prairie View"],
  ["sam-houston-state-university", "Sam Houston State University", "Texas State University System", "Huntsville"],
  ["south-plains-college", "South Plains College", "Independent public community college", "Levelland", "college"],
  ["stephen-f-austin-state-university", "Stephen F. Austin State University", "University of Texas System", "Nacogdoches"],
  ["sul-ross-state-university", "Sul Ross State University", "Texas State University System", "Alpine"],
  ["tarleton-state-university", "Tarleton State University", "Texas A&M University System", "Stephenville"],
  ["texas-am-international-university", "Texas A&M International University", "Texas A&M University System", "Laredo"],
  ["texas-am-university", "Texas A&M University", "Texas A&M University System", "College Station"],
  ["texas-southern-university", "Texas Southern University", "Independent public university", "Houston"],
  ["texas-southmost-college", "Texas Southmost College", "Independent public community college", "Brownsville", "college"],
  ["texas-state-university", "Texas State University", "Texas State University System", "San Marcos"],
  ["texas-tech-university", "Texas Tech University", "Texas Tech University System", "Lubbock"],
  ["texas-womans-university", "Texas Woman's University", "Texas Woman's University System", "Denton"],
  ["university-of-houston", "University of Houston", "University of Houston System", "Houston"],
  ["university-of-north-texas", "University of North Texas", "University of North Texas System", "Denton"],
  ["ut-arlington", "The University of Texas at Arlington", "University of Texas System", "Arlington"],
  ["ut-austin", "The University of Texas at Austin", "University of Texas System", "Austin"],
  ["ut-dallas", "The University of Texas at Dallas", "University of Texas System", "Richardson"],
  ["ut-el-paso", "The University of Texas at El Paso", "University of Texas System", "El Paso"],
  ["ut-permian-basin", "The University of Texas Permian Basin", "University of Texas System", "Odessa"],
  ["ut-rio-grande-valley", "The University of Texas Rio Grande Valley", "University of Texas System", "Edinburg"],
  ["ut-san-antonio", "The University of Texas at San Antonio", "University of Texas System", "San Antonio"],
  ["west-texas-am-university", "West Texas A&M University", "Texas A&M University System", "Canyon"],
].map(([directory_key, canonical_name, system_name, city, education_division = "university"]) => Object.freeze({
  directory_key,
  canonical_name,
  system_name,
  city,
  region_code: "TX",
  country_code: "US",
  education_division,
  directory_status: "reference",
  is_selectable: true,
  is_public: true,
  source: "built-in reference list",
})));

function normalizeDirectoryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const name = String(entry.canonical_name || entry.name || "").trim();
  if (!name) return null;
  return {
    ...entry,
    directory_key: entry.directory_key || entry.directoryKey || null,
    institution_id: entry.institution_id || entry.institutionId || null,
    canonical_name: name,
    system_name: entry.system_name || entry.systemName || "",
    education_division: entry.education_division || entry.educationDivision || "university",
  };
}

function choiceFor(entry) {
  return {
    choice: "institution",
    directoryKey: entry.directory_key || null,
    institutionId: entry.institution_id || null,
    name: entry.canonical_name,
    systemName: entry.system_name || "",
    entry,
  };
}

export default function InstitutionPicker({
  value = null,
  onChange,
  educationDivision = "",
  label = "Institution",
  required = false,
  disabled = false,
  allowIndependent = true,
  helpText = "Choose the exact school you attend or work for. Schools in the same system remain separate environments.",
}) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const warningId = `${inputId}-warning`;
  const [query, setQuery] = useState("");
  const [remoteEntries, setRemoteEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [directoryMessage, setDirectoryMessage] = useState("");
  const [otherName, setOtherName] = useState(value?.choice === "other" ? value.name || "" : "");

  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchInstitutionDirectory(query, educationDivision);
        if (!current) return;
        setRemoteEntries(Array.isArray(rows) ? rows.map(normalizeDirectoryEntry).filter(Boolean) : []);
        setDirectoryMessage("");
      } catch (error) {
        if (!current) return;
        setRemoteEntries([]);
        setDirectoryMessage(error?.message || "The live directory is temporarily unavailable. The reference list is still available.");
      } finally {
        if (current) setLoading(false);
      }
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query, educationDivision]);

  const entries = useMemo(() => {
    const byKey = new Map();
    [...remoteEntries, ...TEXAS_INSTITUTION_FALLBACK]
      .map(normalizeDirectoryEntry)
      .filter(Boolean)
      .filter((entry) => !educationDivision || entry.education_division === educationDivision)
      .forEach((entry) => {
        const key = entry.directory_key || entry.canonical_name.toLocaleLowerCase("en-US");
        if (!byKey.has(key) || entry.institution_id) byKey.set(key, entry);
      });
    const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
    return [...byKey.values()]
      .filter((entry) => !normalizedQuery || [entry.canonical_name, entry.system_name, entry.city, entry.region_code]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("en-US")
        .includes(normalizedQuery))
      .sort((left, right) => left.canonical_name.localeCompare(right.canonical_name, "en-US"));
  }, [remoteEntries, query, educationDivision]);

  const selectedValue = value?.choice === "independent"
    ? "__independent__"
    : value?.choice === "other"
      ? "__other__"
      : value?.directoryKey || value?.entry?.directory_key || "";
  const warning = value?.choice === "independent"
    ? "Independent accounts can use free resources, but cannot join an instructor's institutional course, roster, or grade workflow until an institution affiliation is approved."
    : value?.choice === "other"
      ? "A typed institution must be reviewed and matched before institutional course access is available. Do not choose another school to enter its environment."
      : value?.choice === "institution"
        ? "Selecting a school identifies the requested environment; it does not grant access by itself. Your approved account, invitation, or enrollment must match this institution."
        : "";

  function handleSelection(event) {
    const next = event.target.value;
    if (next === "__independent__") {
      onChange?.({ choice: "independent", directoryKey: null, institutionId: null, name: "Independent / no institution" });
      return;
    }
    if (next === "__other__") {
      onChange?.({ choice: "other", directoryKey: null, institutionId: null, name: otherName.trim() });
      return;
    }
    const entry = entries.find((item) => String(item.directory_key) === next);
    if (entry) onChange?.(choiceFor(entry));
  }

  function handleOtherName(event) {
    const name = event.target.value;
    setOtherName(name);
    onChange?.({ choice: "other", directoryKey: null, institutionId: null, name: name.trim() });
  }

  return (
    <div className="ac-field ac-institution-picker">
      <label htmlFor={`${inputId}-search`}>{label}{required ? " *" : ""}</label>
      <p className="ac-field-help" id={helpId}>{helpText}</p>
      <input
        id={`${inputId}-search`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search school, system, or city"
        autoComplete="off"
        disabled={disabled}
        aria-describedby={`${helpId}${warning ? ` ${warningId}` : ""}`}
      />
      <select
        id={inputId}
        value={selectedValue}
        onChange={handleSelection}
        required={required}
        disabled={disabled}
        aria-describedby={`${helpId}${warning ? ` ${warningId}` : ""}`}
      >
        <option value="">{loading ? "Loading institutions…" : "Select an institution"}</option>
        {entries.map((entry) => (
          <option key={entry.directory_key || entry.canonical_name} value={entry.directory_key || ""}>
            {entry.canonical_name}{entry.system_name ? ` — ${entry.system_name}` : ""}
          </option>
        ))}
        {allowIndependent ? <option value="__independent__">Independent / no institution</option> : null}
        <option value="__other__">Other institution — request review</option>
      </select>
      {value?.choice === "other" ? (
        <label className="ac-subfield">
          Institution's full legal name *
          <input
            value={otherName}
            onChange={handleOtherName}
            required={required}
            disabled={disabled}
            autoComplete="organization"
            placeholder="Type the institution name"
          />
        </label>
      ) : null}
      {warning ? <p className="ac-callout ac-callout--warning" id={warningId}>{warning}</p> : null}
      {directoryMessage ? <p className="ac-inline-status" role="status">{directoryMessage}</p> : null}
      {!loading && query && entries.length === 0 ? (
        <p className="ac-inline-status">No matching entry was found. Choose “Other institution” to request a reviewed match.</p>
      ) : null}
    </div>
  );
}
