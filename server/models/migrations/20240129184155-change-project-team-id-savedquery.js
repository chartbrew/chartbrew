const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    await queryInterface.addColumn("SavedQuery", "team_id", {
      type: Sequelize.INTEGER,
      allowNull: true, // Temporarily allow null
      references: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    });

    let savedQueries;
    if (dialect === "mysql") {
      savedQueries = await queryInterface.sequelize.query(`
        SELECT SavedQuery.*, Project.team_id FROM SavedQuery
        JOIN Project on SavedQuery.project_id = Project.id;
      `, { type: Sequelize.QueryTypes.SELECT });
    } else if (dialect === "postgres") {
      savedQueries = await queryInterface.sequelize.query(`
          SELECT "SavedQuery".*, "Project".team_id FROM "SavedQuery"
          JOIN "Project" on "SavedQuery".project_id = "Project".id;
        `, { type: Sequelize.QueryTypes.SELECT });
    }

    let newSavedQueries = [];
    if (savedQueries.length > 0) {
      newSavedQueries = savedQueries.map((savedQuery) => {
        return {
          ...savedQuery,
          team_id: savedQuery.team_id,
        };
      });
    }

    if (newSavedQueries.length > 0) {
      await queryInterface.bulkDelete("SavedQuery", null, {});
      await queryInterface.bulkInsert("SavedQuery", newSavedQueries);
    }

    await queryInterface.changeColumn("SavedQuery", "team_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    });

    await queryInterface.removeColumn("SavedQuery", "project_id");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("SavedQuery", "project_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      reference: {
        model: "Project",
        key: "id",
        onDelete: "cascade",
      },
    });

    await queryInterface.removeColumn("SavedQuery", "team_id");
  }
};
