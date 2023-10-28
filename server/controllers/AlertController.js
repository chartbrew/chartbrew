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
  return db.Alert.create(data)
    .then((createdAlert) => {
      return findById(createdAlert.id);
    })
    .then((alert) => {
      if (data.alertIntegrations) {
        data.alertIntegrations.forEach((ai) => {
          const foundIntegration = alert.AlertIntegrations.find((alertIntegration) => {
            return alertIntegration.id === ai.id;
          });

          if (foundIntegration) {
            db.AlertIntegration.update({
              enabled: ai.enabled,
            }, {
              where: {
                id: foundIntegration.id,
              },
            });
          } else {
            db.AlertIntegration.create({
              alert_id: alert.id,
              integration_id: ai.integration_id,
              enabled: ai.enabled,
            });
          }
        });
      }

      return findById(alert.id);
    })
    .catch((err) => {
      return new Promise((resolve, reject) => {
        reject(err);
      });
    });
}

function update(id, data) {
  return db.Alert.update(data, {
    where: {
      id,
    },
  })
    .then(() => {
      return findById(id);
    })
    .then(async (alert) => {
      if (data.alertIntegrations) {
        data.alertIntegrations.forEach((ai) => {
          const foundIntegration = alert.AlertIntegrations.find((alertIntegration) => {
            return alertIntegration.id === ai.id;
          });

          if (foundIntegration) {
            db.AlertIntegration.update({
              enabled: ai.enabled,
            }, {
              where: {
                id: foundIntegration.id,
              },
            });
          } else {
            db.AlertIntegration.create({
              alert_id: alert.id,
              integration_id: ai.integration_id,
              enabled: ai.enabled,
            });
          }
        });
      }
      return findById(id);
    });
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
    include: [{ model: db.AlertIntegration }],
  });
}

function getByCdcId(cdcId) {
  return db.Alert.findAll({
    where: {
      cdc_id: cdcId,
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
  getByCdcId,
  addIntegration,
};
