const { migrateHorizontalBars } = require("../scripts/migrateHorizontalBars");

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface) {
    await migrateHorizontalBars(queryInterface);
  },

  async down(queryInterface) {
    await migrateHorizontalBars(queryInterface, { direction: "down" });
  },
};
