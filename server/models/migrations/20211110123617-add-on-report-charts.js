const Sequelize = require("sequelize");

const migrateOnReport = require("../scripts/migrateOnReport");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Chart", "onReport", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await migrateOnReport.up();
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Chart", "onReport");
  },
};
