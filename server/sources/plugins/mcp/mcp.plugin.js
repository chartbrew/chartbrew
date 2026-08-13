const protocol = require("./mcp.protocol");
const mcpAi = require("./ai/mcp.ai");

module.exports = {
  id: "mcp",
  type: "mcp",
  subType: "mcp",
  name: "MCP server",
  category: "integrations",
  description: "Connect to a remote MCP server and use approved read-only tools as data sources.",

  capabilities: {
    actions: ["startOAuth"],
    connection: {
      supportsTest: true,
      supportsOAuth: true,
      supportsFiles: false,
      authModes: ["none", "bearer", "headers", "oauth"],
    },
    data: {
      supportsQuery: true,
      supportsSchema: true,
      supportsResourcePicker: true,
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
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },

  backend: {
    ...protocol,
    ai: mcpAi,
  },
};
