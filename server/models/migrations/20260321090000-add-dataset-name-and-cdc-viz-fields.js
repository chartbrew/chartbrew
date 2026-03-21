const Sequelize = require("sequelize");
const migrateDatasetVizToCdc = require("../scripts/migrateDatasetVizToCdc");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "name", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "xAxis", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "xAxisOperation", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "yAxis", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "yAxisOperation", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "dateField", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "dateFormat", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "conditions", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });

    await migrateDatasetVizToCdc.up(queryInterface);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ChartDatasetConfig", "conditions");
    await queryInterface.removeColumn("ChartDatasetConfig", "dateFormat");
    await queryInterface.removeColumn("ChartDatasetConfig", "dateField");
    await queryInterface.removeColumn("ChartDatasetConfig", "yAxisOperation");
    await queryInterface.removeColumn("ChartDatasetConfig", "yAxis");
    await queryInterface.removeColumn("ChartDatasetConfig", "xAxisOperation");
    await queryInterface.removeColumn("ChartDatasetConfig", "xAxis");
    await queryInterface.removeColumn("Dataset", "name");
  }
};
