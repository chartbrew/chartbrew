const fs = require("fs");

const db = require("../models/models");
const ProjectController = require("./ProjectController");
const apiProtocol = require("../sources/shared/protocols/api.protocol");

function sanitizeConnectionWriteData(data = {}) {
  const sanitizedData = { ...data };
  delete sanitizedData.allowPrivateHost;
  return sanitizedData;
}

class ConnectionController {
  constructor() {
    this.projectController = new ProjectController();
  }

  findAll() {
    return db.Connection.findAll({
      attributes: { exclude: ["dbName", "password", "username", "options", "port", "host", "sslCa", "sslCert", "sslKey"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
    })
      .then((connections) => {
        return Promise.resolve(connections);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  findById(id) {
    return db.Connection.findByPk(id, {
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
    })
      .then((connection) => {
        if (!connection) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return connection;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByIdAndTeam(id, teamId) {
    return db.Connection.findOne({
      where: { id, team_id: teamId },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
    })
      .then((connection) => {
        if (!connection) {
          return new Promise((resolve, reject) => reject(new Error(404)));
        }
        return connection;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByTeam(teamId) {
    return db.Connection.findAll({
      where: { team_id: teamId },
      attributes: { exclude: ["password", "schema"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
      order: [["createdAt", "DESC"]],
    })
      .then((connections) => {
        return connections;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByProject(projectId) {
    return db.Connection.findAll({
      where: { project_id: projectId },
      attributes: { exclude: ["password"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
    })
      .then((connections) => {
        return connections;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  findByProjects(teamId, projects) {
    return db.Connection.findAll({
      where: { team_id: teamId },
      attributes: { exclude: ["password"] },
      include: [{ model: db.OAuth, attributes: { exclude: ["refreshToken"] } }],
      order: [["createdAt", "DESC"]],
    })
      .then((connections) => {
        const filteredConnections = connections.filter((connection) => {
          if (!connection.project_ids) return false;
          return connection.project_ids.some((projectId) => {
            return projects.includes(projectId);
          });
        });

        return filteredConnections;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async create(data) {
    const dataToSave = sanitizeConnectionWriteData(data);

    if (!dataToSave.type) dataToSave.type = "mongodb"; // eslint-disable-line

    return db.Connection.create(dataToSave)
      .then((connection) => connection)
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  update(id, data) {
    return db.Connection.update(sanitizeConnectionWriteData(data), { where: { id } })
      .then(() => {
        return this.findById(id);
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async removeConnection(id, removeDatasets) {
    if (removeDatasets) {
      try {
        const drs = await db.DataRequest.findAll({ where: { connection_id: id } });
        const datasetIds = drs.map((dr) => dr.dataset_id);

        await db.DataRequest.destroy({ where: { connection_id: id } });
        await db.Dataset.destroy({ where: { id: datasetIds } });
      } catch (e) {
        //
      }
    }

    const connection = await this.findById(id);
    // remove certificates and keys if present
    try {
      if (connection.sslCa) {
        fs.unlink(connection.sslCa, () => {});
      }
      if (connection.sslCert) {
        fs.unlink(connection.sslCert, () => {});
      }
      if (connection.sslKey) {
        fs.unlink(connection.sslKey, () => {});
      }
      if (connection.sshPrivateKey) {
        fs.unlink(connection.sshPrivateKey, () => {});
      }
    } catch (e) {
      //
    }

    return db.Connection.destroy({ where: { id } })
      .then(() => {
        return true;
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  getApiTestOptions(connection) {
    return apiProtocol.getApiTestOptions(connection);
  }

  testRequest(data, extras) {
    try {
      const certificates = {};
      extras?.files?.forEach((file) => {
        if (["sslCa", "sslCert", "sslKey", "sshPrivateKey"].includes(file.fieldname)) {
          certificates[file.fieldname] = file.path;
        }
      });

      return apiProtocol.testUnsavedConnection({
        connection: { ...data, ...certificates },
        extras,
      });
    } catch (error) {
      return Promise.reject(new Error(`Error processing certificate files: ${error.message}`));
    }
  }

  testApi(data, policyContext = {}) {
    return apiProtocol.testApi(data, policyContext);
  }

  testConnection(id) {
    return db.Connection.findByPk(id)
      .then((connection) => {
        return apiProtocol.testConnection({ connection });
      })
      .catch((err) => {
        return new Promise((resolve, reject) => reject(err));
      });
  }

  testApiRequest({
    connection_id, dataRequest, itemsLimit, items, offset, pagination, paginationField,
  }) {
    return this.findById(connection_id)
      .then((connection) => {
        return apiProtocol.previewDataRequest({
          connection,
          dataRequest,
          itemsLimit,
          items,
          offset,
          pagination,
          paginationField,
        });
      })
      .catch((error) => {
        return new Promise((resolve, reject) => reject(error));
      });
  }

  async runApiRequest(id, chartId, dataRequest, getCache, filters, timezone = "", runtimeVariables = {}, auditContext = null) {
    const connection = await this.findById(id);
    return apiProtocol.runDataRequest({
      connection,
      dataRequest,
      chartId,
      getCache,
      filters,
      timezone,
      variables: runtimeVariables,
      auditContext,
    });
  }

  async getApiBuilderMetadata(connectionId, { includeSensitive = false } = {}) {
    const connection = await this.findById(connectionId);
    return apiProtocol.getBuilderMetadata({
      connection,
      options: { includeSensitive },
    });
  }

  async duplicateConnection(connectionId, name) {
    const connection = await db.Connection.findByPk(connectionId);
    const connectionToSave = connection.toJSON();
    delete connectionToSave.id;
    delete connectionToSave.createdAt;
    delete connectionToSave.updatedAt;

    if (name) {
      connectionToSave.name = name;
    }

    const newConnection = await db.Connection.create(connectionToSave);
    return newConnection;
  }

}

module.exports = ConnectionController;
