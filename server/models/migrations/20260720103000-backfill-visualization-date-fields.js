const {
  backfillVisualizationDateFields,
} = require("../scripts/backfillVisualizationDateFields");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await backfillVisualizationDateFields(queryInterface);
  },

  async down() {
    // Existing date fields cannot be distinguished safely from values added by this backfill.
  },
};
