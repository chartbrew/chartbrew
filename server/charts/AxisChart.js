const _ = require("lodash");
const moment = require("moment");
const NewBarChart = require("./NewBarChart");
const NewLineChart = require("./NewLineChart");
const NewPieChart = require("./NewPieChart");
const determineType = require("../modules/determineType");
const dataFilter = require("./dataFilter");

moment.suppressDeprecationWarnings = true;

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
        const { yAxisOperation } = dataset.options;
        let { xAxis, yAxis } = dataset.options;
        let xData;
        let xType;
        let yData;
        let yType;
        let xAxisData = [];
        let yAxisData = [];

        const filteredData = dataFilter(dataset);

        // first, handle the xAxis
        if (xAxis.indexOf("root[]") > -1) {
          xAxis = xAxis.replace("root[].", "");
          // and data stays the same
          xData = filteredData;
        } else {
          const arrayFinder = xAxis.substring(0, xAxis.indexOf("]") - 1);
          xData = _.get(filteredData, arrayFinder);
        }

        let xAxisFieldName = xAxis;
        if (xAxisFieldName.indexOf(".") > -1) {
          xAxisFieldName = xAxisFieldName.substring(xAxisFieldName.lastIndexOf(".") + 1);
        }

        if (!(xData instanceof Array)) throw new Error("The X field is not part of an Array");
        xData.map((item) => {
          const xValue = _.get(item, xAxis);
          if (xValue) xType = determineType(xValue);
          xAxisData.push(xValue);
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

        // now the yAxis
        if (yAxis.indexOf("root[]") > -1) {
          yAxis = yAxis.replace("root[].", "");
          // and data stays the same
          yData = filteredData;
        } else {
          const arrayFinder = yAxis.substring(0, yAxis.indexOf("]") - 1);
          yAxis = yAxis.substring(yAxis.indexOf("]") + 1);
          yData = _.get(filteredData, arrayFinder);
        }

        if (!(yData instanceof Array)) throw new Error("The Y field is not part of an Array");
        yData.map((item, index) => {
          const yValue = _.get(item, yAxis);
          if (yValue) yType = determineType(yValue);

          // only add the yValue if it corresponds to one of the x values found above
          if (_.indexOf(xAxisData.filtered, yData[index][xAxisFieldName]) > -1) {
            yAxisData.push({ x: yData[index][xAxisFieldName], y: yValue });
          } else if (xType === "date") {
            xAxisData.filtered.forEach((dateValue) => {
              if (moment(dateValue).isSame(yData[index][xAxisFieldName])) {
                yAxisData.push({ x: yData[index][xAxisFieldName], y: yValue });
              }
            });
          }
          return item;
        });

        // Y CHART data processing
        switch (yAxisOperation) {
          case "none":
            yAxisData = this.noOp(xAxisData.filtered, yAxisData);
            break;
          case "count":
            yAxisData = this.count(xAxisData.formatted);
            break;
          case "avg":
            yAxisData = this.sum(xAxisData.formatted, yAxisData, yType, true);
            break;
          case "sum":
            yAxisData = this.sum(xAxisData.formatted, yAxisData, yType);
            break;
          default:
            yAxisData = this.noOp(xAxisData.filtered, yAxisData);
            break;
        }

        this.axisData.x = _.uniq(xAxisData.formatted);
        this.axisData.y.push(yAxisData);
        // this.axisData.y.push([15000, 0, 0, 0]);
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
    const finalData = {
      filtered: [],
      formatted: [],
    };

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
      // make a new array containing all the dates between startDate and endDate
      while (startDate.isBefore(endDate)) {
        newAxisData.push(startDate.clone());
        for (let d = 0; d < axisData.length; d++) {
          if (axisData[d].isSame(startDate, this.chart.timeInterval)) {
            newAxisData.push(axisData[d]);
          }
        }

        startDate.add(1, this.chart.timeInterval).startOf(this.chart.timeInterval);
      }

      axisData = newAxisData;
    }

    finalData.filtered = _.clone(axisData);
    finalData.filtered = finalData.filtered.map((item) => item.format());

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

    finalData.formatted = axisData;

    return finalData;
  }

  processNumber(data) {
    return {
      filtered: data,
      formatted: data,
    };
  }

  processString(data) {
    return {
      filtered: data,
      formatted: data,
    };
  }

  processBoolean(data) {
    return {
      filtered: data,
      formatted: data,
    };
  }

  processObject(data) {
    return {
      filtered: data,
      formatted: data,
    };
  }

  /* OPERATIONS */
  noOp(xData, yData) {
    const formattedData = [];
    const alreadyProcessed = [];
    for (let i = 0; i < yData.length; i++) {
      if (
        determineType(yData[i].x) !== "date"
        && _.indexOf(xData, yData[i].x) > -1
        && _.indexOf(alreadyProcessed, yData[i].x) === -1
      ) {
        formattedData.push(yData[i].y);
        alreadyProcessed.push(yData[i].x);
      }

      if (determineType(yData[i].x) === "date") {
        xData.forEach((date) => {
          if (moment(date).isSame(yData[i].x) && _.indexOf(alreadyProcessed, yData[i].x) === -1) {
            formattedData.push(yData[i].y);
            alreadyProcessed.push(yData[i].x);
          }
        });
      }
    }

    return formattedData;
  }

  count(xData) {
    // get the labels and appearance count
    const formattedData = {};
    for (const value of xData) {
      if (!formattedData[value] && formattedData[value] !== 0) {
        formattedData[value] = determineType(xData[0]) === "date" && this.chart.includeZeros ? 0 : 1;
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
    for (let i = 0; i < yData.length; i++) {
      if (i === 0 || !formattedData[yData[i].x]) {
        if (average) formattedData[yData[i].x] = [yData[i].y];
        else formattedData[yData[i].x] = yData[i].y;
      } else if (average) {
        formattedData[yData[i].x].push(yData[i].y);
      } else {
        formattedData[yData[i].x] += yData[i].y;
      }
    }

    const axisData = [];
    if (average) {
      Object.keys(formattedData).forEach((key) => {
        axisData.push(_.sum(formattedData[key]) / formattedData[key].length);
      });
    } else {
      Object.values(formattedData).forEach((value) => axisData.push(value));
    }

    return axisData;
  }
}

module.exports = AxisChart;
