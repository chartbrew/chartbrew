const { Op } = require("sequelize");

const db = require("../models/models");
const DatasetController = require("./DatasetController");
const {
  VERSION_LIMIT, chartAccess, getVersion, restoreVersion, captureConfiguration, sameConfiguration,
} = require("../modules/chartVersions");
const { createHttpError } = require("../modules/observations/access");
const { buildChartRuntimeContext, getDatasetRuntimeFilters } = require("../modules/chartRuntimeFilters");
const { resolveChartDatasetOptions } = require("../modules/resolveChartDatasetOptions");
const { VisualizationEngine } = require("../visualization/VisualizationEngine");
const { markChartDatasetIntelligenceStale } = require("../modules/datasetIntelligence/profileLifecycle");
const { attachPreparedRender } = require("../modules/preparedSnapshot");

async function list(chartId, before, context) {
  const chart = await db.Chart.findByPk(chartId);
  await chartAccess(chart, context);
  if (before !== undefined && !/^[1-9]\d*$/.test(String(before))) {
    throw createHttpError("Select a valid history page.", 400);
  }
  const rows = await db.ChartVersion.findAll({
    attributes: { exclude: ["configuration", "operation_id"] },
    where: { chart_id: chart.id, ...(before ? { version: { [Op.lt]: Number(before) } } : {}) },
    include: [{ model: db.User, attributes: ["name"] }],
    order: [["version", "DESC"]], limit: 26,
  });
  return {
    versions: rows.slice(0, 25).map((row) => {
      const { User: user, ...version } = row.toJSON();
      return { ...version, author: user?.name || (["baseline", "system"].includes(version.origin) ? null : "Former member") };
    }),
    nextBefore: rows.length > 25 ? rows[24].version : null,
    configurationVersion: chart.configurationVersion,
    limit: VERSION_LIMIT,
  };
}

async function detail(chartId, version, context) {
  const { saved } = await getVersion(chartId, version, context);
  const current = await captureConfiguration(chartId);
  return {
    version: saved.version,
    summary: saved.summary,
    createdAt: saved.createdAt,
    configuration: saved.configuration,
    canRestore: !sameConfiguration(current, saved.configuration),
  };
}

async function preview(chartId, version, context) {
  const { saved, chart: current, project, datasets } = await getVersion(chartId, version, context);
  const chart = {
    ...saved.configuration.chart,
    id: current.id,
    project_id: current.project_id,
    ChartDatasetConfigs: saved.configuration.bindings.map((binding) => ({
      ...binding,
      chart_id: current.id,
      Dataset: datasets.find((dataset) => dataset.id === binding.dataset_id).toJSON(),
    })),
  };
  const runtimeContext = buildChartRuntimeContext(chart, [], {}, project.timezone);
  const controller = new DatasetController();
  const results = await Promise.all(chart.ChartDatasetConfigs.map(async (binding) => {
    const variables = { ...runtimeContext.variables };
    (binding.configuration?.variables || []).forEach(({ name, value }) => {
      if (variables[name] == null || variables[name] === "") variables[name] = value;
    });
    const result = await controller.runRequest({
      dataset_id: binding.dataset_id,
      chart_id: chart.id,
      projectId: project.id,
      teamId: project.team_id,
      filters: runtimeContext.filters.filter((filter) => filter.type === "date")
        .concat(getDatasetRuntimeFilters(runtimeContext, binding)),
      variables,
      timezone: project.timezone,
      runtimeContext,
      getCache: false,
      maintainDatasetMetadata: false,
      readRuntimeSourceCache: false,
      writeRuntimeSourceCache: false,
    });
    return { ...result, options: resolveChartDatasetOptions(binding, result.options) };
  }));
  const compiled = new VisualizationEngine({ chart, datasets: results, timezone: project.timezone })
    .render({ filters: runtimeContext.filters, variables: runtimeContext.variables, timezone: project.timezone });
  return attachPreparedRender(chart, compiled, compiled.preparedData, { timezone: project.timezone });
}

async function restore(chartId, version, context) {
  await restoreVersion(chartId, version, context);
  await markChartDatasetIntelligenceStale(chartId);
  const ChartController = require("./ChartController"); // eslint-disable-line global-require
  const controller = new ChartController();
  await controller.chartCache.remove(context.userId, chartId);
  try {
    return await controller.updateChartData(chartId, { id: context.userId }, { getCache: true });
  } catch {
    const chart = await controller.findById(chartId, null, { hydratePreparedData: false });
    return { ...chart.toJSON(), render: null, refreshError: { message: "Settings restored. Refresh the chart to load its data." } };
  }
}

module.exports = { list, detail, preview, restore };
