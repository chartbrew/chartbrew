const migrateToChartjsV3 = require("../scripts/migrateToChartjsV3");

module.exports = {
  up: async () => {
    return migrateToChartjsV3.up();
  },

  down: async () => {

  }
};
