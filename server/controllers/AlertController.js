const db = require("../models/models");

function findById(id) {
  return db.Alert.findOne({
    where: {
      id,
    },
    include: [{ model: db.AlertIntegration }],
  });
}

function create(data) {
  let createdAlert;
  return db.Alert.create(data)
    .then((alert) => {
      createdAlert = alert;
      if (data.integrations) {
        return Promise.all(data.integrations.map((integration) => {
          const { id, enabled, type } = integration;
          return db.AlertIntegration.create({
            alert_id: alert.id,
            integration_id: id,
            enabled,
            type,
          });
        }));
      }

      return alert;
    })
    .then(() => findById(createdAlert.id));
}

function update(id, data) {
  return db.Alert.update(data, {
    where: {
      id,
    },
  })
    .then(() => findById(id));
}

function remove(id) {
  return db.Alert.destroy({
    where: {
      id,
    },
  });
}

function getByChartId(chartId) {
  return db.Alert.findAll({
    where: {
      chart_id: chartId,
    },
  });
}

function getByDatasetId(datasetId) {
  return db.Alert.findAll({
    where: {
      dataset_id: datasetId,
    },
  });
}

function addIntegration({
  alert_id, integration_id, enabled, type
}) {
  // first check if the integration already exists
  return db.AlertIntegration.findOne({
    where: {
      alert_id,
      integration_id,
    },
  })
    .then((alertIntegration) => {
      if (alertIntegration) {
        return db.AlertIntegration.update({
          enabled,
          type,
        }, {
          where: {
            id: alertIntegration.id,
          },
        })
          .then(() => {
            return db.AlertIntegration.findByPk(alertIntegration.id);
          });
      }

      return db.AlertIntegration.create({
        alert_id,
        integration_id,
        enabled,
        type,
      });
    });
}

module.exports = {
  findById,
  create,
  update,
  remove,
  getByChartId,
  getByDatasetId,
  addIntegration,
};
