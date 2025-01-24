const tooltipsStyle = require("./tooltipsStyle");
const getContrastYIQ = require("../modules/getContrastYIQ");

class NewBarChart {
  constructor(chart, datasets, axisData) {
    this.chart = chart;
    this.datasets = datasets;
    this.axisData = axisData;
  }

  getConfiguration() {
    // configure chartjs datasets
    const formattedDatasets = [];
    for (let i = 0; i < this.chart.ChartDatasetConfigs.length; i++) {
      const datasetConfig = this.chart.ChartDatasetConfigs[i];

      const formattedDataset = {
        label: datasetConfig.legend,
        data: this.axisData.y[i]?.length === 0 ? [0] : this.axisData.y[i],
        borderWidth: 1.5,
        hoverBorderWidth: 3,
      };

      if (datasetConfig.datasetColor) {
        formattedDataset.borderColor = datasetConfig.datasetColor;
      }
      if (datasetConfig.fillColor) {
        formattedDataset.backgroundColor = datasetConfig.fillColor;
      }
      if (!datasetConfig.fill && !datasetConfig.multiFill) {
        formattedDataset.backgroundColor = "transparent";
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
          formattedDataset.datalabels.align = this.chart.horizontal ? "end" : "start";
          formattedDataset.datalabels.anchor = "end";
          if (this.chart.stacked) {
            if (i === this.datasets.length - 1 && this.datasets.length > 1) {
              formattedDataset.datalabels.offset = -16;
              formattedDataset.datalabels.color = datasetConfig.fillColor;
            }
            formattedDataset.datalabels.display = true;
          }
        }
      } else {
        formattedDataset.datalabels = {
          color: getContrastYIQ(datasetConfig.fillColor),
          display: "auto",
        };

        if (this.chart.type === "bar") {
          formattedDataset.datalabels.align = this.chart.horizontal ? "end" : "start";
          formattedDataset.datalabels.anchor = "end";
          if (this.chart.stacked) {
            if (i === this.datasets.length - 1 && this.datasets.length > 1) {
              formattedDataset.datalabels.offset = -16;
              formattedDataset.datalabels.color = datasetConfig.fillColor;
            }
            formattedDataset.datalabels.display = true;
          }
        }
      }

      formattedDatasets.push(formattedDataset);
    }

    let maxTickLength = 0;
    this.axisData.x.forEach((label) => {
      if (label?.length > maxTickLength) {
        maxTickLength = label.length;
      }
    });

    let maxTickRotation = 0;
    if (maxTickLength > 10) {
      maxTickRotation = 25;
    }

    const chartJsData = {
      data: {
        labels: this.axisData.x === 0 ? ["No data"] : this.axisData.x,
        datasets: formattedDatasets,
      },
    };

    chartJsData.options = {
      indexAxis: this.chart.horizontal ? "y" : "x",
      interaction: {
        intersect: this.chart.horizontal,
        mode: "index",
      },
      maintainAspectRatio: false,
      elements: {
        point: {
          radius: !this.chart.pointRadius && this.chart.pointRadius !== 0
            ? 3 : this.chart.pointRadius,
          hitRadius: 8,
          hoverRadius: 8,
        },
        bar: {
          borderRadius: 3,
          borderSkipped: "start",
        },
      },
      scales: {
        y: {
          stacked: this.chart.stacked,
          beginAtZero: !this.chart.minValue && true,
          ticks: {
            precision: 0,
            font: {
              family: "Inter",
              size: 10,
            },
            maxTicksLimit: this.chart.mode === "kpichart" ? 4 : 10,
            padding: this.chart.mode === "kpichart" ? 10 : 3,
            display: true,
          },
          grid: {
            display: !this.chart.horizontal,
            lineWidth: 0.5,
          },
          border: {
            display: this.chart.mode !== "kpichart",
          },
        },
        x: {
          stacked: this.chart.stacked,
          ticks: {
            font: {
              family: "Inter",
              size: 10,
            },
            maxRotation: this.chart.chartSize === 1 ? maxTickRotation : 90,
            minRotation: 0,
          },
          grid: {
            display: this.chart.mode !== "kpichart" || this.chart.horizontal,
            lineWidth: 0.5,
          },
          border: {
            display: this.chart.mode !== "kpichart" || this.chart.horizontal,
          },
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

    if (this.chart.chartSize === 1) maxTicksLimit = 4;
    if (this.chart.chartSize === 2) maxTicksLimit = 8;
    if (this.chart.chartSize === 3) maxTicksLimit = 12;
    if (this.chart.chartSize === 4) maxTicksLimit = 16;

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

    if (this.chart.horizontal) {
      chartJsData.options.scales.y.ticks.maxTicksLimit = maxTicksLimit;
    } else {
      chartJsData.options.scales.x.ticks.maxTicksLimit = maxTicksLimit;
    }

    return chartJsData;
  }
}

module.exports = NewBarChart;
