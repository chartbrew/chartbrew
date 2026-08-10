const {
  getEncryptedJson,
  setEncryptedJson,
} = require("../../modules/modelEncryptedFields");

module.exports = (sequelize, DataTypes) => {
  const MetricMonitor = sequelize.define("MetricMonitor", {
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
    created_by: DataTypes.INTEGER,
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    kind: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    binding_key: DataTypes.STRING,
    metric_spec: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      set(value) {
        setEncryptedJson(this, "metric_spec", value);
      },
      get() {
        return getEncryptedJson(this, "metric_spec");
      },
    },
    baseline_policy: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      set(value) {
        setEncryptedJson(this, "baseline_policy", value);
      },
      get() {
        return getEncryptedJson(this, "baseline_policy");
      },
    },
    publication_policy: {
      type: DataTypes.TEXT("long"),
      set(value) {
        setEncryptedJson(this, "publication_policy", value);
      },
      get() {
        return getEncryptedJson(this, "publication_policy");
      },
    },
    cadence: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "after_refresh",
    },
    importance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "collecting",
    },
    status_reason: DataTypes.STRING,
    minimum_samples: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    definition_fingerprint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_sampled_at: DataTypes.DATE,
    last_evaluated_period_end: DataTypes.DATE,
    next_evaluation_at: DataTypes.DATE,
  }, {
    freezeTableName: true,
    indexes: [
      { fields: ["team_id", "is_active", "status"] },
      { fields: ["chart_id", "is_active"] },
      { fields: ["dataset_id", "is_active"] },
      { unique: true, fields: ["team_id", "chart_id", "binding_key"] },
    ],
  });

  MetricMonitor.associate = (models) => {
    models.MetricMonitor.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
    models.MetricMonitor.belongsTo(models.Project, {
      foreignKey: "project_id",
      onDelete: "CASCADE",
    });
    models.MetricMonitor.belongsTo(models.Chart, {
      foreignKey: "chart_id",
      onDelete: "CASCADE",
    });
    models.MetricMonitor.belongsTo(models.Dataset, {
      foreignKey: "dataset_id",
      onDelete: "CASCADE",
    });
    models.MetricMonitor.belongsTo(models.User, {
      as: "creator",
      foreignKey: "created_by",
      onDelete: "SET NULL",
    });
    models.MetricMonitor.hasMany(models.MetricSnapshot, { foreignKey: "monitor_id" });
    models.MetricMonitor.hasMany(models.MetricEvaluation, { foreignKey: "monitor_id" });
    models.MetricMonitor.hasMany(models.Observation, { foreignKey: "monitor_id" });
  };

  return MetricMonitor;
};
