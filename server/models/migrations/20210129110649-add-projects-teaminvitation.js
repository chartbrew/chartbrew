const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("TeamInvitation", "projects", {
      type: Sequelize.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("projects"));
        } catch (e) {
          return this.getDataValue("projects");
        }
      },
      set(value) {
        return this.setDataValue("projects", JSON.stringify(value));
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("TeamInvitation", "projects");
  }
};
