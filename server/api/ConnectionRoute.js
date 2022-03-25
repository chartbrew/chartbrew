const ConnectionController = require("../controllers/ConnectionController");
const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const connectionController = new ConnectionController();
  const projectController = new ProjectController();
  const teamController = new TeamController();

  const checkAccess = (req) => {
    let gProject;
    return projectController.findById(req.params.project_id)
      .then((project) => {
        gProject = project;

        if (req.params.connection_id) {
          return connectionController.findById(req.params.connection_id);
        }

        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((data) => {
        if (!req.params.connection_id) return Promise.resolve(data);

        if (data.project_id !== gProject.id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.getTeamRole(gProject.team_id, req.user.id);
      });
  };

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
    checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("connection");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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
  app.get("/project/:project_id/connection/:connection_id", verifyToken, (req, res) => {
    let isEditor = false;
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("connection");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        const editorPermission = accessControl.can(teamRole.role).updateAny("connection");
        if (editorPermission.granted) isEditor = true;

        return connectionController.findById(req.params.connection_id);
      })
      .then((connection) => {
        const newConnection = connection;
        if (!isEditor) {
          newConnection.password = "";
        }
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
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("connection");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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
  app.put("/project/:project_id/connection/:connection_id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("connection");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return connectionController.update(req.params.connection_id, req.body);
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
  ** Route to remove a connection from a project
  */
  app.delete("/project/:project_id/connection/:connection_id", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("connection");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return connectionController.removeConnection(req.params.connection_id);
      })
      .then((success) => {
        if (success) {
          return res.status(200).send({ removed: success });
        }

        return new Promise((resolve, reject) => reject(new Error(400)));
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
  app.get("/project/:project_id/connection/:connection_id/test", verifyToken, (req, res) => {
    checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("connection");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        return connectionController.testConnection(req.params.connection_id);
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
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        const requestData = req.body;
        requestData.connection_id = req.params.connection_id;

        return connectionController.testApiRequest(requestData);
      })
      .then((dataRequest) => {
        if (!dataRequest) return res.status(500).send("Api Request Error");
        return res.status(200).send(dataRequest);
      })
      .catch((errorCode) => {
        return res.status(errorCode).send({ error: errorCode });
      });
  });
  // -------------------------------------------------

  /*
  ** Route to test any connection
  */
  app.post("/project/:project_id/connection/:type/test", verifyToken, (req, res) => {
    return connectionController.testRequest(req.body)
      .then((response) => {
        if (req.params.type === "api") {
          return res.status(response.statusCode).send(response.body);
        } else {
          return res.status(200).send(response);
        }
      })
      .catch((err) => {
        return res.status(400).send(err.message || err);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to run helper methods for different connections
  */
  app.post("/project/:project_id/connection/:connection_id/helper/:method", verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return connectionController.runHelperMethod(
          req.params.connection_id, req.params.method, req.body,
        );
      })
      .then((data) => {
        return res.status(200).send(data);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // -------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
