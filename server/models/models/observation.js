const {
  getEncryptedJson,
  setEncryptedJson,
} = require("../../modules/modelEncryptedFields");

module.exports = (sequelize, DataTypes) => {
  const Observation = sequelize.define("Observation", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    project_id: DataTypes.INTEGER,
    chart_id: DataTypes.INTEGER,
    dataset_id: DataTypes.INTEGER,
    monitor_id: DataTypes.UUID,
    metric_evaluation_id: DataTypes.UUID,
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "metric_change",
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "open",
    },
    severity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    confidence: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    direction: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deduplication_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    current_value: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    baseline_value: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    absolute_delta: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    relative_delta: DataTypes.DOUBLE,
    unit: DataTypes.STRING,
    current_period_start: DataTypes.DATE,
    current_period_end: DataTypes.DATE,
    comparison_period_start: DataTypes.DATE,
    comparison_period_end: DataTypes.DATE,
    evidence: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      set(value) {
        setEncryptedJson(this, "evidence", value);
      },
      get() {
        return getEncryptedJson(this, "evidence");
      },
    },
    first_detected_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_detected_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    opened_at: DataTypes.DATE,
    resolved_at: DataTypes.DATE,
    definition_fingerprint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    score_version: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    evidence_revision: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  }, {
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["team_id", "deduplication_key"] },
      { fields: ["team_id", "status", "last_detected_at"] },
      { fields: ["project_id", "status", "last_detected_at"] },
      { fields: ["monitor_id", "last_detected_at"] },
      { unique: true, fields: ["metric_evaluation_id"] },
      { fields: ["resolved_at"] },
    ],
  });

  Observation.associate = (models) => {
    models.Observation.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
    models.Observation.belongsTo(models.Project, {
      foreignKey: "project_id",
      onDelete: "SET NULL",
    });
    models.Observation.belongsTo(models.Chart, {
      foreignKey: "chart_id",
      onDelete: "SET NULL",
    });
    models.Observation.belongsTo(models.Dataset, {
      foreignKey: "dataset_id",
      onDelete: "SET NULL",
    });
    models.Observation.belongsTo(models.MetricMonitor, {
      foreignKey: "monitor_id",
      onDelete: "SET NULL",
    });
    models.Observation.belongsTo(models.MetricEvaluation, {
      foreignKey: "metric_evaluation_id",
      onDelete: "SET NULL",
    });
    models.Observation.hasMany(models.ObservationPreference, { foreignKey: "observation_id" });
    models.Observation.hasMany(models.ObservationFeedback, { foreignKey: "observation_id" });
    models.Observation.hasMany(models.ObservationAudit, { foreignKey: "observation_id" });
  };

  return Observation;
};
