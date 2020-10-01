const tooltipsStyle = require("./tooltipsStyle");

class NewLineChart {
  constructor(chart, datasets, axisData) {
    this.chart = chart;
    this.datasets = datasets;
    this.axisData = axisData;
  }

  getConfiguration() {
    let maxLabelLength = 0;
    let selectedDatasetLabels = 0;
    const formattedDatasets = [];
    for (let i = 0; i < this.datasets.length; i++) {
      const dataset = this.datasets[0];

      const formattedDataset = {
        label: dataset.options.legend,
        data: this.axisData.y[i],
      };

      if (dataset.options.datasetColor) {
        formattedDataset.borderColor = dataset.options.datasetColor;
      }
      if (dataset.options.fillColor) {
        formattedDataset.backgroundColor = dataset.options.fillColor;
      }
      formattedDataset.fill = dataset.options.fill;

      formattedDatasets.push(formattedDataset);

      if (this.axisData.x.length > maxLabelLength) {
        maxLabelLength = this.axisData.x.length;
        selectedDatasetLabels = this.axisData.x;
      }
    }

    const chartJsData = {
      data: {
        labels: selectedDatasetLabels,
        datasets: formattedDatasets,
      },
    };

    if (this.chart.mode === "kpi" && this.chart.subType.indexOf("AddTimeseries") > -1) {
      chartJsData.options = {
        maintainAspectRatio: false,
        elements: {
          point: {
            radius: 0,
          }
        },
        scales: {
          yAxes: [{
            display: false,
          }],
          xAxes: [{
            display: false,
          }],
        },
        tooltips: {
          enabled: false,
        },
        legend: {
          display: false,
        },
      };
    } else {
      chartJsData.options = {
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
            }
          }],
          xAxes: [{
            ticks: {
              fontFamily: "Inter",
            },
          }],
        },
        tooltips: tooltipsStyle,
      };
    }

    return chartJsData;
  }
}

module.exports = NewLineChart;
