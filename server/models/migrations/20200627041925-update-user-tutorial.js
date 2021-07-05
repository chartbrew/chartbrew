const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    return queryInterface.addColumn("User", "tutorials", {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: "{}",
      set(val) {
        try {
          return this.setDataValue("tutorials", JSON.stringify(val));
        } catch (e) {
          return this.setDataValue("tutorials", val);
        }
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("tutorials"));
        } catch (e) {
          return this.getDataValue("tutorials");
        }
      },
    });
  },

  down: async (queryInterface) => {
    return queryInterface.removeColumn("User", "tutorials");
  },
};
