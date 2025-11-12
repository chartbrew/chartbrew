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
      description: "The type of chart",
    },
    subType: {
      type: DataTypes.STRING,
      description: "The sub-type of chart, currently only AddTimeseries is supported for accumulating timeseries data",
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
      description: "Holds the chart.js configuration",
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
      description: "When was chartData last updated"
    },
    chartSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      description: "This field is deprecated in favor of layout"
    },
    dashboardOrder: {
      type: DataTypes.INTEGER,
      description: "This field is deprecated in favor of layout"
    },
    displayLegend: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      description: "Whether to display the chart.js legend"
    },
    pointRadius: {
      type: DataTypes.INTEGER,
      description: "0 to hide, integer value to set the point radius"
    },
    dataLabels: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to display the data labels on each data point on the chart"
    },
    startDate: {
      type: DataTypes.DATE,
      description: "Used to inject a fixed start date into the chart"
    },
    endDate: {
      type: DataTypes.DATE,
      description: "Used to inject a fixed end date into the chart"
    },
    dateVarsFormat: {
      type: DataTypes.STRING,
      description: "The format of the date variables in the chart"
    },
    includeZeros: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      description: "Whether to include zero-valued data points in the chart"
    },
    currentEndDate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      description: "Whether to use the current end date as the end date for the chart - this moves the start date to match the original period length"
    },
    fixedStartDate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      description: "Whether to force the start date to remain fixed"
    },
    timeInterval: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "day",
      description: "The time interval of the chart, second, minute, hour, day, week, month, year"
    },
    autoUpdate: {
      type: DataTypes.INTEGER, // represented in seconds
      description: "The interval in seconds at which the chart should be automatically updated"
    },
    lastAutoUpdate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: moment().toDate(),
      description: "When the last automatic update was performed"
    },
    draft: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      description: "Whether the chart is a draft and should be hidden from dashboard viewers"
    },
    mode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "chart",
      description: "chart or kpi"
    },
    maxValue: {
      type: DataTypes.INTEGER,
      description: "Cap the maximum shown value on the chart"
    },
    minValue: {
      type: DataTypes.INTEGER,
      description: "Cap the minimum shown value on the chart"
    },
    disabledExport: {
      type: DataTypes.BOOLEAN,
      description: "Whether to disable the export button for the chart"
    },
    onReport: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      description: "Whether to display the chart on the report"
    },
    xLabelTicks: {
      type: DataTypes.STRING,
      defaultValue: "default",
      description: "How many ticks to display on the x-axis - default, half, third, fourth, showAll"
    },
    stacked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to stack the chart - only works for bar charts"
    },
    horizontal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to display the chart horizontally - only works for bar charts"
    },
    showGrowth: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to show the growth percentage at the top of the chart"
    },
    invertGrowth: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "When negative growth is meant to be positive and vice versa"
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
      description: "The layout of the chart - in the format of react-grid-layout"
    },
    snapshotToken: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      description: "A token used to authenticate the automated snapshot generation"
    },
    isLogarithmic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to use a logarithmic scale for the y-axis"
    },
    content: {
      type: DataTypes.TEXT,
      description: "The content used for type=markdown"
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
      description: "The ranges to display on the chart - only works for gauge charts"
    },
    dashedLastPoint: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      description: "Whether to dash the last point on the chart - only works for line charts"
    },
    defaultRowsPerPage: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
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
    models.Chart.hasMany(models.SharePolicy, { foreignKey: "entity_id", scope: { entity_type: "Chart" } });
  };

  return Chart;
};
