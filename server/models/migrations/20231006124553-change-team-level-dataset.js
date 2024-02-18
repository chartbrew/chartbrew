const Sequelize = require("sequelize");
const populateDatasetTeamId = require("../scripts/populateDatasetTeamId");

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn("Dataset", "team_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    });

    await queryInterface.addColumn("Dataset", "project_ids", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await populateDatasetTeamId.up();

    await queryInterface.changeColumn("Dataset", "team_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Dataset", "team_id");
    await queryInterface.removeColumn("Dataset", "project_ids");
  }
};
