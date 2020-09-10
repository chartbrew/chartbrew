const moment = require("moment");
const dataFinder = require("../modules/dataFinder");
const tooltipsStyle = require("./tooltipsStyle");

class LineChart {
  constructor(data) {
    this.chart = data.chart;
    this.datasets = data.datasets;

    // make sure the dates start from midnight
    if (this.chart.startDate) {
      this.chart.startDate = moment(this.chart.startDate).startOf("day");
    }
    if (this.chart.endDate) {
      this.chart.endDate = moment(this.chart.endDate).endOf("day");
    }

    // if (this.chart.currentEndDate) {
    //   const timeDiff = this.chart.endDate.diff(this.chart.startDate, "days");
    //   this.chart.endDate = moment();
    //   this.chart.startDate = this.chart.endDate.subtract(timeDiff, "days");
    // }
  }

  /*
  ** Get data for a chart that aggregates a length(obj) over time
  */
  async aggregateOverTime() {
    const datasets = [];
    let maxLabelLength = 0;
    let selectedDatasetLabels = 0;

    // go through all the datasets
    for (const dataset of this.datasets) {
      if (!dataset.deleted) {
        // get the array in the selector chain
        const arrayFieldSelector = [];
        for (const value of dataset.options.xAxis.split(".")) {
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
          connectorData = dataset.data;
        } else {
          connectorData = dataFinder.findField(dataset.data, arrayFieldSelector, 1);
        }

        // build up the selector array which is used to show the way to the date value
        let xFieldSelector = dataset.options.xAxis;
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
            let startDate = moment(this.chart.startDate);
            let endDate = moment(this.chart.endDate);

            // check to see if the current date is set to be the endDate
            // this means the startDate and endDate will move accross in time
            if (this.chart.currentEndDate) {
              const timeDiff = endDate.diff(startDate, "days");
              endDate = moment().endOf("day");
              startDate = endDate.clone().subtract(timeDiff, "days").startOf("day");
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
          if (this.chart.startDate && this.chart.endDate && this.chart.currentEndDate) {
            const timeDiff = endDate.diff(startDate, "days");
            endDate = moment().endOf("day");
            startDate = endDate.clone().subtract(timeDiff, "days").startOf("day");
          }

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

            startDate = startDate.add(1, this.chart.timeInterval).startOf(this.chart.timeInterval);
          }

          axisData = newAxisData;
        }

        const startDate = axisData[0];
        const endDate = axisData[axisData.length - 1];
        // format the dates
        for (let i = 0; i < axisData.length; i++) {
          switch (this.chart.timeInterval) {
            case "hour":
              if (startDate.year() !== endDate.year()) {
                axisData[i] = axisData[i].format("YYYY/MM/DD hA");
              } else {
                axisData[i] = axisData[i].format("MMM Do hA");
              }
              break;
            case "day":
              if (startDate.year() !== endDate.year()) {
                axisData[i] = axisData[i].format("YYYY MMM D");
              } else {
                axisData[i] = axisData[i].format("MMM D");
              }
              break;
            case "week":
              if (startDate.year() !== endDate.year()) {
                axisData[i] = axisData[i].format("YYYY MMM [w] w");
              } else {
                axisData[i] = axisData[i].format("MMM [w] w");
              }
              break;
            case "month":
              if (startDate.year() !== endDate.year()) {
                axisData[i] = axisData[i].format("MMM YYYY");
              } else {
                axisData[i] = axisData[i].format("MMM");
              }
              break;
            case "year":
              axisData[i] = axisData[i].format("YYYY");
              break;
            default:
              axisData[i] = axisData[i].format("MMM D");
              break;
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
          label: dataset.options.legend,
          data: yAxis,
        };

        if (dataset.options.datasetColor) {
          formattedDataset.borderColor = dataset.options.datasetColor;
        }
        if (dataset.options.fillColor) {
          formattedDataset.backgroundColor = dataset.options.fillColor;
        }
        formattedDataset.fill = dataset.options.fill;

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
      }
    };

    return new Promise((resolve) => resolve(chartJsData));
  }
}

module.exports = LineChart;
