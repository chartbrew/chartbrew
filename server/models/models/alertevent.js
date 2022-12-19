module.exports = (sequelize, DataTypes) => {
  const AlertEvent = sequelize.define("AlertEvent", {
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
    trigger: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("trigger", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("trigger"));
        } catch (e) {
          return this.getDataValue("trigger");
        }
      }
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

  AlertEvent.associate = (models) => {
    models.AlertEvent.belongsTo(models.Alert, { foreignKey: "alert_id" });
  };

  return AlertEvent;
};
