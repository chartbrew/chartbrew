const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("Team");
    if (!columns.aiEnabled) {
      await queryInterface.addColumn("Team", "aiEnabled", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("Team");
    if (columns.aiEnabled) {
      await queryInterface.removeColumn("Team", "aiEnabled");
    }
  },
};
