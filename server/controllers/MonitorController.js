const db = require("../models/models");
const ChartController = require("./ChartController");
const DatasetController = require("./DatasetController");
const {
  assertCanEditProject,
  assertCanViewProject,
  canEditProject,
  createHttpError,
  getProjectScope,
} = require("../modules/observations/access");
const {
  buildDatasetRecordCountDefinition,
  buildMonitorDefinition,
  getEligibleLayers,
  getMinimumSamples,
} = require("../modules/observations/monitorSchema");
const { getObservationPolicy } = require("../modules/observations/policy");
const {
  getValueFormat,
  normalizeValueFormat,
  toLegacyUnit,
} = require("../modules/observations/valueFormat");
const { normalizeDesiredDirection } = require("../modules/observations/metricDirection");

const ALLOWED_IMPORTANCE = new Set([1, 2, 3]);

async function serializeMonitor(monitor) {
  const sampleCount = await db.MetricSnapshot.count({
    where: {
      definition_fingerprint: monitor.definition_fingerprint,
      monitor_id: monitor.id,
    },
  });
  return {
    active: monitor.is_active,
    chartId: monitor.chart_id,
    chartName: monitor.Chart?.name || null,
    createdBy: monitor.creator ? { id: monitor.creator.id, name: monitor.creator.name } : null,
    datasetId: monitor.dataset_id,
    datasetName: monitor.Dataset?.name || null,
    desiredDirection: normalizeDesiredDirection(monitor.metric_spec?.desiredDirection),
    id: monitor.id,
    importance: monitor.importance,
    kind: monitor.kind,
    lastSampledAt: monitor.last_sampled_at,
    minimumSamples: monitor.minimum_samples,
    name: monitor.name,
    projectId: monitor.project_id,
    projectName: monitor.Project?.name || null,
    sampleCount,
    status: monitor.status,
    statusReason: monitor.status_reason,
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
        attributes: ["id", "name"],
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
        attributes: ["id", "name", "team_id"],
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
    return getEligibleLayers(chart.visualization);
  }

  async recordCountOptions(access) {
    const datasets = await db.Dataset.findAll({
      attributes: ["id", "name", "project_ids", "updatedAt"],
      limit: 100,
      order: [["updatedAt", "DESC"]],
      where: {
        draft: false,
        team_id: access.teamId,
      },
    });

    return datasets.flatMap((dataset) => {
      const datasetProjectIds = Array.isArray(dataset.project_ids)
        ? dataset.project_ids.map(Number)
        : [];
      const projectIds = datasetProjectIds
        .filter((projectId) => canEditProject(access, projectId));
      if (!access.canConfigureTeam && projectIds.length === 0) return [];
      return [{
        id: dataset.id,
        name: dataset.name || `Dataset ${dataset.id}`,
        projectIds: access.canConfigureTeam ? datasetProjectIds : projectIds,
      }];
    });
  }

  async createRecordCount(access, data = {}) {
    const dataset = await db.Dataset.findOne({
      where: {
        draft: false,
        id: Number(data.datasetId),
        team_id: access.teamId,
      },
    });
    if (!dataset) throw createHttpError("Dataset not found", 404);

    const datasetProjectIds = (Array.isArray(dataset.project_ids) ? dataset.project_ids : [])
      .map(Number);
    const requestedProjectId = Number(data.projectId);
    const projectId = datasetProjectIds.includes(requestedProjectId)
      ? requestedProjectId
      : datasetProjectIds.find((id) => canEditProject(access, id)) || null;
    if (!access.canConfigureTeam && !projectId) {
      throw createHttpError("You do not have permission to watch this dataset", 403);
    }
    assertCanEditProject(access, projectId);

    const policy = getObservationPolicy();
    const definition = buildDatasetRecordCountDefinition({
      dataset,
      desiredDirection: data.desiredDirection,
    });
    const existingMonitor = await db.MetricMonitor.findOne({
      where: {
        binding_key: definition.bindingKey,
        chart_id: null,
        dataset_id: dataset.id,
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

    const values = {
      baseline_policy: definition.baselinePolicy,
      binding_key: definition.bindingKey,
      chart_id: null,
      created_by: access.userId,
      dataset_id: dataset.id,
      definition_fingerprint: definition.definitionFingerprint,
      importance: 1,
      is_active: true,
      kind: definition.kind,
      metric_spec: definition.metricSpec,
      minimum_samples: getMinimumSamples(definition.kind, policy.minimumSamples),
      name: data.name?.trim() || definition.name,
      project_id: projectId,
      status: "collecting",
      status_reason: "needs_more_history",
      team_id: access.teamId,
    };
    let monitor;
    if (existingMonitor) {
      const definitionChanged = existingMonitor.definition_fingerprint
        !== definition.definitionFingerprint;
      monitor = await existingMonitor.update({
        ...values,
        created_by: existingMonitor.created_by || access.userId,
        last_sampled_at: definitionChanged ? null : existingMonitor.last_sampled_at,
        status: definitionChanged ? "collecting" : existingMonitor.status,
        status_reason: definitionChanged ? "definition_changed" : existingMonitor.status_reason,
      });
    } else {
      monitor = await db.MetricMonitor.create(values);
    }

    try {
      const datasetController = new DatasetController();
      await datasetController.runRequest({
        dataset_id: dataset.id,
        getCache: false,
        noSource: false,
        projectId,
        teamId: access.teamId,
        team_id: access.teamId,
      });
    } catch (error) {
      await monitor.update({
        status: "waiting_for_data",
        status_reason: "initial_evaluation_failed",
      });
    }

    return this.findById(access, monitor.id).then(serializeMonitor);
  }

  async create(access, data = {}, user = null) {
    const chart = await this.getChart(access, data.chartId);
    assertCanEditProject(access, chart.project_id);
    const policy = getObservationPolicy();

    let definition;
    try {
      definition = buildMonitorDefinition({
        chart,
        desiredDirection: data.desiredDirection,
        layerId: data.layerId,
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
        project_id: chart.project_id,
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
        project_id: chart.project_id,
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
        attributes: ["id", "name"],
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
    if (data.desiredDirection !== undefined || data.valueFormat !== undefined) {
      const metricSpec = { ...monitor.metric_spec };
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
      values.metric_spec = metricSpec;
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
module.exports.serializeMonitor = serializeMonitor;
