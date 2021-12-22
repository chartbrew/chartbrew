const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Chart", "xLabelTicks", {
      type: Sequelize.STRING,
      defaultValue: "default",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Chart", "xLabelTicks");
  }
};
