import { useState } from "react";
import { currentCourseId, saveResourceRecord } from "./storageService.js";

function newNode(label = "New concept", relation = "connects to") {
  return { id: crypto.randomUUID(), label, relation };
}

export default function ConceptMap() {
  const [title, setTitle] = useState("What shapes digital access?");
  const [nodes, setNodes] = useState([
    newNode("Infrastructure", "makes access possible"),
    newNode("Cost", "limits participation"),
    newNode("Policy", "sets conditions"),
    newNode("Skill", "changes outcomes"),
  ]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function update(id, field, value) {
    setNodes((items) => items.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  async function save() {
    setNotice("");
    setError("");
    try {
      await saveResourceRecord({
        course_id: currentCourseId(),
        resource_type: "other",
        title: title.trim() || "Concept map",
        description: `${nodes.length}-node concept map`,
        placement: "lesson",
        storage_mode: "metadata",
        visibility: currentCourseId() ? "course" : "private",
        metadata: { format: "EdMap/1.0", center: title, nodes },
      });
      setNotice("Concept map saved to the course resource library.");
    } catch (saveError) {
      setError(saveError.message || "The concept map could not be saved.");
    }
  }

  return (
    <div className="studio-map-layout">
      <div className="studio-map-editor">
        <label>
          Central idea
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        {nodes.map((node, index) => (
          <div className="studio-node-editor" key={node.id}>
            <span>{index + 1}</span>
            <input
              value={node.label}
              onChange={(event) => update(node.id, "label", event.target.value)}
              placeholder="Concept"
            />
            <input
              value={node.relation}
              onChange={(event) => update(node.id, "relation", event.target.value)}
              placeholder="Relationship"
            />
            <button
              type="button"
              aria-label={`Remove ${node.label}`}
              onClick={() => setNodes((items) => items.filter((item) => item.id !== node.id))}
            >
              ×
            </button>
          </div>
        ))}
        <div className="studio-inline-actions">
          <button type="button" onClick={() => setNodes((items) => [...items, newNode()])}>+ Add node</button>
          <button className="is-primary" type="button" onClick={save}>Save map</button>
        </div>
        {notice && <div className="studio-alert is-success">{notice}</div>}
        {error && <div className="studio-alert is-error">{error}</div>}
      </div>

      <div className="studio-concept-map" aria-label="Concept map preview">
        <div className="studio-map-center">{title}</div>
        {nodes.map((node, index) => (
          <div className={`studio-map-node node-${(index % 6) + 1}`} key={node.id}>
            <small>{node.relation}</small>
            <strong>{node.label}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
