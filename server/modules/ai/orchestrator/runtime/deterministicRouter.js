function isSetupQuestion(message) {
  return /\b(get started|getting started|where (?:do|should) I start|plan (?:my|our|a|the) (?:first )?report)\b/i.test(message)
    || /^(?:please )?(?:help(?: me)?|how (?:do|can|should) (?:I|we)|which .+ should (?:I|we))\b/i.test(message);
}

function normalizeMessage(message) {
  return `${message || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

function isTypedConfirmation(message) {
  return /^(yes|confirm|confirm it|confirm this change|go ahead|do it|apply it)[.!]?$/
    .test(normalizeMessage(message));
}

function isVisualizationAction(message) {
  const normalized = normalizeMessage(message);
  if (isSetupQuestion(normalized)) return false;
  if (!normalized || /\bkpi (review|reviews|summary|summaries|status)\b/.test(normalized)) {
    return false;
  }
  const hasAction = /\b(add|build|change|convert|create|display|generate|make|move|place|save|show|update|visuali[sz]e)\b/
    .test(normalized);
  if (!hasAction) return false;
  return /\b(chart|charts|dashboard|dashboards|graph|graphs|table|tables|visuali[sz]ation|visuali[sz]ations|kpi card|kpi cards)\b/
    .test(normalized)
    || /\b(as|into|like) (a )?kpi\b/.test(normalized)
    || /\b(create|build|make|add|generate) (a |an )?kpi\b/.test(normalized);
}

function routeWorkspaceRequest({ action, message }) {
  if (action?.type === "confirm_pending_action" && action.actionId) {
    return { intent: "confirm_pending_action", mode: "executor" };
  }
  const normalized = normalizeMessage(message);
  if (!normalized) return null;
  if (isTypedConfirmation(normalized)) {
    return { intent: "confirm_pending_action", mode: "executor" };
  }
  if (isSetupQuestion(normalized)) return null;
  if (isVisualizationAction(normalized)) return null;
  if (/\b(data freshness|freshness (issues|status)|check (data )?freshness)\b/.test(normalized)) {
    return { intent: "data_freshness", mode: "fast_path" };
  }
  if (/\b(metrics?|kpis?)\b.*\b(need|needs|requiring|require) attention\b|\bneeds attention\b.*\b(metrics?|kpis?)\b/.test(normalized)) {
    return { intent: "metric_attention", mode: "fast_path" };
  }
  if (/\b(what happened|what has happened|what has been happening|what's been happening|workspace summary|workspace update|summari[sz]e (recent|workspace)|recent changes|kpi status)\b/.test(normalized)) {
    return { intent: "workspace_summary", mode: "fast_path" };
  }
  if (/\b(recommend|suggest|which|what)\b.*\b(metrics?|kpis?)\b.*\b(watch|monitor)\b|\b(metrics?|kpis?)\b.*\bworth watching\b/.test(normalized)) {
    return { intent: "watch_recommendation", mode: "fast_path" };
  }
  if (/\b(list|show|review|which|what)\b.*\b(watched metrics?|metric watches?|monitors?)\b/.test(normalized)) {
    return { intent: "watch_review", mode: "fast_path" };
  }
  if (/\b(list|show|review|which|what)\b.*\b(kpi reviews?|kpi summaries|scheduled summaries)\b/.test(normalized)) {
    return { intent: "kpi_review", mode: "fast_path" };
  }
  if (/^(watch|monitor)\b/.test(normalized)
    || /\b(prepare|create|add|set up|schedule|change|update)\b.*\b(watch|monitor|kpi review|kpi summary|comparison|threshold|healthy direction)\b/.test(normalized)
    || /\b(could|can)\b.*\b(watch|watched|monitor)\b/.test(normalized)) {
    return { intent: "workspace_follow_up", mode: "planner" };
  }
  if (/\b(workspace|watched metrics?|kpi reviews?|kpi summaries|metric watches?)\b/.test(normalized)) {
    return { intent: "workspace_follow_up", mode: "planner" };
  }
  return null;
}

module.exports = {
  isVisualizationAction,
  isTypedConfirmation,
  normalizeMessage,
  routeWorkspaceRequest,
};
