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
    dataLabels: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    startDate: {
      type: DataTypes.DATE,
    },
    endDate: {
      type: DataTypes.DATE,
    },
    dateVarsFormat: {
      type: DataTypes.STRING,
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
    fixedStartDate: {
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
      defaultValue: true,
    },
    xLabelTicks: {
      type: DataTypes.STRING,
      defaultValue: "default",
    },
    stacked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    horizontal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    showGrowth: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    layout: {
      type: DataTypes.TEXT,
      defaultValue: JSON.stringify({
        "lg": [0, 0, 6, 2],
        "md": [0, 0, 6, 2],
        "sm": [0, 0, 4, 2],
        "xs": [0, 0, 4, 2],
        "xxs": [0, 0, 2, 2]
      }),
      set(val) {
        return this.setDataValue("layout", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("layout"));
        } catch (e) {
          return this.getDataValue("layout");
        }
      },
    },
    snapshotToken: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    isLogarithmic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    content: {
      type: DataTypes.TEXT,
    },
    /*
    ** ranges example
    {
      "ranges": [
        { "min": 0, "max": 50, "label": "Low" },
        { "min": 50, "max": 100, "label": "Medium" },
        { "min": 100, "max": 150, "label": "High" }
      ]
    }
    */
    ranges: {
      type: DataTypes.TEXT,
      set(val) {
        return this.setDataValue("ranges", JSON.stringify(val));
      },
      get() {
        try {
          return JSON.parse(this.getDataValue("ranges"));
        } catch (e) {
          return this.getDataValue("ranges");
        }
      },
    },
  }, {
    freezeTableName: true,
  });

  Chart.associate = (models) => {
    models.Chart.hasMany(models.ChartDatasetConfig, { foreignKey: "chart_id" });
    models.Chart.hasMany(models.Dataset, { foreignKey: "chart_id" });
    models.Chart.hasMany(models.Chartshare, { foreignKey: "chart_id" });
    models.Chart.belongsTo(models.Project, { foreignKey: "project_id" });
    models.Chart.hasMany(models.Alert, { foreignKey: "chart_id" });
  };

  return Chart;
};
