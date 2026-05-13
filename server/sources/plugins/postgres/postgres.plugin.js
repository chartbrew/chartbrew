const postgresProtocol = require("./postgres.protocol");
const {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
} = require("../../shared/ai/queryGenerationInstructions");

module.exports = {
  id: "postgres",
  type: "postgres",
  subType: "postgres",
  name: "PostgreSQL",
  category: "database",
  description: "Connect to PostgreSQL databases and run SQL queries.",

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
    ...postgresProtocol,
    ai: {
      getCapabilities: () => getQueryGenerationCapabilities("postgres"),
      getSchema: postgresProtocol.getSchema,
      generateQuery: postgresProtocol.generateQuery,
      instructions: getQueryGenerationInstructions("postgres"),
    },
  },
};
