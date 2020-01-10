const ConnectionController = require("../controllers/ConnectionController");
const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const connectionController = new ConnectionController();
  const projectController = new ProjectController();
  const teamController = new TeamController();

  /*
  ** [MASTER] Route to get all the connections
  */
  app.get("/connection", verifyToken, (req, res) => {
    if (!req.user.admin) {
      return res.status(401).send({ error: "Not authorized" });
    }

    return connectionController.findAll()
      .then((connections) => {
        return res.status(200).send(connections);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to create a connection
  */
  app.post("/project/:project_id/connection", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("connection");
        if (!permission.granted) {
          throw new Error(401);
        }

        // set the project id for the connection
        req.body.project_id = req.params.project_id;
        return connectionController.create(req.body);
      })
      .then((connection) => {
        return res.status(200).send(connection);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to get a connection by ID
  */
  app.get("/project/:project_id/connection/:id", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("connection");
        if (!permission.granted) {
          throw new Error(401);
        }
        return connectionController.findById(req.params.id);
      })
      .then((connection) => {
        const newConnection = connection;
        newConnection.password = "";
        return res.status(200).send(newConnection);
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
  ** Route to get all the connections for a project
  */
  app.get("/project/:project_id/connection", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("connection");
        if (!permission.granted) {
          throw new Error(401);
        }
        return connectionController.findByProject(req.params.project_id);
      })
      .then((connections) => {
        return res.status(200).send(connections);
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
  ** Route to update a connection
  */
  app.put("/project/:project_id/connection/:id", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("connection");
        if (!permission.granted) {
          throw new Error(401);
        }
        return connectionController.update(req.params.id, req.body);
      })
      .then((connection) => {
        return res.status(200).send(connection);
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
  ** Route to get the mongodb connection url
  ** TODO: To be removed before going in production
  */
  app.get("/project/:project_id/connection/:id/url", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("connection");
        if (!permission.granted) {
          throw new Error(401);
        }
        // throw new Error(400);
        return connectionController.getConnectionUrl(req.params.id);
      })
      .then((connectionUrl) => {
        return res.status(200).send(connectionUrl);
      })
      .catch((error) => {
        if (error === "404") return res.status(404).send({ error: "Not found" });
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to remove a connection from a project
  */
  app.delete("/project/:project_id/connection/:id", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("connection");
        if (!permission.granted) {
          throw new Error(401);
        }
        return connectionController.removeConnection(req.params.id);
      })
      .then((success) => {
        if (success) {
          return res.status(200).send({ removed: success });
        }

        throw new Error(400);
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
  ** Route to test a connection
  */
  app.get("/project/:project_id/connection/:id/test", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("connection");
        if (!permission.granted) {
          throw new Error(401);
        }
        return connectionController.testConnection(req.params.id);
      })
      .then((response) => {
        return res.status(200).send(response);
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
  ** Route to test a potential api request
  */
  app.post("/project/:project_id/connection/:connection_id/apiTest", verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("apiRequest");
        if (!permission.granted) {
          throw new Error(401);
        }

        const requestData = req.body;
        requestData.connection_id = req.params.connection_id;

        return connectionController.testApiRequest(requestData);
      })
      .then((apiRequest) => {
        if (!apiRequest) return res.status(500).send("Api Request Error");
        return res.status(200).send(apiRequest);
      })
      .catch((errorCode) => {
        return res.status(errorCode).send({ error: errorCode });
      });
  });
  // -------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
