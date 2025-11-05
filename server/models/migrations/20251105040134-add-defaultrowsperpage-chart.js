const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "defaultRowsPerPage", {
      type: Sequelize.INTEGER,
      defaultValue: 10,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "defaultRowsPerPage");
  }
};
