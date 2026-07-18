const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const ChartController = require("../controllers/ChartController");
const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const SharePolicyController = require("../controllers/SharePolicyController");
const verifyToken = require("../modules/verifyToken");
const getUserFromToken = require("../modules/getUserFromToken");
const accessControl = require("../modules/accessControl");
const spreadsheetExport = require("../modules/spreadsheetExport");
const alertController = require("../controllers/AlertController");
const getEmbeddedChartData = require("../modules/getEmbeddedChartData");
const db = require("../models/models");
const { startRun } = require("../modules/updateAudit");
const {
  isOutboundPolicyError,
  serializeOutboundPolicyError,
} = require("../modules/outboundTargetPolicy");
const { verifyProjectPassword } = require("../modules/projectPassword");
const { validateShareTokenPolicy, verifyShareToken } = require("../modules/shareToken");
const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

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

  const sendPolicyError = (res, error) => {
    if (!isOutboundPolicyError(error)) return false;
    return res.status(400).send(serializeOutboundPolicyError(error));
  };

  const getPublicPasswordInput = (req) => {
    return req.body?.password || req.query?.password || req.query?.pass || req.headers.pass;
  };

  const verifyProjectSharePolicyAccess = async (req, project, sharePolicy) => {
    if (!sharePolicy) {
      return true;
    }

    if (sharePolicy.visibility === "disabled") {
      return false;
    }

    if (sharePolicy.visibility === "public") {
      return true;
    }

    const shareToken = req.query?.token || req.body?.token;
    if (!shareToken) {
      return false;
    }

    try {
      const decodedToken = verifyShareToken(shareToken);
      validateShareTokenPolicy(decodedToken, sharePolicy, "Project", project.id);
      return true;
    } catch (_error) {
      return false;
    }
  };

  const hasProjectReadAccess = async (project, user) => {
    if (!project || !user?.id) {
      return false;
    }

    const teamRole = await teamController.getTeamRole(project.team_id, user.id);
    if (!teamRole?.role) {
      return false;
    }

    const permission = accessControl.can(teamRole.role).readOwn("chart");
    if (!permission.granted) {
      return false;
    }

    user.teamRole = teamRole;

    if (["teamOwner", "teamAdmin"].includes(teamRole.role)) {
      return true;
    }

    if (teamRole?.projects?.length > 0) {
      const hasProjectAccess = teamRole.projects.some((projectId) => `${projectId}` === `${project.id}`);
      if (hasProjectAccess || project.ghost) {
        user.projects = teamRole.projects;
        return true;
      }
    }

    return false;
  };

  const checkPublicAccess = async (req, requiredAccess) => {
    const chart = await chartController.findById(req.params.chart_id);
    if (!chart) {
      return Promise.reject(404);
    }

    const projectId = req.params.project_id || chart.project_id;
    const project = await projectController.findById(projectId);
    if (!project || `${chart.project_id}` !== `${project.id}`) {
      return Promise.reject(401);
    }

    if (!chart.onReport) {
      return Promise.reject(401);
    }

    const hasAuthenticatedProjectAccess = await hasProjectReadAccess(project, req.user);

    if (!project.public && !hasAuthenticatedProjectAccess) {
      return Promise.reject(401);
    }

    const passwordInput = getPublicPasswordInput(req);
    const isPasswordCorrect = await verifyProjectPassword(passwordInput, project.password);
    if (project.passwordProtected && !isPasswordCorrect && !hasAuthenticatedProjectAccess) {
      return Promise.reject(401);
    }

    const sharePolicy = await db.SharePolicy.findOne({
      where: {
        entity_type: "Project",
        entity_id: project.id,
      },
    });

    const hasSharePolicyAccess = await verifyProjectSharePolicyAccess(req, project, sharePolicy);
    if (!hasSharePolicyAccess && !hasAuthenticatedProjectAccess) {
      return Promise.reject(401);
    }

    if (requiredAccess === "export") {
      const team = await teamController.findById(project.team_id);
      if (!team?.allowReportExport) {
        return Promise.reject(401);
      }
    }

    return { chart, project, hasAuthenticatedProjectAccess };
  };

  const resolveRuntimeVariables = async (req, project, providedVariables = {}) => {
    const queryParams = req.body?.queryParams || {};
    const urlVariables = projectController._extractVariablesFromQuery(queryParams);
    let policyVariables = {};

    const sharePolicy = await db.SharePolicy.findOne({
      where: {
        entity_type: "Project",
        entity_id: project.id,
      },
    });

    if (sharePolicy) {
      policyVariables = projectController._mergeVariablesWithPolicy(urlVariables, sharePolicy);
    } else if (project.public) {
      policyVariables = urlVariables;
    }

    return {
      ...policyVariables,
      ...(providedVariables || {}),
    };
  };

  const checkPermissions = (actionType = "readOwn", entity = "chart") => {
    return async (req, res, next) => {
      const projectId = req.params.project_id || req.body?.project_id;
      const chartId = req.params.chart_id || req.body?.chart_id;

      const project = await projectController.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const teamRole = await teamController.getTeamRole(project.team_id, req.user.id);

      req.user.teamRole = teamRole;

      if (!teamRole?.role) {
        return res.status(403).json({ message: "Access denied" });
      }

      // check if the chart is part of the right project
      if (chartId && projectId) {
        const chart = await chartController.findById(req.params.chart_id);
        if (chart.project_id.toString() !== projectId.toString()) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // check if the alert is part of a chart in the right project
      if (chartId && req.params.alert_id) {
        const alert = await alertController.findById(req.params.alert_id);
        if (alert.chart_id.toString() !== chartId.toString()) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // check if the cdc is part of a chart in the right project
      if (chartId && req.params.cdc_id) {
        const cdc = await db.ChartDatasetConfig.findByPk(req.params.cdc_id);
        if (cdc.chart_id.toString() !== chartId.toString()) {
          return res.status(403).json({ message: "Access denied" });
        }
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

  const isPublicProjectFilterAllowed = async (project, chart, passwordInput) => {
    if (!project?.public) {
      return false;
    }

    const isPasswordCorrect = await verifyProjectPassword(passwordInput, project.password);
    if (project?.passwordProtected && !isPasswordCorrect) {
      return false;
    }

    if (!chart?.onReport) {
      return false;
    }

    const sharePolicy = await db.SharePolicy.findOne({
      where: {
        entity_type: "Project",
        entity_id: project.id,
      },
    });

    if (!sharePolicy) {
      return true;
    }

    if (sharePolicy.visibility === "disabled") {
      return false;
    }

    return sharePolicy.visibility === "public";
  };

  const checkFilterAccess = async (req, res, next) => {
    try {
      const project = await projectController.findById(req.params.project_id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const chart = await chartController.findById(req.params.chart_id);
      if (!chart) {
        return res.status(404).json({ message: "Chart not found" });
      }

      if (`${chart.project_id}` !== `${project.id}`) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (req.user?.id) {
        const teamRole = await teamController.getTeamRole(project.team_id, req.user.id);
        if (teamRole?.role) {
          req.user.teamRole = teamRole;

          const permission = accessControl.can(teamRole.role).readOwn("chart");
          if (permission.granted) {
            if (["teamOwner", "teamAdmin"].includes(teamRole.role)) {
              return next();
            }

            if (teamRole?.projects?.length > 0) {
              const hasProjectAccess = teamRole.projects.some((projectId) => `${projectId}` === `${project.id}`);
              if (hasProjectAccess || project.ghost) {
                req.user.projects = teamRole.projects;
                return next();
              }
            }
          }
        }
      }

      const snapshotAccessToken = req.query.accessToken || req.body?.accessToken;
      if (snapshotAccessToken) {
        try {
          const decodedAccessToken = jwt.verify(snapshotAccessToken, settings.encryptionKey);
          if (`${decodedAccessToken?.project_id}` === `${project.id}`) {
            return next();
          }
        } catch (error) {
          // Continue to other auth mechanisms.
        }
      }

      const shareToken = req.query.token || req.body?.token;
      if (!shareToken) {
        const passwordInput = getPublicPasswordInput(req);
        const allowPublicAccess = await isPublicProjectFilterAllowed(project, chart, passwordInput);
        if (allowPublicAccess) {
          return next();
        }
        return res.status(401).json({ message: "Not authorized" });
      }

      let decodedToken;
      try {
        decodedToken = verifyShareToken(shareToken);
      } catch (error) {
        return res.status(401).json({ message: "Not authorized" });
      }

      if (!decodedToken?.sub?.sharePolicyId || !decodedToken?.sub?.type || !decodedToken?.sub?.id) {
        return res.status(401).json({ message: "Not authorized" });
      }

      const sharePolicy = await db.SharePolicy.findByPk(decodedToken.sub.sharePolicyId);
      if (!sharePolicy) {
        return res.status(401).json({ message: "Not authorized" });
      }

      if (sharePolicy.visibility === "disabled") {
        return res.status(403).json({ message: "Share policy is disabled" });
      }

      if (decodedToken.sub.type === "Chart") {
        try {
          validateShareTokenPolicy(decodedToken, sharePolicy, "Chart", chart.id);
        } catch (error) {
          return res.status(401).json({ message: "Not authorized" });
        }

        return next();
      }

      if (decodedToken.sub.type === "Project") {
        try {
          validateShareTokenPolicy(decodedToken, sharePolicy, "Project", project.id);
        } catch (error) {
          return res.status(401).json({ message: "Not authorized" });
        }

        if (project.passwordProtected) {
          const passwordInput = getPublicPasswordInput(req);
          const isPasswordCorrect = await verifyProjectPassword(passwordInput, project.password);
          if (!isPasswordCorrect) {
            return res.status(403).json({ message: "Enter the correct password" });
          }
        }

        if (!project.public || !chart.onReport) {
          return res.status(401).json({ message: "Not authorized" });
        }

        return next();
      }

      return res.status(401).json({ message: "Not authorized" });
    } catch (error) {
      return res.status(400).send(error);
    }
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
  app.get("/project/:project_id/chart/:chart_id", verifyToken, checkPermissions("readAny"), (req, res) => {
    return chartController.findById(req.params.chart_id)
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
  ** Route to quickly create a chart with all its chart dataset configs in one go
  */
  app.post("/project/:project_id/chart/quick-create", verifyToken, checkPermissions("createOwn"), (req, res) => {
    // Ensure project_id matches the route parameter
    req.body.project_id = req.params.project_id;
    return chartController.createWithChartDatasetConfigs(req.body, req.user)
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
  app.put("/project/:project_id/chart/:chart_id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.update(req.params.chart_id, req.body, req.user, req.query.justUpdates)
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
  app.put("/project/:project_id/chart/:chart_id/order", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.changeDashboardOrder(req.params.chart_id, req.body.otherId)
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
  app.delete("/project/:project_id/chart/:chart_id", verifyToken, checkPermissions("deleteOwn"), (req, res) => {
    return chartController.remove(req.params.chart_id)
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
      req.body.variables,
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
  app.post("/project/:project_id/chart/:chart_id/query", verifyToken, checkPermissions("readOwn"), async (req, res) => {
    try {
      const project = await projectController.findById(req.params.project_id);
      const traceContext = await startRun({
        triggerType: "chart_manual",
        entityType: "chart",
        status: "running",
        teamId: project.team_id,
        projectId: Number(req.params.project_id),
        chartId: Number(req.params.chart_id),
        summary: {
          noSource: req.query.no_source === "true",
          getCache: Boolean(req.query.getCache),
        },
      });

      const chart = await chartController.updateChartData(
        req.params.chart_id,
        req.user,
        {
          noSource: req.query.no_source === "true",
          skipParsing: req.query.skip_parsing === "true",
          getCache: req.query.getCache,
          filters: req.body.filters,
          variables: req.body.variables,
          traceContext,
        },
      );

      return res.status(200).send(chart);
    } catch (error) {
      console.error((error && error.message) || error); // eslint-disable-line
      const policyResponse = sendPolicyError(res, error);
      if (policyResponse) return policyResponse;
      if (`${error}` === "401" || error.message === "401") {
        return res.status(401).send({ error: "Not authorized" });
      }
      if (`${error}` === "413" && error.message === "413") {
        return res.status(413).send(`${error}`);
      }
      return res.status(400).send(`${(error && error.message) || error}`);
    }
  });
  // --------------------------------------------------------

  /*
  ** Route to filter the charts from the dashboard
  */
  app.post("/project/:project_id/chart/:chart_id/filter", apiLimiter(50), getUserFromToken, checkFilterAccess, async (req, res) => {
    if (!req.body?.filters) return res.status(400).send("No filters selected");
    let noSource = req.query.no_source === "true";
    let skipParsing = req.query.skip_parsing === "true";
    let getCache = true;

    if (req.query.refresh === "true") {
      noSource = false;
      skipParsing = false;
      getCache = false;
    }

    try {
      const project = await projectController.findById(req.params.project_id);
      const variables = await resolveRuntimeVariables(req, project, req.body?.variables);
      const team = await teamController.findById(project.team_id);
      const hasAuthenticatedProjectAccess = Boolean(req.user?.teamRole?.role);
      const hasInternalAccessToken = Boolean(req.query.accessToken || req.body?.accessToken);

      if (req.query.refresh === "true" && !hasAuthenticatedProjectAccess && !hasInternalAccessToken && !team.allowReportRefresh) {
        return res.status(401).send({ error: "Not authorized" });
      }

      // filters are being passed, so the chart is not updated in the database
      const chart = await chartController.updateChartData(
        req.params.chart_id,
        req.user,
        {
          noSource,
          skipParsing,
          filters: req.body?.filters,
          getCache,
          cacheOnly: req.query.cacheOnly === "true",
          variables,
          runtimeOnly: true,
        },
      );

      if (typeof chart?.setDataValue === "function") {
        chart.setDataValue("showBranding", team.showBranding);
      } else if (chart) {
        chart.showBranding = team.showBranding;
      }
      return res.status(200).send(chart);
    } catch (error) {
      if (error === "401" || error.message === "401") {
        return res.status(401).send({ error: "Not authorized" });
      }
      if (error === "413" && error.message === "413") {
        return res.status(413).send(error);
      }
      if (error?.code === "RUNTIME_CHART_CACHE_MISS") {
        return res.status(200).send({
          id: Number(req.params.chart_id),
          cacheMiss: true,
        });
      }
      return res.status(400).send(error);
    }
  });
  // --------------------------------------------------------

  /*
  ** [DEPRECATED] Route to get a chart for embedding (must be public for success)
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
    return chartController.findByShareString(req.params.share_string, req.query)
      .then(async (chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (error?.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error?.message?.indexOf("413") > -1) {
          return res.status(413).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to share a chart with a share policy
  */
  app.get("/chart/share/:share_string", apiLimiter(50), (req, res) => {
    return chartController.findBySharePolicy(req.params.share_string, req.query)
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((error) => {
        if (
          error?.message === "401"
          || error?.message === "Invalid share token"
          || error?.message === "Share policy has expired"
          || error?.name === "JsonWebTokenError"
          || error?.name === "TokenExpiredError"
        ) {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error?.message === "Share policy is disabled") {
          return res.status(403).send({ error: "Not authorized" });
        }
        if (error?.message?.indexOf("413") > -1) {
          return res.status(413).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to generate a share token
  */
  app.post("/project/:project_id/chart/:chart_id/share/token", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.generateShareToken(req.params.chart_id, req.body)
      .then(({ token, url, sharePolicy }) => {
        return res.status(200).send({ token, url, sharePolicy });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to get latest chart data without an authentication token
  */
  app.get("/chart/:chart_id", apiLimiter(50), (req, res) => {
    return checkPublicAccess(req, "view")
      .then(async ({ chart, project }) => {
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
        if (err === 401 || err?.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (err === 404 || err?.message === "404") {
          return res.status(404).send({ error: "Chart not found" });
        }
        return res.status(400).send(err);
      });
  });

  /*
  ** Route to run the query for a chart on a project that enables this
  */
  app.post("/chart/:chart_id/query", apiLimiter(50), getUserFromToken, (req, res) => {
    return checkPublicAccess(req, "view")
      .then(async ({ project }) => {
        const team = await teamController.findById(project.team_id);

        if (!team.allowReportRefresh) {
          throw new Error(401);
        }

        const variables = await resolveRuntimeVariables(req, project, req.body?.variables);
        const traceContext = await startRun({
          triggerType: "chart_manual",
          entityType: "chart",
          status: "running",
          teamId: project.team_id,
          projectId: Number(project.id),
          chartId: Number(req.params.chart_id),
          summary: {
            publicReportRefresh: true,
            noSource: req.query.no_source === "true",
            getCache: Boolean(req.query.getCache),
          },
        });

        return chartController.updateChartData(
          req.params.chart_id,
          null,
          {
            noSource: req.query.no_source === "true",
            skipParsing: req.query.skip_parsing === "true",
            getCache: req.query.getCache,
            filters: req.body?.filters,
            variables,
            traceContext,
          },
        );
      })
      .then((chart) => {
        return res.status(200).send(chart);
      })
      .catch((err) => {
        if (err === 401 || err?.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (err === 404 || err?.message === "404") {
          return res.status(404).send({ error: "Chart not found" });
        }
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

    if (!Array.isArray(req.body?.chartIds) || req.body.chartIds.length === 0) {
      return res.status(400).send({
        message: "chartIds is required",
        error: "chartIds is required",
      });
    }

    return chartController.exportChartData(
      req.user.id,
      req.body.chartIds,
      req.body.filters,
      req.params.project_id
    )
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
        return chartController.exportChartData(
          null,
          [req.params.chart_id],
          req.body.filters,
          req.params.project_id
        );
      })
      .then((data) => {
        return spreadsheetExport(data);
      })
      .then((fileBuffer) => {
        return res.status(200).send(fileBuffer);
      })
      .catch((err) => {
        if (err === 401 || err?.message === "401") {
          return res.status(401).send({
            message: "Not authorized",
            error: "Not authorized",
          });
        }
        if (err === 404 || err?.message === "404") {
          return res.status(404).send({
            message: "Chart not found",
            error: "Chart not found",
          });
        }
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
  app.post("/project/:project_id/chart/:chart_id/share", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return chartController.createShare(req.params.chart_id)
      .then(() => {
        return chartController.findById(req.params.chart_id);
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
  app.delete("/project/:project_id/chart/:chart_id/share/:share_id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
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
  ** Route to create a new share policy
  */
  app.post("/project/:project_id/chart/:chart_id/share/policy", verifyToken, checkPermissions("updateOwn"), async (req, res) => {
    try {
      const policy = await chartController.createSharePolicy(req.params.chart_id);
      return res.status(200).send(policy);
    } catch (error) {
      return res.status(400).send(error);
    }
  });
  // --------------------------------------------------------

  /*
  ** Route to get all share policies for a chart
  */
  app.get("/project/:project_id/chart/:chart_id/share/policy", verifyToken, checkPermissions("readAny"), async (req, res) => {
    try {
      const policies = await SharePolicyController.findByEntityId("Chart", req.params.chart_id);
      return res.status(200).send(policies);
    } catch (error) {
      return res.status(400).send(error);
    }
  });
  // --------------------------------------------------------

  /*
  ** Route to update a share policy
  */
  app.put("/project/:project_id/chart/:chart_id/share/policy/:policy_id", verifyToken, checkPermissions("updateOwn"), async (req, res) => {
    try {
      const updatedPolicy = await SharePolicyController.updateSharePolicy(
        req.params.policy_id,
        req.body,
        "Chart",
        req.params.chart_id
      );
      return res.status(200).send(updatedPolicy);
    } catch (error) {
      if (error?.message === "404") {
        return res.status(404).send({ error: "Share policy not found" });
      }
      return res.status(400).send(error);
    }
  });
  // --------------------------------------------------------

  /*
  ** Route to delete a share policy
  */
  app.delete("/project/:project_id/chart/:chart_id/share/policy/:policy_id", verifyToken, checkPermissions("updateOwn"), async (req, res) => {
    try {
      await SharePolicyController.deleteSharePolicy(req.params.policy_id, "Chart", req.params.chart_id);
      return res.status(200).send({ deleted: true });
    } catch (error) {
      if (error?.message === "404") {
        return res.status(404).send({ error: "Share policy not found" });
      }
      return res.status(400).send(error);
    }
  });
  // --------------------------------------------------------

  /*
  ** Route to get chart alerts
  */
  app.get("/project/:project_id/chart/:chart_id/alert", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return alertController.getByChartId(req.params.chart_id)
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
  app.post("/project/:project_id/chart/:chart_id/alert", verifyToken, checkPermissions("updateOwn"), (req, res) => {
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
  app.put("/project/:project_id/chart/:chart_id/alert/:alert_id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
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
  app.delete("/project/:project_id/chart/:chart_id/alert/:alert_id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
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
  app.post("/project/:project_id/chart/:chart_id/chart-dataset-config",
    verifyToken,
    checkPermissions("updateOwn"),
    async (req, res) => {
      try {
        const cdc = await chartController.createChartDatasetConfig(req.params.chart_id, req.body);

        return res.status(200).send(cdc);
      } catch (error) {
        return res.status(400).send({ error: (error && error.message) || error });
      }
    });
  // --------------------------------------------------------

  /*
  ** Route to update ChartDatasetConfigs
  */
  app.put("/project/:project_id/chart/:chart_id/chart-dataset-config/:cdc_id",
    verifyToken,
    checkPermissions("updateOwn"),
    async (req, res) => {
      try {
        const cdc = await chartController.updateChartDatasetConfig(req.params.cdc_id, req.body);

        return res.status(200).send(cdc);
      } catch (error) {
        return res.status(400).send({ error: (error && error.message) || error });
      }
    });
  // --------------------------------------------------------

  /*
  ** Route to delete ChartDatasetConfigs
  */
  app.delete("/project/:project_id/chart/:chart_id/chart-dataset-config/:cdc_id",
    verifyToken,
    checkPermissions("updateOwn"),
    async (req, res) => {
      try {
        await chartController.deleteChartDatasetConfig(req.params.cdc_id);

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
