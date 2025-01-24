const tooltipsStyle = require("./tooltipsStyle");
const getContrastYIQ = require("../modules/getContrastYIQ");

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
    for (let i = 0; i < this.chart.ChartDatasetConfigs.length; i++) {
      const datasetConfig = this.chart.ChartDatasetConfigs[i];
      const formattedDataset = {
        label: datasetConfig.legend,
        data: this.axisData.y[i]?.length === 0 ? [0] : this.axisData.y[i],
      };

      if (datasetConfig.datasetColor) {
        formattedDataset.borderColor = datasetConfig.datasetColor;
      }
      if (datasetConfig.fillColor) {
        formattedDataset.backgroundColor = datasetConfig.fillColor;
      }
      formattedDataset.fill = datasetConfig.fill;

      if (datasetConfig.fillColor !== null
        && typeof datasetConfig.fillColor === "object"
        && datasetConfig.fillColor instanceof Array
      ) {
        formattedDataset.datalabels = {
          color: datasetConfig.fillColor.map((color) => getContrastYIQ(color)),
          display: "auto",
        };
        if (this.chart.type === "bar") {
          formattedDataset.datalabels.align = "end";
          formattedDataset.datalabels.anchor = "end";
        }
      } else {
        formattedDataset.datalabels = {
          color: getContrastYIQ(datasetConfig.fillColor),
          display: "auto",
        };

        if (this.chart.type === "bar") {
          formattedDataset.datalabels.align = "end";
          formattedDataset.datalabels.anchor = "end";
        }
      }

      formattedDatasets.push(formattedDataset);

      if (this.axisData.x.length > maxLabelLength) {
        maxLabelLength = this.axisData.x.length;
        selectedDatasetLabels = this.axisData.x;
      }
    }

    let maxTickLength = 0;
    if (selectedDatasetLabels !== 0 && selectedDatasetLabels.length > 0) {
      selectedDatasetLabels.forEach((label) => {
        if (label?.length > maxTickLength) {
          maxTickLength = label.length;
        }
      });
    }

    const chartJsData = {
      data: {
        labels: selectedDatasetLabels === 0 ? ["No data"] : selectedDatasetLabels,
        datasets: formattedDatasets,
      },
    };

    const radius = !this.chart.pointRadius && this.chart.pointRadius !== 0
      ? 0 : this.chart.pointRadius;

    chartJsData.options = {
      interaction: {
        intersect: false,
        mode: "index",
      },
      maintainAspectRatio: false,
      elements: {
        point: {
          radius,
          hitRadius: 8,
          hoverRadius: 8,
        },
        line: {
          tension: 0.05,
          borderCapStyle: "round",
        },
      },
      scales: {
        y: {
          beginAtZero: !this.chart.minValue && true,
          ticks: {
            precision: 0,
            font: {
              family: "Inter",
              size: 10,
            },
            maxTicksLimit: 10,
            padding: this.chart.mode === "kpichart" ? 10 : 3,
            display: true,
          },
          grid: {
            display: true,
            lineWidth: 0.5,
          },
          border: {
            display: this.chart.mode !== "kpichart",
          }
        },
        x: {
          ticks: {
            precision: 0,
            font: {
              family: "Inter",
              size: 10,
            },
            maxRotation: 45,
            minRotation: 0,
          },
          grid: {
            display: this.chart.mode !== "kpichart",
            lineWidth: 0.5,
          },
          border: {
            display: this.chart.mode !== "kpichart",
          }
        },
      },
      plugins: {
        tooltip: tooltipsStyle,
        legend: {
          display: this.chart.displayLegend,
          position: this.chart.mode === "kpichart" ? "bottom" : "top",
          labels: {
            font: {
              family: "Inter",
              size: 12,
            },
            boxWidth: 15,
            pointerStyle: "start"
          },
        },
        decimation: {
          enabled: true,
        },
      },
    };

    if (this.chart.maxValue) {
      chartJsData.options.scales.y.max = this.chart.maxValue;
    }
    if (this.chart.minValue) {
      chartJsData.options.scales.y.min = this.chart.minValue;
    }
    if (this.chart.isLogarithmic) {
      chartJsData.options.scales.y.type = "logarithmic";
    }

    // check how many ticks should the X Axis have
    let maxTicksLimit = 10;

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

    chartJsData.options.scales.x.ticks.maxTicksLimit = maxTicksLimit;

    return chartJsData;
  }
}

module.exports = NewLineChart;
