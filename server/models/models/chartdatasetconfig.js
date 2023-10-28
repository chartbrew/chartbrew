module.exports = (sequelize, DataTypes) => {
  const ChartDatasetConfig = sequelize.define("ChartDatasetConfig", {
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
    dataset_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Dataset",
        key: "id",
        onDelete: "cascade",
      },
    },
    formula: {
      type: DataTypes.TEXT,
    },
    datasetColor: {
      type: DataTypes.TEXT,
    },
    fillColor: {
      type: DataTypes.TEXT,
      set(val) {
        try {
          return this.setDataValue("fillColor", JSON.stringify(val));
        } catch (e) {
          return this.setDataValue("fillColor", val);
        }
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("fillColor"));
        } catch (e) {
          return this.getDataValue("fillColor");
        }
      }
    },
    fill: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    multiFill: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    legend: {
      type: DataTypes.STRING,
    },
    pointRadius: {
      type: DataTypes.INTEGER,
    },
    excludedFields: {
      type: DataTypes.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("excludedFields"));
        } catch (e) {
          return this.getDataValue("excludedFields");
        }
      },
      set(val) {
        return this.setDataValue("excludedFields", JSON.stringify(val));
      },
    },
    sort: {
      type: DataTypes.STRING,
    },
    columnsOrder: {
      type: DataTypes.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("columnsOrder"));
        } catch (e) {
          return this.getDataValue("columnsOrder");
        }
      },
      set(val) {
        return this.setDataValue("columnsOrder", JSON.stringify(val));
      }
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    maxRecords: {
      type: DataTypes.INTEGER,
    },
    goal: {
      type: DataTypes.INTEGER,
    },
  }, {
    freezeTableName: true,
  });

  ChartDatasetConfig.associate = (models) => {
    models.ChartDatasetConfig.belongsTo(models.Dataset, { foreignKey: "dataset_id" });
    models.ChartDatasetConfig.belongsTo(models.Chart, { foreignKey: "chart_id" });
    models.ChartDatasetConfig.hasMany(models.Alert, { foreignKey: "cdc_id" });
  };

  return ChartDatasetConfig;
};
