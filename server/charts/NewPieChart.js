const NewBarChart = require("./NewBarChart");

class NewPieChart {
  constructor(chart, datasets, axisData) {
    this.chart = chart;
    this.datasets = datasets;
    this.axisData = axisData;
  }

  getConfiguration() {
    // The pie chart works like the bar chart - so just extend the configuration
    const barChart = new NewBarChart(this.chart, this.datasets, this.axisData);
    const config = barChart.getConfiguration();

    config.options.pieceLabel = { render: "value", fontStyle: "bold" };
    config.options.scales = {
      xAxes: [{ display: false }],
      yAxes: [{ display: false }],
    };

    return config;
  }
}

module.exports = NewPieChart;
