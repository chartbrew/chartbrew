import mcpLogoLight from "./assets/logo-light.png";
import mcpLogoDark from "./assets/logo-dark.png";
import atlassianLogo from "./assets/atlassian.svg";
import posthogLogo from "./assets/posthog.svg";
import linearLogoLight from "./assets/linear-light.svg";
import linearLogoDark from "./assets/linear-dark.svg";
import sentryLogoLight from "./assets/sentry-light.svg";
import sentryLogoDark from "./assets/sentry-dark.svg";
import notionLogoLight from "./assets/notion-light.svg";
import notionLogoDark from "./assets/notion-dark.svg";
import stripeLogo from "../stripe/assets/logo-light.svg";
import mixpanelLogoLight from "./assets/mixpanel-light.svg";
import mixpanelLogoDark from "./assets/mixpanel-dark.svg";
import supabaseLogo from "../supabasedb/assets/logo-light.png";
import amplitudeLogo from "./assets/amplitude.svg";
import airtableLogo from "./assets/airtable.svg";
import attioLogoLight from "./assets/attio-light.svg";
import attioLogoDark from "./assets/attio-dark.svg";
import todoistLogo from "./assets/todoist.svg";
import motherduckLogo from "./assets/motherduck.svg";
import honeycombLogo from "./assets/honeycomb.svg";

const mcpSource = {
  id: "mcp",
  type: "mcp",
  subType: "mcp",
  name: "MCP server",
  description: "Connect another MCP service with its URL.",
  category: "integrations",
  providers: {
    atlassian: { name: "Atlassian", assets: { lightLogo: atlassianLogo, darkLogo: atlassianLogo } },
    posthog: { name: "PostHog", assets: { lightLogo: posthogLogo, darkLogo: posthogLogo } },
    linear: { name: "Linear", assets: { lightLogo: linearLogoLight, darkLogo: linearLogoDark } },
    sentry: { name: "Sentry", assets: { lightLogo: sentryLogoLight, darkLogo: sentryLogoDark } },
    notion: { name: "Notion", assets: { lightLogo: notionLogoLight, darkLogo: notionLogoDark } },
    stripe: { name: "Stripe", assets: { lightLogo: stripeLogo, darkLogo: stripeLogo } },
    mixpanel: { name: "Mixpanel", assets: { lightLogo: mixpanelLogoLight, darkLogo: mixpanelLogoDark } },
    supabase: { name: "Supabase", assets: { lightLogo: supabaseLogo, darkLogo: supabaseLogo } },
    amplitude: { name: "Amplitude", assets: { lightLogo: amplitudeLogo, darkLogo: amplitudeLogo } },
    airtable: { name: "Airtable", assets: { lightLogo: airtableLogo, darkLogo: airtableLogo } },
    attio: { name: "Attio", assets: { lightLogo: attioLogoLight, darkLogo: attioLogoDark } },
    motherduck: { name: "MotherDuck", assets: { lightLogo: motherduckLogo, darkLogo: motherduckLogo } },
    honeycomb: { name: "Honeycomb", assets: { lightLogo: honeycombLogo, darkLogo: honeycombLogo } },
    todoist: { name: "Todoist", assets: { lightLogo: todoistLogo, darkLogo: todoistLogo } },
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
