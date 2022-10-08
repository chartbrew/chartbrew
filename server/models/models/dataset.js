const simplecrypt = require("simplecrypt");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const sc = simplecrypt({
  password: settings.secret,
  salt: "10",
});

module.exports = (sequelize, DataTypes) => {
  const Dataset = sequelize.define("Dataset", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    connection_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      reference: {
        model: "Connection",
        key: "id",
        onDelete: "cascade",
      },
    },
    query: {
      type: DataTypes.TEXT,
    },
    xAxis: {
      type: DataTypes.STRING,
    },
    xAxisOperation: {
      type: DataTypes.STRING,
    },
    yAxis: {
      type: DataTypes.STRING,
    },
    yAxisOperation: {
      type: DataTypes.STRING,
      defaultValue: "none",
    },
    dateField: {
      type: DataTypes.STRING,
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
    dateFormat: {
      type: DataTypes.STRING,
    },
    legend: {
      type: DataTypes.STRING,
    },
    pointRadius: {
      type: DataTypes.INTEGER,
    },
    patterns: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "[]",
      set(val) {
        return this.setDataValue("patterns", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("patterns"));
        } catch (e) {
          return this.getDataValue("patterns");
        }
      }
    },
    conditions: {
      type: DataTypes.TEXT("long"),
      set(val) {
        return this.setDataValue("conditions", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("conditions"));
        } catch (e) {
          return this.getDataValue("conditions");
        }
      }
    },
    formula: {
      type: DataTypes.TEXT,
    },
    fieldsSchema: {
      type: DataTypes.TEXT("long"),
      get() {
        try {
          return JSON.parse(sc.decrypt(this.getDataValue("fieldsSchema")));
        } catch (e) {
          return this.getDataValue("fieldsSchema");
        }
      },
      set(val) {
        return this.setDataValue("fieldsSchema", sc.encrypt(JSON.stringify(val)));
      },
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
    groups: {
      type: DataTypes.TEXT,
      get() {
        try {
          return JSON.parse(this.getDataValue("groups"));
        } catch (e) {
          return this.getDataValue("groups");
        }
      },
      set(val) {
        return this.setDataValue("groups", JSON.stringify(val));
      },
    },
    groupBy: {
      type: DataTypes.STRING,
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
    averageByTotal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
      }
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    freezeTableName: true,
  });

  Dataset.associate = (models) => {
    models.Dataset.belongsTo(models.Chart, { foreignKey: "chart_id" });
    models.Dataset.belongsTo(models.Connection, { foreignKey: "connection_id" });
    models.Dataset.hasOne(models.DataRequest, { foreignKey: "dataset_id" });
  };

  return Dataset;
};
