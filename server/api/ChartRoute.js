const rateLimit = require("express-rate-limit");

const ChartController = require("../controllers/ChartController");
const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const spreadsheetExport = require("../modules/spreadsheetExport");
const alertController = require("../controllers/AlertController");
const getEmbeddedChartData = require("../modules/getEmbeddedChartData");

const apiLimiter = (max = 10) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max,
  });
};

module.exports = (app) => {
  const chartController = new ChartController();
  const projectController = new ProjectController();
  const teamController = new TeamController();

  const checkPublicAccess = (req, requiredAccess) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        if (project.passwordProtected) {
          const passwordInput = req.body?.password || req.query?.password;
          if (passwordInput !== project.password) {
            return Promise.reject(401);
          }
        }

        return teamController.findById(project.team_id);
      })
      .then((team) => {
        if (requiredAccess === "export" && team.allowReportExport) {
          return team;
        }

        return Promise.reject(401);
      });
  };

  const checkPermissions = (actionType = "readOwn", entity = "chart") => {
    return async (req, res, next) => {
      const projectId = req.params.project_id || req.body.project_id;

      const project = await projectController.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const teamRole = await teamController.getTeamRole(project.team_id, req.user.id);

      req.user.teamRole = teamRole;

      if (!teamRole?.role) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (["teamOwner", "teamAdmin"].includes(teamRole.role)) {
        const permission = accessControl.can(teamRole.role)[actionType](entity);
        if (!permission.granted) {
          return res.status(403).json({ message: "Access denied" });
        }

        return next();
      }

      if (teamRole?.projects?.length > 0) {
        if (projectId) {
          const filteredProjects = teamRole.projects.filter((o) => `${o}` === `${projectId}`);
          if (filteredProjects.length === 0 && !project.ghost) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const permission = accessControl.can(teamRole.role)[actionType](entity);
        if (!permission.granted) {
          return res.status(403).json({ message: "Access denied" });
        }

        req.user.projects = teamRole.projects;

        return next();
      }

      return res.status(403).json({ message: "Access denied" });
    };
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
  app.get("/project/:project_id/chart", verifyToken, checkPermissions("readAny"), (req, res) => {
    return chartController.findByProject(req.params.project_id)
      .then((charts) => {
        let filteredCharts = charts;
        if (req.user?.teamRole?.role === "projectViewer") {
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
  ** Route to get a chart by id
  */
  app.get("/project/:project_id/chart/:id", verifyToken, checkPermissions("readAny"), (req, res) => {
    return chartController.findById(req.params.id)
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
  ** Route to create a new chart
  */
  app.post("/project/:project_id/chart", verifyToken, checkPermissions("createOwn"), (req, res) => {
    // assign the project id to the new chart
    req.body.project_id = req.params.project_id;
    return chartController.create(req.body, req.user)
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
  app.put("/project/:project_id/chart/:id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.update(req.params.id, req.body, req.user, req.query.justUpdates)
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
  app.put("/project/:project_id/chart/:id/order", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.changeDashboardOrder(req.params.id, req.body.otherId)
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
  app.delete("/project/:project_id/chart/:id", verifyToken, checkPermissions("deleteOwn"), (req, res) => {
    return chartController.remove(req.params.id)
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
  app.post("/project/:project_id/chart/test", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.testQuery(req.body, req.params.project_id)
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
  app.post("/project/:project_id/chart/preview", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    let chart = req.body;
    if (chart.chart) chart = chart.chart; // eslint-disable-line
    return chartController.previewChart(
      chart,
      req.params.project_id,
      req.user,
      req.query.no_source,
      req.query.skip_parsing,
    )
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
  app.post("/project/:project_id/chart/:id/query", verifyToken, checkPermissions("readOwn"), (req, res) => {
    return chartController.updateChartData(
      req.params.id,
      req.user,
      {
        noSource: req.query.no_source === "true",
        skipParsing: req.query.skip_parsing === "true",
        getCache: req.query.getCache,
        filters: req.body.filters,
      },
    )
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        console.error((error && error.message) || error); // eslint-disable-line
        if (`${error}` === "401" || error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (`${error}` === "413" && error.message === "413") {
          return res.status(413).send(`${error}`);
        }
        return res.status(400).send(`${(error && error.message) || error}`);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to filter the charts from the dashboard
  */
  app.post("/project/:project_id/chart/:id/filter", apiLimiter(50), (req, res) => {
    if (!req.body.filters) return res.status(400).send("No filters selected");
    let noSource = req.query.no_source === "true";
    let skipParsing = req.query.skip_parsing === "true";
    let getCache = true;

    // if it's a date range filter, we need to query the source and disable the cache
    if (req.body.filters.length === 1 && req.body.filters.find((f) => f.type === "date")) {
      noSource = false;
      skipParsing = false;
      getCache = false;
    }

    // filters are being passed, so the chart is not updated in the database
    return chartController.updateChartData(
      req.params.id,
      req.user,
      {
        noSource,
        skipParsing,
        filters: req.body.filters,
        getCache,
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
  app.get("/chart/:share_string/embedded", apiLimiter(50), (req, res) => {
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

          return res.status(200).send(getEmbeddedChartData(chart, team));
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
    return chartController.findByShareString(req.params.share_string, req.query.snapshot)
      .then(async (chart) => {
        if (!chart.public && !chart.shareable) {
          return new Promise((resolve, reject) => reject(new Error("401")));
        }

        // get the team's branding status
        const project = await projectController.findById(chart.project_id);
        const team = await teamController.findById(project.team_id);

        return res.status(200).send(getEmbeddedChartData(chart, team));
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
  ** Route to get latest chart data without an authentication token
  */
  app.get("/chart/:id", apiLimiter(50), (req, res) => {
    // check if the chart is on a public report first
    return chartController.findById(req.params.id)
      .then(async (chart) => {
        const project = await projectController.findById(chart.project_id);

        if (!project.public) throw new Error(401);
        if (project.public
          && project.passwordProtected
          && req.query.password !== project.password
        ) {
          throw new Error(401);
        }

        const team = await teamController.findById(project.team_id);

        return res.status(200).send({
          id: chart.id,
          name: chart.name,
          type: chart.type,
          subType: chart.subType,
          chartDataUpdated: chart.chartDataUpdated,
          chartData: chart.chartData,
          ChartDatasetConfigs: chart.ChartDatasetConfigs,
          mode: chart.mode,
          chartSize: chart.chartSize,
          project_id: chart.project_id,
          showBranding: team.showBranding,
          showGrowth: chart.showGrowth,
          timeInterval: chart.timeInterval,
          isLogarithmic: chart.isLogarithmic,
        });
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });

  /*
  ** Route to run the query for a chart on a project that enables this
  */
  app.post("/chart/:id/query", apiLimiter(50), (req, res) => {
    return chartController.findById(req.params.id)
      .then(async (chart) => {
        const project = await projectController.findById(chart.project_id);

        const team = await teamController.findById(project.team_id);

        if (!team.allowReportRefresh) {
          throw new Error(401);
        }

        return chartController.updateChartData(
          req.params.id,
          null,
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
      .catch((err) => {
        return res.status(400).send(err);
      });
  });

  /*
  ** Route used to export data in spreadsheet format
  */
  app.post("/project/:project_id/chart/export", verifyToken, checkPermissions("readAny"), (req, res) => {
    if (!req.user?.teamRole?.canExport && req.user?.teamRole?.role !== "teamOwner" && req.user.role !== "teamAdmin") {
      return new Promise((resolve, reject) => reject(new Error(401)));
    }

    return chartController.exportChartData(req.user.id, req.body.chartIds, req.body.filters)
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
  ** Route used to export data from a PUBLIC dashboard
  */
  app.post("/project/:project_id/chart/export/public/:chart_id", apiLimiter(20), (req, res) => {
    return checkPublicAccess(req, "export")
      .then(() => {
        return chartController.exportChartData(null, [req.params.chart_id], req.body.filters);
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
  app.post("/project/:project_id/chart/:id/share", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.createShare(req.params.id)
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
  app.delete("/project/:project_id/chart/:id/share/:share_id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.removeShare(req.params.share_id)
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
  ** Route to get chart alerts
  */
  app.get("/project/:project_id/chart/:id/alert", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return alertController.getByChartId(req.params.id)
      .then((alerts) => {
        return res.status(200).send(alerts);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to create a new chart alert
  */
  app.post("/project/:project_id/chart/:id/alert", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    // check to see if the recipients are in the same team
    return teamController.getTeamMembers(req.user?.teamRole?.team_id)
      .then((teamMembers) => {
        const { recipients } = req.body;
        const teamMemberEmails = teamMembers.map((member) => member.email);
        const invalidRecipients = recipients
          .filter((recipient) => !teamMemberEmails.includes(recipient));
        if (invalidRecipients.length > 0) {
          return new Promise((resolve, reject) => reject(new Error("Invalid recipients")));
        }

        return alertController.create(req.body);
      })
      .then((alert) => {
        return res.status(200).send(alert);
      })
      .catch((error) => {
        return res.status(400).send((error && error.message) || error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to update a chart alert
  */
  app.put("/project/:project_id/chart/:id/alert/:alert_id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    // check to see if the recipients are in the same team
    return teamController.getTeamMembers(req.user?.teamRole?.team_id)
      .then((teamMembers) => {
        const { recipients } = req.body;
        const teamMemberEmails = teamMembers.map((member) => member.email);
        const invalidRecipients = recipients
          .filter((recipient) => !teamMemberEmails.includes(recipient));
        if (invalidRecipients.length > 0) {
          return new Promise((resolve, reject) => reject(new Error("Invalid recipients")));
        }

        return alertController.update(req.params.alert_id, req.body);
      })
      .then((alert) => {
        return res.status(200).send(alert);
      })
      .catch((error) => {
        return res.status(400).send((error && error.message) || error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to delete a chart alert
  */
  app.delete("/project/:project_id/chart/:id/alert/:alert_id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return alertController.remove(req.params.alert_id)
      .then(() => {
        return res.status(200).send({ message: "Alert deleted" });
      })
      .catch((error) => {
        return res.status(400).send((error && error.message) || error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to create ChartDatasetConfig
  */
  app.post("/project/:project_id/chart/:id/chart-dataset-config",
    verifyToken,
    checkPermissions("updateOwn"),
    async (req, res) => {
      try {
        const cdc = await chartController.createChartDatasetConfig(req.params.id, req.body);

        return res.status(200).send(cdc);
      } catch (error) {
        return res.status(400).send({ error: (error && error.message) || error });
      }
    });
  // --------------------------------------------------------

  /*
  ** Route to update ChartDatasetConfigs
  */
  app.put("/project/:project_id/chart/:id/chart-dataset-config/:cdcId",
    verifyToken,
    checkPermissions("updateOwn"),
    async (req, res) => {
      try {
        const cdc = await chartController.updateChartDatasetConfig(req.params.cdcId, req.body);

        return res.status(200).send(cdc);
      } catch (error) {
        return res.status(400).send({ error: (error && error.message) || error });
      }
    });
  // --------------------------------------------------------

  /*
  ** Route to delete ChartDatasetConfigs
  */
  app.delete("/project/:project_id/chart/:id/chart-dataset-config/:cdcId",
    verifyToken,
    checkPermissions("updateOwn"),
    async (req, res) => {
      try {
        await chartController.deleteChartDatasetConfig(req.params.cdcId);

        return res.status(200).send({ removed: true });
      } catch (error) {
        return res.status(400).send({ error: (error && error.message) || error });
      }
    });
  // --------------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
