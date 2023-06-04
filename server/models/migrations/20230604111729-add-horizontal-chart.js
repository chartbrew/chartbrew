const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "horizontal", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "horizontal");
  }
};
