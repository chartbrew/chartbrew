const MetricRecommendationController = require("../../../../controllers/MetricRecommendationController");
const MonitorController = require("../../../../controllers/MonitorController");
const { getObservationAccess } = require("../../../observations/access");
const { getWorkspaceAccessEnvelope } = require("../../../workspaceContext/accessEnvelope");
const { assertPreviewInstruction } = require("../../../workspaceContext/instructionGate");
const { createPendingAction } = require("../../../workspaceContext/previewStore");

function getComparisonLabel(period) {
  const labels = {
    day: "Last complete day compared with the day before",
    month: "Last complete month compared with the month before",
    quarter: "Last complete quarter compared with the quarter before",
    week: "Last complete week compared with the week before",
    year: "Last complete year compared with the year before",
  };
  return labels[period] || "Last complete period compared with the period before";
}

function getDirectionLabel(direction) {
  return {
    higher: "Higher is better",
    lower: "Lower is better",
    neutral: "Either direction can matter",
  }[direction] || "Either direction can matter";
}

function getBehaviorLabel(behavior, period) {
  const periodLabel = {
    day: "day",
    month: "month",
    quarter: "quarter",
    week: "week",
    year: "year",
  }[period] || "period";
  return {
    distribution: `Median or percentile for the ${periodLabel}`,
    flow: `Total across the ${periodLabel}`,
    ratio: `Rate for the ${periodLabel}`,
    state: `Value at the end of the ${periodLabel}`,
  }[behavior] || `Value for the ${periodLabel}`;
}

function getThresholdLabel(threshold = {}) {
  if (threshold.type === "absolute") return `At least ${threshold.value}`;
  if (threshold.type === "percentage_points") {
    return `At least ${threshold.value} percentage points`;
  }
  return `At least ${(Number(threshold.value) * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function normalizeMonitorInput(payload, overrides = {}) {
  return {
    chartId: overrides.chartId || payload.chart_id,
    comparison: payload.comparison,
    desiredDirection: payload.desired_direction,
    importance: payload.importance,
    layerId: overrides.layerId || payload.layer_id,
    metricBehavior: payload.metric_behavior,
    name: payload.name,
    threshold: payload.threshold,
    valueFormat: payload.value_format || overrides.valueFormat,
  };
}

function getMonitorChangedValues(data, plan) {
  return {
    comparisonPeriod: plan.periodContract?.baselinePolicy?.comparisonPeriod || null,
    desiredDirection: plan.definition?.metricSpec?.desiredDirection
      || data.desiredDirection
      || null,
    importance: plan.importance || data.importance || 1,
    metricBehavior: plan.periodContract?.metricBehavior || data.metricBehavior || null,
    name: data.name || plan.definition?.name || null,
    thresholdType: plan.periodContract?.publicationPolicy?.thresholdType || null,
    thresholdValue: plan.periodContract?.publicationPolicy?.thresholdValue ?? null,
  };
}

async function previewMetricMonitor(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const envelope = await getWorkspaceAccessEnvelope(access);
  const controller = new MonitorController();
  const mode = payload.mode === "update" ? "update" : "create";
  assertPreviewInstruction(payload.original_question, `metric_monitor.${mode}`);
  let data;
  let plan;
  let projectId;
  let resourceId = null;
  let resourceVersion = null;
  let source;

  if (mode === "create") {
    let recommendation = null;
    if (payload.recommendation_id) {
      recommendation = await new MetricRecommendationController().findCurrent(
        access,
        payload.recommendation_id
      );
    }
    data = normalizeMonitorInput(payload, recommendation ? {
      chartId: recommendation.chart.id,
      layerId: recommendation.layerId,
      valueFormat: recommendation.valueFormat,
    } : {});
    plan = await controller.previewCreate(access, data);
    projectId = plan.chart.project_id;
    source = {
      chart: plan.chart.name,
      dashboard: plan.chart.Project?.name || null,
    };
  } else {
    if (!payload.monitor_id) {
      const error = new Error("Choose the watched metric to change");
      error.statusCode = 400;
      throw error;
    }
    data = normalizeMonitorInput(payload);
    delete data.chartId;
    delete data.layerId;
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    plan = await controller.previewUpdate(access, payload.monitor_id, data);
    projectId = plan.monitor.project_id;
    resourceId = plan.monitor.id;
    resourceVersion = plan.monitor.updatedAt?.toISOString() || null;
    source = {
      chart: plan.monitor.Chart?.name || null,
      dashboard: plan.monitor.Project?.name || null,
    };
  }
  const changedValues = mode === "create"
    ? getMonitorChangedValues(data, plan)
    : getMonitorChangedValues(data, {
      definition: { metricSpec: plan.values.metric_spec || plan.monitor.metric_spec },
      importance: plan.values.importance || plan.monitor.importance,
      periodContract: {
        baselinePolicy: plan.values.baseline_policy || plan.monitor.baseline_policy,
        metricBehavior: (plan.values.metric_spec || plan.monitor.metric_spec)?.metricBehavior,
        publicationPolicy: plan.values.publication_policy || plan.monitor.publication_policy,
      },
    });
  const actionType = `metric_monitor.${mode}`;
  const pending = await createPendingAction({
    access,
    accessVersion: envelope.accessVersion,
    actionType,
    projectId,
    proposal: {
      changedValues,
      data,
      mode,
      monitorId: resourceId,
    },
    resourceId,
    resourceVersion,
    sessionId: payload.ai_session_id,
  });
  const comparisonPeriod = changedValues.comparisonPeriod;
  const threshold = {
    type: changedValues.thresholdType,
    value: changedValues.thresholdValue,
  };
  return {
    actionId: pending.actionId,
    expiresAt: pending.expiresAt,
    preview: {
      action: mode,
      calculation: mode === "create"
        ? plan.definition.metricSpec.metricTitle || plan.definition.name
        : plan.monitor.metric_spec?.metricTitle || plan.monitor.name,
      calculationBehaviorLabel: getBehaviorLabel(
        changedValues.metricBehavior,
        comparisonPeriod
      ),
      comparisonLabel: getComparisonLabel(comparisonPeriod),
      firstResultState: mode === "create" ? "Collecting comparison data" : "Uses new settings",
      healthyDirectionLabel: getDirectionLabel(changedValues.desiredDirection),
      name: changedValues.name,
      source,
      thresholdLabel: getThresholdLabel(threshold),
    },
    status: "ready_for_confirmation",
    warnings: [],
  };
}

module.exports = previewMetricMonitor;
module.exports.getBehaviorLabel = getBehaviorLabel;
module.exports.getComparisonLabel = getComparisonLabel;
module.exports.getDirectionLabel = getDirectionLabel;
module.exports.getThresholdLabel = getThresholdLabel;
module.exports.normalizeMonitorInput = normalizeMonitorInput;
