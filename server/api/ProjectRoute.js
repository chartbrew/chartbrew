const path = require("path");
const fs = require("fs");
const { nanoid } = require("nanoid");
const _ = require("lodash");

const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const refreshChartsApi = require("../modules/refreshChartsApi");
const getUserFromToken = require("../modules/getUserFromToken");

module.exports = (app) => {
  const projectController = new ProjectController();
  const teamController = new TeamController();

  const checkPermissions = (actionType = "readOwn") => {
    return async (req, res, next) => {
      const projectId = req.params.id;
      const teamId = req.params.team_id || req.body?.team_id;

      let teamRole;
      let project;

      if (projectId) {
        project = await projectController.findById(projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
      }

      if (teamId) {
        teamRole = await teamController.getTeamRole(teamId, req.user.id);
      } else {
        teamRole = await teamController.getTeamRole(project.team_id, req.user.id);
      }

      if (!teamRole?.role) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (["teamOwner", "teamAdmin"].includes(teamRole.role)) {
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
    return projectController.findById(req.params.id)
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
    let logoPath;

    req.pipe(req.busboy);
    req.busboy.on("file", (fieldname, file, info) => {
      const newFilename = `${nanoid(6)}-${info.filename}`;
      const uploadPath = path.normalize(`${__dirname}/../uploads/${newFilename}`);
      logoPath = `uploads/${newFilename}`;

      file.pipe(fs.createWriteStream(uploadPath));
    });

    req.busboy.on("finish", () => {
      return projectController.update(req.params.id, { logo: logoPath })
        .then((project) => {
          return res.status(200).send(project);
        })
        .catch((err) => {
          return res.status(400).send(err);
        });
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

  /*
  ** Route to get a project with a public dashboard
  */
  app.get("/project/dashboard/:brewName", getUserFromToken, (req, res) => {
    let processedProject;
    return projectController.getPublicDashboard(req.params.brewName)
      .then(async (project) => {
        processedProject = _.cloneDeep(project);
        processedProject.setDataValue("password", "");

        if (req.user) {
          // now determine whether to show the dashboard or not
          const teamRole = await teamController.getTeamRole(project.team_id, req.user.id);

          if ((teamRole && teamRole.role)) {
            return res.status(200).send(project);
          }
        }

        if (project.public && !project.passwordProtected) {
          return res.status(200).send(processedProject);
        }

        if (project.public && project.passwordProtected && req.query.pass === project.password) {
          return res.status(200).send(processedProject);
        }

        if (project.public && project.passwordProtected && req.query.pass !== project.password) {
          return res.status(403).send("Enter the correct password");
        }

        if (!project.isPublic) return res.status(401).send("Not authorized to access this page");

        return res.status(400).send("Cannot get the data");
      })
      .catch((error) => {
        if (error && error.message === "404") {
          return res.status(404).send(error);
        }
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

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
        refreshChartsApi(req.params.id, result, req.headers.authorization);

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
    return projectController.updateVariable(req.params.variableId, req.body)
      .then((variable) => {
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
    return projectController.deleteVariable(req.params.variableId)
      .then(() => {
        return res.status(200).send({ removed: true });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  return (req, res, next) => {
    next();
  };
};
