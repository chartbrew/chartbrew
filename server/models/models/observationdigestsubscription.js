module.exports = (sequelize, DataTypes) => {
  const ObservationDigestSubscription = sequelize.define("ObservationDigestSubscription", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    project_id: DataTypes.INTEGER,
    monitor_id: DataTypes.UUID,
    cadence: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    local_delivery_time: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    day_of_week: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    day_of_month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    delivery_days: DataTypes.JSON,
    content_mode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "kpi_review",
    },
    evaluation_wait_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 120,
    },
    channel: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "email",
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_delivered_at: DataTypes.DATE,
    last_noop_at: DataTypes.DATE,
    last_attempted_at: DataTypes.DATE,
    last_delivery_status: DataTypes.STRING,
  }, {
    freezeTableName: true,
    indexes: [
      { fields: ["user_id", "enabled"] },
      { fields: ["team_id", "enabled", "cadence"] },
    ],
  });

  ObservationDigestSubscription.associate = (models) => {
    models.ObservationDigestSubscription.belongsTo(models.Team, {
      foreignKey: "team_id",
      onDelete: "CASCADE",
    });
    models.ObservationDigestSubscription.belongsTo(models.User, {
      foreignKey: "user_id",
      onDelete: "CASCADE",
    });
    models.ObservationDigestSubscription.belongsTo(models.Project, {
      foreignKey: "project_id",
      onDelete: "CASCADE",
    });
    models.ObservationDigestSubscription.belongsTo(models.MetricMonitor, {
      foreignKey: "monitor_id",
      onDelete: "CASCADE",
    });
    models.ObservationDigestSubscription.hasMany(models.ObservationDigestDeliveryItem, {
      foreignKey: "subscription_id",
    });
  };

  return ObservationDigestSubscription;
};
