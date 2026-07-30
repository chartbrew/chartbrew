const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("MetricMonitor");
    if (!columns.created_by) return;
    await queryInterface.changeColumn("MetricMonitor", "created_by", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "User", key: "id" },
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("MetricMonitor");
    if (!columns.created_by) return;
    await queryInterface.changeColumn("MetricMonitor", "created_by", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "User", key: "id" },
      onDelete: "CASCADE",
    });
  },
};
