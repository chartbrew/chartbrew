const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn("Connection", "project_id");
  },

  async down(queryInterface) {
    await queryInterface.addColumn("Connection", "project_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      reference: {
        model: "Project",
        key: "id",
        onDelete: "cascade",
      },
    });
  },
};
