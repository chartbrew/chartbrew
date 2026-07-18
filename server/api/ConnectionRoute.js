const multer = require("multer");
const fs = require("fs");

const ConnectionController = require("../controllers/ConnectionController");
const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const { encryptFile } = require("../modules/fileEncryption");
const {
  CONNECTION_FILE_FIELDS,
  removeManagedConnectionFile,
} = require("../modules/connectionFiles");
const {
  isOutboundPolicyError,
  serializeOutboundPolicyError,
} = require("../modules/outboundTargetPolicy");
const {
  findSourceForConnection,
  getSourceForConnection,
} = require("../sources");
const {
  assertSourceServerEnabled,
  isSourceDisabledError,
  serializeSourceDisabledError,
} = require("../sources/sourceAvailability");

const upload = multer({
  dest: ".connectionFiles/",
  limits: {
    fileSize: 1024 * 1024, // 1MB
  }
});

module.exports = (app) => {
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size limit exceeded." });
    }
    // Handle other errors or pass them to the default Express error handler
    return next(err);
  });

  const connectionController = new ConnectionController();
  const projectController = new ProjectController();
  const teamController = new TeamController();

  const sendPolicyError = (res, error) => {
    if (!isOutboundPolicyError(error)) return false;
    return res.status(400).send(serializeOutboundPolicyError(error));
  };

  const sendSourceDisabledError = (res, error) => {
    if (!isSourceDisabledError(error)) return false;
    return res.status(error.statusCode || 400).send(serializeSourceDisabledError(error));
  };

  const redactConnectionSecrets = (connection) => {
    const redactedConnection = connection?.toJSON ? connection.toJSON() : { ...connection };

    redactedConnection.hasSshPassword = Boolean(redactedConnection.sshPassword);
    redactedConnection.hasSshPrivateKey = Boolean(redactedConnection.sshPrivateKey);
    redactedConnection.hasSshPassphrase = Boolean(redactedConnection.sshPassphrase);
    delete redactedConnection.sshPassword;
    delete redactedConnection.sshPrivateKey;
    delete redactedConnection.sshPassphrase;

    return redactedConnection;
  };

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

  const checkPermissions = (actionType = "readOwn") => {
    return async (req, res, next) => {
      const { team_id } = req.params;

      // Fetch the TeamRole for the user
      const teamRole = await teamController.getTeamRole(team_id, req.user.id);

      if (!teamRole) {
        return res.status(403).json({ message: "Access denied" });
      }

      const permission = accessControl.can(teamRole.role)[actionType]("connection");
      if (!permission.granted) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role, projects } = teamRole;

      // Handle permissions for teamOwner and teamAdmin
      if (["teamOwner", "teamAdmin"].includes(role)) {
        req.user.isEditor = true;
        return next();
      }

      if (role === "projectAdmin" || role === "projectViewer" || role === "projectEditor") {
        // save the projects in the user object
        req.user.projects = projects;
        req.user.permittedFields = permission.attributes;

        return next();
      }

      return res.status(403).json({ message: "Access denied" });
    };
  };

  const ensureConnectionBelongsToTeam = async (req, res, next) => {
    try {
      const connection = await connectionController.findByIdAndTeam(
        req.params.connection_id,
        req.params.team_id
      );
      if (req.user.projects?.length > 0) {
        const hasProjectAccess = Array.isArray(connection?.project_ids)
          && connection.project_ids.some((projectId) => req.user.projects.includes(projectId));

        if (!hasProjectAccess) {
          return res.status(403).send({ error: "Not authorized" });
        }
      }

      req.connection = connection;
      return next();
    } catch (error) {
      if (error?.message === "404") {
        return res.status(404).send({ error: "Not Found" });
      }
      return res.status(400).send(error);
    }
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
        return res.status(200).send(connections.map(redactConnectionSecrets));
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  // V3 ROUTES

  /*
  ** Route to get team connections
  */
  app.get("/team/:team_id/connections", verifyToken, checkPermissions("readOwn"), async (req, res) => {
    const { team_id } = req.params;

    try {
      const connections = await connectionController.findByTeam(team_id);
      const redactedConnections = connections.map(redactConnectionSecrets);

      if (req.user.projects) {
        let filteredConnections = redactedConnections.filter((connection) => {
          if (!connection.project_ids) return false;
          return connection.project_ids.some((projectId) => {
            return req.user.projects.includes(projectId);
          });
        });

        if (req.user.permittedFields) {
          filteredConnections = filteredConnections.map((connection) => {
            const newConnection = { ...connection };
            Object.keys(newConnection).forEach((key) => {
              if (!req.user.permittedFields.includes(key)) {
                newConnection[key] = null;
              }
            });
            return newConnection;
          });
        }

        return res.status(200).send(filteredConnections);
      }

      return res.status(200).send(redactedConnections);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  });
  // -----------------------------------------

  // V2 ROUTES

  /*
  ** Route to create a connection
  */
  app.post("/team/:team_id/connections", verifyToken, checkPermissions("createOwn"), async (req, res) => {
    try {
      const routeTeamId = parseInt(req.params.team_id, 10);
      const requestData = { ...req.body, team_id: routeTeamId };
      const source = findSourceForConnection(requestData);
      if (source?.backend?.prepareConnectionData || source?.backend?.afterConnectionCreated) {
        assertSourceServerEnabled(source);
      }

      const connectionData = source?.backend?.prepareConnectionData
        ? await source.backend.prepareConnectionData({ connection: requestData })
        : requestData;
      const connection = await connectionController.create({
        ...connectionData,
        team_id: routeTeamId,
      });
      if (source?.backend?.afterConnectionCreated) {
        Promise.resolve(source.backend.afterConnectionCreated({ connection })).catch(() => {});
      }
      return res.status(200).send(redactConnectionSecrets(connection));
    } catch (error) {
      if (error.message === "401") {
        return res.status(401).send({ error: "Not authorized" });
      }
      const sourceDisabledResponse = sendSourceDisabledError(res, error);
      if (sourceDisabledResponse) return sourceDisabledResponse;
      return res.status(400).send(error);
    }
  });
  // -----------------------------------------

  /*
  ** Route to duplicate a connection
  */
  app.post("/team/:team_id/connections/:connection_id/duplicate", verifyToken, checkPermissions("createOwn"), ensureConnectionBelongsToTeam, (req, res) => {
    return connectionController.duplicateConnection(req.params.connection_id, req.body.name)
      .then((connection) => {
        return res.status(200).send(redactConnectionSecrets(connection));
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to get a connection by ID
  */
  app.get("/team/:team_id/connections/:connection_id", verifyToken, checkPermissions("readOwn"), ensureConnectionBelongsToTeam, (req, res) => {
    return connectionController.findByIdAndTeam(req.params.connection_id, req.params.team_id)
      .then((connection) => {
        let newConnection = connection.toJSON();
        if (!req.user.isEditor) {
          newConnection.password = "";
        }

        newConnection = redactConnectionSecrets(newConnection);

        if (req.user.permittedFields) {
          Object.keys(newConnection).forEach((key) => {
            if (!req.user.permittedFields.includes(key)) {
              newConnection[key] = null;
            }
          });
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
        let filteredConnections = connections.map(redactConnectionSecrets);
        if (req.user.permittedFields) {
          filteredConnections = filteredConnections.map((connection) => {
            const newConnection = { ...connection };
            Object.keys(newConnection).forEach((key) => {
              if (!req.user.permittedFields.includes(key)) {
                newConnection[key] = null;
              }
            });
            return newConnection;
          });
        }

        return res.status(200).send(filteredConnections);
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
  app.put("/team/:team_id/connections/:connection_id", verifyToken, checkPermissions("updateOwn"), ensureConnectionBelongsToTeam, (req, res) => {
    req.body.team_id = req.params.team_id;

    return connectionController.update(req.params.connection_id, req.body)
      .then((connection) => {
        return res.status(200).send(redactConnectionSecrets(connection));
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
  ** Route to trigger a MongoDB schema update for a connection
  */
  app.post("/team/:team_id/connections/:connection_id/update-schema", verifyToken, checkPermissions("updateOwn"), ensureConnectionBelongsToTeam, (req, res) => {
    const source = findSourceForConnection(req.connection);
    try {
      if (source) assertSourceServerEnabled(source);
    } catch (error) {
      const sourceDisabledResponse = sendSourceDisabledError(res, error);
      if (sourceDisabledResponse) return sourceDisabledResponse;
      return res.status(400).send(error);
    }

    const updateSchema = source?.backend?.updateSchema
      ? source.backend.updateSchema({ connection: req.connection })
      : Promise.reject(new Error("Connection does not support schema updates"));

    return updateSchema
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((error) => {
        const sourceDisabledResponse = sendSourceDisabledError(res, error);
        if (sourceDisabledResponse) return sourceDisabledResponse;
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }
        return res.status(400).send(error);
      });
  });
  // -----------------------------------------

  /*
  ** Route to add files to a connection
  */
  app.post("/team/:team_id/connections/:connection_id/files", verifyToken, checkPermissions("updateOwn"), ensureConnectionBelongsToTeam, upload.any(), (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send({ error: "No files were uploaded" });
    }

    const seenFields = new Set();
    const hasInvalidFiles = req.files.some((file) => {
      if (!CONNECTION_FILE_FIELDS.includes(file.fieldname) || seenFields.has(file.fieldname)) {
        return true;
      }
      seenFields.add(file.fieldname);
      return false;
    });
    if (hasInvalidFiles) {
      return Promise.all(req.files.map((file) => removeManagedConnectionFile(file.path)))
        .then(() => res.status(400).send({ error: "Invalid connection file field" }));
    }

    // update the fields with the paths of the files
    const files = {};
    const encryptionPromises = [];

    req.files.forEach((file) => {
      files[file.fieldname] = file.path;
      // Encrypt the file
      encryptionPromises.push(encryptFile(file.path));
    });

    // Wait for all files to be encrypted before updating the connection
    return Promise.all(encryptionPromises)
      .then(() => {
        return connectionController.update(req.params.connection_id, files, {
          allowManagedFilePaths: true,
        });
      })
      .then((connection) => {
        return res.status(200).send(redactConnectionSecrets(connection));
      })
      .catch(async (error) => {
        await Promise.all(req.files.map((file) => removeManagedConnectionFile(file.path)));
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------

  /*
  ** Route to remove a connection
  */
  app.delete("/team/:team_id/connections/:connection_id", verifyToken, checkPermissions("deleteOwn"), ensureConnectionBelongsToTeam, (req, res) => {
    return connectionController.removeConnection(req.params.connection_id, req.query.removeDatasets)
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
  app.get("/team/:team_id/connections/:connection_id/test", verifyToken, checkPermissions("readOwn"), ensureConnectionBelongsToTeam, (req, res) => {
    const source = findSourceForConnection(req.connection);
    try {
      if (source) assertSourceServerEnabled(source);
    } catch (error) {
      const sourceDisabledResponse = sendSourceDisabledError(res, error);
      if (sourceDisabledResponse) return sourceDisabledResponse;
      return res.status(400).send(error);
    }

    const testConnection = source?.backend?.testConnection
      ? source.backend.testConnection({ connection: req.connection })
      : connectionController.testConnection(req.params.connection_id);

    return testConnection
      .then((response) => {
        return res.status(200).send(response);
      })
      .catch((error) => {
        const sourceDisabledResponse = sendSourceDisabledError(res, error);
        if (sourceDisabledResponse) return sourceDisabledResponse;
        const policyResponse = sendPolicyError(res, error);
        if (policyResponse) return policyResponse;
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
  app.post("/team/:team_id/connections/:connection_id/apiTest", verifyToken, checkPermissions("readOwn"), ensureConnectionBelongsToTeam, (req, res) => {
    const requestData = req.body;
    requestData.connection_id = req.params.connection_id;
    const source = findSourceForConnection(req.connection);
    try {
      if (source) assertSourceServerEnabled(source);
    } catch (error) {
      const sourceDisabledResponse = sendSourceDisabledError(res, error);
      if (sourceDisabledResponse) return sourceDisabledResponse;
      return res.status(400).send(error);
    }

    const testRequest = source?.backend?.previewDataRequest
      ? source.backend.previewDataRequest({
        connection: req.connection,
        dataRequest: requestData.dataRequest,
        itemsLimit: requestData.itemsLimit,
        items: requestData.items,
        offset: requestData.offset,
        pagination: requestData.pagination,
        paginationField: requestData.paginationField,
      })
      : connectionController.testApiRequest(requestData);

    return testRequest
      .then((dataRequest) => {
        if (!dataRequest) return res.status(500).send("Api Request Error");
        return res.status(200).send(dataRequest);
      })
      .catch((errorCode) => {
        const sourceDisabledResponse = sendSourceDisabledError(res, errorCode);
        if (sourceDisabledResponse) return sourceDisabledResponse;
        const policyResponse = sendPolicyError(res, errorCode);
        if (policyResponse) return policyResponse;

        if (typeof errorCode === "number") {
          return res.status(errorCode).send({ error: errorCode });
        }

        return res.status(400).send({ error: errorCode?.message || errorCode });
      });
  });
  // -------------------------------------------------

  /*
  ** Route to test any connection
  */
  app.post("/team/:team_id/connections/:type/test", verifyToken, checkPermissions("readOwn"), (req, res) => {
    const requestData = {
      ...req.body,
      type: req.body.type || req.params.type,
      team_id: req.params.team_id,
    };
    const source = findSourceForConnection(requestData);
    try {
      if (source) assertSourceServerEnabled(source);
    } catch (error) {
      const sourceDisabledResponse = sendSourceDisabledError(res, error);
      if (sourceDisabledResponse) return sourceDisabledResponse;
      return res.status(400).send(error.message || error);
    }

    const testConnection = source?.backend?.testUnsavedConnection
      ? source.backend.testUnsavedConnection({ connection: requestData })
      : connectionController.testRequest(requestData);

    return testConnection
      .then((response) => {
        if (req.params.type === "api") {
          return res.status(response.statusCode).send(response.body);
        } else {
          return res.status(200).send(response);
        }
      })
      .catch((err) => {
        const sourceDisabledResponse = sendSourceDisabledError(res, err);
        if (sourceDisabledResponse) return sourceDisabledResponse;
        const policyResponse = sendPolicyError(res, err);
        if (policyResponse) return policyResponse;
        return res.status(400).send(err.message || err);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to test any connection that need file (like SSL certificates)
  */
  app.post("/team/:team_id/connections/:type/test/files", verifyToken, checkPermissions("readOwn"), upload.any(), (req, res) => {
    let connectionParams;
    try {
      connectionParams = JSON.parse(req.body.connection);
    } catch (err) {
      return res.status(400).send("Invalid connection parameters");
    }

    const encryptionPromises = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        // Encrypt the file
        encryptionPromises.push(encryptFile(file.path));
      });
    }

    // Wait for all files to be encrypted before testing the connection
    return Promise.all(encryptionPromises)
      .then(() => {
        connectionParams.type = connectionParams.type || req.params.type;
        connectionParams.team_id = req.params.team_id;
        const source = findSourceForConnection(connectionParams);
        if (source) assertSourceServerEnabled(source);

        if (source?.backend?.testUnsavedConnection) {
          return source.backend.testUnsavedConnection({
            connection: connectionParams,
            extras: { files: req.files },
          });
        }

        return connectionController.testRequest(connectionParams, { files: req.files });
      })
      .then((response) => {
        // if done, remove the files
        try {
          req.files.forEach((file) => {
            fs.unlink(file.path, () => {});
          });
        } catch (err) {
          // do nothing
        }

        if (req.params.type === "api") {
          return res.status(response.statusCode).send(response.body);
        } else {
          return res.status(200).send(response);
        }
      })
      .catch((err) => {
        const sourceDisabledResponse = sendSourceDisabledError(res, err);
        if (sourceDisabledResponse) return sourceDisabledResponse;
        const policyResponse = sendPolicyError(res, err);
        if (policyResponse) return policyResponse;
        // remove the files if there is an error
        try {
          req.files.forEach((file) => {
            fs.unlink(file.path, () => { });
          });
        } catch (err) {
          // do nothing
        }
        return res.status(400).send(err.message || err);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to run plugin-owned actions for a source connection
  */
  app.post("/team/:team_id/connections/:connection_id/source-action", verifyToken, checkPermissions("readOwn"), ensureConnectionBelongsToTeam, async (req, res) => {
    try {
      const source = getSourceForConnection(req.connection);
      assertSourceServerEnabled(source);
      const actionName = req.body?.action;
      const action = source.backend?.actions?.[actionName];

      if (!action) {
        return res.status(400).send({ error: "Unsupported source action" });
      }

      const data = await action({
        connection: req.connection,
        params: req.body?.params || {},
        user: req.user,
        teamId: req.params.team_id,
      });

      return res.status(200).send(data);
    } catch (err) {
      const sourceDisabledResponse = sendSourceDisabledError(res, err);
      if (sourceDisabledResponse) return sourceDisabledResponse;
      return res.status(400).send(err);
    }
  });
  // -------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
