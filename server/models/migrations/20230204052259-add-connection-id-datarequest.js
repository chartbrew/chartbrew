const Sequelize = require("sequelize");

const moveDatasetConnectionToDr = require("../scripts/moveDatasetConnectionToDr");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("DataRequest", "connection_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      reference: {
        model: "Connection",
        key: "id",
        onDelete: "cascade",
      },
    });

    await moveDatasetConnectionToDr.up();
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("DataRequest", "connection_id");
  },
};
