function clean(value) {
  return String(value || "").trim();
}

export function mediaLearningRoute(resource) {
  if (resource?.target_kind === "lesson" && resource?.target_key) {
    return {
      view: "lesson",
      lessonId: String(resource.target_key),
      resourceId: String(resource.id),
      workId: String(resource.id),
    };
  }
  if (resource?.target_kind === "assignment" && resource?.target_key) {
    return {
      view: "assignments",
      workId: String(resource.target_key),
      resourceId: String(resource.id),
    };
  }
  return { view: "resources", resourceId: String(resource?.id || "") };
}

export function mediaCompletionRuleLabel(rule) {
  if (rule === "lesson") return "Complete the linked lesson";
  if (rule === "knowledge_check") return "Submit the linked knowledge check";
  if (rule === "assignment") return "Submit the linked assignment";
  return "No required completion step";
}

export function mediaLearningStatus(resource) {
  if (resource?.learning_requirement !== "required") {
    return { status: "optional", label: "Optional learning resource" };
  }
  if (resource?.learning_progress?.status === "completed") {
    return { status: "completed", label: "Required learning step complete" };
  }
  return {
    status: "pending",
    label: mediaCompletionRuleLabel(resource?.completion_rule),
  };
}

export function requiredMediaWorkRows(resources = []) {
  return (Array.isArray(resources) ? resources : []).flatMap((resource) => {
    if (resource?.learning_requirement !== "required" || !resource?.id) return [];
    const estimatedMinutes = Math.max(1, Number(resource.estimated_minutes) || 15);
    return [{
      id: String(resource.id),
      publication_resource_id: String(resource.id),
      workType: "media_requirement",
      title: clean(resource.title) || "Required course media",
      instructions: clean(resource.description) || mediaCompletionRuleLabel(resource.completion_rule),
      due_at: resource.learning_due_at || null,
      status: resource.learning_progress?.status === "completed" ? "complete" : "not-started",
      settings: { estimated_hours: estimatedMinutes / 60 },
      target_kind: resource.target_kind,
      target_key: resource.target_key,
      completion_rule: resource.completion_rule,
      completion_target_key: resource.completion_target_key,
      learning_progress: resource.learning_progress || null,
      route: mediaLearningRoute(resource),
      resource,
    }];
  });
}
