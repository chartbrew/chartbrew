const _ = require("lodash");
const moment = require("moment");
const NewBarChart = require("./NewBarChart");
const NewLineChart = require("./NewLineChart");
const NewPieChart = require("./NewPieChart");
const determineType = require("../modules/determineType");

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

        // X AXIS data processing
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

        // Y CHART data processing
        switch (yAxisOperation) {
          case "count":
            yAxisData = this.count(xAxisData);
            break;
          case "avg":
            yAxisData = this.sum(xAxisData, yAxisData, yType, true);
            break;
          case "sum":
            yAxisData = this.sum(xAxisData, yAxisData, yType);
            break;
          default:
            yAxisData = this.sum(xAxisData, yAxisData, yType, true);
            break;
        }

        this.axisData.x = _.uniq(xAxisData);
        this.axisData.y.push(yAxisData);
      }
    } catch (e) {
      // console.log(e);
    }

    let chart;
    switch (this.chart.type) {
      case "line":
        chart = new NewLineChart(this.chart, this.datasets, this.axisData);
        break;
      case "bar":
        chart = new NewBarChart(this.chart, this.datasets, this.axisData);
        break;
      default:
        chart = new NewPieChart(this.chart, this.datasets, this.axisData);
        break;
    }

    return chart.getConfiguration();
  }

  processDate(data) {
    let axisData = data;
    // order the dates
    for (let i = 0; i < axisData.length - 1; i++) {
      for (let j = i + 1; j < axisData.length; j++) {
        // make sure all dates are transformed into moment objects
        axisData[i] = moment(axisData[i]);
        axisData[j] = moment(axisData[j]);
        // --
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
        const entityDate = axisData[i];
        if (entityDate.isAfter(startDate) && entityDate.isBefore(endDate)) {
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
      while (startDate.isBefore(endDate)) {
        newAxisData.push(startDate);
        if (axisData[index]) {
          while (axisData[index].isSame(startDate, this.chart.timeInterval)) {
            if (!axisData[index]) break;
            newAxisData.push(axisData[index]);
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

  processNumber(data) {
    return data;
  }

  processString(data) {
    return data;
  }

  processBoolean(data) {
    return data;
  }

  processObject(data) {
    return data;
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

    if (determineType(xData[0]) === "date" && this.chart.subType.indexOf("AddTimeseries") > -1) {
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

  sum(xData, yData, type, average) {
    if (type !== "number") {
      // use count instead
      return this.count(xData);
    }

    const formattedData = {};
    for (let i = 0; i < xData.length; i++) {
      if (i === 0 || xData[i] !== xData[i - 1]) {
        formattedData[xData[i]] = [yData[i]];
      } else {
        formattedData[xData[i]].push(yData[i]);
      }
    }

    const axisData = [];
    Object.keys(formattedData).forEach((key) => {
      let sum = 0;
      for (let i = 0; i < formattedData[key].length; i++) {
        sum += formattedData[key][i];
      }

      if (average) {
        axisData.push(sum / formattedData[key].length);
      } else {
        axisData.push(sum);
      }
    });

    return axisData;
  }
}

module.exports = AxisChart;
