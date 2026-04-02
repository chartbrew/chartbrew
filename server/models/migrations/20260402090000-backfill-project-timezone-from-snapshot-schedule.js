const backfillProjectTimezoneFromSnapshotSchedule = require("../scripts/backfillProjectTimezoneFromSnapshotSchedule");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await backfillProjectTimezoneFromSnapshotSchedule.up(queryInterface);
  },

  async down() {
    await backfillProjectTimezoneFromSnapshotSchedule.down();
  },
};
