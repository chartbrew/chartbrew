const path = require("path");

const protocol = require("./privatusAnalytics.protocol");

const DEFAULT_DATA_REQUEST = {
  headers: {},
  body: "null",
  conditions: null,
  configuration: null,
  method: "GET",
  useGlobalHeaders: true,
  query: null,
  pagination: false,
  items: "limit",
  itemsLimit: 100,
  offset: "page",
  paginationField: null,
  template: null,
};

module.exports = {
  id: "privatusAnalytics",
  dependsOn: ["api"],
  type: "api",
  subType: "privatusAnalytics",
  name: "Privatus Analytics",
  category: "analytics",
  description: "Connect to cookieless website analytics from Privatus Analytics.",

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
      supportsResourcePicker: false,
      supportsPagination: false,
      supportsVariables: true,
      supportsJoins: true,
    },
    templates: {
      datasets: true,
      charts: true,
      dashboards: false,
    },
    ai: {
      canGenerateDatasets: false,
      canGenerateQueries: false,
      hasSourceInstructions: false,
      hasTools: false,
    },
  },

  backend: {
    ...protocol,
    getDefaultDataRequest() {
      return { ...DEFAULT_DATA_REQUEST };
    },
  },

  templates: {
    directory: path.join(__dirname, "templates"),
    chartTemplates: ["site-overview"],
    defaults: {
      dataRequest: DEFAULT_DATA_REQUEST,
    },
  },
};
