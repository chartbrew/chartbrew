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
      type: DataTypes.STRING,
      allowNull: false,
    },
    rollup: {
      type: DataTypes.STRING,
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
    definition_fingerprint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    freezeTableName: true,
    indexes: [
      {
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
      { fields: ["monitor_id", "period_end"] },
      { fields: ["team_id", "period_end"] },
      { fields: ["period_end"] },
    ],
  });

  MetricSnapshot.associate = (models) => {
    models.MetricSnapshot.belongsTo(models.MetricMonitor, { foreignKey: "monitor_id" });
    models.MetricSnapshot.belongsTo(models.Team, { foreignKey: "team_id" });
    models.MetricSnapshot.belongsTo(models.UpdateRun, {
      foreignKey: "update_run_id",
      constraints: false,
    });
  };

  return MetricSnapshot;
};
