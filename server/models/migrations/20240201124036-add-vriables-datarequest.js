const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("DataRequest", "variables", {
      type: Sequelize.TEXT,
      set(val) {
        try {
          return this.setDataValue("variables", JSON.stringify(val));
        } catch (e) {
          return this.setDataValue("variables", val);
        }
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("variables"));
        } catch (e) {
          return this.getDataValue("variables");
        }
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("DataRequest", "variables");
  }
};
