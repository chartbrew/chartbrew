const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Project", "logoLink", {
      type: Sequelize.STRING(1234),
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Project", "logoLink");
  },
};
