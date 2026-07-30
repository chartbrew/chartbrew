const Sequelize = require("sequelize");

async function replaceCreatedByConstraint(queryInterface, onDelete) {
  const references = await queryInterface.getForeignKeyReferencesForTable("MetricMonitor");
  const constraints = references.filter((reference) => (
    reference.columnName === "created_by"
  ));

  for (const constraint of constraints) {
    // DDL is intentionally sequential so a failed migration can be retried safely.
    // eslint-disable-next-line no-await-in-loop
    await queryInterface.removeConstraint(
      "MetricMonitor",
      constraint.constraintName || constraint.constraint_name,
    );
  }

  await queryInterface.changeColumn("MetricMonitor", "created_by", {
    type: Sequelize.INTEGER,
    allowNull: true,
  });
  await queryInterface.addConstraint("MetricMonitor", {
    fields: ["created_by"],
    type: "foreign key",
    name: "metric_monitor_created_by_fk",
    references: {
      table: "User",
      field: "id",
    },
    onDelete,
  });
}

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("MetricMonitor");
    if (!columns.created_by) return;
    await replaceCreatedByConstraint(queryInterface, "SET NULL");
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("MetricMonitor");
    if (!columns.created_by) return;
    await replaceCreatedByConstraint(queryInterface, "CASCADE");
  },
};
