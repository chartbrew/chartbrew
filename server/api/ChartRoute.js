const ChartController = require("../controllers/ChartController");
const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const chartController = new ChartController();
  const projectController = new ProjectController();
  const teamController = new TeamController();

  const checkAccess = (req) => {
    let gProject;
    return projectController.findById(req.params.project_id)
      .then((project) => {
        gProject = project;
        if (req.params.id) {
          return chartController.findById(req.params.id);
        }

        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((data) => {
        if (!req.params.id) {
          return Promise.resolve(data);
        }

        // check if the project_id matches in the database records
        if (parseInt(data.project_id, 10) !== parseInt(gProject.id, 10)) {
          throw new Error(401);
        }

        return teamController.getTeamRole(gProject.team_id, req.user.id);
      })
      .then((teamRole) => {
        // the owner has access to all the projects
        if (teamRole.role === "owner") return teamRole;

        // otherwise, check if the team role contains access to the right project
        if (!teamRole.projects) return Promise.reject(401);
        const filteredProjects = teamRole.projects.filter((o) => `${o}` === `${req.params.project_id}`);
        if (filteredProjects.length === 0) {
          return Promise.reject(401);
        }

        return teamRole;
      });
  };

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
    return checkAccess(req)
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
    return checkAccess(req)
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
    return checkAccess(req)
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
  ** Route to add a new connection to the chart
  */
  app.post("/project/:project_id/chart/:id/connection", verifyToken, (req, res) => {
    if (!req.body.connection_id) return res.status(400).send({ error: "no connection_id" });

    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }
        return chartController.addConnection(req.params.id, req.body);
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
    return checkAccess(req)
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
    return checkAccess(req)
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
    return checkAccess(req)
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
    return checkAccess(req)
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
          req.query.no_source,
          req.query.skip_parsing,
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
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }

        return chartController.updateChartData(
          req.params.id,
          req.user,
          req.query.no_source === "true",
          req.query.skip_parsing === "true",
        );
      })
      .then((chart) => {
        // console.log("chart", chart);
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error === "401" || error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error === "413" && error.message === "413") {
          return res.status(413).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to filter the charts from the dashboard
  */
  app.post("/project/:project_id/chart/:id/filter", verifyToken, (req, res) => {
    if (!req.body.filters) return res.status(400).send("No filters selected");

    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("chart");
        if (!permission.granted) {
          throw new Error(401);
        }

        // filters are being passed, so the chart is not updated in the database
        return chartController.updateChartData(
          req.params.id,
          req.user,
          req.query.no_source === "true",
          req.query.skip_parsing === "true",
          req.body.filters,
        );
      })
      .then((chart) => {
        // console.log("chart", chart);
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error === "401" || error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error === "413" && error.message === "413") {
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
          chartData: chart.chartData,
          Datasets: chart.Datasets,
          mode: chart.mode,
          chartSize: chart.chartSize,
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
