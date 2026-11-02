module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ReportThemePreset", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      team_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Team", key: "id" }, onDelete: "CASCADE" },
      created_by: { type: Sequelize.INTEGER, allowNull: true, references: { model: "User", key: "id" }, onDelete: "SET NULL" },
      name: { type: Sequelize.STRING(80), allowNull: false },
      appearance: { type: Sequelize.JSON, allowNull: false },
      revision: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("ReportThemePreset", ["team_id"]);
    await queryInterface.addColumn("Project", "reportAppearance", { type: Sequelize.JSON, allowNull: true });
    await queryInterface.addColumn("Project", "reportAppearanceRevision", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("Project", "reportAppearanceRevision");
    await queryInterface.removeColumn("Project", "reportAppearance");
    await queryInterface.dropTable("ReportThemePreset");
  },
};
