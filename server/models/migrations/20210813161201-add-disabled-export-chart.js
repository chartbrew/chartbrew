const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Chart", "disabledExport", {
      type: Sequelize.BOOLEAN,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Chart", "disabledExport");
  }
};
