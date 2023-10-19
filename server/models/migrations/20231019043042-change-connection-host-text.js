const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn("Connection", "host", {
      type: Sequelize.TEXT,
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn("Connection", "host", {
      type: Sequelize.STRING,
    });
  }
};
