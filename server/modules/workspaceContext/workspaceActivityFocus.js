const ACTIVITY_RESPONSE_FOCUS = Object.freeze({
  data_freshness: "data_freshness",
  metric_attention: "needs_attention",
  workspace_summary: "recent_changes",
});

const ACTIVITY_INTENTS = new Set(Object.keys(ACTIVITY_RESPONSE_FOCUS));
const MAXIMUM_ATTENTION_METRICS = 8;
const MAXIMUM_RECENT_METRICS = 10;

function getMetricKey(item) {
  const project = item.project?.id || item.project?.name || "workspace";
  const metric = item.monitorId || item.metricName || item.title || item.factId;
  return `${project}:${`${metric || "item"}`.trim().toLowerCase()}`;
}

function selectUniqueMetricItems(items, seen, limit) {
  const selected = [];
  items.forEach((item) => {
    if (selected.length >= limit) return;
    const key = getMetricKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    selected.push(item);
  });
  return selected;
}

function filterRecentChanges(activity) {
  const seen = new Set();
  const changes = selectUniqueMetricItems(
    activity.changes,
    seen,
    MAXIMUM_RECENT_METRICS
  );
  const evaluations = selectUniqueMetricItems(
    activity.evaluations.filter((item) => (
      ["changed", "improved", "needs_attention"].includes(item.status)
    )),
    seen,
    Math.max(MAXIMUM_RECENT_METRICS - changes.length, 0)
  );
  const availableMetricCount = new Set([
    ...activity.changes.map(getMetricKey),
    ...activity.evaluations
      .filter((item) => ["changed", "improved", "needs_attention"].includes(item.status))
      .map(getMetricKey),
  ]).size;
  const omittedMetricCount = Math.max(
    availableMetricCount - changes.length - evaluations.length,
    0
  );

  return {
    ...activity,
    changes,
    coverage: {
      ...activity.coverage,
      truncated: Boolean(activity.coverage.truncated || omittedMetricCount > 0),
    },
    evaluations,
    health: activity.health.filter((item) => item.state === "active"),
    summaryOmittedMetricCount: omittedMetricCount,
  };
}

function getActivityResponseFocus(intent) {
  return ACTIVITY_RESPONSE_FOCUS[intent] || null;
}

function filterWorkspaceActivity(activity, focus) {
  if (focus === "recent_changes") {
    return filterRecentChanges(activity);
  }
  if (focus === "needs_attention") {
    const seen = new Set();
    const changes = selectUniqueMetricItems(
      activity.changes.filter((item) => item.impact === "negative"),
      seen,
      MAXIMUM_ATTENTION_METRICS
    );
    const evaluations = selectUniqueMetricItems(
      activity.evaluations.filter((item) => item.status === "needs_attention"),
      seen,
      Math.max(MAXIMUM_ATTENTION_METRICS - changes.length, 0)
    );
    return {
      ...activity,
      alerts: activity.alerts.filter((item) => item.state === "active"),
      changes,
      evaluations,
      health: activity.health.filter((item) => item.state === "active"),
    };
  }
  if (focus === "data_freshness") {
    return {
      ...activity,
      alerts: [],
      changes: [],
      evaluations: activity.evaluations.filter((item) => (
        item.stale
        || ["stale", "unavailable", "waiting"].includes(item.completeness)
      )),
      health: activity.health.filter((item) => item.state === "active"),
    };
  }
  return activity;
}

module.exports = {
  ACTIVITY_INTENTS,
  ACTIVITY_RESPONSE_FOCUS,
  filterWorkspaceActivity,
  getMetricKey,
  getActivityResponseFocus,
};
