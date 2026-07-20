const db = require("../models/models");
const { remapVisualizationBindings } = require("../visualization/remapBindings");

async function createTemplateChart(chart, projectId, datasetMapping) {
  const sourceConfigs = chart.ChartDatasetConfigs || [];
  const chartData = { ...chart, project_id: projectId };
  delete chartData.ChartDatasetConfigs;
  const createdChart = await db.Chart.create(chartData);
  const createdConfigs = await Promise.all(sourceConfigs.map((cdc) => {
    const newCdc = {
      ...cdc,
      chart_id: createdChart.id,
      dataset_id: datasetMapping[cdc.td_id] || cdc.dataset_id,
    };
    ["bindingId", "id", "templateBindingId"].forEach((field) => delete newCdc[field]);
    return db.ChartDatasetConfig.create(newCdc);
  }));

  if (chart.visualization && createdConfigs.length > 0) {
    await createdChart.update({
      visualization: remapVisualizationBindings(chart.visualization, sourceConfigs, createdConfigs),
    });
  }
  return createdChart;
}

function createTemplateCharts(charts, projectId, datasetMapping) {
  return Promise.all(charts.map((chart) => {
    return createTemplateChart(chart, projectId, datasetMapping);
  }));
}

module.exports = { createTemplateChart, createTemplateCharts };
