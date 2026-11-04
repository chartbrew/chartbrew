const Sequelize = require("sequelize");
const sourceExecution = require("../../../modules/sourceExecution");

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
const { normalizeSqlQuery } = require("./readOnlyQuery");

async function exploreReadOnly({ connection, operation, query, search = "", names = [], limit = 20 }) {
  if (operation === "inspect") {
    const schema = connection.schema || await getSchema({ connection });
    const tables = schema.tables || Object.keys(schema.description || {});
    const matches = tables.filter((table) => typeof table === "string"
      && (!names.length || names.includes(table)) && table.toLowerCase().includes(search.toLowerCase()));
    return { resources: matches.slice(0, limit).map((name) => ({ name, fields: schema.description?.[name] || [] })), truncated: matches.length > limit };
  }
  const validatedQuery = normalizeSqlQuery(query);
  let sqlDb;
  try {
    const rows = await sourceExecution.runSourceExecution({ connection, cacheHit: false }, async () => {
      sqlDb = await externalDbConnection(connection);
      return sqlDb.transaction({ readOnly: true }, async (transaction) => {
        // Sequelize's readOnly option selects a replica; enforce read-only execution on the database too.
        await sqlDb.query(connection.type === "mysql" ? "START TRANSACTION READ ONLY" : "SET TRANSACTION READ ONLY", { transaction });
        return sqlDb.query(`SELECT * FROM (${validatedQuery}) AS chartbrew_preview LIMIT ${limit}`,
          { type: Sequelize.QueryTypes.SELECT, transaction });
      });
    });
    return { rows, dataRequest: { query: validatedQuery, method: "GET" } };
  } finally {
    await closeSqlConnection(sqlDb);
  }
}

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
  if (dbConnection.getDialect?.() === "postgres") {
    const tables = await dbConnection.query(`
      SELECT t.table_name, t.table_schema
      FROM information_schema.tables AS t
      JOIN pg_catalog.pg_namespace AS n ON n.nspname = t.table_schema
      JOIN pg_catalog.pg_class AS c ON c.relnamespace = n.oid AND c.relname = t.table_name
      WHERE t.table_type LIKE '%TABLE'
        AND t.table_name != 'spatial_ref_sys'
        AND t.table_schema = ANY(pg_catalog.current_schemas(false))
        AND pg_catalog.pg_table_is_visible(c.oid)
      ORDER BY t.table_name
    `, { type: Sequelize.QueryTypes.SELECT });
    const description = {};

    await tables.reduce((promise, table) => {
      return promise.then(async () => {
        const columns = await dbConnection.getQueryInterface().describeTable(table.table_name, {
          schema: table.table_schema,
        });
        description[table.table_name] = Object.keys(columns);
      });
    }, Promise.resolve());

    return { tables: tables.map((table) => table.table_name), description };
  }

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
    const results = await sourceExecution.runSourceExecution({
      connection: savedConnection, dataRequest, auditContext, cacheHit: false,
    }, async () => {
      dbConnection = await externalDbConnection(savedConnection);
      return dbConnection.query(queryToExecute, { type: Sequelize.QueryTypes.SELECT });
    });

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
    return await sourceExecution.runSourceExecution({ connection, cacheHit: false }, async () => {
      dbConnection = await externalDbConnection(connection);
      return dbConnection.query(queryToExecute, { type: Sequelize.QueryTypes.SELECT });
    });
  } finally {
    await closeSqlConnection(dbConnection);
  }
}

module.exports = {
  exploreReadOnly,
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
