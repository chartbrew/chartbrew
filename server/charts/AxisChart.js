const _ = require("lodash");
const moment = require("moment");
const BarChart = require("./BarChart");
const LineChart = require("./LineChart");
const PieChart = require("./PieChart");
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
    this.dateFormat = "";
  }

  plot() {
    const finalXAxisData = [];
    let gXType;
    for (let i = 0; i < this.datasets.length; i++) {
      const dataset = this.datasets[i];
      const { yAxisOperation } = dataset.options;
      let { xAxis, yAxis } = dataset.options;
      let xData;
      let yData;
      let yType;
      let xType;
      let xAxisData = [];
      let yAxisData = [];

      let filteredData = dataFilter(dataset.data, xAxis, dataset.options.conditions);

      if (dataset.dateField && this.chart.startDate && this.chart.endDate) {
        const startDate = moment(this.chart.startDate).startOf(this.chart.timeInterval);
        const endDate = moment(this.chart.endDate).endOf(this.chart.timeInterval);

        const dateConditions = [{
          field: dataset.dateField,
          value: startDate,
          operator: "greaterOrEqual",
        }, {
          field: dataset.dateField,
          value: endDate,
          operator: "lessOrEqual",
        }];

        filteredData = dataFilter(filteredData, dataset.dateField, dateConditions);
      }

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
      gXType = xType;

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

      // if the operation is count, make sure the xData has only unique values
      if (yAxisOperation === "none") {
        finalXAxisData.push(xAxisData.formatted);
      } else {
        finalXAxisData.push(_.uniq(xAxisData.formatted));
      }
      this.axisData.y.push(yAxisData);
    }

    const logObj = [];
    // group x & y values and eliminate duplicates on the X axis
    for (let i = 0; i < finalXAxisData.length; i++) {
      logObj[i] = {};
      for (let j = 0; j < finalXAxisData[i].length; j++) {
        if (!logObj[i][finalXAxisData[i][j]]) logObj[i][finalXAxisData[i][j]] = [];

        logObj[i][finalXAxisData[i][j]].push(this.axisData.y[i][j]);
      }
    }

    // now get all the keys and merge them in one array - this will help map the final X Axis
    let allKeys = [];
    logObj.map((item) => {
      Object.keys(item).forEach((key) => {
        allKeys.push(key);
      });

      return item;
    });

    if (gXType === "number") {
      allKeys = _.uniq(allKeys).sort();
    } else if (gXType === "date") {
      allKeys = _.uniq(allKeys).sort((a, b) => {
        return moment(a, this.dateFormat) - moment(b, this.dateFormat);
      });
    } else {
      allKeys = _.uniq(allKeys);
    }

    // now build each dataset matching keys from logObj and allKeys
    for (let i = 0; i < logObj.length; i++) {
      this.axisData.y[i] = [];
      for (const key of allKeys) {
        // add just the first element for now
        if (logObj[i][key]) {
          this.axisData.y[i].push(logObj[i][key][0]);
        } else {
          this.axisData.y[i].push(0);
        }
      }
    }
    this.axisData.x = allKeys;

    let chart;
    switch (this.chart.type) {
      case "line":
        chart = new LineChart(this.chart, this.datasets, this.axisData);
        break;
      case "bar":
        chart = new BarChart(this.chart, this.datasets, this.axisData);
        break;
      default:
        chart = new PieChart(this.chart, this.datasets, this.axisData);
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
        newAxisData.push(startDate);
        for (let d = 0; d < axisData.length; d++) {
          if (axisData[d].isSame(startDate, this.chart.timeInterval)) {
            newAxisData.push(axisData[d]);
          }
        }

        startDate = startDate
          .clone()
          .add(1, this.chart.timeInterval).startOf(this.chart.timeInterval);
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
            this.dateFormat = "YYYY/MM/DD hA";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM Do hA";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "day":
          if (startDate.year() !== endDate.year()) {
            this.dateFormat = "YYYY MMM D";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM D";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "week":
          if (startDate.year() !== endDate.year()) {
            this.dateFormat = "YYYY MMM [w] w";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM [w] w";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "month":
          if (startDate.year() !== endDate.year()) {
            this.dateFormat = "MMM YYYY";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "year":
          this.dateFormat = "YYYY";
          axisData[i] = axisData[i].format(this.dateFormat);
          break;
        default:
          this.dateFormat = "MMM D";
          axisData[i] = axisData[i].format(this.dateFormat);
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
    const finalData = [];
    yData.map((item) => finalData.push(item.y));
    return finalData;
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
