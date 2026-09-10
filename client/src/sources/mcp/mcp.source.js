import mcpLogoLight from "./assets/mcp-light.svg";
import mcpLogoDark from "./assets/mcp-dark.svg";
import posthogLogo from "./assets/posthog.svg";

const mcpSource = {
  id: "mcp",
  type: "mcp",
  subType: "mcp",
  name: "MCP server",
  category: "integrations",
  providers: {
    posthog: { name: "PostHog", assets: { lightLogo: posthogLogo, darkLogo: posthogLogo } },
  },
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
    lightLogo: mcpLogoLight,
    darkLogo: mcpLogoDark,
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
