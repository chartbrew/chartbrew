const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Connection", "allowPrivateHost", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.bulkUpdate(
      "Connection",
      { allowPrivateHost: true },
      { type: "api" }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Connection", "allowPrivateHost");
  },
};
