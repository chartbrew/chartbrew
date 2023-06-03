const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "dateVarsFormat", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "dateVarsFormat");
  }
};
