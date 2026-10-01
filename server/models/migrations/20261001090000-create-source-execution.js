module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SourceExecution", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      teamId: { type: Sequelize.INTEGER, allowNull: false },
      sourceId: { type: Sequelize.STRING, allowNull: false },
      connectionId: { type: Sequelize.INTEGER, allowNull: false },
      activity: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false },
      cacheHit: { type: Sequelize.BOOLEAN, allowNull: false },
      startedAt: { type: Sequelize.DATE(3), allowNull: false },
      finishedAt: { type: Sequelize.DATE(3), allowNull: true },
      projectId: { type: Sequelize.INTEGER, allowNull: true },
      chartId: { type: Sequelize.INTEGER, allowNull: true },
      datasetId: { type: Sequelize.INTEGER, allowNull: true },
      dataRequestId: { type: Sequelize.INTEGER, allowNull: true },
      runId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("SourceExecution", ["teamId", "status", "finishedAt"], {
      name: "source_execution_team_status_finished",
    });
    await queryInterface.addIndex("SourceExecution", ["startedAt"], { name: "source_execution_started" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("SourceExecution");
  },
};
