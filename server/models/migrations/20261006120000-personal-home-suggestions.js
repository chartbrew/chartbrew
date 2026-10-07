const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const team = await queryInterface.describeTable("Team");
    if (!team.aiSuggestionsEnabled) {
      await queryInterface.addColumn("Team", "aiSuggestionsEnabled", {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
      });
    }
    await queryInterface.createTable("AiHomeState", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      team_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Team", key: "id" }, onDelete: "CASCADE" },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
      last_active_at: Sequelize.DATE,
      last_attempt_at: Sequelize.DATE,
      forgotten_before: Sequelize.DATE,
      revision: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      signature: Sequelize.STRING(64),
      payload: Sequelize.TEXT("long"),
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("AiHomeState", ["team_id", "user_id"], { unique: true });
    await queryInterface.addIndex("AiHomeState", ["last_active_at"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("AiHomeState");
    await queryInterface.removeColumn("Team", "aiSuggestionsEnabled");
  },
};
