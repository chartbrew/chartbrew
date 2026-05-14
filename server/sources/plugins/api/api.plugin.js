const apiAi = require("./ai/api.ai");
const apiProtocol = require("../../shared/protocols/api.protocol");

module.exports = {
  id: "api",
  type: "api",
  name: "API",
  category: "api",
  description: "Connect to REST-like HTTP APIs with headers, authentication, variables, and pagination.",

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: ["no_auth", "basic_auth", "bearer_token", "headers"],
    },
    data: {
      supportsQuery: false,
      supportsSchema: false,
      supportsResourcePicker: false,
      supportsPagination: true,
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
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },

  backend: {
    ...apiProtocol,
    ai: apiAi,
  },
};
