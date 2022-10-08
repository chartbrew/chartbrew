const Sequelize = require("sequelize");

const migrateOrderToDataset = require("../scripts/migrateOrderToDatasets");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "order", {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });

    await migrateOrderToDataset.up();
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "order");
  }
};
