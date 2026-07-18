const mongoose = require("mongoose");
const { Queue } = require("bullmq");

const db = require("../../../models/models");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const assembleMongoUrl = require("../../../modules/assembleMongoUrl");
const validateMongoQuery = require("../../../modules/validateMongoQuery");
const { generateMongoQuery } = require("../../../modules/ai/generateMongoQuery");
const updateMongoSchemaWorker = require("../../../crons/workers/updateMongoSchema");
const { getQueueOptions } = require("../../../redisConnection");
const { serializeResponsePreview } = require("../../../modules/updateAudit");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../../shared/connectorRuntime");

const { ObjectId } = mongoose.Types;
const DEFAULT_CONNECT_TIMEOUT_MS = 30000;

function getMongoConnectionOptions(options = {}) {
  const connectionOptions = {};
  const connectTimeoutMS = Number(options.connectTimeoutMS);
  const socketTimeoutMS = Number(options.socketTimeoutMS);

  if (Number.isFinite(connectTimeoutMS) && connectTimeoutMS > 0) {
    connectionOptions.connectTimeoutMS = connectTimeoutMS;
    connectionOptions.serverSelectionTimeoutMS = connectTimeoutMS;
  }

  if (Number.isFinite(socketTimeoutMS) && socketTimeoutMS > 0) {
    connectionOptions.socketTimeoutMS = socketTimeoutMS;
  }

  return connectionOptions;
}

function stringifyMongoIds(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  const valueType = typeof value;
  if (valueType !== "object") return value;

  if ((value instanceof ObjectId) || (value && value._bsontype === "ObjectId")) {
    return typeof value.toHexString === "function" ? value.toHexString() : String(value);
  }

  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => stringifyMongoIds(item, seen));
  }

  const result = {};
  Object.keys(value).forEach((key) => {
    result[key] = stringifyMongoIds(value[key], seen);
  });
  return result;
}

function getQueryToExecute(query) {
  if (typeof query !== "string" || query.trim().length === 0) {
    const error = new Error("MongoDB query is required");
    error.auditStage = "query";
    throw error;
  }

  let formattedQuery = query;
  if (formattedQuery.indexOf("connection.") === 0) {
    formattedQuery = formattedQuery.replace("connection.", "");
  }

  const validation = validateMongoQuery(formattedQuery);
  if (!validation.valid) {
    const error = new Error(`Invalid MongoDB query: ${validation.message}`);
    error.auditStage = "query";
    throw error;
  }

  return formattedQuery;
}

function serializeMongoString(value) {
  return JSON.stringify(String(value))
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function getStringReplacement(variable, value) {
  if (variable.isAlreadyQuoted) {
    return {
      target: `${variable.quoteCharacter}${variable.placeholder}${variable.quoteCharacter}`,
      value: serializeMongoString(value),
    };
  }

  return {
    target: variable.placeholder,
    value: serializeMongoString(value),
  };
}

function applyMongoVariables(dataRequest, variables = {}) {
  const originalDataRequest = dataRequest;

  if (!originalDataRequest.query
    || !originalDataRequest.VariableBindings
    || originalDataRequest.VariableBindings.length === 0
  ) {
    return {
      dataRequest: originalDataRequest,
      processedQuery: originalDataRequest.query,
    };
  }

  let processedQuery = originalDataRequest.query;
  const variableRegex = /\{\{([^}]+)\}\}/g;
  let match;
  const foundVariables = [];

  // oxlint-disable-next-line no-cond-assign
  while ((match = variableRegex.exec(processedQuery)) !== null) {
    const variableName = match[1].trim();
    const startIndex = match.index;
    const endIndex = match.index + match[0].length;
    const beforeChar = startIndex > 0 ? processedQuery[startIndex - 1] : "";
    const afterChar = endIndex < processedQuery.length ? processedQuery[endIndex] : "";
    const isAlreadyQuoted = (beforeChar === "'" && afterChar === "'")
      || (beforeChar === "\"" && afterChar === "\"");

    foundVariables.push({
      placeholder: match[0],
      name: variableName,
      isAlreadyQuoted,
      quoteCharacter: isAlreadyQuoted ? beforeChar : null,
    });
  }

  foundVariables.forEach((variable) => {
    const binding = originalDataRequest.VariableBindings.find((vb) => vb.name === variable.name);
    const runtimeValue = variables[variable.name];
    const hasRuntimeValue = runtimeValue !== null && runtimeValue !== undefined && runtimeValue !== "";
    const hasDefaultValue = binding?.default_value !== null
      && binding?.default_value !== undefined
      && binding?.default_value !== "";

    if (hasRuntimeValue) {
      let replacementValue = runtimeValue;
      let replacementTarget = variable.placeholder;

      if (binding?.type) {
        switch (binding.type) {
          case "string": {
            const replacement = getStringReplacement(variable, runtimeValue);
            replacementTarget = replacement.target;
            replacementValue = replacement.value;
            break;
          }
          case "number":
            replacementValue = Number.isNaN(Number(runtimeValue)) ? "0" : Number(runtimeValue);
            break;
          case "boolean":
            replacementValue = (runtimeValue === "true" || runtimeValue === true) ? "true" : "false";
            break;
          case "date": {
            const replacement = getStringReplacement(variable, runtimeValue);
            replacementTarget = replacement.target;
            replacementValue = replacement.value;
            break;
          }
          default: {
            const replacement = getStringReplacement(variable, runtimeValue);
            replacementTarget = replacement.target;
            replacementValue = replacement.value;
          }
        }
      } else {
        const replacement = getStringReplacement(variable, runtimeValue);
        replacementTarget = replacement.target;
        replacementValue = replacement.value;
      }

      processedQuery = processedQuery.replace(replacementTarget, replacementValue);
    } else if (hasDefaultValue && binding) {
      let replacementValue = binding.default_value;
      let replacementTarget = variable.placeholder;

      switch (binding.type) {
        case "string": {
          const replacement = getStringReplacement(variable, binding.default_value);
          replacementTarget = replacement.target;
          replacementValue = replacement.value;
          break;
        }
        case "number":
          replacementValue = Number.isNaN(Number(binding.default_value)) ? "0" : Number(binding.default_value);
          break;
        case "boolean":
          replacementValue = binding.default_value === "true" || binding.default_value === true ? "true" : "false";
          break;
        case "date": {
          const replacement = getStringReplacement(variable, binding.default_value);
          replacementTarget = replacement.target;
          replacementValue = replacement.value;
          break;
        }
        default: {
          const replacement = getStringReplacement(variable, binding.default_value);
          replacementTarget = replacement.target;
          replacementValue = replacement.value;
        }
      }

      processedQuery = processedQuery.replace(replacementTarget, replacementValue);
    } else {
      if (binding?.required) {
        throw new Error(`Required variable '${variable.name}' has no value provided and no default value`);
      }

      processedQuery = processedQuery.replace(variable.placeholder, variable.isAlreadyQuoted ? "" : "\"\"");
    }
  });

  return {
    dataRequest: originalDataRequest,
    processedQuery,
  };
}

async function closeMongoConnection(mongoConnection) {
  if (!mongoConnection || typeof mongoConnection.close !== "function") {
    return;
  }

  try {
    await mongoConnection.close();
  } catch {
    // no-op
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

function getConnectionUrl(connection) {
  return assembleMongoUrl(connection);
}

async function createMongoConnection(connection, options = {}) {
  const savedConnection = await getSavedConnection(connection);
  const mongoConnection = mongoose.createConnection(
    getConnectionUrl(savedConnection),
    getMongoConnectionOptions(options)
  );
  await mongoConnection.asPromise();
  return {
    savedConnection,
    mongoConnection,
  };
}

async function testConnection({ connection }) {
  let mongoConnection;

  try {
    const result = await createMongoConnection(connection);
    mongoConnection = result.mongoConnection;

    return {
      success: true,
    };
  } finally {
    await closeMongoConnection(mongoConnection);
  }
}

async function testUnsavedConnection({ connection }) {
  let mongoConnection;

  try {
    const result = await createMongoConnection(connection, {
      connectTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,
    });
    mongoConnection = result.mongoConnection;
    const collections = await mongoConnection.db.listCollections().toArray();

    return {
      success: true,
      collections,
    };
  } finally {
    await closeMongoConnection(mongoConnection);
  }
}

async function executeMongoQuery({ connection, query, connectTimeoutMS }) {
  let mongoConnection;
  const formattedQuery = getQueryToExecute(query);

  try {
    const result = await createMongoConnection(connection, {
      connectTimeoutMS,
      socketTimeoutMS: connectTimeoutMS,
    });
    mongoConnection = result.mongoConnection;

    let data;
    try {
      data = await Function(`'use strict';return (mongoConnection, ObjectId) => mongoConnection.${formattedQuery}.toArray()`)()(mongoConnection, ObjectId); // eslint-disable-line
    } catch {
      data = await Function(`'use strict';return (mongoConnection, ObjectId) => mongoConnection.${formattedQuery}`)()(mongoConnection, ObjectId); // eslint-disable-line
    }

    let finalData = data;
    if (finalData && typeof finalData?.next === "function") {
      finalData = await finalData.toArray();
    }
    if (formattedQuery.indexOf("count(") > -1) {
      finalData = { count: finalData };
    }

    return stringifyMongoIds(finalData);
  } finally {
    await closeMongoConnection(mongoConnection);
  }
}

async function previewDataRequest({ connection, dataRequest }) {
  const finalData = await executeMongoQuery({
    connection,
    query: dataRequest.query,
    connectTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,
  });

  return {
    responseData: {
      data: finalData,
    },
  };
}

async function addSchemaUpdateJob(connectionId) {
  const connection = await db.Connection.findByPk(connectionId);

  if (!connection) {
    throw new Error("Connection not found");
  }

  if (connection.type !== "mongodb") {
    throw new Error("Connection is not a MongoDB connection");
  }

  const queue = new Queue("updateMongoDBSchemaQueue", getQueueOptions());
  const job = await queue.add(`update-mongo-schema-${connectionId}`, { connection_id: connectionId }, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  });

  return job.waitUntilFinished(queue);
}

function afterConnectionCreated({ connection }) {
  return addSchemaUpdateJob(connection.id);
}

async function updateSchema({ connection }) {
  await updateMongoSchemaWorker({
    data: {
      connection_id: connection.id,
    },
  });

  return db.Connection.findByPk(connection.id);
}

async function getSchema({ connection }) {
  if (connection?.schema) {
    return connection.schema;
  }

  const updatedConnection = await updateSchema({ connection });
  return updatedConnection?.schema;
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
        connectionType: "mongodb",
        ...serializeResponsePreview(drCache.responseData),
      });
      return drCache;
    }
  }

  try {
    const finalData = await executeMongoQuery({
      connection,
      query: processedQuery || dataRequest.query,
      connectTimeoutMS: 100000,
    });

    const dataToCache = {
      dataRequest,
      responseData: {
        data: finalData,
      },
      connection_id: connection.id,
    };

    await drCacheController.create(dataRequest.id, dataToCache);
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType: "mongodb",
      ...serializeResponsePreview(dataToCache.responseData),
    });

    addSchemaUpdateJob(connection.id).catch(() => {});

    return dataToCache;
  } catch (error) {
    await failConnectorAudit(auditContext, error, error.auditStage || "connection", {
      cacheHit: false,
      connectionType: "mongodb",
    });
    return Promise.reject(error);
  }
}

function runChartQuery({ connection, query }) {
  return executeMongoQuery({
    connection,
    query,
    connectTimeoutMS: 30000,
  });
}

function generateQuery({
  schema,
  question,
  conversationHistory,
  currentQuery,
}) {
  return generateMongoQuery(schema, question, conversationHistory, currentQuery);
}

module.exports = {
  addSchemaUpdateJob,
  applyVariables({ dataRequest, variables }) {
    return applyMongoVariables(dataRequest, variables);
  },
  applyMongoVariables,
  afterConnectionCreated,
  generateQuery,
  getConnectionUrl,
  getQueryToExecute,
  getSchema,
  previewDataRequest,
  runChartQuery,
  runDataRequest,
  stringifyMongoIds,
  testConnection,
  testUnsavedConnection,
  updateSchema,
};
