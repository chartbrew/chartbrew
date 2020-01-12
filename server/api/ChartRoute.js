const ChartController = require("../controllers/ChartController");
const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const chartController = new ChartController();
  const projectController = new ProjectController();
  const teamController = new TeamController();

  /*
  ** [MASTER] Route to get all the charts
  */
  app.get("/chart", verifyToken, (req, res) => {
    if (!req.user.admin) {
      return res.status(401).send({ error: "Not authorized" });
    }

    // check query parameters
    const conditions = {};
    if (req.query.exclude) {
      const exclusions = req.query.exclude.split(",");
      conditions.attributes = { exclude: exclusions };
    } else if (req.query.include) {
      const inclusions = req.query.include.split(",");
      conditions.attributes = inclusions;
    }

    return chartController.findAll(conditions)
      .then((charts) => {
        return res.status(200).send(charts);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to get all the charts for a project
  */
  app.get("/project/:project_id/chart", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }

        return chartController.findByProject(req.params.project_id);
      })
      .then((charts) => {
        return res.status(200).send(charts);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to create a new chart
  */
  app.post("/project/:project_id/chart", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }

        // assign the project id to the new chart
        req.body.project_id = req.params.project_id;
        return chartController.create(req.body, req.user);
      })
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error.message.indexOf("406") > -1) {
          return res.status(406).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to update a chart
  */
  app.put("/project/:project_id/chart/:id", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }
        return chartController.update(req.params.id, req.body, req.user);
      })
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error.message.indexOf("406") > -1) {
          return res.status(406).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to update the order of the chart
  */
  app.put("/project/:project_id/chart/:id/order", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }
        return chartController.changeDashboardOrder(req.params.id, req.body.otherId);
      })
      .then((updates) => {
        return res.status(200).send(updates);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to remove a chart
  */
  app.delete("/project/:project_id/chart/:id", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }

        return chartController.remove(req.params.id);
      })
      .then((response) => {
        return res.status(200).send({ removed: response });
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to test a query before saving
  */
  app.post("/project/:project_id/chart/test", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }
        return chartController.testQuery(req.body, req.params.project_id);
      })
      .then((data) => {
        return res.status(200).send(data);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error.message.indexOf("413") > -1) {
          return res.status(413).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to test a query before saving
  */
  app.post("/project/:project_id/chart/preview", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }

        let chart = req.body;
        if (chart.chart) chart = chart.chart; // eslint-disable-line
        return chartController.previewChart(
          chart,
          req.params.project_id,
          req.user,
          req.query.no_source
        );
      })
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error.message && error.message.indexOf("413") > -1) {
          return res.status(413).send(error);
        }

        return res.status(400).send({ error });
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to run the query for a chart
  */
  app.get("/project/:project_id/chart/:id", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }

        return chartController.updateChartData(req.params.id);
      })
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error.message.indexOf("413") > -1) {
          return res.status(413).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------


  /*
  ** Route to get a chart for embedding (must be public for success)
  */
  app.get("/chart/:id/embedded", (req, res) => {
    return chartController.findById(req.params.id)
      .then((chart) => {
        if (!chart.public) throw new Error("401");

        return res.status(200).send({
          name: chart.name,
          type: chart.type,
          subType: chart.subType,
          chartDataUpdated: chart.chartDataUpdated,
          chartData: chart.chartData
        });
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error.message.indexOf("413") > -1) {
          return res.status(413).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
