const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "configuration", {
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
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "configuration");
  }
};
