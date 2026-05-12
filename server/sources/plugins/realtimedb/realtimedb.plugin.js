const realtimeDbAi = require("./ai/realtimedb.ai");
const realtimeDbProtocol = require("./realtimedb.protocol");

module.exports = {
  id: "realtimedb",
  type: "realtimedb",
  subType: "realtimedb",
  name: "Realtime DB",
  category: "database",
  description: "Connect to Firebase Realtime Database and query JSON paths.",
  capabilities: {
    connection: {
      supportsTest: true,
      supportsOAuth: false,
      supportsFiles: false,
      authModes: ["service_account"],
    },
    data: {
      supportsQuery: true,
      supportsSchema: false,
      supportsResourcePicker: false,
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
    ...realtimeDbProtocol,
    ai: realtimeDbAi,
  },
};
