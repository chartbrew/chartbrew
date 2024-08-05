const { Sequelize } = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn("Project", "updateSchedule", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn("Project", "updateSchedule", {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: "{}",
    });
  },
};
