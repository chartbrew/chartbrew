const _ = require("lodash");
const moment = require("moment");

function determineType(data) {
  let dataType;
  if (data !== null && typeof data === "object" && data instanceof Array) {
    dataType = "array";
  }
  if (data !== null && typeof data === "object" && !(data instanceof Array)) {
    dataType = "object";
  }
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "boolean") {
    dataType = "boolean";
  }
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "number") {
    dataType = "number";
  }
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "string") {
    dataType = "string";
  }
  if (typeof data !== "object" && !(data instanceof Array) && moment(data).isValid()
    && ((typeof data === "number" && data.toString().length > 9) || (typeof data !== "number"))) {
    dataType = "date";
  }

  return dataType;
}

class AxisChart {
  constructor(data) {
    this.chart = data.chart;
    this.datasets = data.datasets;
    this.axisData = {
      x: [],
      y: [],
    };
  }

  plot() {
    try {
      for (let i = 0; i < this.datasets.length; i++) {
        const dataset = this.datasets[i];
        const { data } = dataset;
        const { yAxisOperation } = dataset.options;
        let { xAxis, yAxis } = dataset.options;
        let xData;
        let xType;
        let yData;
        let yType;
        let xAxisData = [];
        let yAxisData = [];

        // first, handle the xAxis
        if (xAxis.indexOf("root[]") > -1) {
          xAxis = xAxis.replace("root[].", "");
          // and data stays the same
          xData = data;
        } else {
          const arrayFinder = xAxis.substring(0, xAxis.indexOf("]") - 1);
          xData = _.get(data, arrayFinder);
        }

        if (!(xData instanceof Array)) throw new Error("The X field is not part of an Array");
        xData.map((item) => {
          const xValue = _.get(item, xAxis);
          if (xValue) xType = determineType(xValue);
          xAxisData.push(xValue);
          return item;
        });

        // now the yAxis
        if (yAxis.indexOf("root[]") > -1) {
          yAxis = yAxis.replace("root[].", "");
          // and data stays the same
          yData = data;
        } else {
          const arrayFinder = yAxis.substring(0, yAxis.indexOf("]") - 1);
          yAxis = yAxis.substring(yAxis.indexOf("]") + 1);
          yData = _.get(data, arrayFinder);
        }

        if (!(yData instanceof Array)) throw new Error("The Y field is not part of an Array");
        yData.map((item) => {
          const yValue = _.get(item, yAxis);
          if (yValue) yType = determineType(yValue);
          yAxisData.push(yValue);
          return item;
        });

        switch (xType) {
          case "date":
            xAxisData = this.processDate(xAxisData);
            break;
          case "number":
            xAxisData = this.processNumber(xAxisData);
            break;
          case "string":
            xAxisData = this.processString(xAxisData);
            break;
          case "boolean":
            xAxisData = this.processBoolean(xAxisData);
            break;
          case "object":
            xAxisData = this.processObject(xAxisData);
            break;
          case "array":
            xAxisData = this.processObject(xAxisData);
            break;
          default:
            xAxisData = this.processObject(xAxisData);
            break;
        }

        switch (yAxisOperation) {
          case "count":
            yAxisData = this.count(xAxisData);
            break;
          case "avg":
            yAxisData = this.average(yAxisData, xAxisData, yType);
            break;
          case "sum":
            yAxisData = this.sum(yAxisData, xAxisData, yType);
            break;
          default:
            yAxisData = this.count(xAxisData);
            break;
        }

        this.axisData.x.push(_.uniq(xAxisData));
        this.axisData.y.push(yAxisData);
      }
    } catch (e) {
      // console.log(e);
    }
  }

  processDate(data) {
    let axisData = data;
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

      const newAxisData = [];
      for (let i = 0; i < axisData.length; i++) {
        const entityDate = moment(axisData[i]);
        if (entityDate.isAfter(moment(startDate)) && entityDate.isBefore(moment(endDate))) {
          newAxisData.push(entityDate);
        }
      }

      axisData = newAxisData;
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

    return axisData;
  }

  processNumber() {

  }

  processString() {

  }

  processBoolean() {

  }

  processObject() {

  }

  /* OPERATIONS */
  count(xData) {
    // get the labels and appearance count
    const formattedData = {};
    for (const value of xData) {
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

    const yData = [];
    Object.keys(formattedData).forEach((key) => {
      yData.push(formattedData[key]);
    });

    return yData;
  }
}

module.exports = AxisChart;
