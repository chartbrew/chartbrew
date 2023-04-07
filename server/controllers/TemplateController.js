const db = require("../models/models");

module.exports.findById = (id) => {
  return db.Template.findByPk(id);
};

module.exports.find = (condition) => {
  return db.Template.findAll({
    where: condition,
  });
};

module.exports.update = (id, data) => {
  return db.Template.update(data, { where: { id } })
    .then(() => this.findById(id));
};

module.exports.create = (teamId, data) => {
  return db.Template.create({ team_id: teamId, model: data.model, name: data.name })
    .then((template) => this.findById(template.id));
};

module.exports.delete = (id) => {
  return db.Template.destroy({ where: { id } });
};

module.exports.getDashboardModel = (projectId) => {
  const template = {
    Charts: [],
  };
  return db.Chart.findAll({
    where: { project_id: projectId },
    order: [[db.Dataset, "order", "ASC"]],
    attributes: { exclude: ["id", "project_id", "chartData", "createdAt", "updatedAt", "lastAutoUpdate", "chartDataUpdated"] },
    include: [{
      model: db.Dataset,
      attributes: { exclude: ["id", "chart_id", "createdAt", "updatedAt"] },
      include: [{
        model: db.DataRequest,
        attributes: { exclude: ["id", "dataset_id", "createdAt", "updatedAt"] },
        include: [{
          model: db.Connection,
          attributes: { exclude: ["project_id", "oauth_id", "createdAt", "updatedAt"] },
        }]
      }],
    }],
  })
    .then((charts) => {
      const connections = [];
      charts.forEach((chart, dIndex) => {
        const newChart = chart;
        // set a template ID for each chart
        newChart.setDataValue("tid", dIndex);

        if (!template.Connection
          && newChart.Datasets
          && newChart.Datasets.length > 0
        ) {
          newChart.Datasets.forEach((d) => {
            d?.DataRequests.forEach((dr) => {
              if (dr.Connection) {
                const foundConnection = connections.find((c) => c.id === dr.Connection.id);
                if (!foundConnection) connections.push(dr.Connection);
              }
            });
          });

          // remove the connection objects
          newChart.Datasets = chart.Datasets.map((d) => {
            const newDataset = d;
            return {
              ...newDataset,
              DataRequests: d.DataRequests.map((dr) => {
                const newDataRequest = dr;
                if (dr.Connection?.id) {
                  delete newDataRequest.setDataValue("Connection", dr.Connection.id);
                }
                return newDataRequest;
              }),
            };
          });
        }

        template.Connections = connections;
        template.Charts.push(newChart);
      });

      return template;
    })
    .catch((err) => {
      throw err;
    });
};
