const db = require("../../../../models/models");
const ChartController = require("../../../../controllers/ChartController");
const { normalizeTeamId, requireDatasetForTeam } = require("./teamScope");

async function getDatasetCharts(dataset) {
  const chartDatasetConfigs = await db.ChartDatasetConfig.findAll({
    where: { dataset_id: dataset.id },
    include: [{
      model: db.Chart,
      include: [{
        model: db.Project,
        attributes: ["id", "name", "ghost"]
      }]
    }]
  });
  const charts = chartDatasetConfigs
    .map((config) => config.Chart)
    .filter(Boolean);

  if (dataset.chart_id && !charts.some((chart) => chart.id === dataset.chart_id)) {
    const legacyChart = await db.Chart.findByPk(dataset.chart_id, {
      include: [{
        model: db.Project,
        attributes: ["id", "name", "ghost"]
      }]
    });

    if (legacyChart) {
      charts.push(legacyChart);
    }
  }

  return charts;
}

async function refreshChartsForDataset(dataset, shouldRefresh) {
  const charts = await getDatasetCharts(dataset);
  const chartController = new ChartController();
  const refreshedCharts = [];
  const refreshErrors = [];

  if (!shouldRefresh) {
    return { charts, refreshedCharts, refreshErrors };
  }

  for (const chart of charts) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      await chartController.updateChartData(chart.id, null, { getCache: false });
      refreshedCharts.push(chart);
    } catch (error) {
      refreshErrors.push({
        chart_id: chart.id,
        message: error.message,
      });
    }
  }

  return { charts, refreshedCharts, refreshErrors };
}

async function updateDataset(payload) {
  const {
    dataset_id, name, team_id,
    query, configuration, variables, transform
  } = payload;

  if (!dataset_id) {
    throw new Error("dataset_id is required to update a dataset");
  }

  if (!team_id) {
    throw new Error("team_id is required to update a dataset");
  }

  try {
    const normalizedTeamId = normalizeTeamId(team_id);

    // Find the existing dataset
    const dataset = await requireDatasetForTeam(dataset_id, normalizedTeamId);

    // Update dataset fields (only if provided)
    const datasetUpdates = {};
    if (name !== undefined) datasetUpdates.name = name;

    if (Object.keys(datasetUpdates).length > 0) {
      await db.Dataset.update(datasetUpdates, { where: { id: dataset_id } });
    }

    // Find and update the main data request
    const dataRequest = await db.DataRequest.findByPk(dataset.main_dr_id);
    if (!dataRequest) {
      throw new Error("DataRequest not found for this dataset");
    }

    // Update data request fields (only if provided)
    const drUpdates = {};
    if (query !== undefined) drUpdates.query = query;
    if (configuration !== undefined) drUpdates.configuration = configuration;
    if (variables !== undefined) drUpdates.variables = variables;
    if (transform !== undefined) drUpdates.transform = transform;

    if (Object.keys(drUpdates).length > 0) {
      await db.DataRequest.update(drUpdates, { where: { id: dataRequest.id } });
    }

    const {
      charts: affectedCharts,
      refreshedCharts,
      refreshErrors
    } = await refreshChartsForDataset(dataset, Object.keys(drUpdates).length > 0);

    // Refresh the dataset to get updated values
    const updatedDataset = await db.Dataset.findByPk(dataset_id, {
      include: [{
        model: db.DataRequest,
        attributes: ["id", "query", "conditions", "configuration", "variables", "transform"]
      }]
    });

    return {
      dataset_id: updatedDataset.id,
      data_request_id: updatedDataset.main_dr_id,
      name: updatedDataset.name || updatedDataset.legend,
      dataset_url: `${global.clientUrl}/${normalizedTeamId}/dataset/${updatedDataset.id}`,
      updated_fields: {
        dataset: Object.keys(datasetUpdates),
        data_request: Object.keys(drUpdates)
      },
      affected_charts: affectedCharts.map((chart) => ({
        chart_id: chart.id,
        name: chart.name,
        project_id: chart.project_id,
        visibility: chart.Project?.ghost ? "temporary" : "dashboard",
      })),
      refreshed_chart_ids: refreshedCharts.map((chart) => chart.id),
      refresh_errors: refreshErrors,
      ...(affectedCharts.length === 1 ? {
        chart_id: affectedCharts[0].id,
        chart_name: affectedCharts[0].name,
        type: affectedCharts[0].type,
        project_id: affectedCharts[0].project_id,
        is_temporary: !!affectedCharts[0].Project?.ghost,
        visibility: affectedCharts[0].Project?.ghost ? "temporary" : "dashboard",
        ghost_project_id: affectedCharts[0].Project?.ghost ? affectedCharts[0].project_id : null,
        dashboard_url: `${global.clientUrl}/${normalizedTeamId}/${affectedCharts[0].project_id}/dashboard`,
        chart_url: `${global.clientUrl}/${normalizedTeamId}/${affectedCharts[0].project_id}/chart/${affectedCharts[0].id}/edit`,
      } : {})
    };
  } catch (error) {
    throw new Error(`Dataset update failed: ${error.message}`);
  }
}

module.exports = updateDataset;
