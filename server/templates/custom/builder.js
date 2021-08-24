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

  const createdConnections = {};
  const avoidConnectionCreationList = [];

  // TODO: find a way to create the connections and attach the c_id to the right dataset
  const attachConnection = async (dataset, chartId) => {
    if (_.indexOf(avoidConnectionCreationList, dataset.connection_id) > -1) {
      return new Promise((resolve) => resolve({
        ...dataset, chart_id: chartId, connection_id: dataset.connection_id,
      }));
    }

    // check wether the connections need to be re-used or created
    const projectConnection = _.findLast(project.Connections, { id: dataset.connection_id });
    const connectionOpt = connections[dataset.connection_id];

    let newConnection = _.clone(projectConnection);
    if ((projectConnection && connectionOpt && connectionOpt.createNew) || !projectConnection) {
      newConnection = _.clone(model.Connections.filter((c) => c.id === dataset.connection_id)[0]);
      newConnection.project_id = projectId;
      delete newConnection.id;

      avoidConnectionCreationList.push(dataset.connection_id);
      newConnection = await db.Connection.create(newConnection);
      // update which connection have been created
      createdConnections[dataset.connection_id] = newConnection.id;
    }

    const newDataset = { ...dataset, connection_id: newConnection.id, chart_id: chartId };

    return new Promise((resolve) => resolve(newDataset));
  };

  const preparedDatasets = async (datasets, chartId) => {
    // now go through the datasets
    const formattedDatasets = datasets.map(async (d) => {
      const newDataset = await attachConnection(d, chartId)
        .then((preparedDataset) => {
          return preparedDataset;
        });

      return newDataset;
    });

    return Promise.all(formattedDatasets);
  };

  const createDatasets = async (datasets) => {
    const promises = datasets.map(async (d) => {
      const dataset = d;
      if (createdConnections[dataset.connection_id]) {
        dataset.connection_id = createdConnections[dataset.connection_id];
      }

      return db.Dataset.create(dataset)
        .then((createdDataset) => {
          const newDr = dataset.DataRequest;
          newDr.dataset_id = createdDataset.id;
          db.DataRequest.create(newDr);
          return createdDataset;
        });
    });

    return Promise.all(promises);
  };

  // now go through all the charts
  const chartPromises = model.Charts.map(async (chart) => {
    const newChart = chart;
    newChart.project_id = projectId;
    const newPromise = await db.Chart.create(newChart)
      .then(async (createdChart) => {
        const datasetsToCreate = await preparedDatasets(
          chart.Datasets,
          createdChart.id
        );

        const createdDatasets = await createDatasets(datasetsToCreate);

        return {
          chart: createdChart,
          datasets: createdDatasets,
        };
      });

    return newPromise;
  });

  let gResult;
  return Promise.all(chartPromises)
    .then((charts) => {
      gResult = charts;

      const updatePromises = [];
      charts.forEach((chart) => {
        chart.datasets.forEach((dataset) => {
          if (createdConnections[dataset.connection_id]) {
            updatePromises.push(
              db.Dataset.update(
                { connection_id: createdConnections[dataset.connection_id] },
                { where: { id: dataset.id } }
              )
            );
          }
        });
      });

      return Promise.all(updatePromises);
    })
    .then(() => {
      return gResult;
    })
    .catch((err) => {
      return err;
    });
};
