const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Dataset", "groups", {
      type: Sequelize.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("groups"));
        } catch (e) {
          return this.getDataValue("groups");
        }
      },
      set(val) {
        return this.setDataValue("groups", JSON.stringify(val));
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Dataset", "groups");
  }
};
