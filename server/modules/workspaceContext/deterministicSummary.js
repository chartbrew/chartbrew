const { formatMetricValue } = require("../observations/valueFormat");

function escapeMarkdown(value, maximumLength = 300) {
  return `${value ?? ""}`
    .replace(/\p{Cc}/gu, " ")
    .replace(/([\\`*_[\]<>])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatRange(range) {
  return `${formatDate(range.from)} to ${formatDate(range.to)}`;
}

function formatEvaluation(evaluation) {
  const name = escapeMarkdown(evaluation.metricName, 120);
  const value = formatMetricValue(evaluation.currentValue, evaluation.valueFormat);
  const comparison = escapeMarkdown(evaluation.comparisonLabel, 180);
  const statusCopy = {
    changed: "changed",
    improved: "improved",
    needs_attention: "needs attention",
    no_meaningful_change: "had no meaningful change",
  }[evaluation.status] || "was evaluated";
  const stale = evaluation.stale ? " The latest source evidence can be stale." : "";
  return `- **${name}** ${statusCopy} at ${escapeMarkdown(value, 80)}. ${comparison}.${stale}`;
}

function formatChange(change) {
  const title = escapeMarkdown(change.title || change.metricName, 160);
  const summary = escapeMarkdown(change.summary, 260);
  const comparison = change.comparisonLabel
    ? ` ${escapeMarkdown(change.comparisonLabel, 180)}.`
    : "";
  return `- **${title}** — ${summary}${comparison}`;
}

function formatHealth(item) {
  return `- **${escapeMarkdown(item.title, 160)}** — ${escapeMarkdown(item.message, 260)}`;
}

function formatAlert(alert) {
  const time = alert.lastTriggeredAt ? ` on ${formatDate(alert.lastTriggeredAt)}` : "";
  return `- **${escapeMarkdown(alert.name, 160)}** triggered${time}.`;
}

function buildCoverageText(coverage) {
  const parts = [
    `${coverage.evaluatedMetricCount} evaluated`,
    `${coverage.waitingMetricCount} waiting`,
    `${coverage.unhealthyMetricCount} with data issues`,
    `${coverage.watchedMetricCount} watched in total`,
  ];
  const limitText = coverage.truncated
    ? " Some older or lower-priority results are not in this answer."
    : "";
  const accessText = coverage.limitedToAccessibleProjects
    ? " This answer includes only dashboards you can access."
    : "";
  return `Coverage: ${parts.join(", ")}.${accessText}${limitText}`;
}

function buildDeterministicWorkspaceSummary(activity) {
  const lines = [`## Workspace activity`, "", formatRange(activity.range)];
  const attentionChanges = activity.changes.filter((change) => change.impact !== "positive");
  const positiveChanges = activity.changes.filter((change) => change.impact === "positive");
  const attentionEvaluations = activity.evaluations.filter((evaluation) => {
    return evaluation.status === "needs_attention";
  });
  const otherEvaluations = activity.evaluations.filter((evaluation) => {
    return evaluation.status !== "needs_attention";
  });

  if (attentionChanges.length > 0 || attentionEvaluations.length > 0 || activity.health.length > 0) {
    lines.push("", "### Needs attention", "");
    lines.push(...attentionChanges.map(formatChange));
    lines.push(...attentionEvaluations.map(formatEvaluation));
    lines.push(...activity.health.filter((item) => item.state === "active").map(formatHealth));
  }
  if (positiveChanges.length > 0 || otherEvaluations.length > 0) {
    lines.push("", "### Other KPI results", "");
    lines.push(...positiveChanges.map(formatChange));
    lines.push(...otherEvaluations.map(formatEvaluation));
  }
  if (activity.alerts.length > 0) {
    lines.push("", "### Recent alerts", "", ...activity.alerts.map(formatAlert));
  }
  if (activity.changes.length === 0
    && activity.evaluations.length === 0
    && activity.health.length === 0
    && activity.alerts.length === 0) {
    lines.push("", "There are no completed KPI results or active data issues in this range.");
  }
  lines.push("", buildCoverageText(activity.coverage));
  return lines.join("\n");
}

module.exports = {
  buildCoverageText,
  buildDeterministicWorkspaceSummary,
  escapeMarkdown,
  formatChange,
  formatEvaluation,
  formatRange,
};
