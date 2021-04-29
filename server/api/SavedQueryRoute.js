const SavedQueryController = require("../controllers/SavedQueryController");
const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const savedQueryController = new SavedQueryController();
  const projectController = new ProjectController();
  const teamController = new TeamController();

  const checkAccess = (req) => {
    let gProject;
    return projectController.findById(req.params.project_id)
      .then((project) => {
        gProject = project;
        if (req.params.id) {
          return savedQueryController.findById(req.params.id);
        }
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((data) => {
        if (!req.params.id) {
          return Promise.resolve(data);
        }

        if (parseInt(data.project_id, 10) !== parseInt(gProject.id, 10)) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.getTeamRole(gProject.team_id, req.user.id);
      });
  };

  /**
   * [MASTER] Route to get all saved queries
   */
  app.get("/savedQuery", verifyToken, (req, res) => {
    if (!req.user.admin) {
      return res.status(401).send({ error: "Not authorized" });
    }

    let conditions;
    if (req.query.include === "query") {
      conditions = {};
    }

    return savedQueryController.findAll(conditions)
      .then((savedQueries) => {
        return res.status(200).send(savedQueries);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  /*
  ** Route to get all the saved queries in a project
  */
  app.get("/project/:project_id/savedQuery", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("savedQuery");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return savedQueryController.findByProject(req.params.project_id, req.query.type);
      })
      .then((savedQueries) => {
        return res.status(200).send(savedQueries);
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
  ** Route to create a new savedQuery
  */
  app.post("/project/:project_id/savedQuery", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("savedQuery");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        const newSavedQuery = req.body;
        newSavedQuery.project_id = req.params.project_id;
        newSavedQuery.user_id = req.user.id;

        return savedQueryController.create(newSavedQuery);
      })
      .then((savedQuery) => {
        return res.status(200).send(savedQuery);
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
  ** Route to update a savedQuery
  */
  app.put("/project/:project_id/savedQuery/:id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("savedQuery");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        const newSavedQuery = req.body;
        newSavedQuery.project_id = req.params.project_id;
        newSavedQuery.user_id = req.user.id;

        return savedQueryController.update(req.params.id, newSavedQuery);
      })
      .then((savedQuery) => {
        return res.status(200).send(savedQuery);
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
  ** Remove a savedQuery
  */
  app.delete("/project/:project_id/savedQuery/:id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("savedQuery");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return savedQueryController.remove(req.params.id);
      })
      .then((resp) => {
        return res.status(200).send(resp);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // --------------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
