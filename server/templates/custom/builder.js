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

  if (project.Connections && project.Connections.length > 0) {
    project.Connections.forEach((c) => {
      avoidConnectionCreationList.push(c.id);
    });
  }

  const createAndRecordConnection = async (connection) => {
    if (_.indexOf(avoidConnectionCreationList, connection.id) > -1
      && !connections[connection.id]?.createNew
    ) {
      return new Promise((resolve) => resolve(connection));
    }

    const newConnection = _.clone(connection);
    newConnection.project_id = projectId;
    delete newConnection.id;

    avoidConnectionCreationList.push(connection.id);

    const createdConnection = await db.Connection.create(newConnection);
    createdConnections[connection.id] = createdConnection.id;

    return createdConnection;
  };

  const createConnections = async (connections) => {
    const promises = connections.map(async (c) => {
      return createAndRecordConnection(c);
    });

    return Promise.all(promises);
  };

  const prepareDataRequests = async (dataRequests, datasetId) => {
    const newDataRequests = dataRequests;

    // first create the connections
    const connectionsToCreate = model.Connections.filter((c) => {
      return newDataRequests.find((dr) => dr.Connection === c.id);
    });

    const createdConnections = await createConnections(connectionsToCreate);

    const drsToCreate = [];
    dataRequests.forEach((dr) => {
      const newDr = { ...dr, dataset_id: datasetId };
      if (createdConnections[dr.Connection]) {
        newDr.connection_id = createdConnections[dr.Connection];
      } else {
        newDr.connection_id = dr.Connection;
      }

      drsToCreate.push(newDr);
    });

    return drsToCreate;
  };

  const createDatasets = async (datasets) => {
    const promises = datasets.map(async (d) => {
      const dataset = d;
      if (dataset.DataRequest) {
        dataset.DataRequests = [dataset.DataRequest];
      }

      return db.Dataset.create(dataset)
        .then(async (createdDataset) => {
          const drsToCreate = await prepareDataRequests(
            dataset.DataRequests,
            createdDataset.id
          );

          const drPromises = [];
          drsToCreate.forEach((dr) => {
            drPromises.push(
              db.DataRequest.create(dr),
            );
          });
          Promise.all(drPromises);
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
        // const datasetsToCreate = await preparedDatasets(
        //   chart.Datasets,
        //   createdChart.id
        // );
        const datasetsToCreate = chart.Datasets.map((d) => {
          return {
            ...d,
            chart_id: createdChart.id,
          };
        });

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
