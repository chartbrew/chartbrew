module.exports = (sequelize, DataTypes) => {
  const AlertIntegration = sequelize.define("AlertIntegration", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    alert_id: {
      type: DataTypes.UUID,
      allowNull: false,
      reference: {
        model: "Alert",
        key: "id",
        onDelete: "cascade",
      },
    },
    integration_id: {
      type: DataTypes.UUID,
      allowNull: false,
      reference: {
        model: "Integration",
        key: "id",
        onDelete: "cascade",
      },
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
  }, {
    freezeTableName: true,
  });

  AlertIntegration.associate = (models) => {
    models.AlertIntegration.belongsTo(models.Alert, { foreignKey: "alert_id" });
    models.AlertIntegration.belongsTo(models.Integration, { foreignKey: "integration_id" });
  };

  return AlertIntegration;
};
