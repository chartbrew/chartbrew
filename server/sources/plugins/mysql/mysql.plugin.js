const mysqlProtocol = require("./mysql.protocol");
const {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
} = require("../../shared/ai/queryGenerationInstructions");

module.exports = {
  id: "mysql",
  type: "mysql",
  subType: "mysql",
  name: "MySQL",
  category: "database",
  description: "Connect to MySQL databases and run SQL queries.",

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: true,
      authModes: ["connection_string", "credentials"],
    },
    data: {
      supportsQuery: true,
      supportsSchema: true,
      supportsResourcePicker: false,
      supportsPagination: false,
      supportsVariables: true,
      supportsJoins: true,
    },
    templates: {
      datasets: false,
      charts: false,
      dashboards: false,
    },
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: true,
      hasSourceInstructions: true,
      hasTools: false,
    },
  },

  backend: {
    ...mysqlProtocol,
    ai: {
      getCapabilities: () => getQueryGenerationCapabilities("mysql"),
      getSchema: mysqlProtocol.getSchema,
      generateQuery: mysqlProtocol.generateQuery,
      instructions: getQueryGenerationInstructions("mysql"),
    },
  },
};
