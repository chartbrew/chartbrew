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
          attributes: { exclude: ["project_id", "oauth_id", "createdAt", "updatedAt"] },
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
              let found = false;
              connections.forEach((c) => {
                if (d.Connection.id === c.id) found = true;
              });

              if (!found) connections.push(d.Connection);
            });

            // remove the connection objects
            newChart.Datasets = chart.Datasets.map((d) => {
              const newDataset = d;
              newDataset.setDataValue("Connection", d.Connection.id);
              return newDataset;
            });
          }

          template.Connections = connections;
          template.Charts.push(newChart);
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
