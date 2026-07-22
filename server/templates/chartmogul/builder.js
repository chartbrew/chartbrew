const _ = require("lodash");

const db = require("../../models/models");
const { createTemplateCharts } = require("../createTemplateCharts");

module.exports = async (
  teamId, projectId, token, key, dashboardOrder, modelTemplate, charts, connection_id
) => {
  const model = modelTemplate(token, key, dashboardOrder);

  if (charts && Array.isArray(charts)) {
    const newModelCharts = [];
    model.Charts.forEach((chart) => {
      if (_.indexOf(charts, chart.tid) > -1) {
        newModelCharts.push(chart);
      }
    });

    model.Charts = newModelCharts;
  }

  model.Connections[0].team_id = teamId;

  let connection;
  if (connection_id) connection = await db.Connection.findByPk(connection_id);
  else connection = await db.Connection.create(model.Connections[0]);

  const datasetMapping = {};
  const datasetPromises = [];
  model.Datasets.forEach((dataset) => {
    datasetPromises.push(db.Dataset.create({ ...dataset, team_id: teamId, draft: false })
      .then((d) => {
        datasetMapping[dataset.td_id] = d.id;
        dataset.DataRequests.forEach((dr) => {
          db.DataRequest.create({ ...dr, connection_id: connection.id, dataset_id: d.id });
        });
      }));
  });

  await Promise.all(datasetPromises);

  return createTemplateCharts(model.Charts, projectId, datasetMapping)
    .catch((err) => {
      return err;
    });
};
