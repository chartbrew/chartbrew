const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "fieldsMetadata", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "vizVersion", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ChartDatasetConfig", "vizConfig", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ChartDatasetConfig", "vizConfig");
    await queryInterface.removeColumn("ChartDatasetConfig", "vizVersion");
    await queryInterface.removeColumn("Dataset", "fieldsMetadata");
  }
};
