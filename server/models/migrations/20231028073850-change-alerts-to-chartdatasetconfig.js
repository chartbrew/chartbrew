const Sequelize = require("sequelize");
const migrateAlertsToCdc = require("../scripts/migrateAlertsToCdc");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Alert", "cdc_id", {
      type: Sequelize.UUID,
      allowNull: false,
      reference: {
        model: "ChartDatasetConfig",
        key: "id",
        onDelete: "cascade",
      },
    });

    migrateAlertsToCdc.up(queryInterface);

    await queryInterface.removeColumn("Alert", "dataset_id");
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Alert", "cdc_id");

    await queryInterface.addColumn("Alert", "dataset_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      reference: {
        model: "Dataset",
        key: "id",
        onDelete: "cascade",
      },
    });
  }
};
