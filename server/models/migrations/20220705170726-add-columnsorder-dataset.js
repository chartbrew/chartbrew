const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "columnsOrder", {
      type: Sequelize.TEXT,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "columnsOrder");
  }
};
