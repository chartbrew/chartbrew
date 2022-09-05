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

  const checkAccess = (req) => {
    const teamId = req.params.team_id || req.body.team_id || req.query.team_id;

    if (req.params.id) {
      return projectController.findById(req.params.id)
        .then((project) => {
          return teamController.getTeamRole(project.team_id, req.user.id);
        })
        .then((teamRole) => {
          // the owner has access to all the projects
          if (teamRole.role === "owner") return teamRole;

          // otherwise, check if the team role contains access to the right project
          if (!teamRole.projects) return Promise.reject(401);
          const filteredProjects = teamRole.projects.filter((o) => `${o}` === `${req.params.id}`);
          if (filteredProjects.length === 0) {
            return Promise.reject(401);
          }

          return teamRole;
        });
    }

    return teamController.getTeamRole(teamId, req.user.id);
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
  app.post("/project", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("project");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return projectController.create(req.user.id, req.body);
      })
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
  ** Route to get all the user's projects
  */
  app.get("/project/user", verifyToken, (req, res) => {
    projectController.findByUserId(req.user.id)
      .then((projects) => {
        return res.status(200).send(projects);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to get a project by ID
  */
  app.get("/project/:id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("project");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return projectController.findById(req.params.id);
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
  app.put("/project/:id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("project");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return projectController.update(req.params.id, req.body);
      })
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
  app.post("/project/:id/logo", verifyToken, (req, res) => {
    let logoPath;

    req.pipe(req.busboy);
    req.busboy.on("file", (fieldname, file, info) => {
      const newFilename = `${nanoid(6)}-${info.filename}`;
      const uploadPath = path.normalize(`${__dirname}/../uploads/${newFilename}`);
      logoPath = `uploads/${newFilename}`;

      file.pipe(fs.createWriteStream(uploadPath));
    });

    req.busboy.on("finish", () => {
      return checkAccess(req)
        .then((teamRole) => {
          const permission = accessControl.can(teamRole.role).updateAny("project");
          if (!permission.granted) {
            return new Promise((resolve, reject) => reject(new Error(401)));
          }

          return projectController.update(req.params.id, { logo: logoPath });
        })
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
  app.delete("/project/:id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("project");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return projectController.remove(req.params.id, req.user.id);
      })
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
  app.get("/project/team/:team_id", verifyToken, (req, res) => {
    return teamController.getTeamRole(req.params.team_id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("project");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return projectController.getTeamProjects(req.params.team_id);
      })
      .then((projects) => {
        return res.status(200).send(projects);
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
  app.post("/project/:id/template/:template", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("connection");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return projectController.generateTemplate(
          req.params.id,
          req.body,
          req.params.template,
        );
      })
      .then((result) => {
        // refresh the charts
        const charts = [];
        result.forEach((r) => {
          charts.push(r.chart);
        });
        refreshChartsApi(req.params.id, charts, req.headers.authorization);

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

  return (req, res, next) => {
    next();
  };
};
