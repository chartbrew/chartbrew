const Sequelize = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Project", "lastSnapshotSentAt", {
      type: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Project", "lastSnapshotSentAt");
  },
};
