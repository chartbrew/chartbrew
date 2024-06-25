const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Connection", "schema", {
      type: Sequelize.TEXT("long"),
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Connection", "schema");
  },
};
