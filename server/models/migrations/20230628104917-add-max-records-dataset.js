const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "maxRecords", {
      type: Sequelize.INTEGER,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "maxRecords");
  }
};
