const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("DataRequest", "configuration", {
      type: Sequelize.TEXT,
      set(val) {
        return this.setDataValue("configuration", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("configuration"));
        } catch (e) {
          return this.getDataValue("configuration");
        }
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("DataRequest", "configuration");
  }
};
