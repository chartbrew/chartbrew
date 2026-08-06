const { createHash } = require("../updateAudit");
const { buildMonitorDefinition, getEligibleLayers } = require("./monitorSchema");

const AGGREGATION_LABELS = {
  avg: "Average",
  count: "Count",
  max: "Maximum",
  min: "Minimum",
  none: "Chart value",
  sum: "Sum",
};

function getRecommendationIdentity(candidate) {
  return [
    candidate.chartId,
    candidate.bindingKey,
    candidate.definitionFingerprint,
  ].join(":");
}

function getRecommendationId(teamId, candidate) {
  return createHash({
    bindingKey: candidate.bindingKey,
    chartId: candidate.chartId,
    definitionFingerprint: candidate.definitionFingerprint,
    teamId,
  });
}

function getDismissalIdentity(dismissal) {
  return [
    dismissal.chart_id,
    dismissal.binding_key,
    dismissal.definition_fingerprint,
  ].join(":");
}

function isCurrentDismissal(dismissal, now = new Date()) {
  return !dismissal.expires_at || new Date(dismissal.expires_at).getTime() > now.getTime();
}

function getSemanticConfirmation(chart, layer, definition, now) {
  const binding = (chart.ChartDatasetConfigs || []).find((item) => {
    return `${item.id}` === `${layer.bindingId}`;
  });
  const intelligence = binding?.Dataset?.DatasetIntelligence;
  if (!intelligence || intelligence.status !== "ready") return false;
  if (intelligence.expires_at && new Date(intelligence.expires_at).getTime() <= now.getTime()) {
    return false;
  }
  const field = intelligence.profile?.fields?.[definition.metricSpec.metricField];
  if (field?.role !== "measure" || Number(field.confidence) < 0.9) return false;
  return !field.defaultAggregation
    || field.defaultAggregation === "none"
    || field.defaultAggregation === definition.metricSpec.aggregate;
}

function getReasons({
  activeAlertCount, autoUpdate, pinCount, projectName, semanticConfirmed,
}) {
  const reasons = [];
  if (activeAlertCount > 0) {
    reasons.push("An active alert already marks this chart as important.");
  }
  if (pinCount > 0) {
    const people = pinCount === 1 ? "person has" : "people have";
    reasons.push(`${pinCount} ${people} pinned ${projectName}.`);
  }
  if (semanticConfirmed) {
    reasons.push("Its field and calculation match the dataset profile.");
  }
  if (autoUpdate && reasons.length < 2) {
    reasons.push("The chart refreshes automatically.");
  }
  if (reasons.length === 0) {
    reasons.push("This chart contains a metric Chartbrew can reproduce after each refresh.");
  }
  return reasons.slice(0, 2);
}

function compareRecommendations(left, right) {
  const fields = [
    "hasActiveAlert",
    "hasPins",
    "pinCount",
    "semanticConfirmed",
    "autoUpdates",
    "hasRecentData",
    "updatedAtValue",
  ];
  for (const field of fields) {
    const difference = Number(right.rank[field]) - Number(left.rank[field]);
    if (difference !== 0) return difference;
  }
  const chartDifference = Number(left.chart.id) - Number(right.chart.id);
  if (chartDifference !== 0) return chartDifference;
  return `${left.layerId}`.localeCompare(`${right.layerId}`);
}

function buildMetricRecommendations({
  charts = [], dismissals = [], monitors = [], pinCounts = new Map(), teamId, now = new Date(),
}) {
  const existing = new Set(monitors.map((monitor) => {
    return `${monitor.chart_id}:${monitor.binding_key}`;
  }));
  const dismissed = new Set(dismissals
    .filter((dismissal) => isCurrentDismissal(dismissal, now))
    .map(getDismissalIdentity));
  const recentCutoff = now.getTime() - (30 * 24 * 60 * 60 * 1000);

  return charts.flatMap((chart) => {
    const options = getEligibleLayers(chart.visualization);
    return options.flatMap((option) => {
      let definition;
      try {
        definition = buildMonitorDefinition({
          chart,
          desiredDirection: "neutral",
          layerId: option.id,
          valueFormat: option.valueFormat,
        });
      } catch (error) {
        return [];
      }
      const candidate = {
        bindingKey: definition.bindingKey,
        chartId: chart.id,
        definitionFingerprint: definition.definitionFingerprint,
      };
      if (existing.has(`${chart.id}:${definition.bindingKey}`)) return [];
      if (dismissed.has(getRecommendationIdentity(candidate))) return [];

      const layer = (chart.visualization?.layers || []).find((item) => {
        return `${item.id}` === `${option.id}`;
      });
      const activeAlertCount = (chart.Alerts || []).filter((alert) => alert.active).length;
      const pinCount = Number(pinCounts.get(Number(chart.project_id))) || 0;
      const semanticConfirmed = getSemanticConfirmation(chart, layer, definition, now);
      const updatedAtValue = chart.chartDataUpdated
        ? new Date(chart.chartDataUpdated).getTime()
        : 0;
      const aggregate = definition.metricSpec.aggregate || "none";
      const aggregateLabel = AGGREGATION_LABELS[aggregate] || "Calculated value";
      const projectName = chart.Project?.name || "Dashboard";

      return [{
        chart: { id: chart.id, name: chart.name || definition.name },
        comparison: definition.kind === "timeseries"
          ? "Compared with the previous period"
          : "Compared across successful refreshes",
        defaultImportance: activeAlertCount > 0 || pinCount > 0 ? 2 : 1,
        id: getRecommendationId(teamId, candidate),
        kind: definition.kind,
        layerId: option.id,
        name: definition.name,
        project: { id: chart.project_id, name: projectName },
        calculation: aggregate === "none"
          ? aggregateLabel
          : `${aggregateLabel} of ${definition.metricSpec.metricTitle}`,
        reasons: getReasons({
          activeAlertCount,
          autoUpdate: Number(chart.autoUpdate) > 0,
          pinCount,
          projectName,
          semanticConfirmed,
        }),
        rank: {
          autoUpdates: Number(chart.autoUpdate) > 0,
          hasActiveAlert: activeAlertCount > 0,
          hasPins: pinCount > 0,
          hasRecentData: updatedAtValue >= recentCutoff,
          pinCount,
          semanticConfirmed,
          updatedAtValue,
        },
        valueFormat: definition.metricSpec.valueFormat,
        _definition: candidate,
      }];
    });
  }).sort(compareRecommendations);
}

function serializeRecommendation(recommendation) {
  const serialized = { ...recommendation };
  delete serialized._definition;
  delete serialized.rank;
  return serialized;
}

module.exports = {
  buildMetricRecommendations,
  compareRecommendations,
  getRecommendationId,
  isCurrentDismissal,
  serializeRecommendation,
};
