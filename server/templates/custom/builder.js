const _ = require("lodash");

const db = require("../../models/models");

module.exports = async (projectId, { template_id, charts }) => {
  const { model } = await db.Template.findByPk(template_id);

  if (charts && Array.isArray(charts)) {
    const newModelCharts = [];
    model.Charts.forEach((chart) => {
      if (_.indexOf(charts, chart.tid) > -1) {
        newModelCharts.push(chart);
      }
    });

    model.Charts = newModelCharts;
  }

  const createChart = (chart) => {
    return db.Chart.create(chart)
      .then((createdChart) => {
        if (chart?.ChartDatasetConfigs?.length > 0) {
          chart.ChartDatasetConfigs.forEach((cdc) => {
            const newCdc = { ...cdc, chart_id: createdChart.id };
            db.ChartDatasetConfig.create(newCdc);
          });
        }

        return createdChart;
      })
      .catch((err) => {
        return err;
      });
  };

  const chartPromises = [];
  model.Charts.forEach((chart) => {
    const newChart = { ...chart, project_id: projectId };
    delete newChart.id;
    chartPromises.push(createChart(newChart));
  });

  return Promise.all(chartPromises);
};
