const db = require("../../../../models/models");
const { SUPPORTED_CONNECTIONS, isConnectionSupported } = require("../entityCreationRules");

async function listConnections(payload) {
  const { project_id } = payload; // scope could be used for filtering in the future

  const whereClause = {};

  // If project_id is provided, filter by connections used in that project
  if (project_id) {
    const datasets = await db.Dataset.findAll({
      attributes: ["connection_id"],
      include: [{
        model: db.DataRequest,
        attributes: ["connection_id"],
      }],
    });

    const connectionIds = new Set();
    datasets.forEach((ds) => {
      if (ds.connection_id) connectionIds.add(ds.connection_id);
      if (ds.DataRequests) {
        ds.DataRequests.forEach((dr) => {
          if (dr.connection_id) connectionIds.add(dr.connection_id);
        });
      }
    });

    if (connectionIds.size > 0) {
      whereClause.id = Array.from(connectionIds);
    }
  }

  // Only support MySQL, PostgreSQL, and MongoDB connections for now
  const supportedTypes = Object.keys(SUPPORTED_CONNECTIONS);

  const connections = await db.Connection.findAll({
    where: {
      ...whereClause,
      type: supportedTypes
    },
    attributes: ["id", "type", "subType", "name"],
    order: [["createdAt", "DESC"]],
  });

  // Filter connections to only include supported subtypes
  const filteredConnections = connections.filter(
    (conn) => isConnectionSupported(conn.type, conn.subType)
  );

  return {
    connections: filteredConnections.map((c) => ({
      id: c.id,
      type: c.type,
      subType: c.subType,
      name: c.name,
    })),
  };
}

module.exports = listConnections;
