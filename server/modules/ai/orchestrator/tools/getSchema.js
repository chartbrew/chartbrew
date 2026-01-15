const db = require("../../../../models/models");
const { isConnectionSupported } = require("../entityCreationRules");

async function getSchema(payload) {
  const { connection_id, include_samples = true } = payload;
  // sample_rows_per_entity could be used when extracting samples in the future

  const connection = await db.Connection.findByPk(connection_id);
  if (!connection) {
    throw new Error("Connection not found");
  }

  // Check if connection type and subtype are supported
  if (!isConnectionSupported(connection.type, connection.subType)) {
    throw new Error(`Connection type '${connection.type}'${connection.subType ? `/${connection.subType}` : ""} is not supported. Currently only MySQL, PostgreSQL, and MongoDB connections are supported. API connections and other sources will be available in future updates.`);
  }

  // For supported database connections, return schema
  return {
    dialect: connection.type,
    connection_id: connection.id,
    name: connection.name,
    entities: connection.schema || [],
    samples: include_samples ? {} : undefined,
  };
}

module.exports = getSchema;
