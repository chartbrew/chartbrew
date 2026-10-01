module.exports = (sequelize, DataTypes) => sequelize.define("SourceExecution", {
  id: { type: DataTypes.UUID, primaryKey: true },
  teamId: { type: DataTypes.INTEGER, allowNull: false },
  sourceId: { type: DataTypes.STRING, allowNull: false },
  connectionId: { type: DataTypes.INTEGER, allowNull: false },
  activity: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  cacheHit: { type: DataTypes.BOOLEAN, allowNull: false },
  startedAt: { type: DataTypes.DATE(3), allowNull: false },
  finishedAt: { type: DataTypes.DATE(3), allowNull: true },
  projectId: { type: DataTypes.INTEGER, allowNull: true },
  chartId: { type: DataTypes.INTEGER, allowNull: true },
  datasetId: { type: DataTypes.INTEGER, allowNull: true },
  dataRequestId: { type: DataTypes.INTEGER, allowNull: true },
  runId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  freezeTableName: true,
  indexes: [
    { name: "source_execution_team_status_finished", fields: ["teamId", "status", "finishedAt"] },
    { name: "source_execution_started", fields: ["startedAt"] },
    { name: "source_execution_finished", fields: ["finishedAt"] },
  ],
});
