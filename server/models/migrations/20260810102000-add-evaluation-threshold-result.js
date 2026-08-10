const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("MetricEvaluation");
    if (!columns.passes_threshold) {
      await queryInterface.addColumn("MetricEvaluation", "passes_threshold", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("MetricEvaluation");
    if (columns.passes_threshold) {
      await queryInterface.removeColumn("MetricEvaluation", "passes_threshold");
    }
  },
};
