const { Op } = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkDelete("Observation", {
      monitor_id: { [Op.ne]: null },
    });
    await queryInterface.bulkDelete("MetricMonitor", {});
  },

  async down() {
    // Legacy observation data cannot be reconstructed after this development-only reset.
  },
};
