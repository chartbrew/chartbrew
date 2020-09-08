const BarChart = require("./BarChart");
const tooltipsStyle = require("./tooltipsStyle");

class PieChart {
  constructor(data) {
    this.chartData = data;
  }

  async createPatterns() {
    const barChart = new BarChart(this.chartData);

    const config = await barChart.createPatterns();
    config.options.pieceLabel = { render: "value", fontStyle: "bold" };
    config.options.scales = {
      xAxes: [{ display: false }],
      yAxes: [{ display: false }],
    };
    config.options.tooltips = tooltipsStyle;

    return new Promise((resolve) => resolve(config));
  }
}

module.exports = PieChart;
