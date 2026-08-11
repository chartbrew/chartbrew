const { isCapabilityQuestion } = require("./capabilityHandler");
const { routeWorkspaceRequest } = require("./runtime/deterministicRouter");

const AI_ACCESS_MODES = Object.freeze({
  FULL: "full",
  PROJECT_EDITOR: "project_editor",
  REPORTING_ONLY: "reporting_only",
});

const VIEWER_REPORTING_AI_TOOLS = Object.freeze([
  "get_workspace_activity",
  "get_workspace_context",
  "list_kpi_reviews",
  "list_metric_monitors",
]);

const PROJECT_EDITOR_AI_TOOLS = Object.freeze([
  ...VIEWER_REPORTING_AI_TOOLS,
  "get_dataset_intelligence",
  "preview_kpi_review",
  "preview_metric_monitor",
  "recommend_metric_monitors",
  "run_existing_dataset",
  "search_datasets",
  "summarize",
]);

const VIEWER_FORBIDDEN_REQUEST_PATTERNS = Object.freeze([
  /\b(create|add|build|make|generate|update|edit|change|modify|delete|remove|replace|configure)\b.{0,80}\b(chart|dashboard|dataset|connection|data source|source connection)\b/i,
  /\b(query|run|execute|write|generate|profile|inspect)\b.{0,80}\b(database|data source|source|connection|dataset|sql|query|api)\b/i,
  /\b(query|calculate|analy[sz]e)\b.{0,80}\b(my|our|the)?\s*data\b/i,
  /\b(fetch|retrieve|pull|calculate|analy[sz]e)\b.{0,80}\b(from|against)\b.{0,40}\b(database|data source|source|connection|dataset|api)\b/i,
  /\b(how many|how much|show|find|count|total|average)\b.{0,120}\b(in|from)\b.{0,40}\b(database|data source|connection|dataset|api)\b/i,
  /\b(connect|disconnect)\b.{0,80}\b(database|data source|source|connection|api)\b/i,
  /\b(create|add|prepare|preview|set up|schedule|update|edit|change|delete|remove|watch|monitor)\b.{0,80}\b(metric|kpi|metric watch|watched metric|metric monitor|monitor|alert|kpi review|kpi summary|scheduled summary)\b/i,
  /^(watch|monitor)\b/i,
  /\b(recommend|suggest)\b.{0,80}\b(metric|kpi)\b.{0,40}\b(watch|monitor)\b/i,
  /\b(set|change|update|edit)\b.{0,80}\b(threshold|comparison|healthy direction)\b/i,
]);

const VIEWER_CAPABILITY_MESSAGE = [
  "I can report from the dashboards, saved metric results, watched metrics, alerts, data health, and KPI reviews that you can access.",
  "I cannot query data sources, recommend new watches, or create or change datasets, charts, dashboards, connections, watched metrics, alerts, or KPI review schedules.",
  "Ask a workspace editor or administrator to make an allowed change.",
].join(" ");

const PROJECT_EDITOR_CAPABILITY_MESSAGE = [
  "I can report from the dashboards and saved metric results that you can access.",
  "I can also inspect or run an existing accessible dataset, recommend and prepare watched-metric changes in dashboards that you can edit, and prepare your KPI review schedule.",
  "I cannot create or change data sources, datasets, charts, or dashboards in this chat.",
  "Watched-metric changes need your clear instruction or confirmation. KPI review schedule changes need confirmation.",
].join(" ");

function isReportingOnlyRole(role) {
  return role === "projectViewer";
}

function getAiRoleScope(access, envelope) {
  if (access.canConfigureTeam) {
    return {
      accessMode: AI_ACCESS_MODES.FULL,
      allowedToolNames: undefined,
    };
  }
  if (isReportingOnlyRole(access.role)) {
    return {
      accessMode: AI_ACCESS_MODES.REPORTING_ONLY,
      allowedToolNames: [...VIEWER_REPORTING_AI_TOOLS],
    };
  }
  if (Array.isArray(envelope.editableProjectIds) && envelope.editableProjectIds.length > 0) {
    return {
      accessMode: AI_ACCESS_MODES.PROJECT_EDITOR,
      allowedToolNames: [...PROJECT_EDITOR_AI_TOOLS],
    };
  }
  return {
    accessMode: AI_ACCESS_MODES.REPORTING_ONLY,
    allowedToolNames: [...VIEWER_REPORTING_AI_TOOLS],
  };
}

function getRoleBoundaryMessage(role, question) {
  if (!isReportingOnlyRole(role)) return null;
  const normalized = `${question || ""}`.trim();
  if (!normalized) return null;
  const route = routeWorkspaceRequest({ message: normalized });
  if (isCapabilityQuestion(normalized)
    || route?.intent === "watch_recommendation"
    || VIEWER_FORBIDDEN_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return VIEWER_CAPABILITY_MESSAGE;
  }
  return null;
}

module.exports = {
  AI_ACCESS_MODES,
  PROJECT_EDITOR_AI_TOOLS,
  PROJECT_EDITOR_CAPABILITY_MESSAGE,
  VIEWER_CAPABILITY_MESSAGE,
  VIEWER_FORBIDDEN_REQUEST_PATTERNS,
  VIEWER_REPORTING_AI_TOOLS,
  getAiRoleScope,
  getRoleBoundaryMessage,
  isReportingOnlyRole,
};
