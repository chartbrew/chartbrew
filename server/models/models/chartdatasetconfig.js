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
      description: "The formula (e.g {val / 100}) used transform the data points values. Can be used to pre-(a)pend, strings to numbers too £{val}"
    },
    datasetColor: {
      type: DataTypes.TEXT,
      description: "The color of the dataset"
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
      },
      description: "The color of the dataset fill"
    },
    fill: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to fill the dataset"
    },
    multiFill: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Useful for the UI to prompt the user to select multiple colors for the dataset"
    },
    legend: {
      type: DataTypes.STRING,
      description: "The legend label (name) of the dataset"
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
      description: "The fields to exclude from the dataset - used for tables"
    },
    sort: {
      type: DataTypes.STRING,
      description: "The sort order of the dataset - asc or desc"
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
      },
      description: "The order of the columns in the dataset - used for tables"
    },
    order: {
      type: DataTypes.FLOAT,
      defaultValue: 1,
      description: "The order of the dataset in the chart"
    },
    maxRecords: {
      type: DataTypes.INTEGER,
      description: "The maximum number of records to display in the dataset"
    },
    goal: {
      type: DataTypes.INTEGER,
      description: "The goal of the dataset - used to display a progress bar for KPIs"
    },
    configuration: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("configuration", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("configuration"));
        } catch (e) {
          return this.getDataValue("configuration");
        }
      },
      /*
      {
        variables: [
          {
            name: "string",  // Variable name from DataRequest VariableBinding
            value: "any"     // Override value (string, number, etc.)
          }
        ]
      }
      */
      description: "Additional configuration options for the dataset. Currently used to give values to variables."
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
