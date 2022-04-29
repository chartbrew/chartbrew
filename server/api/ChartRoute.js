const ChartController = require("../controllers/ChartController");
const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const spreadsheetExport = require("../modules/spreadsheetExport");

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
        if (data && `${data.project_id}` !== `${gProject.id}`) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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
    let gRole;
    return checkAccess(req)
      .then((teamRole) => {
        gRole = teamRole.role;
        const permission = accessControl.can(teamRole.role).readAny("chart");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return chartController.findByProject(req.params.project_id);
      })
      .then((charts) => {
        let filteredCharts = charts;
        if (gRole === "member") {
          filteredCharts = charts.filter((c) => !c.draft);
        }
        return res.status(200).send(filteredCharts);
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
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        // assign the project id to the new chart
        req.body.project_id = req.params.project_id;
        return chartController.create(req.body, req.user);
      })
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error.message && error.message.indexOf("406") > -1) {
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
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return chartController.update(req.params.id, req.body, req.user, req.query.justUpdates);
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
          return new Promise((resolve, reject) => reject(new Error(401)));
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
          return new Promise((resolve, reject) => reject(new Error(401)));
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
          return new Promise((resolve, reject) => reject(new Error(401)));
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
          return new Promise((resolve, reject) => reject(new Error(401)));
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
          return new Promise((resolve, reject) => reject(new Error(401)));
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
        const permission = accessControl.can(teamRole.role).readAny("chart");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return chartController.updateChartData(
          req.params.id,
          req.user,
          {
            noSource: req.query.no_source === "true",
            skipParsing: req.query.skip_parsing === "true",
            getCache: req.query.getCache,
          },
        );
      })
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        console.error((error && error.message) || error); // eslint-disable-line
        if (`${error}` === "401" || error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (`${error}` === "413" && error.message === "413") {
          return res.status(413).send(error);
        }
        return res.status(400).send((error && error.message) || error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to filter the charts from the dashboard
  */
  app.post("/project/:project_id/chart/:id/filter", (req, res) => {
    if (!req.body.filters) return res.status(400).send("No filters selected");

    // filters are being passed, so the chart is not updated in the database
    return chartController.updateChartData(
      req.params.id,
      req.user,
      {
        noSource: req.query.no_source === "true",
        skipParsing: req.query.skip_parsing === "true",
        filters: req.body.filters,
        getCache: true,
      },
    )
      .then(async (chart) => {
        // get the team's branding status
        const project = await projectController.findById(chart.project_id);
        const team = await teamController.findById(project.team_id);

        chart.setDataValue("showBranding", team.showBranding);
        chart.setDataValue("Chartshares", null);
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
  app.get("/chart/:share_string/embedded", (req, res) => {
    // backwards-compatible code for public charts with ID-enabled embed
    /* Deprecated */
    if (req.params.share_string.length < 16) {
      return chartController.findById(req.params.share_string)
        .then(async (chart) => {
          if (!chart.public) {
            return new Promise((resolve, reject) => reject(new Error("401")));
          }

          // get the team's branding status
          const project = await projectController.findById(chart.project_id);
          const team = await teamController.findById(project.team_id);

          return res.status(200).send({
            id: chart.id,
            name: chart.name,
            type: chart.type,
            subType: chart.subType,
            chartDataUpdated: chart.chartDataUpdated,
            chartData: chart.chartData,
            Datasets: chart.Datasets,
            mode: chart.mode,
            chartSize: chart.chartSize,
            project_id: chart.project_id,
            showBranding: team.showBranding,
            showGrowth: chart.showGrowth,
            timeInterval: chart.timeInterval,
          });
        })
        .catch((error) => {
          if (error.message === "401") {
            return res.status(401).send({ error: "Not authorized" });
          }
          if (error.message && error.message.indexOf("413") > -1) {
            return res.status(413).send(error);
          }
          return res.status(400).send(error);
        });
    }

    // New! taking advantage of the share strings
    return chartController.findByShareString(req.params.share_string)
      .then(async (chart) => {
        if (!chart.public && !chart.shareable) {
          return new Promise((resolve, reject) => reject(new Error("401")));
        }

        // get the team's branding status
        const project = await projectController.findById(chart.project_id);
        const team = await teamController.findById(project.team_id);

        return res.status(200).send({
          id: chart.id,
          name: chart.name,
          type: chart.type,
          subType: chart.subType,
          chartDataUpdated: chart.chartDataUpdated,
          chartData: chart.chartData,
          Datasets: chart.Datasets,
          mode: chart.mode,
          chartSize: chart.chartSize,
          project_id: chart.project_id,
          showBranding: team.showBranding,
          showGrowth: chart.showGrowth,
          timeInterval: chart.timeInterval,
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

  /*
  ** Route used to export data in spreadsheet format
  */
  app.post("/project/:project_id/chart/export", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("chart");
        if (!permission.granted || (!teamRole.canExport && teamRole.role !== "owner")) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return chartController.exportChartData(req.user.id, req.body.chartIds, req.body.filters);
      })
      .then((data) => {
        return spreadsheetExport(data);
      })
      .then((fileBuffer) => {
        return res.status(200).send(fileBuffer);
      })
      .catch((err) => {
        return res.status(400).send({
          message: (err && err.message) || err,
          error: (err && err.toString()) || err,
        });
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to create a new share link
  */
  app.post("/project/:project_id/chart/:id/share", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return chartController.createShare(req.params.id);
      })
      .then(() => {
        return chartController.findById(req.params.id);
      })
      .then((chart) => {
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
  ** Route to delete a share link
  */
  app.delete("/project/:project_id/chart/:id/share/:share_id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("chart");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return chartController.removeShare(req.params.share_id);
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

  return (req, res, next) => {
    next();
  };
};
