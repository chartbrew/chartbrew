const tooltipsStyle = require("./tooltipsStyle");

class NewBarChart {
  constructor(chart, datasets, axisData) {
    this.chart = chart;
    this.datasets = datasets;
    this.axisData = axisData;
  }

  getConfiguration() {
    // configure chartjs datasets
    const formattedDatasets = [];
    for (let i = 0; i < this.datasets.length; i++) {
      const dataset = this.datasets[i];

      const formattedDataset = {
        label: dataset.options.legend,
        data: this.axisData.y[i],
        borderWidth: 2,
        hoverBorderWidth: 3,
      };

      if (dataset.options.datasetColor) {
        formattedDataset.borderColor = dataset.options.datasetColor;
      }
      if (dataset.options.fillColor) {
        formattedDataset.backgroundColor = dataset.options.fillColor;
      }
      formattedDataset.fill = dataset.options.fill;

      formattedDatasets.push(formattedDataset);
    }

    return {
      data: {
        labels: this.axisData.x,
        datasets: formattedDatasets,
      },
      options: {
        maintainAspectRatio: false,
        legend: {
          display: this.chart.displayLegend,
        },
        elements: {
          point: {
            radius:
              !this.chart.pointRadius && this.chart.pointRadius !== 0 ? 3 : this.chart.pointRadius,
            hitRadius: 8,
            hoverRadius: 8,
          },
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              precision: 0,
              fontFamily: "Inter",
            },
          }],
          xAxes: [{
            ticks: {
              fontFamily: "Inter",
            },
          }],
        },
        tooltips: tooltipsStyle,
      }
    };
  }
}

module.exports = NewBarChart;
