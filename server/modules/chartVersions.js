const { isDeepStrictEqual } = require("node:util");
const { Op } = require("sequelize");

const db = require("../models/models");
const homeSuggestions = require("./ai/homeSuggestions/service");
const { createHttpError, getObservationAccess, canEditProject } = require("./observations/access");
const { assertVisualizationSpec } = require("../visualization/spec");
const { remapVisualizationBindings } = require("../visualization/remapBindings");

const VERSION_LIMIT = 100;
const CHART_FIELDS = [
  "name", "type", "subType", "visualization", "displayLegend", "pointRadius", "dataLabels",
  "startDate", "endDate", "dateVarsFormat", "includeZeros", "currentEndDate", "fixedStartDate",
  "timeInterval", "autoUpdate", "mode", "maxValue", "minValue", "xLabelTicks", "stacked",
  "horizontal", "showGrowth", "invertGrowth", "isLogarithmic", "content", "ranges",
  "dashedLastPoint", "defaultRowsPerPage",
];
const BINDING_FIELDS = [
  "id", "dataset_id", "xAxis", "xAxisOperation", "yAxis", "yAxisOperation", "dateField",
  "dateFormat", "conditions", "formula", "datasetColor", "fillColor", "fill", "multiFill",
  "legend", "pointRadius", "excludedFields", "sort", "columnsOrder", "order", "maxRecords",
  "goal", "configuration",
];

function pickFields(value, fields) {
  return Object.fromEntries(fields.filter((field) => value[field] !== undefined)
    .map((field) => [field, value[field]]));
}

async function captureConfiguration(chartId, transaction) {
  const chart = await db.Chart.findByPk(chartId, { transaction });
  const bindings = await db.ChartDatasetConfig.findAll({
    where: { chart_id: chartId }, order: [["order", "ASC"], ["id", "ASC"]], transaction,
  });
  const configuration = JSON.parse(JSON.stringify({
    chart: pickFields(chart.toJSON(), CHART_FIELDS),
    bindings: bindings.map((binding) => pickFields(binding.toJSON(), BINDING_FIELDS)),
  }));
  configuration.bindings.forEach((binding) => {
    binding.conditions?.forEach((condition) => delete condition.values);
  });
  return configuration;
}

function comparable(configuration) {
  const result = structuredClone(configuration);
  if (result.chart.visualization?.metadata) {
    ["createdBy", "migratedFrom", "migrationWarnings"].forEach((key) => {
      delete result.chart.visualization.metadata[key];
    });
  }
  result.bindings.forEach((binding, index) => {
    const id = binding.id;
    binding.id = `binding-${index}`;
    binding.conditions?.forEach((condition) => delete condition.values);
    result.chart.visualization?.layers?.forEach((layer) => {
      if (`${layer.bindingId}` === `${id}`) layer.bindingId = binding.id;
    });
  });
  return result;
}

function sameConfiguration(left, right) {
  return isDeepStrictEqual(comparable(left), comparable(right));
}

function describeChange(before, after) {
  if (!before) return "Created chart";
  const groups = [];
  if (!isDeepStrictEqual(before.bindings, after.bindings)) groups.push("Changed chart data settings");
  const changed = CHART_FIELDS.filter((field) => !isDeepStrictEqual(before.chart[field], after.chart[field]));
  if (changed.includes("name")) groups.push("Changed chart title");
  if (changed.some((field) => ["type", "subType"].includes(field))) groups.push("Changed chart type");
  if (changed.some((field) => ["startDate", "endDate", "currentEndDate", "fixedStartDate", "timeInterval"].includes(field))) {
    groups.push("Changed date range");
  }
  if (!groups.length) return "Changed chart appearance";
  return groups.length === 1 ? groups[0] : "Updated chart settings";
}

async function chartAccess(chart, context, transaction) {
  if (!chart || (context.projectId && Number(chart.project_id) !== Number(context.projectId))) {
    throw createHttpError("Chart not found.", 404);
  }
  const project = await db.Project.findByPk(chart.project_id, { transaction });
  if (!project || (context.teamId && Number(project.team_id) !== Number(context.teamId))) {
    throw createHttpError("Chart not found.", 404);
  }
  if (context.internal) return { access: { teamId: Number(project.team_id), allProjects: true }, project };
  if (!context.userId) throw createHttpError("Sign in to edit this chart.", 401);
  const access = await getObservationAccess(project.team_id, context.userId);
  const ghostEditor = project.ghost && ["projectAdmin", "projectEditor"].includes(access.role);
  if (!canEditProject(access, chart.project_id) && !ghostEditor) {
    throw createHttpError("You do not have permission to edit this chart.", 403);
  }
  return { access, project };
}

async function checkDatasets(bindings, access, transaction) {
  const ids = [...new Set(bindings.map((binding) => Number(binding.dataset_id)))];
  const datasets = await db.Dataset.findAll({ where: { id: ids }, transaction });
  if (datasets.length !== ids.length || datasets.some((dataset) => (
    Number(dataset.team_id) !== access.teamId
    || (!access.allProjects && !(dataset.project_ids || []).some((id) => access.projectIds.includes(Number(id))))
  ))) throw createHttpError("A dataset is missing or you cannot access it. Ask a team admin to check access.", 403);
  return datasets;
}

async function recordVersion(chart, configuration, context, transaction, summary) {
  const version = chart.configurationVersion + 1;
  await db.ChartVersion.create({
    chart_id: chart.id,
    version,
    configuration,
    user_id: context.userId || null,
    origin: context.origin || "manual",
    operation_id: context.operationId || null,
    restored_from_version: context.restoredFromVersion || null,
    summary,
  }, { transaction });
  await chart.update({ configurationVersion: version }, { transaction });
  if (context.userId && ["manual", "ai", "restore"].includes(context.origin || "manual")) {
    const recordActivity = async () => {
      try {
        const project = await db.Project.findByPk(chart.project_id, { attributes: ["team_id"] });
        if (project) await homeSuggestions.recordUserActivity(project.team_id, context.userId, [{ entityType: "chart", entityId: chart.id }]);
      } catch (error) { homeSuggestions.log("activity_unavailable"); }
    };
    if (transaction) transaction.afterCommit(recordActivity);
    else await recordActivity();
  }
  await db.ChartVersion.destroy({
    where: { chart_id: chart.id, version: { [Op.lte]: version - VERSION_LIMIT } }, transaction,
  });
}

async function initializeHistory(chart, context, transaction) {
  if (chart.configurationVersion) return;
  await recordVersion(chart, await captureConfiguration(chart.id, transaction), { ...context, origin: context.userId ? context.origin : "system" }, transaction, "Created chart");
}

async function saveChartVersion(chartId, context, mutate) {
  const save = async (transaction) => {
    const chart = await db.Chart.findByPk(chartId, { transaction, lock: transaction.LOCK.UPDATE });
    const { access } = await chartAccess(chart, context, transaction);
    if (context.operationId && await db.ChartVersion.findOne({
      where: { chart_id: chart.id, operation_id: context.operationId }, transaction,
    })) return { configurationVersion: chart.configurationVersion, repeated: true };
    if (!Number.isInteger(context.expectedVersion) || context.expectedVersion !== chart.configurationVersion) {
      throw createHttpError("This chart changed. Reload the latest version before saving.", 409);
    }
    const before = await captureConfiguration(chart.id, transaction);
    const result = await mutate({ chart, transaction, access });
    const after = await captureConfiguration(chart.id, transaction);
    await checkDatasets(after.bindings, access, transaction);
    if (after.chart.visualization) assertVisualizationSpec(after.chart.visualization, {
      allowIncomplete: after.chart.visualization.status !== "ready",
    });
    if (!sameConfiguration(before, after)) {
      if (!chart.configurationVersion) {
        await recordVersion(chart, before, { origin: "baseline" }, transaction, "History started");
      }
      await recordVersion(chart, after, context, transaction, context.restoredFromVersion
        ? `Restored version ${context.restoredFromVersion}` : describeChange(before, after));
    }
    return { result, configurationVersion: chart.configurationVersion };
  };
  return context.transaction ? save(context.transaction) : db.sequelize.transaction(save);
}

function mutationContext(req) {
  const { expectedVersion, operationId } = req.body || {};
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0
    || typeof operationId !== "string" || !operationId.length || operationId.length > 128) {
    throw createHttpError("Reload the chart before saving. The save request is incomplete.", 400);
  }
  return { userId: req.user.id, projectId: req.params.project_id, chartId: req.params.chart_id, expectedVersion, operationId, origin: "manual" };
}

async function getVersion(chartId, version, context, transaction) {
  if (!/^[1-9]\d*$/.test(String(version))) throw createHttpError("Version not found.", 404);
  const chart = await db.Chart.findByPk(chartId, { transaction });
  const { access, project } = await chartAccess(chart, context, transaction);
  const saved = await db.ChartVersion.findOne({ where: { chart_id: chart.id, version }, transaction });
  if (!saved) throw createHttpError("This version is no longer available. Open History to select another version.", 404);
  const datasets = await checkDatasets(saved.configuration.bindings, access, transaction);
  return { chart, saved, datasets, project };
}

async function restoreVersion(chartId, version, context) {
  return saveChartVersion(chartId, { ...context, origin: "restore", restoredFromVersion: Number(version) }, async ({ chart, transaction }) => {
    const { saved } = await getVersion(chartId, version, context, transaction);
    const configuration = saved.configuration;
    const existing = await db.ChartDatasetConfig.findAll({ where: { chart_id: chart.id }, transaction });
    const removed = existing.filter((binding) => !configuration.bindings.some((item) => item.id === binding.id));
    if (removed.length && await db.Alert.count({ where: { cdc_id: removed.map((binding) => binding.id) }, transaction })) {
      throw createHttpError("An alert uses a dataset that this version removes. Remove that alert before restoring.", 409);
    }
    const bindings = await Promise.all(configuration.bindings.map(async (item) => {
      const current = existing.find((binding) => binding.id === item.id);
      const values = pickFields(item, BINDING_FIELDS.filter((field) => field !== "id"));
      return current
        ? current.update(values, { transaction })
        : db.ChartDatasetConfig.create({ ...values, chart_id: chart.id }, { transaction });
    }));
    if (removed.length) await db.ChartDatasetConfig.destroy({ where: { id: removed.map((binding) => binding.id) }, transaction });
    const visualization = configuration.chart.visualization;
    if (visualization?.layers.some((layer) => layer.bindingId != null
      && !configuration.bindings.some((binding) => `${binding.id}` === `${layer.bindingId}`))) {
      throw createHttpError("This version has an unavailable dataset. Select another version.", 422);
    }
    await chart.update({
      ...configuration.chart,
      visualization: remapVisualizationBindings(visualization, configuration.bindings, bindings),
    }, { transaction });
  });
}

module.exports = {
  VERSION_LIMIT, CHART_FIELDS, BINDING_FIELDS, pickFields, captureConfiguration, sameConfiguration,
  chartAccess, checkDatasets, initializeHistory, saveChartVersion, mutationContext, getVersion, restoreVersion,
};
