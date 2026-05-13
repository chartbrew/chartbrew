const timescaledbProtocol = require("./timescaledb.protocol");
const {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
} = require("../../shared/ai/queryGenerationInstructions");

module.exports = {
  id: "timescaledb",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "timescaledb",
  name: "Timescale",
  category: "database",
  description: "Connect to TimescaleDB databases and run SQL queries.",

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
    ...timescaledbProtocol,
    ai: {
      getCapabilities: () => getQueryGenerationCapabilities("timescaledb"),
      getSchema: timescaledbProtocol.getSchema,
      generateQuery: timescaledbProtocol.generateQuery,
      instructions: getQueryGenerationInstructions("timescaledb"),
    },
  },
};
