const Sequelize = require("sequelize");

const migrateProjectsToTeamRole = require("../scripts/migrateProjectsToTeamRole");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("TeamRole", "projects", {
      type: Sequelize.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("projects"));
        } catch (e) {
          return this.getDataValue("projects");
        }
      },
      set(val) {
        return this.setDataValue("projects", JSON.stringify(val));
      }
    });

    await migrateProjectsToTeamRole.up();
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("TeamRole", "projects");
  }
};
