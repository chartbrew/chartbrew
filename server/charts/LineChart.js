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
    for (let i = 0; i < this.datasets.length; i++) {
      const dataset = this.datasets[i];

      const formattedDataset = {
        label: dataset.options.legend,
        data: this.axisData.y[i]?.length === 0 ? [0] : this.axisData.y[i],
      };

      if (dataset.options.datasetColor) {
        formattedDataset.borderColor = dataset.options.datasetColor;
      }
      if (dataset.options.fillColor) {
        formattedDataset.backgroundColor = dataset.options.fillColor;
      }
      formattedDataset.fill = dataset.options.fill;

      if (dataset.options.fillColor !== null
        && typeof dataset.options.fillColor === "object"
        && dataset.options.fillColor instanceof Array
      ) {
        formattedDataset.datalabels = {
          color: dataset.options.fillColor.map((color) => getContrastYIQ(color)),
          display: "auto",
        };
        if (this.chart.type === "bar") {
          formattedDataset.datalabels.align = "end";
          formattedDataset.datalabels.anchor = "end";
        }
      } else {
        formattedDataset.datalabels = {
          color: getContrastYIQ(dataset.options.fillColor),
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

    let maxTickRotation = 0;
    if (maxTickLength > 10) {
      maxTickRotation = 25;
    }

    const chartJsData = {
      data: {
        labels: selectedDatasetLabels === 0 ? ["No data"] : selectedDatasetLabels,
        datasets: formattedDatasets,
      },
    };

    if (this.chart.mode === "kpi") {
      chartJsData.options = {
        maintainAspectRatio: false,
        elements: {
          point: {
            radius: 0,
          },
          line: {
            tension: 0.05,
            borderWidth: 4,
          },
        },
        scales: {
          y: {
            display: false,
          },
          x: {
            display: false,
          },
        },
        plugins: {
          decimation: {
            enabled: true
          },
          tooltip: {
            enabled: false,
          },
          legend: {
            display: false,
          },
        }
      };
    } else {
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
            radius: this.chart.chartSize === 1 ? 0 : radius,
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
              maxTicksLimit: this.chart.chartSize === 1 ? 4 : 10,
              padding: this.chart.mode === "kpichart" ? 10 : 3,
              display: true,
            },
            grid: {
              display: true,
              drawBorder: this.chart.mode !== "kpichart",
              lineWidth: 0.5,
            },
          },
          x: {
            ticks: {
              precision: 0,
              font: {
                family: "Inter",
                size: 10,
              },
              maxRotation: this.chart.chartSize === 1 ? maxTickRotation : 45,
              minRotation: 0,
            },
            grid: {
              display: this.chart.mode !== "kpichart",
              drawBorder: this.chart.mode !== "kpichart",
              lineWidth: 0.5,
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

      chartJsData.options.scales.x.ticks.maxTicksLimit = maxTicksLimit;
    }

    return chartJsData;
  }
}

module.exports = NewLineChart;
