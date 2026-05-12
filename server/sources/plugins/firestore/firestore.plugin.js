const firestoreAi = require("./ai/firestore.ai");
const firestoreProtocol = require("./firestore.protocol");

module.exports = {
  id: "firestore",
  type: "firestore",
  subType: "firestore",
  name: "Firestore",
  category: "database",
  description: "Connect to Google Cloud Firestore and query collections.",

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
    ...firestoreProtocol,
    ai: firestoreAi,
  },
};
