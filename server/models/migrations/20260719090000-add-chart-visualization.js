const Sequelize = require("sequelize");
const { migrateChartVisualization } = require("../scripts/migrateChartVisualization");

function reportFailures(report, action) {
  if (report.failed === 0) return;

  process.stderr.write(
    `[visualization migration] ${report.failed} chart specifications could not be ${action}: `
    + `${JSON.stringify(report.failures)}\n`
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("Chart");
    if (!columns.visualization) {
      await queryInterface.addColumn("Chart", "visualization", {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      });
    }

    const report = await migrateChartVisualization(queryInterface);
    reportFailures(report, "migrated");
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("Chart");
    if (columns.visualization) {
      await queryInterface.removeColumn("Chart", "visualization");
    }
  },
};
