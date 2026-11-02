const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("TeamBusinessProfile", "homeSuggestions", { type: Sequelize.TEXT });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("TeamBusinessProfile", "homeSuggestions");
  },
};
