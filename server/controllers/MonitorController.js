const db = require("../models/models");
const ChartController = require("./ChartController");
const DatasetController = require("./DatasetController");
const {
  assertCanEditProject,
  assertCanViewProject,
  createHttpError,
  getProjectScope,
} = require("../modules/observations/access");
const {
  buildDefinitionFingerprint,
  buildMonitorDefinition,
  getEligibleLayers,
  getMinimumSamples,
} = require("../modules/observations/monitorSchema");
const {
  getMonitorPeriodContract,
  hasPeriodContractInput,
  mergeMonitorPeriodInput,
  normalizePeriodContract,
} = require("../modules/observations/periodContract");
const { getPeriodEvaluationSchedule } = require("../modules/observations/periodWindows");
const { getObservationPolicy } = require("../modules/observations/policy");
const {
  getValueFormat,
  normalizeValueFormat,
  toLegacyUnit,
} = require("../modules/observations/valueFormat");
const { normalizeDesiredDirection } = require("../modules/observations/metricDirection");

const ALLOWED_IMPORTANCE = new Set([1, 2, 3]);

function getProjectRefreshIntervalSeconds(schedule = {}) {
  const safeSchedule = schedule || {};
  const frequencyNumber = Number(safeSchedule.frequencyNumber);
  if (safeSchedule.frequency === "every_x_minutes" && frequencyNumber > 0) {
    return frequencyNumber * 60;
  }
  if (safeSchedule.frequency === "every_x_hours" && frequencyNumber > 0) {
    return frequencyNumber * 60 * 60;
  }
  if (safeSchedule.frequency === "every_x_days" && frequencyNumber > 0) {
    return frequencyNumber * 24 * 60 * 60;
  }
  if (safeSchedule.frequency === "daily") return 24 * 60 * 60;
  if (safeSchedule.frequency === "weekly") return 7 * 24 * 60 * 60;
  return null;
}

function getRefreshSchedule(chart) {
  const chartInterval = Number(chart.autoUpdate) > 0 ? Number(chart.autoUpdate) : null;
  const projectInterval = getProjectRefreshIntervalSeconds(chart.Project?.updateSchedule);
  const intervals = [chartInterval, projectInterval].filter(Boolean);
  return {
    automatic: intervals.length > 0,
    intervalSeconds: intervals.length > 0 ? Math.min(...intervals) : null,
  };
}

async function serializeMonitor(monitor) {
  const baselinePolicy = monitor.baseline_policy?.type === "completed_period"
    ? monitor.baseline_policy
    : null;
  const publicationPolicy = monitor.publication_policy || null;
  return {
    active: monitor.is_active,
    aggregate: monitor.metric_spec?.aggregate || "none",
    chartId: monitor.chart_id,
    chartName: monitor.Chart?.name || null,
    createdBy: monitor.creator ? {
      icon: monitor.creator.icon || null,
      id: monitor.creator.id,
      name: monitor.creator.name,
    } : null,
    comparison: baselinePolicy ? {
      checkpointToleranceMinutes: baselinePolicy.checkpointToleranceMinutes,
      mode: baselinePolicy.periodMode,
      period: baselinePolicy.comparisonPeriod,
      rule: baselinePolicy.comparison,
      settlingDelayMinutes: baselinePolicy.settlingDelayMinutes,
      timezone: baselinePolicy.calendarTimezone,
      weekStartsOn: baselinePolicy.weekStartsOn,
    } : null,
    datasetId: monitor.dataset_id,
    datasetName: monitor.Dataset?.name || null,
    desiredDirection: normalizeDesiredDirection(monitor.metric_spec?.desiredDirection),
    id: monitor.id,
    importance: monitor.importance,
    kind: monitor.kind,
    lastSampledAt: monitor.last_sampled_at,
    lastEvaluatedPeriodEnd: monitor.last_evaluated_period_end,
    metricBehavior: monitor.metric_spec?.metricBehavior || null,
    minimumSamples: monitor.minimum_samples,
    name: monitor.name,
    nextEvaluationAt: monitor.next_evaluation_at,
    projectId: monitor.project_id,
    projectName: monitor.Project?.name || null,
    sourceName: monitor.metric_spec?.metricTitle || monitor.name,
    status: monitor.status,
    statusReason: monitor.status_reason,
    threshold: publicationPolicy ? {
      type: publicationPolicy.thresholdType,
      value: publicationPolicy.thresholdValue,
    } : null,
    timeUnit: monitor.metric_spec?.timeUnit || null,
    valueFormat: getValueFormat(monitor.metric_spec),
  };
}

class MonitorController {
  async list(access) {
    const monitors = await db.MetricMonitor.findAll({
      include: [{
        model: db.Chart,
        attributes: ["id", "name"],
        required: false,
      }, {
        model: db.Dataset,
        attributes: ["id", "name"],
        required: false,
      }, {
        model: db.Project,
        attributes: ["id", "name"],
        required: false,
      }, {
      model: db.User,
      as: "creator",
      attributes: ["id", "name", "icon"],
        required: false,
      }],
      order: [["createdAt", "DESC"]],
      where: {
        team_id: access.teamId,
        ...getProjectScope(access),
      },
    });
    return Promise.all(monitors.map(serializeMonitor));
  }

  async getChart(access, chartId) {
    const chart = await db.Chart.findOne({
      include: [{
        model: db.ChartDatasetConfig,
        include: [{ model: db.Dataset, attributes: ["id"] }],
      }, {
        model: db.Project,
        attributes: ["id", "name", "team_id", "timezone", "updateSchedule"],
      }],
      where: { id: chartId },
    });
    if (!chart || Number(chart.Project?.team_id) !== access.teamId) {
      throw createHttpError("Chart not found", 404);
    }
    assertCanViewProject(access, chart.project_id);
    return chart;
  }

  async options(access, chartId) {
    const chart = await this.getChart(access, chartId);
    return getEligibleLayers(chart.visualization).map((option) => ({
      ...option,
      calendarTimezone: chart.Project?.timezone || "UTC",
      refreshSchedule: getRefreshSchedule(chart),
      timeUnit: option.timeUnit || chart.timeInterval || "day",
    }));
  }

  async create(access, data = {}, user = null) {
    const chart = await this.getChart(access, data.chartId);
    assertCanEditProject(access, chart.project_id);
    const policy = getObservationPolicy();

    let definition;
    let periodContract;
    try {
      const draftDefinition = buildMonitorDefinition({
        chart,
        desiredDirection: data.desiredDirection,
        layerId: data.layerId,
        unit: data.unit,
        valueFormat: data.valueFormat,
      });
      periodContract = normalizePeriodContract(data, draftDefinition.metricSpec);
      definition = buildMonitorDefinition({
        chart,
        desiredDirection: data.desiredDirection,
        layerId: data.layerId,
        periodContract,
        unit: data.unit,
        valueFormat: data.valueFormat,
      });
    } catch (error) {
      throw createHttpError(error.message, 400);
    }
    const binding = chart.ChartDatasetConfigs.find((item) => {
      const layer = chart.visualization.layers.find((candidate) => {
        return `${candidate.id}` === `${data.layerId}`;
      });
      return `${item.id}` === `${layer?.bindingId}`;
    });
    const importance = Number(data.importance) || 1;
    if (!ALLOWED_IMPORTANCE.has(importance)) {
      throw createHttpError("Choose a valid metric importance", 400);
    }
    const existingMonitor = await db.MetricMonitor.findOne({
      where: {
        binding_key: definition.bindingKey,
        chart_id: chart.id,
        team_id: access.teamId,
      },
    });
    if (!existingMonitor?.is_active) {
      const monitorCount = await db.MetricMonitor.count({
        where: { is_active: true, team_id: access.teamId },
      });
      if (monitorCount >= policy.maximumMonitors) {
        throw createHttpError("This workspace has reached its watched metric limit", 400);
      }
    }

    const [monitor, created] = await db.MetricMonitor.findOrCreate({
      where: {
        binding_key: definition.bindingKey,
        chart_id: chart.id,
        team_id: access.teamId,
      },
      defaults: {
        baseline_policy: definition.baselinePolicy,
        binding_key: definition.bindingKey,
        chart_id: chart.id,
        created_by: access.userId,
        dataset_id: binding?.dataset_id || binding?.Dataset?.id || null,
        definition_fingerprint: definition.definitionFingerprint,
        importance,
        kind: definition.kind,
        metric_spec: definition.metricSpec,
        minimum_samples: getMinimumSamples(definition.kind, policy.minimumSamples),
        name: data.name?.trim() || definition.name,
        next_evaluation_at: getPeriodEvaluationSchedule({
          comparison: periodContract.baselinePolicy.comparison,
          comparisonPeriod: periodContract.baselinePolicy.comparisonPeriod,
          periodMode: periodContract.baselinePolicy.periodMode,
          settlingDelayMinutes: periodContract.baselinePolicy.settlingDelayMinutes,
          timezone: periodContract.baselinePolicy.calendarTimezone,
          weekStartsOn: periodContract.baselinePolicy.weekStartsOn,
        }).currentDueAt,
        project_id: chart.project_id,
        publication_policy: definition.publicationPolicy,
        team_id: access.teamId,
      },
    });
    if (!created) {
      const definitionChanged = monitor.definition_fingerprint !== definition.definitionFingerprint;
      await monitor.update({
        baseline_policy: definition.baselinePolicy,
        dataset_id: binding?.dataset_id || binding?.Dataset?.id || null,
        definition_fingerprint: definition.definitionFingerprint,
        importance,
        is_active: true,
        kind: definition.kind,
        last_sampled_at: definitionChanged ? null : monitor.last_sampled_at,
        metric_spec: definition.metricSpec,
        minimum_samples: getMinimumSamples(definition.kind, policy.minimumSamples),
        name: data.name?.trim() || monitor.name,
        next_evaluation_at: definitionChanged
          ? getPeriodEvaluationSchedule({
            comparison: periodContract.baselinePolicy.comparison,
            comparisonPeriod: periodContract.baselinePolicy.comparisonPeriod,
            periodMode: periodContract.baselinePolicy.periodMode,
            settlingDelayMinutes: periodContract.baselinePolicy.settlingDelayMinutes,
            timezone: periodContract.baselinePolicy.calendarTimezone,
            weekStartsOn: periodContract.baselinePolicy.weekStartsOn,
          }).currentDueAt
          : monitor.next_evaluation_at,
        project_id: chart.project_id,
        publication_policy: definition.publicationPolicy,
        status: definitionChanged ? "collecting" : monitor.status,
        status_reason: definitionChanged ? "definition_changed" : monitor.status_reason,
      });
    }
    if (user) {
      try {
        const chartController = new ChartController();
        await chartController.updateChartData(chart.id, user, {
          getCache: false,
          noSource: false,
        });
        await monitor.reload();
      } catch (error) {
        await monitor.update({
          status: "collecting",
          status_reason: "initial_evaluation_failed",
        });
      }
    }
    return serializeMonitor(monitor);
  }

  async findById(access, monitorId) {
    const monitor = await db.MetricMonitor.findOne({
      include: [{
        model: db.Chart,
        attributes: ["id", "name"],
        required: false,
      }, {
        model: db.Dataset,
        attributes: ["id", "name"],
        required: false,
      }, {
        model: db.Project,
        attributes: ["id", "name"],
        required: false,
      }, {
      model: db.User,
      as: "creator",
      attributes: ["id", "name", "icon"],
        required: false,
      }],
      where: {
        id: monitorId,
        team_id: access.teamId,
        ...getProjectScope(access),
      },
    });
    if (!monitor) throw createHttpError("Watched metric not found", 404);
    return monitor;
  }

  async update(access, monitorId, data = {}) {
    const monitor = await this.findById(access, monitorId);
    assertCanEditProject(access, monitor.project_id);
    const values = {};
    if (typeof data.active === "boolean") values.is_active = data.active;
    if (typeof data.name === "string" && data.name.trim()) values.name = data.name.trim();
    if (data.importance !== undefined) {
      const importance = Number(data.importance);
      if (!ALLOWED_IMPORTANCE.has(importance)) {
        throw createHttpError("Choose a valid metric importance", 400);
      }
      values.importance = importance;
    }
    let metricSpec = { ...monitor.metric_spec };
    if (data.desiredDirection !== undefined || data.valueFormat !== undefined) {
      if (data.desiredDirection !== undefined) {
        metricSpec.desiredDirection = normalizeDesiredDirection(data.desiredDirection);
      }
      if (data.valueFormat !== undefined) {
        try {
          metricSpec.valueFormat = normalizeValueFormat(
            data.valueFormat,
            metricSpec.formula,
            metricSpec.unit
          );
        } catch (error) {
          throw createHttpError(error.message, 400);
        }
        metricSpec.unit = toLegacyUnit(metricSpec.valueFormat);
      }
    }
    let periodContract = null;
    if (hasPeriodContractInput(data)) {
      try {
        periodContract = normalizePeriodContract(
          mergeMonitorPeriodInput(data, monitor),
          { ...metricSpec, kind: monitor.kind }
        );
      } catch (error) {
        throw createHttpError(error.message, 400);
      }
      metricSpec = {
        ...metricSpec,
        kind: monitor.kind,
        metricBehavior: periodContract.metricBehavior,
      };
      values.baseline_policy = periodContract.baselinePolicy;
      values.publication_policy = periodContract.publicationPolicy;
    } else {
      try {
        periodContract = getMonitorPeriodContract(monitor);
      } catch (error) {
        periodContract = null;
      }
    }
    if (data.desiredDirection !== undefined || data.valueFormat !== undefined || periodContract) {
      values.metric_spec = metricSpec;
    }
    if (periodContract) {
      const baselinePolicy = values.baseline_policy || monitor.baseline_policy;
      const definitionFingerprint = buildDefinitionFingerprint({
        baselinePolicy,
        bindingKey: monitor.binding_key,
        chartId: monitor.chart_id,
        datasetId: monitor.dataset_id,
        metricSpec,
      });
      const definitionChanged = definitionFingerprint !== monitor.definition_fingerprint;
      values.definition_fingerprint = definitionFingerprint;
      if (definitionChanged) {
        const schedule = getPeriodEvaluationSchedule({
          comparison: baselinePolicy.comparison,
          comparisonPeriod: baselinePolicy.comparisonPeriod,
          periodMode: baselinePolicy.periodMode,
          settlingDelayMinutes: baselinePolicy.settlingDelayMinutes,
          timezone: baselinePolicy.calendarTimezone,
          weekStartsOn: baselinePolicy.weekStartsOn,
        });
        values.last_evaluated_period_end = null;
        values.last_sampled_at = null;
        values.next_evaluation_at = schedule.currentDueAt;
        values.status = "collecting";
        values.status_reason = "definition_changed";
      }
    }
    await monitor.update(values);
    return serializeMonitor(monitor);
  }

  async remove(access, monitorId) {
    const monitor = await this.findById(access, monitorId);
    assertCanEditProject(access, monitor.project_id);
    await monitor.destroy();
    return { removed: true };
  }

  async refresh(access, monitorId, user) {
    const monitor = await this.findById(access, monitorId);
    assertCanEditProject(access, monitor.project_id);
    if (monitor.chart_id) {
      const chartController = new ChartController();
      await chartController.updateChartData(monitor.chart_id, user, {
        getCache: false,
        noSource: false,
      });
    } else if (monitor.dataset_id) {
      const datasetController = new DatasetController();
      await datasetController.runRequest({
        dataset_id: monitor.dataset_id,
        getCache: false,
        noSource: false,
        projectId: monitor.project_id,
        teamId: access.teamId,
        team_id: access.teamId,
      });
    } else {
      throw createHttpError("This metric has no data to refresh", 400);
    }
    return this.findById(access, monitorId).then(serializeMonitor);
  }
}

module.exports = MonitorController;
module.exports.getProjectRefreshIntervalSeconds = getProjectRefreshIntervalSeconds;
module.exports.getRefreshSchedule = getRefreshSchedule;
module.exports.serializeMonitor = serializeMonitor;
