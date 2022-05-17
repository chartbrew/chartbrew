const NewBarChart = require("./BarChart");

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

    config.options.scales = {
      x: { display: false },
      y: { display: false },
    };

    config.options.interaction = {
      mode: "nearest",
    };

    return config;
  }
}

module.exports = NewPieChart;
