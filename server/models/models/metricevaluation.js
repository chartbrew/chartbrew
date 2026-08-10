const {
  getEncryptedJson,
  setEncryptedJson,
} = require("../../modules/modelEncryptedFields");

module.exports = (sequelize, DataTypes) => {
  const MetricEvaluation = sequelize.define("MetricEvaluation", {
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
    definition_fingerprint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    policy_version: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    evaluation_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    comparison_rule: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "previous_period",
    },
    comparison_period: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    period_mode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "completed",
    },
    calendar_timezone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    week_starts_on: DataTypes.INTEGER,
    metric_behavior: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    current_period_start: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    comparison_period_start: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    comparison_period_end: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    current_value: DataTypes.DOUBLE,
    baseline_value: DataTypes.DOUBLE,
    absolute_delta: DataTypes.DOUBLE,
    relative_delta: DataTypes.DOUBLE,
    completeness: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    source_bucket_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    source_checkpoint_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    publication_threshold_type: DataTypes.STRING,
    publication_threshold_value: DataTypes.DOUBLE,
    passes_threshold: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    readiness: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "eligible",
    },
    finality: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "settling",
    },
    revision: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
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
    evaluated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    finalized_at: DataTypes.DATE,
    corrected_at: DataTypes.DATE,
  }, {
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["monitor_id", "evaluation_key", "revision"] },
      { fields: ["monitor_id", "current_period_end"] },
      { fields: ["team_id", "evaluated_at"] },
      { fields: ["current_period_end"] },
    ],
  });

  MetricEvaluation.associate = (models) => {
    models.MetricEvaluation.belongsTo(models.MetricMonitor, {
      foreignKey: "monitor_id",
      onDelete: "CASCADE",
    });
    models.MetricEvaluation.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
    models.MetricEvaluation.hasOne(models.Observation, { foreignKey: "metric_evaluation_id" });
    models.MetricEvaluation.hasMany(models.ObservationDigestDeliveryItem, {
      foreignKey: "metric_evaluation_id",
    });
  };

  return MetricEvaluation;
};
