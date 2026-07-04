const db = require("../../../models/models");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const { applySqlVariables } = require("../../shared/sql/sql.variables");
const { generateClickhouseQuery } = require("../../../modules/ai/generateClickhouseQuery");
const {
  getItemCount,
  serializeResponsePreview,
} = require("../../../modules/updateAudit");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../../shared/connectorRuntime");
const ClickHouseConnection = require("./clickhouse.connection");

async function getSavedConnection(connection) {
  if (!connection?.id) {
    return connection;
  }

  return db.Connection.findByPk(connection.id)
    .then((savedConnection) => savedConnection || connection)
    .catch(() => connection);
}

function applyUploadedFiles(connection, extras = {}) {
  const connectionParams = { ...connection };

  if (Array.isArray(extras.files)) {
    extras.files.forEach((file) => {
      if (["sslCa", "sslCert", "sslKey"].includes(file.fieldname)) {
        connectionParams[file.fieldname] = file.path;
      }
    });
  }

  return connectionParams;
}

async function withConnector(connection, callback) {
  const savedConnection = await getSavedConnection(connection);
  const clickhouse = new ClickHouseConnection(savedConnection);

  try {
    return await callback(clickhouse, savedConnection);
  } finally {
    await clickhouse.disconnect();
  }
}

function getQueryToExecute({ processedQuery, dataRequest }) {
  const query = processedQuery || dataRequest?.query;

  if (typeof query !== "string" || query.trim().length === 0) {
    const error = new Error("ClickHouse query is required");
    error.auditStage = "query";
    throw error;
  }

  return query;
}

function getSchema({ connection }) {
  return withConnector(connection, (clickhouse) => clickhouse.getDatabaseSchema());
}

function testConnection({ connection }) {
  return getSchema({ connection });
}

function testUnsavedConnection({ connection, extras }) {
  return testConnection({ connection: applyUploadedFiles(connection, extras) });
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

async function runDataRequest({
  connection,
  dataRequest,
  getCache,
  processedQuery = null,
  auditContext = null,
}) {
  if (getCache) {
    const drCache = await checkAndGetCache(connection.id, dataRequest);
    if (drCache) {
      await completeConnectorAudit(auditContext, {
        cacheHit: true,
        connectionType: "clickhouse",
        ...serializeResponsePreview(drCache.responseData),
      });
      return drCache;
    }
  }

  try {
    const savedConnection = await getSavedConnection(connection);
    const queryToExecute = getQueryToExecute({ processedQuery, dataRequest });
    const result = await withConnector(savedConnection, (clickhouse) => {
      return clickhouse.query(queryToExecute);
    });

    const dataToCache = {
      dataRequest,
      responseData: {
        data: result,
      },
      connection_id: savedConnection.id,
    };

    await drCacheController.create(dataRequest.id, dataToCache);
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType: "clickhouse",
      rowCount: Array.isArray(result) ? result.length : getItemCount(result),
      ...serializeResponsePreview(dataToCache.responseData),
    });

    return dataToCache;
  } catch (error) {
    await failConnectorAudit(auditContext, error, error.auditStage || "connection", {
      cacheHit: false,
      connectionType: "clickhouse",
    });
    return Promise.reject(error);
  }
}

function runChartQuery({ connection, query }) {
  return withConnector(connection, (clickhouse) => {
    return clickhouse.query(getQueryToExecute({ dataRequest: { query } }));
  });
}

function generateQuery({
  schema,
  question,
  conversationHistory,
  currentQuery,
}) {
  return generateClickhouseQuery(schema, question, conversationHistory, currentQuery);
}

module.exports = {
  applyVariables({ dataRequest, variables }) {
    return applySqlVariables(dataRequest, variables, { escapeBackslash: true });
  },
  applyUploadedFiles,
  generateQuery,
  getQueryToExecute,
  getSavedConnection,
  getSchema,
  prepareConnectionData,
  runChartQuery,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
};
