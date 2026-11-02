const Sequelize = require("sequelize");

async function addColumnIfMissing(queryInterface, table, column, definition) {
  const columns = await queryInterface.describeTable(table);
  if (!columns[column]) await queryInterface.addColumn(table, column, definition);
}

module.exports = {
  async up(queryInterface) {
    await addColumnIfMissing(queryInterface, "ObservationDigestSubscription", "day_of_week", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await addColumnIfMissing(
      queryInterface,
      "ObservationDigestSubscription",
      "last_attempted_at",
      { type: Sequelize.DATE }
    );
    await addColumnIfMissing(
      queryInterface,
      "ObservationDigestSubscription",
      "last_delivery_status",
      { type: Sequelize.STRING }
    );
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("ObservationDigestSubscription");
    if (columns.last_delivery_status) {
      await queryInterface.removeColumn("ObservationDigestSubscription", "last_delivery_status");
    }
    if (columns.last_attempted_at) {
      await queryInterface.removeColumn("ObservationDigestSubscription", "last_attempted_at");
    }
    if (columns.day_of_week) {
      await queryInterface.removeColumn("ObservationDigestSubscription", "day_of_week");
    }
  },
};
