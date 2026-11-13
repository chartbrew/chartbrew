const { teamRoles, viewerRoles } = require("../../shared/roles.json");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const { nanoid } = require("nanoid");

const ChartController = require("../controllers/ChartController");
const { loadDashboardChartBatch } = require("../modules/dashboardChartBatch");
const { resolvePublicDashboardAccess } = require("../modules/publicDashboardAccess");

const { saveDashboardLayout } = require("../modules/dashboardLayout");
const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const SharePolicyController = require("../controllers/SharePolicyController");
const verifyToken = require("../modules/verifyToken");
const { saveReportAppearance } = require("../modules/reportAppearance");
const accessControl = require("../modules/accessControl");
const getUserFromToken = require("../modules/getUserFromToken");
const db = require("../models/models");
const {
  MAX_LOGO_UPLOAD_SIZE_BYTES,
  buildSafeLogoFilename,
  isAllowedLogoMimeType,
  isValidLogoImageBuffer,
  resolveSafeUploadPath,
} = require("../modules/logoUploadSecurity");

const getProjectPasswordInput = (req) => {
  return req.headers.pass || req.query.pass || req.query.password || req.body?.password;
};

const apiLimiter = (max = 10, windowMinutes = 1) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    skip: (req) => !getProjectPasswordInput(req),
  });
};

module.exports = (app) => {
  const projectController = new ProjectController();
  const teamController = new TeamController();

  const checkPermissions = (actionType = "readOwn") => {
    return async (req, res, next) => {
      const projectId = req.params.id;

      let teamRole;
      let project;
      let teamId;

      if (projectId) {
        project = await db.Project.findByPk(projectId, { attributes: ["id", "team_id"] });
        if (!project) return res.status(404).json({ message: "Project not found" });
        teamId = project.team_id;
      } else {
        teamId = req.params.team_id || req.body?.team_id;
      }

      if (teamId) {
        teamRole = await teamController.getTeamRole(teamId, req.user.id);
      }

      if (!teamRole?.role) {
        return res.status(403).json({ message: "Access denied" });
      }
      req.user.teamRole = teamRole;

      if (teamRoles.includes(teamRole.role)) {
        const permission = accessControl.can(teamRole.role)[actionType]("project");
        if (!permission.granted) {
          return res.status(403).json({ message: "Access denied" });
        }

        return next();
      }

      if (teamRole?.projects?.length > 0) {
        if (projectId) {
          const filteredProjects = teamRole.projects.filter((o) => `${o}` === `${projectId}`);
          if (filteredProjects.length === 0) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const permission = accessControl.can(teamRole.role)[actionType]("project");
        if (!permission.granted) {
          return res.status(403).json({ message: "Access denied" });
        }

        req.user.projects = teamRole.projects;

        return next();
      }

      return res.status(403).json({ message: "Access denied" });
    };
  };

  app.put("/project/:id/report-appearance", verifyToken, checkPermissions("updateOwn"), async (req, res) => {
    try {
      return res.json(await saveReportAppearance(req.params.id, req.body));
    } catch (error) {
      return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "The appearance could not be saved. Try again." });
    }
  });

  app.put("/project/:id/layout", verifyToken, checkPermissions("updateOwn"), async (req, res) => {
    try {
      await saveDashboardLayout(req.params.id, req.body);
      return res.json(await projectController.findById(req.params.id));
    } catch (error) {
      return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Could not save the layout. Try again." });
    }
  });

  /*
  ** [MASTER] Route to get all the projects
  */
  app.get("/project", verifyToken, (req, res) => {
    if (!req.user.admin) {
      return res.status(401).send({ error: "Not authorized" });
    }

    return projectController.findAll()
      .then((projects) => {
        return res.status(200).send(projects);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to create a project
  */
  app.post("/project", verifyToken, checkPermissions("createOwn"), (req, res) => {
    return projectController.create(req.user.id, req.body)
      .then((project) => {
        return res.status(200).send(project);
      })
      .catch((error) => {
        if (error.message && error.message.indexOf("401") > -1) {
          return res.status(401).send({ error: "Not authorized" });
        }
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to get a project by ID
  */
  app.get("/project/:id", verifyToken, checkPermissions("readOwn"), (req, res) => {
    return projectController.findById(req.params.id, {
      refreshPreparedData: true,
      hydratePreparedData: req.query.view !== "configuration",
      includeDrafts: !viewerRoles.includes(req.user.teamRole.role),
    })
      .then((project) => {
        return res.status(200).send(project);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        if (error.message === "404") {
          return res.status(404).send({ error: "Not Found" });
        }
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to update a project ID
  */
  app.put("/project/:id", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return projectController.update(req.params.id, req.body)
      .then((project) => {
        return res.status(200).send(project);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to update a project's Logo
  */
  app.post("/project/:id/logo", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    if (!req.busboy) {
      return res.status(400).send({ error: "Upload stream is missing" });
    }

    const parseUpload = () => {
      return new Promise((resolve, reject) => {
        let hasFile = false;
        let fileCount = 0;
        let settled = false;
        const uploadDirectory = path.resolve(__dirname, "../uploads");

        const fail = (status, message) => {
          if (settled) return;
          settled = true;
          reject({ status, message });
        };

        const succeed = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        req.pipe(req.busboy);

        req.busboy.on("file", (fieldName, file, info) => {
          fileCount += 1;
          if (fileCount > 1) {
            file.resume();
            fail(400, "Only one logo file can be uploaded");
            return;
          }

          hasFile = true;
          const mimeType = `${info?.mimeType || ""}`.toLowerCase();
          if (!isAllowedLogoMimeType(mimeType)) {
            file.resume();
            fail(415, "Unsupported file type. Only png, jpg, gif, webp, and svg are allowed");
            return;
          }

          const chunks = [];
          let totalSize = 0;

          file.on("data", (chunk) => {
            if (settled) return;

            totalSize += chunk.length;
            if (totalSize > MAX_LOGO_UPLOAD_SIZE_BYTES) {
              file.resume();
              fail(413, "Logo exceeds maximum size (5MB)");
              return;
            }

            chunks.push(chunk);
          });

          file.on("error", () => {
            fail(400, "Could not process uploaded file");
          });

          file.on("end", async () => {
            if (settled) return;

            const payload = Buffer.concat(chunks);
            if (payload.length === 0) {
              fail(400, "No file uploaded");
              return;
            }

            if (!isValidLogoImageBuffer(payload, mimeType)) {
              fail(415, "Invalid image content");
              return;
            }

            const fileName = buildSafeLogoFilename(mimeType, () => nanoid(18));
            const uploadPath = resolveSafeUploadPath(uploadDirectory, fileName);
            if (!fileName || !uploadPath) {
              fail(400, "Could not determine safe upload path");
              return;
            }

            try {
              await fs.promises.writeFile(uploadPath, payload, { flag: "wx" });
              succeed(`uploads/${fileName}`);
            } catch (error) {
              fail(400, "Could not save uploaded file");
            }
          });
        });

        req.busboy.on("error", () => {
          fail(400, "Could not parse upload request");
        });

        req.busboy.on("finish", () => {
          if (!settled && !hasFile) {
            fail(400, "No file uploaded");
          }
        });
      });
    };

    return parseUpload()
      .then((logoPath) => {
        return projectController.update(req.params.id, { logo: logoPath });
      })
      .then((project) => {
        return res.status(200).send(project);
      })
      .catch((error) => {
        if (error?.status) {
          return res.status(error.status).send({ error: error.message });
        }
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to remove a project
  */
  app.delete("/project/:id", verifyToken, checkPermissions("deleteAny"), (req, res) => {
    return projectController.remove(req.params.id, req.user.id)
      .then(() => {
        return res.status(200).send({ removed: true });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route return a list of projects within a team
  */
  app.get("/project/team/:team_id", verifyToken, checkPermissions("readOwn"), (req, res) => {
    return projectController.getTeamProjects(req.params.team_id)
      .then((projects) => {
        let filteredProjects = projects;
        if (req.user.projects) {
          filteredProjects = projects.filter((o) => {
            return req.user.projects.includes(o.id) || o.ghost;
          });
        }

        return res.status(200).send(filteredProjects);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  const sendPublicDashboard = (report = false, batch = false) => async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const access = await resolvePublicDashboardAccess({
        brewName: req.params.brewName,
        password: getProjectPasswordInput(req),
        queryParams: req.query,
        user: req.user,
        report,
      });
      const configurationOnly = batch || req.query.view === "configuration";
      const project = await projectController.getPublicDashboard(access.project.brewName, {
        hydratePreparedData: !configurationOnly,
        refreshPreparedData: true,
      });
      project.setDataValue("password", "");
      const urlVariables = projectController._extractVariablesFromQuery(req.query);
      const resolveVariables = (variables) => {
        const requested = { ...urlVariables, ...variables };
        return access.policy ? projectController._mergeVariablesWithPolicy(requested, access.policy) : requested;
      };
      if (batch) {
        const charts = await loadDashboardChartBatch(project.id, req.body?.charts, access.member ? req.user : null, new ChartController(), {
          publicProject: project,
          resolveVariables,
          viewerScope: `public-project:${project.id}:policy:${access.policy?.id || "none"}`,
        });
        return res.json(charts);
      }
      if (configurationOnly) return res.json(project);
      return res.json(await projectController.applyVariablesToCharts(project, resolveVariables({})));
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.status ? error.message : "Could not load this dashboard." });
    }
  };

  const publicBatchLimiter = rateLimit({ windowMs: 60000, limit: 50 });
  const publicBatchAccessLimiter = rateLimit({ windowMs: 15 * 60000, limit: 5, skipSuccessfulRequests: true });
  app.get("/project/dashboard/:brewName", apiLimiter(5, 15), getUserFromToken, sendPublicDashboard());
  app.get("/project/:brewName/report", apiLimiter(5, 15), getUserFromToken, sendPublicDashboard(true));
  app.post("/project/dashboard/:brewName/charts", publicBatchLimiter, publicBatchAccessLimiter, getUserFromToken, sendPublicDashboard(false, true));
  app.post("/project/:brewName/report/charts", publicBatchLimiter, publicBatchAccessLimiter, getUserFromToken, sendPublicDashboard(true, true));

  /*
  ** Route to generate a dashboard template
  */
  app.post("/project/:id/template/:template", verifyToken, checkPermissions("createAny"), (req, res) => {
    return projectController.generateTemplate(
      req.params.id,
      req.body,
      req.params.template,
    )
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((err) => {
        if (err && err.message && `${err.message}`.indexOf("404") > -1) {
          return res.status(404).send(err);
        }
        if (err && err.message && `${err.message}`.indexOf("403") > -1) {
          return res.status(403).send(err);
        }
        return res.status(400).send(err);
      });
  });
  // -------------------------------------------

  /*
  ** Route to get a project's variables
  */
  app.get("/project/:id/variables", verifyToken, checkPermissions("readOwn"), (req, res) => {
    return projectController.getVariables(req.params.id)
      .then((variables) => {
        return res.status(200).send(variables);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to create a project variable
  */
  app.post("/project/:id/variables", verifyToken, checkPermissions("createOwn"), (req, res) => {
    return projectController.createVariable(req.params.id, req.body)
      .then((variable) => {
        return res.status(200).send(variable);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to update a project variable
  */
  app.put("/project/:id/variables/:variableId", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return projectController.updateVariable(req.params.id, req.params.variableId, req.body)
      .then((variable) => {
        if (!variable) return res.status(404).send({ error: "Variable not found" });
        return res.status(200).send(variable);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });

  /*
  ** Route to delete a project variable
  */
  app.delete("/project/:id/variables/:variableId", verifyToken, checkPermissions("deleteOwn"), (req, res) => {
    return projectController.deleteVariable(req.params.id, req.params.variableId)
      .then((removed) => {
        if (!removed) return res.status(404).send({ error: "Variable not found" });
        return res.status(200).send({ removed: true });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to take a snapshot of a project
  */
  app.post("/project/:id/snapshot", verifyToken, checkPermissions("readOwn"), (req, res) => {
    return projectController.takeSnapshot(req.params.id, req.body)
      .then((snapshot) => {
        return res.status(200).send({ snapshot_path: snapshot });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to create a dashboard filter
  */
  app.post("/project/:id/dashboard-filter", verifyToken, checkPermissions("createOwn"), (req, res) => {
    return projectController.createDashboardFilter(req.params.id, req.body)
      .then((dashboardFilter) => {
        return res.status(200).send(dashboardFilter);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to get a dashboard filter
  */
  app.get("/project/:id/dashboard-filter/:dashboardFilterId", verifyToken, checkPermissions("readOwn"), (req, res) => {
    return projectController.getDashboardFilter(req.params.id, req.params.dashboardFilterId)
      .then((dashboardFilter) => {
        if (!dashboardFilter) return res.status(404).send({ error: "Dashboard filter not found" });
        return res.status(200).send(dashboardFilter);
      });
  });
  // -------------------------------------------

  /*
  ** Route to get all dashboard filters
  */
  app.get("/project/:id/dashboard-filters", verifyToken, checkPermissions("readOwn"), (req, res) => {
    return projectController.getDashboardFilters(req.params.id)
      .then((dashboardFilters) => {
        return res.status(200).send(dashboardFilters);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to reorder all shared dashboard filters
  */
  app.put("/project/:id/dashboard-filters/order", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return projectController.reorderDashboardFilters(req.params.id, req.body?.filterIds)
      .then((dashboardFilters) => {
        return res.status(200).send(dashboardFilters);
      })
      .catch((error) => {
        return res.status(400).send({ error: error.message });
      });
  });
  // -------------------------------------------

  /*
  ** Route to update a dashboard filter
  */
  app.put("/project/:id/dashboard-filter/:dashboardFilterId", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return projectController.updateDashboardFilter(req.params.id, req.params.dashboardFilterId, req.body)
      .then((dashboardFilter) => {
        if (!dashboardFilter) return res.status(404).send({ error: "Dashboard filter not found" });
        return res.status(200).send(dashboardFilter);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to delete a dashboard filter
  */
  app.delete("/project/:id/dashboard-filter/:dashboardFilterId", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return projectController.deleteDashboardFilter(req.params.id, req.params.dashboardFilterId)
      .then((removed) => {
        if (!removed) return res.status(404).send({ error: "Dashboard filter not found" });
        return res.status(200).send({ removed: true });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to create a project share policy
  */
  app.post("/project/:id/share/policy", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return projectController.createSharePolicy(req.params.id)
      .then((sharePolicy) => {
        return res.status(200).send(sharePolicy);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to generate a project share token
  */
  app.post("/project/:id/share/token", verifyToken, checkPermissions("updateOwn"), (req, res) => {
    return projectController.generateShareToken(req.params.id, req.body)
      .then(({ token, url, sharePolicy }) => {
        return res.status(200).send({ token, url, sharePolicy });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to get all share policies for a project
  */
  app.get("/project/:id/share/policy", verifyToken, checkPermissions("readAny"), async (req, res) => {
    try {
      const policies = await SharePolicyController.findByEntityId("Project", req.params.id);
      return res.status(200).send(policies);
    } catch (error) {
      return res.status(400).send(error);
    }
  });
  // -------------------------------------------

  /*
  ** Route to update a project share policy
  */
  app.put("/project/:id/share/policy/:policy_id", verifyToken, checkPermissions("updateOwn"), async (req, res) => {
    try {
      const updatedPolicy = await SharePolicyController.updateSharePolicy(
        req.params.policy_id,
        req.body,
        "Project",
        req.params.id
      );
      return res.status(200).send(updatedPolicy);
    } catch (error) {
      if (error?.message === "404") {
        return res.status(404).send({ error: "Share policy not found" });
      }
      return res.status(400).send(error);
    }
  });
  // -------------------------------------------

  /*
  ** Route to delete a project share policy
  */
  app.delete("/project/:id/share/policy/:policy_id", verifyToken, checkPermissions("updateOwn"), async (req, res) => {
    try {
      await SharePolicyController.deleteSharePolicy(req.params.policy_id, "Project", req.params.id);
      return res.status(200).send({ deleted: true });
    } catch (error) {
      if (error?.message === "404") {
        return res.status(404).send({ error: "Share policy not found" });
      }
      return res.status(400).send(error);
    }
  });
  // -------------------------------------------

  return (req, res, next) => {
    next();
  };
};
