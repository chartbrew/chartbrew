import mcpLogo from "./assets/mcp.svg";

const mcpSource = {
  id: "mcp",
  type: "mcp",
  subType: "mcp",
  name: "MCP server",
  category: "integrations",
  showNewBadge: true,
  capabilities: {
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
    nextSteps: {
      connectionAfterCreate: true,
    },
  },
  assets: {
    lightLogo: mcpLogo,
    darkLogo: mcpLogo,
  },
  defaults: {
    dataRequest: {
      method: "POST",
      template: "mcp",
      useGlobalHeaders: true,
      configuration: {
        source: "mcp",
        tool: { name: "", contractFingerprint: "" },
        arguments: {},
        output: { mode: "auto", path: [] },
      },
    },
  },
};

export default mcpSource;
