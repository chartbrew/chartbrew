const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("DataRequest", "conditions", {
      type: Sequelize.TEXT,
      set(val) {
        return this.setDataValue("conditions", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("conditions"));
        } catch (e) {
          return this.getDataValue("conditions");
        }
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("DataRequest", "conditions");
  }
};
