const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.changeColumn("Dataset", "yAxisOperation", {
      type: Sequelize.STRING,
      defaultValue: "none",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.changeColumn("Dataset", "yAxisOperation", {
      type: Sequelize.STRING,
    });
  }
};
