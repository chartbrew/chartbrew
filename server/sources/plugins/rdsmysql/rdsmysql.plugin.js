const rdsmysqlProtocol = require("./rdsmysql.protocol");
const {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
} = require("../../shared/ai/queryGenerationInstructions");

module.exports = {
  id: "rdsMysql",
  dependsOn: ["mysql"],
  type: "mysql",
  subType: "rdsMysql",
  name: "RDS MySQL",
  category: "database",
  description: "Connect to Amazon RDS MySQL databases and run SQL queries.",

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
    ...rdsmysqlProtocol,
    ai: {
      getCapabilities: () => getQueryGenerationCapabilities("rdsMysql"),
      getSchema: rdsmysqlProtocol.getSchema,
      generateQuery: rdsmysqlProtocol.generateQuery,
      instructions: getQueryGenerationInstructions("rdsMysql"),
    },
  },
};
