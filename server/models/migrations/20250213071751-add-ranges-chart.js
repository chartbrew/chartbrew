const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Chart", "ranges", {
      type: Sequelize.TEXT,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Chart", "ranges");
  }
};
