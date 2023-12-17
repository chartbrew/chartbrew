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
    attributes: { exclude: ["id", "project_id", "chartData", "createdAt", "updatedAt", "lastAutoUpdate", "chartDataUpdated"] },
    include: [{
      model: db.ChartDatasetConfig,
      attributes: { exclude: ["id", "chart_id", "createdAt", "updatedAt"] },
    }],
  })
    .then((charts) => {
      charts.forEach((chart, dIndex) => {
        const newChart = chart;
        // set a template ID for each chart
        newChart.setDataValue("tid", dIndex);

        template.Charts.push(newChart);
      });

      return template;
    })
    .catch((err) => {
      throw err;
    });
};
