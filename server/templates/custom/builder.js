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

  const createConnections = async (conns, index = 0, connectionResults = []) => {
    if (index >= conns.length) {
      return createdConnections;
    }

    const currConnection = conns[index];
    const newConnection = _.clone(currConnection);

    if (currConnection
      && _.indexOf(avoidConnectionCreationList, currConnection.id) > -1
      && !connections[currConnection.id]?.createNew
    ) {
      connectionResults.push(newConnection);
      return createConnections(conns, index + 1, connectionResults);
    }

    newConnection.project_id = projectId;
    delete newConnection.id;

    avoidConnectionCreationList.push(currConnection.id);

    const createdConnection = await db.Connection.create(newConnection);
    createdConnections[currConnection.id] = createdConnection.id;

    connectionResults.push(createdConnection);

    return createConnections(conns, index + 1, connectionResults);
  };

  const prepareDataRequests = async (dataRequests, datasetId, index = 0, drResults = []) => {
    if (index >= dataRequests.length) {
      return drResults;
    }

    const newDr = { ...dataRequests[index], dataset_id: datasetId };

    // first create the connections
    const connectionsToCreate = model.Connections.filter((c) => {
      return newDr.Connection === c.id;
    });

    let createdConnectionsTemp = createdConnections;
    try {
      createdConnectionsTemp = await createConnections(connectionsToCreate);
    } catch (e) {
      // do nothing
    }

    if (createdConnectionsTemp[newDr.Connection]) {
      newDr.connection_id = createdConnectionsTemp[newDr.Connection];
    } else {
      newDr.connection_id = newDr.Connection;
    }

    drResults.push(newDr);

    return prepareDataRequests(dataRequests, datasetId, index + 1, drResults);
  };

  const createDataRequests = async (dataRequests, index = 0, drResults = []) => {
    if (index >= dataRequests.length) {
      return drResults;
    }

    const dr = dataRequests[index];
    try {
      const newDr = await db.DataRequest.create(dr);
      drResults.push(newDr);
      return createDataRequests(dataRequests, index + 1, drResults);
    } catch (e) {
      return createDataRequests(dataRequests, index + 1, drResults);
    }
  };

  const createDatasets = async (datasets, index = 0, datasetsResult = []) => {
    if (index >= datasets.length) {
      return datasetsResult;
    }

    const dataset = datasets[index];
    if (dataset.DataRequest) {
      dataset.DataRequests = [dataset.DataRequest];
    }

    return db.Dataset.create(dataset)
      .then(async (createdDataset) => {
        const drsToCreate = await prepareDataRequests(
          dataset.DataRequests,
          createdDataset.id
        );

        await createDataRequests(drsToCreate);

        datasetsResult.push(createdDataset);
        return createDatasets(datasets, index + 1, datasetsResult);
      })
      .catch(() => {
        return createDatasets(datasets, index + 1, datasetsResult);
      });
  };

  const createCharts = async (modelCharts, index = 0, chartsResult = []) => {
    if (index >= modelCharts.length) {
      return chartsResult;
    }

    const chart = modelCharts[index];
    chart.project_id = projectId;

    const newChart = await db.Chart.create(chart);

    try {
      const datasetsToCreate = chart.Datasets.map((d) => {
        return {
          ...d,
          chart_id: newChart.id,
        };
      });

      const createdDatasets = await createDatasets(datasetsToCreate);

      chartsResult.push({
        chart: newChart,
        datasets: createdDatasets,
      });
    } catch (e) {
      // do nothing
    }

    return createCharts(modelCharts, index + 1, chartsResult);
  };

  const createdCharts = await createCharts(model.Charts);

  // now go through all the charts
  // const chartPromises = model.Charts.map(async (chart) => {
  //   const newChart = chart;
  //   newChart.project_id = projectId;
  //   const newPromise = await db.Chart.create(newChart)
  //     .then(async (createdChart) => {
  //       // const datasetsToCreate = await preparedDatasets(
  //       //   chart.Datasets,
  //       //   createdChart.id
  //       // );
  //       const datasetsToCreate = chart.Datasets.map((d) => {
  //         return {
  //           ...d,
  //           chart_id: createdChart.id,
  //         };
  //       });

  //       const createdDatasets = await createDatasets(datasetsToCreate);

  //       return {
  //         chart: createdChart,
  //         datasets: createdDatasets,
  //       };
  //     });

  //   return newPromise;
  // });

  const gResult = createdCharts;

  const updatePromises = [];
  createdCharts.forEach((chart) => {
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

  return Promise.all(updatePromises)
    .then(() => {
      return gResult;
    })
    .catch((err) => {
      return err;
    });
};
