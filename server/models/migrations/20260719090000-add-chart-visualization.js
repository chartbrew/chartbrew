const Sequelize = require("sequelize");
const { migrateChartVisualization } = require("../scripts/migrateChartVisualization");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "visualization", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });

    const report = await migrateChartVisualization(queryInterface);
    if (report.failed > 0) {
      throw new Error(`Failed to migrate ${report.failed} chart visualization specifications`);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "visualization");
  },
};
