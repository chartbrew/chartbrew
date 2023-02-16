const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "joinSettings", {
      type: Sequelize.TEXT,
      set(val) {
        return this.setDataValue("joinSettings", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("joinSettings"));
        } catch (e) {
          return this.getDataValue("joinSettings");
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "joinSettings");
  },
};
