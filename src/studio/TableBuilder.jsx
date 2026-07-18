import { useState } from "react";
import { currentCourseId, saveResourceRecord } from "./storageService.js";

function downloadText(filename, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TableBuilder() {
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(4);
  const [title, setTitle] = useState("Evidence comparison table");
  const [cells, setCells] = useState(() => [
    ["Source", "Claim", "Evidence", "Reliability"],
    ["Source A", "", "", ""],
    ["Source B", "", "", ""],
    ["Synthesis", "", "", ""],
  ]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function resize(nextRows, nextColumns) {
    setCells((existing) => Array.from(
      { length: nextRows },
      (_, rowIndex) => Array.from(
        { length: nextColumns },
        (_, columnIndex) => existing[rowIndex]?.[columnIndex] || ""
      )
    ));
  }

  function updateCell(row, column, value) {
    setCells((existing) => existing.map((line, rowIndex) => (
      rowIndex === row
        ? line.map((cell, columnIndex) => (columnIndex === column ? value : cell))
        : line
    )));
  }

  function toCsv() {
    return cells
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  async function save() {
    setNotice("");
    setError("");
    try {
      await saveResourceRecord({
        course_id: currentCourseId(),
        resource_type: "dataset",
        title: title.trim() || "Course table",
        description: `${rows} × ${columns} editable course table`,
        placement: "lesson",
        storage_mode: "metadata",
        visibility: currentCourseId() ? "course" : "private",
        metadata: { format: "EdTable/1.0", rows, columns, cells },
      });
      setNotice("Table saved to the course resource library.");
    } catch (saveError) {
      setError(saveError.message || "The table could not be saved.");
    }
  }

  return (
    <div className="studio-table-builder">
      <div className="studio-tool-controls">
        <label>
          Table title
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Rows
          <input
            type="number"
            min="2"
            max="12"
            value={rows}
            onChange={(event) => {
              const value = Math.max(2, Math.min(12, Number(event.target.value) || 2));
              setRows(value);
              resize(value, columns);
            }}
          />
        </label>
        <label>
          Columns
          <input
            type="number"
            min="2"
            max="8"
            value={columns}
            onChange={(event) => {
              const value = Math.max(2, Math.min(8, Number(event.target.value) || 2));
              setColumns(value);
              resize(rows, value);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => downloadText(
            `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "table"}.csv`,
            toCsv(),
            "text/csv"
          )}
        >
          Download CSV
        </button>
        <button className="is-primary" type="button" onClick={save}>Save to course</button>
      </div>

      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}

      <div
        className="studio-editable-table"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(130px, 1fr))` }}
      >
        {cells.flatMap((row, rowIndex) => row.map((cell, columnIndex) => (
          <input
            key={`${rowIndex}-${columnIndex}`}
            value={cell}
            onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
            aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
            className={rowIndex === 0 ? "is-heading" : ""}
          />
        )))}
      </div>
    </div>
  );
}
