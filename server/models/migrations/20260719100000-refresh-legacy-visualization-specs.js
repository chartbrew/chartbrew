const { migrateChartVisualization } = require("../scripts/migrateChartVisualization");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const report = await migrateChartVisualization(queryInterface, {
      refreshLegacy: true,
    });
    if (report.failed > 0) {
      throw new Error(`Failed to refresh ${report.failed} legacy visualization specifications`);
    }
  },

  async down() {
    // This migration re-derives legacy-owned specs without changing the schema.
  },
};
