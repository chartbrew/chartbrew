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

    if (this.chart.type === "pie") {
      config.data.datasets = config.data.datasets.map((dataset) => ({
        ...dataset,
        borderColor: "transparent",
        borderWidth: 0,
        hoverBorderWidth: 0,
        hoverOffset: 4,
        spacing: 0,
      }));
    }

    if (this.chart.type === "doughnut") {
      config.data.datasets = config.data.datasets.map((dataset) => ({
        ...dataset,
        borderColor: "transparent",
        borderWidth: 2,
        hoverBorderWidth: 2,
        hoverOffset: 4,
        spacing: 0,
      }));
    }

    return config;
  }
}

module.exports = NewPieChart;
