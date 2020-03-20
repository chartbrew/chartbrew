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
    query: {
      type: DataTypes.TEXT,
    },
    xAxis: {
      type: DataTypes.STRING,
    },
    xAxisType: {
      type: DataTypes.STRING,
    },
    xAxisOperation: {
      type: DataTypes.STRING,
    },
    yAxis: {
      type: DataTypes.STRING,
    },
    yAxisType: {
      type: DataTypes.STRING,
    },
    yAxisOperation: {
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
  }, {
    freezeTableName: true,
  });

  return Dataset;
};
