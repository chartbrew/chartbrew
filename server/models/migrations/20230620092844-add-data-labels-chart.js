const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "dataLabels", {
      type: Sequelize.BOOLEAN,
      deafultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "dataLabels");
  }
};
