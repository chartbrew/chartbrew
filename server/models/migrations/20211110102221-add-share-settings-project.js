const Sequlize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Project", "public", {
      type: Sequlize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn("Project", "passwordProtected", {
      type: Sequlize.BOOLEAN,
      defaultValue: false,
    });
    await queryInterface.addColumn("Project", "password", {
      type: Sequlize.STRING,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Project", "public");
    await queryInterface.removeColumn("Project", "passwordProtected");
    await queryInterface.removeColumn("Project", "password");
  }
};
