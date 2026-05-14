const protocol = require("./googleAnalytics.protocol");
const googleAnalyticsAi = require("./ai/googleAnalytics.ai");

module.exports = {
  id: "googleAnalytics",
  type: "googleAnalytics",
  subType: "googleAnalytics",
  name: "Google Analytics",
  category: "analytics",
  description: "Connect to Google Analytics and query GA4 reports.",

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: true,
      supportsFiles: false,
      authModes: ["oauth"],
    },
    data: {
      supportsQuery: true,
      supportsSchema: false,
      supportsResourcePicker: true,
      supportsPagination: false,
      supportsVariables: false,
      supportsJoins: true,
    },
    templates: {
      datasets: false,
      charts: false,
      dashboards: true,
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
    ai: googleAnalyticsAi,
  },
};
