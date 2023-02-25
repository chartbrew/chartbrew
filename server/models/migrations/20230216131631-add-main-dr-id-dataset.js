const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "main_dr_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      reference: {
        model: "DataRequest",
        key: "id",
        onDelete: "cascade",
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "main_dr_id");
  },
};
