const moment = require("moment");
const dataFinder = require("../modules/dataFinder");

class LineChart {
  constructor(chart, data) {
    this.chart = chart;
    this.chartData = data;
  }

  /*
  ** Get data for a chart that aggregates a length(obj) over time
  */
  aggregateOverTime() {
    let parsedData;
    try {
      parsedData = JSON.parse(this.chartData);
    } catch (e) {
      parsedData = this.chartData;
    }

    const datasets = [];
    let maxLabelLength = 0;
    let selectedDatasetLabels = 0;

    // go through all the datasets
    for (const dataset of this.chart.Datasets) {
      if (!dataset.deleted) {
      // get the array in the selector chain
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
          connectorData = parsedData;
        } else {
          connectorData = dataFinder.findField(parsedData, arrayFieldSelector, 1);
        }

        // build up the selector array which is used to show the way to the date value
        let xFieldSelector = dataset.xAxis;
        if (xFieldSelector.length < 2) {
          return new Promise((resolve, reject) => reject(new Error("The X selector is not formatted correctly")));
        }
        xFieldSelector = `root.${xFieldSelector.substring(xFieldSelector.lastIndexOf("]") + 2)}`.split(".");

        let axisData = [];
        // extract the values for overTime chart
        for (const obj of connectorData) {
          const entityDate = moment(dataFinder.findField(obj, xFieldSelector, 1));
          // if there's a date range available, make sure to not include dates outside the range
          if (this.chart.startDate && this.chart.endDate) {
            const startDate = moment(this.chart.startDate);
            let endDate = moment(this.chart.endDate);

            // check to see if the current date is set to be the endDate
            if (this.chart.currentEndDate) {
              endDate = moment();
            }

            if (entityDate.isAfter(moment(startDate)) && entityDate.isBefore(moment(endDate))) {
              axisData.push(entityDate);
            }
          } else {
            axisData.push(entityDate);
          }
        }

        // order the dates
        for (let i = 0; i < axisData.length - 1; i++) {
          for (let j = i + 1; j < axisData.length; j++) {
            if (axisData[i] > axisData[j]) {
              const temp = axisData[i];
              axisData[i] = axisData[j];
              axisData[j] = temp;
            }
          }
        }

        // include all the missing dates when includeZeros is true
        if (this.chart.includeZeros) {
          // get the start date
          let startDate = axisData[0];
          let endDate = axisData[axisData.length - 1];
          if (this.chart.startDate) startDate = moment(this.chart.startDate); // eslint-disable-line
          if (this.chart.endDate) endDate = moment(this.chart.endDate); // eslint-disable-line
          if (this.chart.currentEndDate) endDate = moment(); // eslint-disable-line

          const newAxisData = [];
          let index = 0;
          // make a new array containing all the dates between startDate and endDate
          while (moment(startDate).isBefore(moment(endDate))) {
            newAxisData.push(moment(startDate));
            if (axisData[index]) {
              while (moment(axisData[index]).isSame(moment(startDate), this.chart.timeInterval)) {
                if (!axisData[index]) break;
                newAxisData.push(moment(axisData[index]));
                index += 1;
              }
            }

            if (this.chart.timeInterval === "hour") {
              startDate = startDate.add(1, "hour");
            } else {
              startDate = startDate.add(1, "day");
            }
          }

          axisData = newAxisData;
        }


        // format the dates
        for (let i = 0; i < axisData.length; i++) {
          if (this.chart.timeInterval === "hour") {
            axisData[i] = axisData[i].format("MMM Do hA");
          } else if (this.chart.timeInterval === "day") {
            axisData[i] = axisData[i].format("MMM D");
          } else if (this.chart.timeInterval === "week") {
            axisData[i] = axisData[i].format("MMM [week] w");
          } else if (this.chart.timeInterval === "month") {
            axisData[i] = axisData[i].format("MMM");
          } else if (this.chart.timeInterval === "year") {
            axisData[i] = axisData[i].format("YYYY");
          } else {
            axisData[i] = axisData[i].format("MMM D");
          }
        }

        // get the labels and appearance count
        const formattedData = {};
        for (const value of axisData) {
          if (!formattedData[value] && formattedData[value] !== 0) {
            formattedData[value] = this.chart.includeZeros ? 0 : 1;
          } else if (formattedData[value] >= 0) {
            formattedData[value] += 1;
          }
        }

        if (this.chart.subType.indexOf("AddTimeseries") > -1) {
          let previousKey;
          Object.keys(formattedData).map((key) => {
            if (previousKey) {
              formattedData[key] = formattedData[previousKey] + formattedData[key];
            }

            previousKey = key;
            return formattedData[key];
          });
        }

        const labels = [];
        const yAxis = [];
        Object.keys(formattedData).forEach((key) => {
          labels.push(key);
          yAxis.push(formattedData[key]);
        });

        const formattedDataset = {
          label: dataset.legend,
          data: yAxis,
        };

        if (dataset.datasetColor) formattedDataset.borderColor = dataset.datasetColor;
        if (dataset.fillColor) formattedDataset.backgroundColor = dataset.fillColor;
        formattedDataset.fill = dataset.fill;

        datasets.push(formattedDataset);

        if (labels.length > maxLabelLength) {
          maxLabelLength = labels.length;
          selectedDatasetLabels = labels;
        }
      }
    }

    const chartJsData = {
      data: {
        labels: selectedDatasetLabels,
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

module.exports = LineChart;
