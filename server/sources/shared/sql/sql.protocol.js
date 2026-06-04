const Sequelize = require("sequelize");

const db = require("../../../models/models");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const { serializeResponsePreview } = require("../../../modules/updateAudit");
const {
  applySqlVariables,
} = require("./sql.variables");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../connectorRuntime");
const externalDbConnection = require("./externalDbConnection");

async function closeSqlConnection(sqlDb) {
  if (!sqlDb) {
    return;
  }

  if (typeof sqlDb.close === "function") {
    try {
      await sqlDb.close();
    } catch (error) {
      // no-op
    }
  }

  if (sqlDb.sshTunnel && typeof sqlDb.sshTunnel.close === "function") {
    try {
      sqlDb.sshTunnel.close();
    } catch (error) {
      // no-op
    }
  }
}

async function getSchemaFromDbConnection(dbConnection) {
  const tables = await dbConnection.getQueryInterface().showAllTables();
  const schemas = [];

  await tables.reduce((promise, table) => {
    return promise.then(async () => {
      const description = await dbConnection.getQueryInterface().describeTable(table);
      schemas.push({ table, description });
    });
  }, Promise.resolve());

  const schema = schemas.reduce((acc, { table, description }) => {
    acc[table] = description;
    return acc;
  }, {});

  let formattedSchema = {};
  if (schema) {
    try {
      formattedSchema = {};
      Object.keys(schema).forEach((tableName) => {
        formattedSchema[tableName] = Object.keys(schema[tableName]);
      });
    } catch (error) {
      formattedSchema = schema;
    }
  }

  return {
    tables,
    description: formattedSchema,
  };
}

async function getSchema({ connection }) {
  let sqlDb;
  try {
    sqlDb = await externalDbConnection(connection);
    return await getSchemaFromDbConnection(sqlDb);
  } finally {
    await closeSqlConnection(sqlDb);
  }
}

async function testConnection({ connection }) {
  const schema = await getSchema({ connection });

  return {
    success: true,
    schema,
  };
}

function applyUploadedFiles(connection, extras = {}) {
  const connectionParams = { ...connection };

  if (Array.isArray(extras.files)) {
    extras.files.forEach((file) => {
      if (["sslCa", "sslCert", "sslKey", "sshPrivateKey"].includes(file.fieldname)) {
        connectionParams[file.fieldname] = file.path;
      }
    });
  }

  return connectionParams;
}

function testUnsavedConnection({ connection, extras }) {
  return testConnection({ connection: applyUploadedFiles(connection, extras) });
}

function getQueryToExecute({ processedQuery, dataRequest }) {
  const query = processedQuery || dataRequest?.query;

  if (typeof query !== "string" || query.trim().length === 0) {
    const error = new Error("SQL query is required");
    error.auditStage = "query";
    throw error;
  }

  return query;
}

async function prepareConnectionData({ connection }) {
  try {
    const testData = await testConnection({ connection });

    return {
      ...connection,
      schema: testData.schema,
    };
  } catch {
    return { ...connection };
  }
}

async function getSavedConnection(connection) {
  if (!connection?.id) {
    return connection;
  }

  return db.Connection.findByPk(connection.id)
    .then((savedConnection) => savedConnection || connection)
    .catch(() => connection);
}

async function runDataRequest({
  connection,
  dataRequest,
  getCache,
  processedQuery = null,
  auditContext = null,
  connectionType,
}) {
  if (getCache) {
    const drCache = await checkAndGetCache(connection.id, dataRequest);
    if (drCache) {
      await completeConnectorAudit(auditContext, {
        cacheHit: true,
        connectionType,
        ...serializeResponsePreview(drCache.responseData),
      });
      return drCache;
    }
  }

  let dbConnection = null;

  try {
    const savedConnection = await getSavedConnection(connection);
    const queryToExecute = getQueryToExecute({ processedQuery, dataRequest });
    dbConnection = await externalDbConnection(savedConnection);
    const results = await dbConnection.query(queryToExecute, { type: Sequelize.QueryTypes.SELECT });

    const dataToCache = {
      dataRequest,
      responseData: {
        data: results,
      },
      connection_id: savedConnection.id,
    };

    await drCacheController.create(dataRequest.id, dataToCache);
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType,
      rowCount: results.length,
      ...serializeResponsePreview(dataToCache.responseData),
    });

    return dataToCache;
  } catch (error) {
    await failConnectorAudit(auditContext, error, error.auditStage || "connection", {
      cacheHit: false,
      connectionType,
    });
    return Promise.reject(error);
  } finally {
    await closeSqlConnection(dbConnection);
  }
}

async function runChartQuery({ connection, query }) {
  let dbConnection = null;
  try {
    const queryToExecute = getQueryToExecute({ dataRequest: { query } });
    dbConnection = await externalDbConnection(connection);
    return await dbConnection.query(queryToExecute, { type: Sequelize.QueryTypes.SELECT });
  } finally {
    await closeSqlConnection(dbConnection);
  }
}

module.exports = {
  applyVariables({ dataRequest, variables, escapeBackslash }) {
    return applySqlVariables(dataRequest, variables, { escapeBackslash });
  },
  applyUploadedFiles,
  closeSqlConnection,
  getQueryToExecute,
  getSavedConnection,
  getSchema,
  getSchemaFromDbConnection,
  prepareConnectionData,
  runChartQuery,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
};
