const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Project", "updateSchedule", {
      type: Sequelize.TEXT,
    });
    await queryInterface.addColumn("Project", "lastUpdatedAt", {
      type: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Project", "updateSchedule");
    await queryInterface.removeColumn("Project", "lastUpdatedAt");
  },
};
