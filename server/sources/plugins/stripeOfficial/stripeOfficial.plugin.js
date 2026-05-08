const path = require("path");

const stripeOfficialAi = require("./ai/stripeOfficial.ai");
const stripeOfficialProtocol = require("./stripeOfficial.protocol");

module.exports = {
  id: "stripeOfficial",
  type: "stripeOfficial",
  subType: "stripeOfficial",
  name: "Stripe",
  category: "payments",
  description: "Connect to Stripe through a Stripe-specific analytics builder.",

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: ["api_key"],
    },
    data: {
      supportsQuery: false,
      supportsSchema: false,
      supportsResourcePicker: true,
      supportsPagination: true,
      supportsVariables: true,
      supportsJoins: true,
    },
    templates: {
      datasets: true,
      charts: true,
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
    ...stripeOfficialProtocol,
    ai: stripeOfficialAi,
  },

  templates: {
    directory: path.join(__dirname, "templates"),
    chartTemplates: ["compiled-metrics", "starter-metrics"],
    defaults: {
      dataRequest: stripeOfficialProtocol.getDefaultDataRequest(),
    },
  },
};
