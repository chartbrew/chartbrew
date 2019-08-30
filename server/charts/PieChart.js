const BarChart = require("./BarChart");

class PieChart {
  constructor(chart, data) {
    this.chart = chart;
    this.chartData = data;
  }

  async createPatterns() {
    const barChart = new BarChart(this.chart, this.chartData);

    const config = await barChart.createPatterns();
    config.options.pieceLabel = { render: "value", fontStyle: "bold" };
    config.options.scales = {
      xAxes: [{ display: false }],
      yAxes: [{ display: false }],
    };
    // config.options.scale = { gridLines: { display: false } };

    return new Promise(resolve => resolve(config));
  }
}

module.exports = PieChart;
