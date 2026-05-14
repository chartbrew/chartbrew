const mongodbProtocol = require("./mongodb.protocol");
const {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
} = require("../../shared/ai/queryGenerationInstructions");

module.exports = {
  id: "mongodb",
  type: "mongodb",
  subType: "mongodb",
  name: "MongoDB",
  category: "database",
  description: "Connect to MongoDB databases and run Mongo shell queries.",

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
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
    ...mongodbProtocol,
    ai: {
      getCapabilities: () => getQueryGenerationCapabilities("mongodb"),
      getSchema: mongodbProtocol.getSchema,
      generateQuery: mongodbProtocol.generateQuery,
      instructions: getQueryGenerationInstructions("mongodb"),
    },
  },
};
