const Sequelize = require("sequelize");

function hasTable(tables, tableName) {
  return tables.some((table) => {
    if (typeof table === "string") return table === tableName;
    return table.tableName === tableName || table.table_name === tableName;
  });
}

module.exports = {
  async up(queryInterface) {
    const teamColumns = await queryInterface.describeTable("Team");

    if (!teamColumns.useCases) {
      await queryInterface.addColumn("Team", "useCases", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!teamColumns.onboardingCompletedAt) {
      await queryInterface.addColumn("Team", "onboardingCompletedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await queryInterface.bulkUpdate(
        "Team",
        { onboardingCompletedAt: new Date() },
        { onboardingCompletedAt: null }
      );
    }

    const tables = await queryInterface.showAllTables();
    if (!hasTable(tables, "TeamBusinessProfile")) {
      await queryInterface.createTable("TeamBusinessProfile", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        team_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          unique: true,
          references: { model: "Team", key: "id" },
          onDelete: "CASCADE",
        },
        websiteUrl: { type: Sequelize.TEXT, allowNull: true },
        domain: { type: Sequelize.STRING(253), allowNull: true },
        businessName: { type: Sequelize.STRING, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        logoMimeType: { type: Sequelize.STRING(100), allowNull: true },
        logoData: { type: Sequelize.BLOB("medium"), allowNull: true },
        metadata: { type: Sequelize.TEXT, allowNull: true },
        aiContextAllowed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (hasTable(tables, "TeamBusinessProfile")) {
      await queryInterface.dropTable("TeamBusinessProfile");
    }

    const teamColumns = await queryInterface.describeTable("Team");
    if (teamColumns.onboardingCompletedAt) {
      await queryInterface.removeColumn("Team", "onboardingCompletedAt");
    }
    if (teamColumns.useCases) await queryInterface.removeColumn("Team", "useCases");
  },
};
