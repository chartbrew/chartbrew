const supabasedbProtocol = require("./supabasedb.protocol");
const {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
} = require("../../shared/ai/queryGenerationInstructions");

module.exports = {
  id: "supabasedb",
  dependsOn: ["postgres"],
  type: "postgres",
  subType: "supabasedb",
  name: "Supabase DB",
  category: "database",
  description: "Connect to Supabase Postgres databases and run SQL queries.",

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
    ...supabasedbProtocol,
    ai: {
      getCapabilities: () => getQueryGenerationCapabilities("supabasedb"),
      getSchema: supabasedbProtocol.getSchema,
      generateQuery: supabasedbProtocol.generateQuery,
      instructions: getQueryGenerationInstructions("supabasedb"),
    },
  },
};
