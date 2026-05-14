const CustomerioConnection = require("./customerio.connection");
const customerioAi = require("./ai/customerio.ai");
const customerioProtocol = require("./customerio.protocol");

const actions = {
  getAllSegments({ connection }) {
    return CustomerioConnection.getAllSegments(connection);
  },

  getAllCampaigns({ connection }) {
    return CustomerioConnection.getAllCampaigns(connection);
  },

  getCampaignLinks({ connection, params }) {
    return CustomerioConnection.getCampaignLinks(connection, params);
  },

  getCampaignActions({ connection, params }) {
    return CustomerioConnection.getCampaignActions(connection, params);
  },

  getAllObjectTypes({ connection }) {
    return CustomerioConnection.getAllObjectTypes(connection);
  },
};

module.exports = {
  id: "customerio",
  type: "customerio",
  subType: "customerio",
  name: "Customer.io",
  category: "marketing",
  description: "Connect to Customer.io people, campaign, and activity data.",

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: ["bearer_token"],
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
    actions: Object.keys(actions),
  },

  backend: {
    ...customerioProtocol,
    ai: customerioAi,
    actions,
  },
};
