const db = require("../../../models/models");
const apiProtocol = require("../../shared/protocols/api.protocol");
const { getTestConnection } = require("./privatusAnalytics.connection");

async function testUnsavedConnection({ connection }) {
  if (connection.type !== "api") {
    throw new Error("No request type specified");
  }

  return apiProtocol.testApi(getTestConnection(connection), apiProtocol.buildApiPolicyContext(
    "connection_type_test",
    null,
    {
      teamId: connection.team_id || null,
      connectionId: null,
      allowPrivateHost: false,
    }
  ));
}

async function testConnection({ connection }) {
  const savedConnection = connection?.id
    ? await db.Connection.findByPk(connection.id) || connection
    : connection;
  const response = await apiProtocol.testApi(
    getTestConnection(savedConnection),
    apiProtocol.buildApiPolicyContext("connection_test", savedConnection, { allowPrivateHost: false })
  );

  if (response.statusCode < 300) {
    return { success: true };
  }

  throw new Error(400);
}

module.exports = {
  ...apiProtocol,
  testConnection,
  testUnsavedConnection,
};
