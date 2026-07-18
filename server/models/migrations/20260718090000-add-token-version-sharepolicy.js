const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("SharePolicy", "token_version", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.changeColumn("SharePolicy", "token_version", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 2,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("SharePolicy", "token_version");
  }
};
