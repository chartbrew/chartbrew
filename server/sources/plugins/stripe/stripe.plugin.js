const path = require("path");

const apiProtocol = require("../../shared/protocols/api.protocol");

const DEFAULT_DATA_REQUEST = {
  headers: {},
  body: "null",
  conditions: null,
  configuration: null,
  method: "GET",
  useGlobalHeaders: true,
  query: null,
  pagination: true,
  items: "data",
  itemsLimit: 1000,
  offset: "starting_after",
  paginationField: null,
  template: "stripe",
};

module.exports = {
  id: "stripe",
  type: "api",
  subType: "stripe",
  name: "Stripe Legacy",
  category: "payments",
  description: "Connect to Stripe reporting data through the Stripe API.",

  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: ["basic_auth"],
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
      dashboards: true,
    },
    ai: {
      canGenerateDatasets: false,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: false,
    },
  },

  backend: {
    ...apiProtocol,
    getDefaultDataRequest() {
      return { ...DEFAULT_DATA_REQUEST };
    },
  },

  templates: {
    directory: path.join(__dirname, "templates"),
    chartTemplates: ["core-revenue"],
    defaults: {
      dataRequest: DEFAULT_DATA_REQUEST,
    },
  },
};
