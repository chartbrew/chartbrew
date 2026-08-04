const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("ObservationDigestSubscription");
    if (!columns.delivery_days) {
      await queryInterface.addColumn("ObservationDigestSubscription", "delivery_days", {
        type: Sequelize.JSON,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("ObservationDigestSubscription");
    if (columns.delivery_days) {
      await queryInterface.removeColumn("ObservationDigestSubscription", "delivery_days");
    }
  },
};
