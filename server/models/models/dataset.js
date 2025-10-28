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
      description: "Array of project IDs where members can access the dataset"
    },
    draft: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      description: "Whether the dataset is a draft and should be hidden from dashboard viewers"
    },
    /*
    ** Traversal syntax for both x and y axes
    ** root[].field when root is an array
    ** root.field when root is an object
    ** root.field[].field when root is an object and the field is an array
    */
    xAxis: {
      type: DataTypes.STRING,
      description: "X axis or metric field using traversal syntax - root[].field"
    },
    xAxisOperation: {
      type: DataTypes.STRING,
      description: "Not in use"
    },
    yAxis: {
      type: DataTypes.STRING,
    },
    yAxisOperation: {
      type: DataTypes.STRING,
      defaultValue: "none",
      description: "Operation to perform on the y-axis - none, sum, avg, min, max, count"
    },
    dateField: {
      type: DataTypes.STRING,
      description: "Date field using traversal syntax. Specifies which field should be used for date filtering."
    },
    dateFormat: {
      type: DataTypes.STRING,
      description: "Date format to use for date filtering. e.g YYYY-MM-DD"
    },
    legend: {
      type: DataTypes.STRING,
      description: "Legend label (name) of the dataset"
    },
    /*
    ** Conditions to apply to the dataset - used for filtering
    ** Each condition is an object with the following properties:
    ** id: string
    ** field: string - using traversal syntax - root[].field
    ** operator: string
    ** value: string
    ** displayValues: boolean - whether to display the values in the dropdown UI
    */
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
      },
      description: "Conditions to apply to the dataset - used for filtering"
    },
    formula: {
      type: DataTypes.TEXT,
      description: "[Legacy] Formula to use for the dataset"
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
      description: "Schema of the fields in the dataset key(field name) => value(type)"
    },
    /*
    ** Join settings of the dataset - used for tables
    ** Specifies how to join the dataset to the main source data request
    ** joins: array of objects with the following properties:
    ** dr_id: integer - DataRequest ID
    ** join_id: integer - Join ID
    ** dr_field: string - Field in the dataset to join on
    ** join_field: string - Field in the main source data request to join on
    */
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
      },
      description: "Specifies how to join the dataset to the main source data request"
    },
    main_dr_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      reference: {
        model: "DataRequest",
        key: "id",
        onDelete: "cascade",
      },
      description: "The main data request ID of the dataset"
    },
    // ------------------------------------

    /*
    ** LEGACY FIELDS
    */
    chart_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      reference: {
        model: "Chart",
        key: "id",
        onDelete: "SET NULL",
      },
      description: "[Legacy] The chart ID where the dataset is used"
    },
    connection_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      reference: {
        model: "Connection",
        key: "id",
        onDelete: "cascade",
      },
      description: "[Legacy] The connection ID where the dataset is used"
    },
    query: {
      type: DataTypes.TEXT,
      description: "[Legacy] The query used to fetch the dataset"
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
      description: "[Legacy] Fields to exclude from the dataset - used for tables"
    },
    averageByTotal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "[Legacy] Whether to average the total by the field - not used currently"
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
      description: "[Legacy] Configuration of the dataset - used for tables"
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
    models.Dataset.hasMany(models.VariableBinding, { foreignKey: "entity_id", constraints: false, scope: { entity_type: "Dataset" } });
  };

  return Dataset;
};
