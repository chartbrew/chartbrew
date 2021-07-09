const _ = require("lodash");

const db = require("../../models/models");

module.exports = async (
  projectId, apiKey, domain, apiRoot, dashboardOrder, modelTemplate, charts, connection_id
) => {
  const model = modelTemplate(apiKey, domain, apiRoot, dashboardOrder);

  if (charts && Array.isArray(charts)) {
    const newModelCharts = [];
    model.Charts.forEach((chart) => {
      if (_.indexOf(charts, chart.tid) > -1) {
        newModelCharts.push(chart);
      }
    });

    model.Charts = newModelCharts;
  }

  model.Connections[0].project_id = projectId;

  const createDatasets = (datasets, cId, chartId) => {
    const datasetPromises = [];
    // now go through the datasets
    const newDatasets = datasets.map(
      (d) => ({ ...d, chart_id: chartId, connection_id: cId })
    );

    newDatasets.forEach((d) => {
      datasetPromises.push(
        db.Dataset.create(d)
          .then((createdDataset) => {
            const newDr = d.DataRequest;
            newDr.dataset_id = createdDataset.id;
            return db.DataRequest.create(newDr);
          })
      );
    });

    return Promise.all(datasetPromises);
  };

  let connection;
  if (connection_id) connection = await db.Connection.findByPk(connection_id);
  else connection = await db.Connection.create(model.Connections[0]);

  const chartPromises = [];
  // now go through all the charts
  model.Charts.forEach((chart) => {
    const newChart = chart;
    newChart.project_id = projectId;

    chartPromises.push(
      db.Chart.create(newChart)
        .then(async (createdChart) => {
          const createdDatasets = await createDatasets(
            chart.Datasets,
            connection.id,
            createdChart.id
          );

          return {
            chart: createdChart,
            datasets: createdDatasets,
          };
        })
    );
  });

  return Promise.all(chartPromises)
    .catch((err) => {
      return err;
    });
};
