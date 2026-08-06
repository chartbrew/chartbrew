module.exports = (sequelize, DataTypes) => {
  const MetricRecommendationDismissal = sequelize.define("MetricRecommendationDismissal", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    chart_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dismissed_by: DataTypes.INTEGER,
    binding_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    definition_fingerprint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dismissal_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expires_at: DataTypes.DATE,
  }, {
    freezeTableName: true,
    indexes: [{
      fields: ["team_id", "chart_id", "binding_key"],
      name: "metric_recommendation_dismissal_unique",
      unique: true,
    }, {
      fields: ["team_id", "expires_at"],
      name: "metric_recommendation_dismissal_expiry",
    }],
  });

  MetricRecommendationDismissal.associate = (models) => {
    models.MetricRecommendationDismissal.belongsTo(models.Team, { foreignKey: "team_id" });
    models.MetricRecommendationDismissal.belongsTo(models.Project, { foreignKey: "project_id" });
    models.MetricRecommendationDismissal.belongsTo(models.Chart, { foreignKey: "chart_id" });
    models.MetricRecommendationDismissal.belongsTo(models.User, {
      as: "dismissedBy",
      foreignKey: "dismissed_by",
    });
  };

  return MetricRecommendationDismissal;
};
