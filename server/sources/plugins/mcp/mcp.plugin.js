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
    actions: ["startOAuth", "updateToolApproval"],
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
    async exploreReadOnly({ connection, operation, configuration, search, names, limit = 20 }) {
      if (operation === "inspect") {
        const catalog = mcpAi.listResources({ connection, query: search, names });
        return { ...catalog, truncated: catalog.truncated || catalog.resources.length > limit,
          resources: catalog.resources.slice(0, limit).map((resource) => ({
            ...resource,
            contractFingerprint: connection.schema.mcp.tools.find((tool) => tool.name === resource.id)?.contractFingerprint,
          })) };
      }
      const validation = mcpAi.validateConfiguration(configuration, { connection });
      if (!validation.valid) return { status: "invalid", errors: validation.errors };
      const approval = connection.schema?.mcp?.allowedTools?.[configuration.tool.name];
      if (!approval?.datasets) return { status: "invalid", errors: ["Allow this tool in the connection settings first."] };
      const preview = await mcpAi.previewConfiguration({ connection, configuration: validation.configuration, rowLimit: limit });
      return { ...preview, dataRequest: { configuration: validation.configuration, method: "GET" } };
    },
    ai: mcpAi,
  },
};
