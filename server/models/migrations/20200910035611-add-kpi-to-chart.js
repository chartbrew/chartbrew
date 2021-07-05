const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Chart", "mode", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "chart",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Chart", "mode");
  }
};
