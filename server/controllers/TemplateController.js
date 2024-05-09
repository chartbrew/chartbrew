const db = require("../models/models");

module.exports.findById = (id) => {
  return db.Template.findByPk(id);
};

module.exports.find = (condition) => {
  return db.Template.findAll({
    where: condition,
    order: [["createdAt", "DESC"]],
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

module.exports.getDashboardModel = async (projectId) => {
  const template = {
    Charts: [],
    Connections: [],
    Datasets: [],
  };

  const project = await db.Project.findByPk(projectId, {
    include: [{
      model: db.Variable,
    }],
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return db.Chart.findAll({
    where: { project_id: projectId },
    attributes: { exclude: ["id", "project_id", "chartData", "createdAt", "updatedAt", "lastAutoUpdate", "chartDataUpdated"] },
    include: [{
      model: db.ChartDatasetConfig,
      attributes: { exclude: ["id", "chart_id", "createdAt", "updatedAt"] },
      include: [{
        model: db.Dataset,
        include: [{
          model: db.DataRequest,
          include: [{
            model: db.Connection,
            attributes: ["id", "type", "subType", "name", "host", "createdAt", "updatedAt"],
          }],
        }],
      }],
    }],
  })
    .then((charts) => {
      charts.forEach((chart, dIndex) => {
        const newChart = chart;
        // set a template ID for each chart
        newChart.setDataValue("tid", dIndex);

        // extract the connections and datasets from the chart
        const datasets = [];
        const connections = [];
        chart.ChartDatasetConfigs.forEach((config) => {
          const dataset = config.Dataset;
          const dataRequests = dataset.DataRequests;
          const drConnections = [];
          dataRequests.forEach((dr) => {
            if (dr.Connection) {
              drConnections.push(dr.Connection);
            }
          });

          // add datasets and connections only if not already added
          if (!datasets.find((d) => d.id === dataset.id)
            && !template.Datasets.find((d) => d.id === dataset.id)
          ) {
            datasets.push(dataset);
          }

          drConnections.forEach((c) => {
            if (!connections.find((conn) => conn.id === c.id)
              && !template.Connections.find((conn) => conn.id === c.id)
            ) {
              connections.push(c);
            }
          });
        });

        template.Charts.push(newChart);
        template.Connections = template.Connections.concat(connections);
        template.Datasets = template.Datasets.concat(datasets);
        template.Variables = project.Variables;
      });

      return template;
    })
    .catch((err) => {
      throw err;
    });
};
