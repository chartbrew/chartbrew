module.exports = (sequelize, DataTypes) => {
  const Alert = sequelize.define("Alert", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    chart_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Chart",
        key: "id",
        onDelete: "cascade",
      },
    },
    cdc_id: {
      type: DataTypes.UUID,
      allowNull: false,
      reference: {
        model: "ChartDatasetConfig",
        key: "id",
        onDelete: "cascade",
      },
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rules: {
      type: DataTypes.TEXT("long"),
      set(val) {
        return this.setDataValue("rules", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("rules"));
        } catch (e) {
          return this.getDataValue("rules");
        }
      }
    },
    recipients: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("recipients", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("recipients"));
        } catch (e) {
          return this.getDataValue("recipients");
        }
      },
    },
    mediums: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("mediums", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("mediums"));
        } catch (e) {
          return this.getDataValue("mediums");
        }
      },
    },
    active: {
      type: DataTypes.BOOLEAN,
      required: true,
      defaultValue: false,
    },
    token: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      required: true,
    },
    oneTime: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      required: true,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    timeout: {
      type: DataTypes.INTEGER,
      defaultValue: 600,
      required: true,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
  }, {
    freezeTableName: true,
  });

  Alert.associate = (models) => {
    models.Alert.belongsTo(models.ChartDatasetConfig, { foreignKey: "cdc_id" });
    models.Alert.belongsTo(models.Chart, { foreignKey: "chart_id" });
    models.Alert.hasMany(models.AlertEvent, { foreignKey: "alert_id", as: "events" });
    models.Alert.hasMany(models.AlertIntegration, { foreignKey: "alert_id" });
  };

  return Alert;
};
