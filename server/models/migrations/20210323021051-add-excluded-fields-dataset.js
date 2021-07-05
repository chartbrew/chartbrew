const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn("Dataset", "excludedFields", {
      type: Sequelize.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("excludedFields"));
        } catch (e) {
          return this.getDataValue("excludedFields");
        }
      },
      set(val) {
        return this.setDataValue("excludedFields", JSON.stringify(val));
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Dataset", "excludedFields");
  },
};
