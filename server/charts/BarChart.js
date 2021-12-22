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

    const chartJsData = {
      data: {
        labels: this.axisData.x,
        datasets: formattedDatasets,
      },
    };

    if (this.chart.mode === "kpi") {
      chartJsData.options = {
        maintainAspectRatio: false,
        legend: {
          display: false,
        },
        elements: {
          point: {
            radius: 0,
          },
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
              beginAtZero: !this.chart.minValue && true,
              precision: 0,
              fontFamily: "Inter",
              maxTicksLimit: 15,
            },
          }],
          xAxes: [{
            ticks: {
              fontFamily: "Inter",
            },
          }],
        },
        tooltips: tooltipsStyle,
      };

      if (this.chart.maxValue) {
        chartJsData.options.scales.yAxes[0].ticks.max = this.chart.maxValue;
      }
      if (this.chart.minValue) {
        chartJsData.options.scales.yAxes[0].ticks.min = this.chart.minValue;
      }

      // check how many ticks should the X Axis have
      let maxTicksLimit = 25;

      if (this.axisData.x.length) {
        switch (this.chart.xLabelTicks) {
          case "showAll":
            maxTicksLimit = this.axisData.x.length;
            break;
          case "half":
            maxTicksLimit = parseInt(this.axisData.x.length / 2, 10);
            break;
          case "third":
            maxTicksLimit = parseInt(this.axisData.x.length / 3, 10);
            break;
          case "fourth":
            maxTicksLimit = parseInt(this.axisData.x.length / 4, 10);
            break;
          default:
            if (this.chart.xLabelTicks && !Number.isNaN(parseInt(this.chart.xLabelTicks, 10))) {
              maxTicksLimit = parseInt(this.chart.xLabelTicks, 10);
            }
            break;
        }
      }

      chartJsData.options.scales.xAxes[0].ticks.maxTicksLimit = maxTicksLimit;
    }

    return chartJsData;
  }
}

module.exports = NewBarChart;
