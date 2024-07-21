const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Project", "updateSchedule", {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: "{}",
    });
    await queryInterface.addColumn("Project", "lastUpdatedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Project", "updateSchedule");
    await queryInterface.removeColumn("Project", "lastUpdatedAt");
  },
};
