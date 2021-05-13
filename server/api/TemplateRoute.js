const db = require("../models/models");
const verifyToken = require("../modules/verifyToken");
const templates = require("../templates/index");

module.exports = (app) => {
  /*
  ** Route to get the configuration of a template
  */
  app.get("/template/:template", verifyToken, (req, res) => {
    return res.status(200).send(templates[req.params.template].template());
  });
  // -------------------------------------

  /*
  ** Route to templatize a project and get the generation JSON
  */
  app.get("/template/generate/:project_id", verifyToken, (req, res) => {
    if (!req.user.admin) return res.status(401).send("Not authorized to perform this action");

    const template = {
      Charts: [],
    };
    return db.Chart.findAll({
      where: { project_id: req.params.project_id },
      attributes: { exclude: ["id", "project_id", "chartData", "createdAt", "updatedAt", "lastAutoUpdate", "chartDataUpdated"] },
      include: [{
        model: db.Dataset,
        attributes: { exclude: ["id", "chart_id", "connection_id", "createdAt", "updatedAt"] },
        include: [{
          model: db.DataRequest,
          attributes: { exclude: ["id", "dataset_id", "createdAt", "updatedAt"] },
        }, {
          model: db.Connection,
          attributes: { exclude: ["id", "project_id", "createdAt", "updatedAt"] },
        }],
      }],
    })
      .then((charts) => {
        charts.forEach((chart) => {
          if (!template.Connection
            && chart.Datasets
            && chart.Datasets.length > 0
            && chart.Datasets[0].Connection
          ) {
            template.Connection = chart.Datasets[0].Connection;
          }

          template.Charts.push(chart);
        });

        return res.status(200).send(template);
      })
      .catch((err) => {
        return err;
      });
  });
  // -------------------------------------

  return (req, res, next) => {
    next();
  };
};
