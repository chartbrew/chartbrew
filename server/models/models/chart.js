const moment = require("moment");

module.exports = (sequelize, DataTypes) => {
  const Chart = sequelize.define("Chart", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      reference: {
        model: "Project",
        key: "id",
        onDelete: "cascade",
      },
    },
    name: {
      type: DataTypes.STRING,
    },
    type: {
      type: DataTypes.STRING,
    },
    subType: {
      type: DataTypes.STRING,
    },
    public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    shareable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    chartData: {
      type: DataTypes.TEXT("long"),
      set(val) {
        return this.setDataValue("chartData", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("chartData"));
        } catch (e) {
          return this.getDataValue("chartData");
        }
      }
    },
    chartDataUpdated: {
      type: DataTypes.DATE,
    },
    chartSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
    dashboardOrder: {
      type: DataTypes.INTEGER,
    },
    displayLegend: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    pointRadius: {
      type: DataTypes.INTEGER,
    },
    startDate: {
      type: DataTypes.DATE,
    },
    endDate: {
      type: DataTypes.DATE,
    },
    includeZeros: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    currentEndDate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    timeInterval: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "day",
    },
    autoUpdate: {
      type: DataTypes.INTEGER, // represented in seconds
    },
    lastAutoUpdate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: moment().toDate(),
    },
    draft: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    mode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "chart",
    },
    maxValue: {
      type: DataTypes.INTEGER
    },
    minValue: {
      type: DataTypes.INTEGER,
    },
    disabledExport: {
      type: DataTypes.BOOLEAN,
    },
    onReport: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    xLabelTicks: {
      type: DataTypes.STRING,
      defaultValue: "default",
    },
    stacked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    showGrowth: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    freezeTableName: true,
  });

  Chart.associate = (models) => {
    models.Chart.hasMany(models.Dataset, { foreignKey: "chart_id" });
    models.Chart.hasMany(models.Chartshare, { foreignKey: "chart_id" });
  };

  return Chart;
};
