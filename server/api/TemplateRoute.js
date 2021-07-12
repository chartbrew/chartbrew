const db = require("../models/models");
const verifyToken = require("../modules/verifyToken");
const templates = require("../templates/index");
const accessControl = require("../modules/accessControl");

const TeamController = require("../controllers/TeamController");
const templateController = require("../controllers/TemplateController");

const url = "/team/:team_id/template";

module.exports = (app) => {
  const teamController = new TeamController();

  const checkAccess = (req, level, model) => {
    return teamController.getTeamRole(req.params.team_id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role)[level](model);
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamRole;
      });
  };

  const formatError = (error, res) => {
    if (error.message === "401") {
      return res.status(401).send({ error: "Not authorized" });
    }
    if (error.message === "404") {
      return res.status(404).send({ error: "Not Found" });
    }
    return res.status(400).send(error);
  };

  /*
  ** Route to get a community template configuration
  */
  app.get(`${url}/community/:template`, verifyToken, (req, res) => {
    try {
      checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return res.status(200).send(templates[req.params.template].template());
  });
  // -------------------------------------

  /*
  ** Route to get a custom template configuration
  */
  app.get(`/${url}/custom/:template_id`, verifyToken, async (req, res) => {
    try {
      checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.findById(req.params.template_id)
      .then((template) => {
        return res.status(200).send(template);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // -------------------------------------

  /*
  ** Route to update a template
  */
  app.put(`${url}/:template_id`, verifyToken, async (req, res) => {
    try {
      checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.update(req.params.template_id, req.body)
      .catch((err) => {
        return formatError(err, res);
      });
  });
  // -------------------------------------

  /*
  ** Route to create a template
  */
  app.post(`${url}`, verifyToken, async (req, res) => {
    try {
      checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.create(req.params.team_id, req.body)
      .catch((err) => {
        return formatError(err, res);
      });
  });
  // -------------------------------------

  /*
  ** Route to create a template from a project and get the generation JSON
  */
  app.get(`${url}/generate/:project_id`, verifyToken, (req, res) => {
    try {
      checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

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
