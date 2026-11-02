module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ChartCreation", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      request_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "User", key: "id" }, onDelete: "CASCADE" },
      team_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Team", key: "id" }, onDelete: "CASCADE" },
      project_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "Project", key: "id" }, onDelete: "CASCADE" },
      chart_id: Sequelize.INTEGER,
      dataset_id: Sequelize.INTEGER,
      connection_id: Sequelize.INTEGER,
      action: { type: Sequelize.STRING, allowNull: false },
      input_hash: { type: Sequelize.STRING(64), allowNull: false },
      state: { type: Sequelize.STRING, allowNull: false, defaultValue: "running" },
      phase: { type: Sequelize.STRING, defaultValue: "finding" },
      deadline: { type: Sequelize.DATE, allowNull: false },
      result: Sequelize.TEXT,
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("ChartCreation", ["user_id", "project_id", "request_id"], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("ChartCreation");
  },
};
