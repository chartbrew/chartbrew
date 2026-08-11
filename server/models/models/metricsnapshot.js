module.exports = (sequelize, DataTypes) => {
  const MetricSnapshot = sequelize.define("MetricSnapshot", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    monitor_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    update_run_id: DataTypes.INTEGER,
    period_start: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    period_end: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    granularity: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    rollup: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "raw",
    },
    value: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    sample_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    completeness: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1,
    },
    coverage: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "unknown",
    },
    result_as_of: DataTypes.DATE,
    definition_fingerprint: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
  }, {
    freezeTableName: true,
    indexes: [
      {
        name: "metric_snapshot_period_unique",
        unique: true,
        fields: [
          "monitor_id",
          "definition_fingerprint",
          "period_start",
          "period_end",
          "granularity",
          "rollup",
        ],
      },
      { fields: ["monitor_id", "period_end"], name: "metric_snapshot_monitor_period" },
      { fields: ["team_id", "period_end"], name: "metric_snapshot_team_period" },
      { fields: ["period_end"], name: "metric_snapshot_period_end" },
    ],
  });

  MetricSnapshot.associate = (models) => {
    models.MetricSnapshot.belongsTo(models.MetricMonitor, {
      foreignKey: "monitor_id",
      onDelete: "CASCADE",
    });
    models.MetricSnapshot.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
    models.MetricSnapshot.belongsTo(models.UpdateRun, {
      foreignKey: "update_run_id",
      onDelete: "SET NULL",
    });
  };

  return MetricSnapshot;
};
