const LineChart = require("./LineChart");
const dataFinder = require("../modules/dataFinder");

// HELPER FUNCTIONS
function isDuplicate(key, dataset) {
  for (const value of dataset) {
    if (value === key) {
      return true;
    }
  }

  return false;
}

function getLabelOffset(key, labels) {
  let offset = 0;

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] == key) { // eslint-disable-line
      break;
    }
    offset += 1;
  }

  return offset;
}
// ------------------------------------------

/*
** A class for generating chartjs data for a Bar Chart
*/
class BarChart {
  constructor(chart, data) {
    this.chart = chart;
    this.chartData = data;
  }

  async aggregateOverTime() {
    const lineChart = new LineChart(this.chart, this.chartData);

    // reuse the code for aggregation from the line chart
    const chartConf = await lineChart.aggregateOverTime();

    // modify the data to fit the bar chart api
    for (const dataset of chartConf.data.datasets) {
      dataset.borderWidth = 2;
      dataset.hoverBorderWidth = 3;
    }

    return new Promise(resolve => resolve(chartConf));
  }

  createPatterns() {
    const labels = [];
    const datasets = [];

    for (const dataset of this.chart.Datasets) {
      if (!dataset.deleted) {
        const arrayFieldSelector = [];
        for (const value of dataset.xAxis.split(".")) {
          if (value.indexOf("[]") > -1) {
            arrayFieldSelector.push(value.replace("[]", ""));
            break;
          } else {
            arrayFieldSelector.push(value);
          }
        }

        // the connector data will be used as the main array where to look for the date
        let connectorData;
        if (arrayFieldSelector.length === 1) {
          connectorData = this.chartData;
        } else {
          connectorData = dataFinder.findField(this.chartData, arrayFieldSelector, 1);
        }

        // build up the selector array which is used to show the way to the date value
        let xFieldSelector = dataset.xAxis;
        if (xFieldSelector.length < 2) {
          return new Promise((resolve, reject) => reject(new Error("The X selector is not formatted correctly")));
        }
        xFieldSelector = `root.${xFieldSelector.substring(xFieldSelector.lastIndexOf("]") + 2)}`.split(".");

        const axisData = {};
        // extract the values and count the repetitions
        for (const obj of connectorData) {
          const foundValue = dataFinder.findField(obj, xFieldSelector, 1);
          if (!axisData[foundValue]) {
            axisData[foundValue] = 1;
          } else {
            axisData[foundValue] += 1;
          }
        }

        const chartDatasetData = [];
        // populate the labels
        Object.keys(axisData).forEach((key) => {
          if (dataset.patterns && dataset.patterns.length > 0) {
            let insertingLabel = key;
            if (key.toLowerCase() === "true" || key.toLowerCase() === "false") {
              insertingLabel = key.toLowerCase();
            }
            for (const pattern of dataset.patterns) {
              if (pattern.value == insertingLabel) { // eslint-disable-line
                if (!isDuplicate(insertingLabel, labels)) {
                  labels.push(insertingLabel);
                }

                // make sure to add zero values in case other datasets added other labels before
                const offset = getLabelOffset(key, labels) - chartDatasetData.length;
                if (offset > 0) {
                  for (let i = 0; i < offset; i++) {
                    chartDatasetData.push(0);
                  }
                }
                chartDatasetData.push(axisData[key]);
              }
            }
          } else {
            if (!isDuplicate(key, labels)) labels.push(key);
            chartDatasetData.push(axisData[key]);
          }
        });

        const formattedDataset = {
          label: dataset.legend,
          data: chartDatasetData,
          borderWidth: 2,
          hoverBorderWidth: 3,
        };

        if (dataset.datasetColor) formattedDataset.borderColor = dataset.datasetColor;
        if (dataset.fillColor) formattedDataset.backgroundColor = dataset.fillColor;
        formattedDataset.fill = dataset.fill;

        datasets.push(formattedDataset);
      }
    }

    const chartJsData = {
      data: {
        labels,
        datasets,
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
            }
          }]
        }
      }
    };

    return new Promise(resolve => resolve(chartJsData));
  }
}

module.exports = BarChart;
