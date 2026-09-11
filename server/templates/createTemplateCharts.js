const db = require("../models/models");
const { createPlacedChart, lockDashboard } = require("../modules/dashboardLayout");
const { appendCharts, breakpoints } = require("../../shared/dashboard/layout.mjs");
const { remapVisualizationBindings } = require("../visualization/remapBindings");

async function createTemplateChart(chart, projectId, datasetMapping, transaction) {
  const sourceConfigs = chart.ChartDatasetConfigs || [];
  const chartData = { ...chart, project_id: projectId };
  delete chartData.ChartDatasetConfigs;
  [
    "chartData",
    "chartDataUpdated",
    "preparedData",
    "preparedDataFingerprint",
    "preparedDataSourceFingerprint",
    "preparedDataUpdatedAt",
    "preparedDataVisualizationFingerprint",
  ].forEach((field) => delete chartData[field]);
  const createdChart = await createPlacedChart(chartData, { transaction, preserveLayout: true });
  const createdConfigs = await Promise.all(sourceConfigs.map((cdc) => {
    const newCdc = {
      ...cdc,
      chart_id: createdChart.id,
      dataset_id: datasetMapping[cdc.td_id] || datasetMapping[cdc.dataset_id] || cdc.dataset_id,
    };
    ["bindingId", "id", "templateBindingId"].forEach((field) => delete newCdc[field]);
    return db.ChartDatasetConfig.create(newCdc, { transaction });
  }));

  if (chart.visualization && createdConfigs.length > 0) {
    await createdChart.update({
      visualization: remapVisualizationBindings(chart.visualization, sourceConfigs, createdConfigs),
    }, { transaction });
  }
  return createdChart;
}

function createTemplateCharts(charts, projectId, datasetMapping = {}) {
  return db.sequelize.transaction(async (transaction) => {
    const { project, charts: existing } = await lockDashboard(projectId, transaction);
    const batch = charts.map((chart, index) => ({ ...chart, id: String(index) }));
    const layouts = appendCharts(existing, batch, project.layoutCustom || breakpoints);
    const created = [];
    for (const [index, chart] of charts.entries()) {
      const data = { ...chart, layout: layouts[String(index)] };
      delete data.id;
      // eslint-disable-next-line no-await-in-loop
      created.push(await createTemplateChart(data, projectId, datasetMapping, transaction));
    }
    return created;
  });
}

module.exports = { createTemplateCharts };
