const _ = require("lodash");

const db = require("../../models/models");

module.exports = async (projectId, { template_id, charts, connections }) => {
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

  // get the project with its connections
  const project = await db.Project.findOne({
    where: { id: projectId },
    include: [{ model: db.Connection }],
  });

  // TODO: find a way to create the connections and attach the c_id to the right dataset
  const attachConnection = async (dataset, chartId) => {
    // check wether the connections need to be re-used or created
    const projectConnection = _.findLast(project.Connections, { id: dataset.connection_id });
    const connectionOpt = connections[dataset.connection_id];

    let newConnection = _.clone(projectConnection);
    if ((projectConnection && connectionOpt && connectionOpt.createNew) || !projectConnection) {
      newConnection = _.clone(model.Connections.filter((c) => c.id === dataset.connection_id)[0]);
      newConnection.project_id = projectId;
      delete newConnection.id;

      newConnection = await db.Connection.create(newConnection);
    }

    const newDataset = { ...dataset, connection_id: newConnection.id, chart_id: chartId };

    return new Promise((resolve) => resolve(newDataset));
  };

  const createDatasets = async (datasets, chartId) => {
    // now go through the datasets
    const formattedDatasets = datasets.map(async (d) => {
      const newDataset = await attachConnection(d, chartId)
        .then((processedDataset) => {
          return db.Dataset.create(processedDataset);
        })
        .then((createdDataset) => {
          const newDr = d.DataRequest;
          newDr.dataset_id = createdDataset.id;
          return db.DataRequest.create(newDr);
        });

      return newDataset;
    });

    return Promise.all(formattedDatasets);
  };

  // now go through all the charts
  const chartPromises = model.Charts.map(async (chart) => {
    const newChart = chart;
    newChart.project_id = projectId;
    const newPromise = await db.Chart.create(newChart)
      .then(async (createdChart) => {
        const createdDatasets = await createDatasets(
          chart.Datasets,
          createdChart.id
        );

        return {
          chart: createdChart,
          datasets: createdDatasets,
        };
      });

    return newPromise;
  });

  return Promise.all(chartPromises)
    .catch((err) => {
      return err;
    });
};
