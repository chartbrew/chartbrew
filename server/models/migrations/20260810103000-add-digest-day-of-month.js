const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("ObservationDigestSubscription");
    if (!columns.day_of_month) {
      await queryInterface.addColumn("ObservationDigestSubscription", "day_of_month", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("ObservationDigestSubscription");
    if (columns.day_of_month) {
      await queryInterface.removeColumn("ObservationDigestSubscription", "day_of_month");
    }
  },
};
