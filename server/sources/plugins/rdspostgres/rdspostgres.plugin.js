const rdspostgresProtocol = require("./rdspostgres.protocol");
const {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
} = require("../../shared/ai/queryGenerationInstructions");

module.exports = {
  id: "rdsPostgres",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "rdsPostgres",
  name: "RDS Postgres",
  category: "database",
  description: "Connect to Amazon RDS Postgres databases and run SQL queries.",

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
    ...rdspostgresProtocol,
    ai: {
      getCapabilities: () => getQueryGenerationCapabilities("rdsPostgres"),
      getSchema: rdspostgresProtocol.getSchema,
      generateQuery: rdspostgresProtocol.generateQuery,
      instructions: getQueryGenerationInstructions("rdsPostgres"),
    },
  },
};
