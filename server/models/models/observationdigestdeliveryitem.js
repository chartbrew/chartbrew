module.exports = (sequelize, DataTypes) => {
  const ObservationDigestDeliveryItem = sequelize.define("ObservationDigestDeliveryItem", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    subscription_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    metric_evaluation_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    evaluation_revision: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    delivery_attempted_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    delivered_at: DataTypes.DATE,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
  }, {
    freezeTableName: true,
    indexes: [
      {
        name: "observation_digest_evaluation_revision_unique",
        unique: true,
        fields: ["subscription_id", "metric_evaluation_id", "evaluation_revision"],
      },
      {
        fields: ["metric_evaluation_id"],
        name: "observation_digest_delivery_evaluation",
      },
      {
        fields: ["subscription_id", "status"],
        name: "observation_digest_delivery_subscription_status",
      },
    ],
  });

  ObservationDigestDeliveryItem.associate = (models) => {
    models.ObservationDigestDeliveryItem.belongsTo(models.ObservationDigestSubscription, {
      foreignKey: "subscription_id",
      onDelete: "CASCADE",
    });
    models.ObservationDigestDeliveryItem.belongsTo(models.MetricEvaluation, {
      foreignKey: "metric_evaluation_id",
      onDelete: "CASCADE",
    });
  };

  return ObservationDigestDeliveryItem;
};
