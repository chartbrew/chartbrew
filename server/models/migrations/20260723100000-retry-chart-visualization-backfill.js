const { migrateChartVisualization } = require("../scripts/migrateChartVisualization");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const report = await migrateChartVisualization(queryInterface);
    if (report.failed > 0) {
      process.stderr.write(
        `[visualization migration] ${report.failed} chart specifications still could not be migrated: `
        + `${JSON.stringify(report.failures)}\n`
      );
    }
  },

  async down() {
    // This migration retries a derived-data backfill without changing the schema.
  },
};
