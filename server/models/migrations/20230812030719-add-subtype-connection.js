const Sequelize = require("sequelize");

const adjustConnectionTypes = require("../scripts/adjustConnectionTypes");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Connection", "subType", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await adjustConnectionTypes.up();
  },

  async down(queryInterface) {
    await adjustConnectionTypes.down();
    await queryInterface.removeColumn("Connection", "subType");
  }
};
