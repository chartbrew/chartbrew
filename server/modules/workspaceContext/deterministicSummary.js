const { DateTime } = require("luxon");

const {
  formatMetricValue,
  fromLegacyUnit,
} = require("../observations/valueFormat");
const { filterWorkspaceActivity } = require("./workspaceActivityFocus");

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

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTime(value, timezone = "UTC") {
  const date = parseDate(value);
  if (!date) return null;
  const dateTime = DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone || "UTC");
  if (dateTime.isValid) return dateTime;
  return DateTime.fromJSDate(date, { zone: "utc" });
}

function formatCompactRange(range, includeYear = true, timezone = "UTC") {
  const from = parseDateTime(range?.from, timezone);
  const to = parseDateTime(range?.to, timezone);
  if (!from || !to) return "Unknown range";
  const sameYear = from.year === to.year;
  const sameMonth = sameYear && from.month === to.month;
  if (from.hasSame(to, "day")) {
    return from.toFormat(includeYear ? "MMM d, yyyy" : "MMM d");
  }
  if (sameMonth) {
    return `${from.toFormat("MMM d")}–${to.day}${
      includeYear ? `, ${from.year}` : ""
    }`;
  }
  if (sameYear) {
    return `${from.toFormat("MMM d")}–${to.toFormat("MMM d")}${
      includeYear ? `, ${from.year}` : ""
    }`;
  }
  return `${from.toFormat("MMM d, yyyy")}–${to.toFormat("MMM d, yyyy")}`;
}

function formatRange(range) {
  return formatCompactRange(range, true, range?.timezone);
}

function getPeriodWindow(period, timezone) {
  const start = parseDateTime(period?.start, timezone);
  const end = parseDateTime(period?.end, timezone);
  if (!start || !end) return null;
  return {
    end: end <= start ? end : end.minus({ milliseconds: 1 }),
    start,
  };
}

function isFullMonth(start, end) {
  return start.day === 1
    && start.year === end.year
    && start.month === end.month
    && end.day === end.daysInMonth;
}

function formatCompactPeriod(period, timezone = "UTC") {
  const window = getPeriodWindow(period, timezone);
  if (!window) return null;
  const { end, start } = window;
  if (start.month === 1 && start.day === 1
    && end.month === 12 && end.day === 31
    && start.year === end.year) {
    return `${start.year}`;
  }
  const quarterEnd = start.plus({ months: 3 }).minus({ milliseconds: 1 });
  if ([1, 4, 7, 10].includes(start.month) && start.day === 1
    && end.hasSame(quarterEnd, "day")) {
    return `Q${start.quarter} ${start.year}`;
  }
  if (isFullMonth(start, end)) {
    return start.toFormat("MMM yyyy");
  }
  return formatCompactRange(
    { from: start.toJSDate(), to: end.toJSDate() },
    start.year !== end.year,
    timezone
  );
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
  const comparisonLabel = escapeMarkdown(change.comparisonLabel, 180);
  const summaryHasComparison = comparisonLabel
    && summary.toLowerCase().includes(comparisonLabel.toLowerCase());
  const comparison = comparisonLabel && !summaryHasComparison
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

function getMetricDirection(item) {
  if (["increase", "decrease"].includes(item.direction)) return item.direction;
  const current = Number(item.currentValue);
  const baseline = Number(item.baselineValue);
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return "changed";
  if (current > baseline) return "increase";
  if (current < baseline) return "decrease";
  return "changed";
}

function getMetricNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getMetricValueFormat(item) {
  if (item.valueFormat) return item.valueFormat;
  if (item.unit) return fromLegacyUnit(item.unit);
  return undefined;
}

function getMetricPeriod(item) {
  const timezone = item.calendarTimezone || "UTC";
  const period = formatCompactPeriod(item.currentPeriod, timezone);
  if (period) return period;
  const date = parseDate(item.observedAt || item.evaluatedAt);
  if (!date) return null;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(date);
}

function formatMetricResult(item) {
  const name = escapeMarkdown(item.metricName || item.title, 120);
  const current = getMetricNumber(item.currentValue);
  const baseline = getMetricNumber(item.baselineValue);
  const period = getMetricPeriod(item);
  const periodCopy = period ? ` · ${period}` : "";
  if (current !== null && baseline !== null) {
    const valueFormat = getMetricValueFormat(item);
    const currentValue = escapeMarkdown(formatMetricValue(current, valueFormat), 80);
    const baselineValue = escapeMarkdown(formatMetricValue(baseline, valueFormat), 80);
    const verb = {
      changed: "changed",
      decrease: "fell",
      increase: "rose",
    }[getMetricDirection(item)];
    return `- **${name}** ${verb} from ${baselineValue} to **${currentValue}**${periodCopy}`;
  }
  let result = "changed";
  if (item.impact === "negative" || item.status === "needs_attention") {
    result = "needs attention";
  } else if (item.impact === "positive" || item.status === "improved") {
    result = "improved";
  }
  return `- **${name}** ${result}${periodCopy}`;
}

function getProjectGroupKey(item) {
  if (item.project?.id) return `project:${item.project.id}`;
  if (item.project?.name) return `project-name:${item.project.name}`;
  return "workspace";
}

function getProjectGroupLabel(item) {
  return item.project?.name || "Workspace-wide items";
}

function groupActivityByProject(activity) {
  const groups = new Map();
  const addItems = (type, items) => {
    items.forEach((item) => {
      const key = getProjectGroupKey(item);
      if (!groups.has(key)) {
        groups.set(key, {
          alerts: [],
          changes: [],
          evaluations: [],
          health: [],
          label: getProjectGroupLabel(item),
        });
      }
      groups.get(key)[type].push(item);
    });
  };

  addItems("changes", activity.changes);
  addItems("evaluations", activity.evaluations);
  addItems("health", activity.health.filter((item) => item.state === "active"));
  addItems("alerts", activity.alerts);
  return [...groups.values()];
}

function appendProjectActivity(lines, group) {
  const attentionChanges = group.changes.filter((change) => change.impact !== "positive");
  const positiveChanges = group.changes.filter((change) => change.impact === "positive");
  const attentionEvaluations = group.evaluations.filter((evaluation) => {
    return evaluation.status === "needs_attention";
  });
  const otherEvaluations = group.evaluations.filter((evaluation) => {
    return evaluation.status !== "needs_attention";
  });

  lines.push("", `### ${escapeMarkdown(group.label, 120)}`);
  if (attentionChanges.length > 0
    || attentionEvaluations.length > 0
    || group.health.length > 0) {
    lines.push("", "#### Needs attention", "");
    lines.push(...attentionChanges.map(formatMetricResult));
    lines.push(...attentionEvaluations.map(formatMetricResult));
    lines.push(...group.health.map(formatHealth));
  }
  if (positiveChanges.length > 0 || otherEvaluations.length > 0) {
    lines.push("", "#### Other KPI results", "");
    lines.push(...positiveChanges.map(formatMetricResult));
    lines.push(...otherEvaluations.map(formatMetricResult));
  }
  if (group.alerts.length > 0) {
    lines.push("", "#### Recent alerts", "", ...group.alerts.map(formatAlert));
  }
}

function appendRecentProjectActivity(lines, group) {
  const metricItems = [...group.changes, ...group.evaluations];
  const attention = metricItems.filter((item) => (
    item.impact === "negative" || item.status === "needs_attention"
  ));
  const improved = metricItems.filter((item) => (
    item.impact === "positive" || item.status === "improved"
  ));
  const changed = metricItems.filter((item) => !attention.includes(item) && !improved.includes(item));

  lines.push("", `### ${escapeMarkdown(group.label, 120)}`);
  if (attention.length > 0) {
    lines.push("", "#### Needs attention", "", ...attention.map(formatMetricResult));
  }
  if (improved.length > 0) {
    lines.push("", "#### Improved", "", ...improved.map(formatMetricResult));
  }
  if (changed.length > 0) {
    lines.push("", "#### Other changes", "", ...changed.map(formatMetricResult));
  }
  if (group.health.length > 0) {
    lines.push("", "#### Data issues", "", ...group.health.map(formatHealth));
  }
  if (group.alerts.length > 0) {
    lines.push("", "#### Alerts", "", ...group.alerts.map(formatAlert));
  }
}

function appendFreshnessActivity(lines, group) {
  lines.push("", `### ${escapeMarkdown(group.label, 120)}`);
  if (group.health.length > 0) {
    lines.push("", "#### Active data issues", "", ...group.health.map(formatHealth));
  }
  if (group.evaluations.length > 0) {
    lines.push(
      "",
      "#### Metrics with incomplete evidence",
      "",
      ...group.evaluations.map((item) => {
        const name = escapeMarkdown(item.metricName, 120);
        return `- **${name}** does not have a complete current result.`;
      })
    );
  }
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
  const focused = filterWorkspaceActivity(activity, "recent_changes");
  const metricItems = [...focused.changes, ...focused.evaluations];
  const attentionCount = metricItems.filter((item) => (
    item.impact === "negative" || item.status === "needs_attention"
  )).length;
  const improvedCount = metricItems.filter((item) => (
    item.impact === "positive" || item.status === "improved"
  )).length;
  const changedCount = metricItems.length - attentionCount - improvedCount;
  const status = [];
  if (attentionCount > 0) status.push(`${attentionCount} need attention`);
  if (improvedCount > 0) status.push(`${improvedCount} improved`);
  if (changedCount > 0) status.push(`${changedCount} changed`);
  const overview = [formatRange(focused.range), ...status].join(" · ");
  const lines = ["## Recent changes", "", overview];
  const groups = groupActivityByProject(focused);
  groups.forEach((group) => appendRecentProjectActivity(lines, group));
  if (groups.length === 0) {
    lines.push(
      "",
      "There are no important metric changes or active data issues in this range."
    );
  }
  const waitingCount = Number(focused.coverage.waitingMetricCount) || 0;
  if (waitingCount > 0) {
    lines.push(
      "",
      `${waitingCount} watched ${waitingCount === 1 ? "metric is" : "metrics are"} still collecting data.`
    );
  }
  if (focused.coverage.limitedToAccessibleProjects) {
    lines.push("", "Only dashboards you can access are included.");
  }
  if (focused.coverage.truncated || focused.summaryOmittedMetricCount > 0) {
    lines.push("", "More changes are available in Activity.");
  }
  return lines.join("\n");
}

function buildDeterministicAttentionSummary(activity) {
  const focused = filterWorkspaceActivity(activity, "needs_attention");
  const lines = [`## Metrics that need attention`, "", formatRange(focused.range)];
  const groups = groupActivityByProject(focused);
  groups.forEach((group) => appendProjectActivity(lines, group));
  if (groups.length === 0) {
    lines.push("", "No completed metric results need attention in this range.");
  }
  if (focused.coverage.truncated) {
    lines.push("", "More results are available in Activity.");
  }
  return lines.join("\n");
}

function buildDeterministicFreshnessSummary(activity) {
  const focused = filterWorkspaceActivity(activity, "data_freshness");
  const lines = [`## Data freshness`, "", formatRange(focused.range)];
  const groups = groupActivityByProject(focused);
  groups.forEach((group) => appendFreshnessActivity(lines, group));
  const waitingCount = Number(focused.coverage.waitingMetricCount) || 0;
  const unhealthyCount = Number(focused.coverage.unhealthyMetricCount) || 0;
  if (groups.length === 0 && waitingCount === 0 && unhealthyCount === 0) {
    lines.push("", "Chartbrew found no active data freshness issues in this range.");
  }
  if (waitingCount > 0) {
    lines.push(
      "",
      `${waitingCount} watched ${waitingCount === 1 ? "metric is" : "metrics are"} waiting for enough data.`
    );
  }
  if (unhealthyCount > focused.health.length) {
    lines.push(
      "",
      `${unhealthyCount} watched ${unhealthyCount === 1 ? "metric has" : "metrics have"} an active data issue.`
    );
  }
  if (focused.coverage.truncated) {
    lines.push("", "More data status details are available in Activity.");
  }
  return lines.join("\n");
}

module.exports = {
  buildDeterministicAttentionSummary,
  buildDeterministicFreshnessSummary,
  buildCoverageText,
  buildDeterministicWorkspaceSummary,
  escapeMarkdown,
  formatChange,
  formatCompactPeriod,
  formatEvaluation,
  formatMetricResult,
  formatRange,
  groupActivityByProject,
};
