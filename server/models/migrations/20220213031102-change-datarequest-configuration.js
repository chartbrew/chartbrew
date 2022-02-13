const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn("DataRequest", "configuration", {
      type: Sequelize.TEXT("long"),
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

  async down(queryInterface) {
    await queryInterface.changeColumn("DataRequest", "configuration", {
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
  }
};
