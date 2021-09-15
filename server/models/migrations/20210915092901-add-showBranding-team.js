const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Team", "showBranding", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Team", "showBranding");
  }
};
