function normalizeMessage(message) {
  return `${message || ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

function isTypedConfirmation(message) {
  return /^(yes|confirm|confirm it|confirm this change|go ahead|do it|apply it)[.!]?$/
    .test(normalizeMessage(message));
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
  if (/\b(what happened|what has happened|what has been happening|what's been happening|workspace summary|workspace update|summari[sz]e (recent|workspace)|recent changes|metrics? need attention|kpi status|data freshness)\b/.test(normalized)) {
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
  isTypedConfirmation,
  normalizeMessage,
  routeWorkspaceRequest,
};
