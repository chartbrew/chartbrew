const simplecrypt = require("simplecrypt");

const { encrypt, decrypt } = require("../../modules/cbCrypto");

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
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    },
    project_ids: {
      type: DataTypes.TEXT,
      set(val) {
        try {
          return this.setDataValue("project_ids", JSON.stringify(val));
        } catch (e) {
          return this.setDataValue("project_ids", val);
        }
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("project_ids"));
        } catch (e) {
          return this.getDataValue("project_ids");
        }
      },
    },
    chart_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      reference: {
        model: "Chart",
        key: "id",
        onDelete: "SET NULL",
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
    draft: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    dateFormat: {
      type: DataTypes.STRING,
    },
    legend: {
      type: DataTypes.STRING,
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
          return JSON.parse(decrypt(this.getDataValue("fieldsSchema")));
        } catch (e) {
          try {
            return JSON.parse(sc.decrypt(this.getDataValue("fieldsSchema")));
          } catch (e) {
            return this.getDataValue("fieldsSchema");
          }
        }
      },
      set(val) {
        return this.setDataValue("fieldsSchema", encrypt(JSON.stringify(val)));
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
    joinSettings: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("joinSettings", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("joinSettings"));
        } catch (e) {
          return this.getDataValue("joinSettings");
        }
      }
    },
    main_dr_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      reference: {
        model: "DataRequest",
        key: "id",
        onDelete: "cascade",
      },
    },
    // ------------------------------------

    /*
    ** LEGACY FIELDS
    */
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

  Dataset.associate = (models) => {
    models.Dataset.hasMany(models.DataRequest, { foreignKey: "dataset_id" });
    models.Dataset.hasMany(models.ChartDatasetConfig, { foreignKey: "dataset_id" });
    models.Dataset.hasOne(models.DataRequest, { foreignKey: "id", as: "mainSource" });
  };

  return Dataset;
};
