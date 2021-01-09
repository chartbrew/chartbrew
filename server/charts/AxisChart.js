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

  plot(skipDataProcessing) {
    // skip the data processing if required (this algorithm is time-expensive)
    if (
      !skipDataProcessing
        || !this.chart.chartData
        || !this.chart.chartData.data
        || !this.chart.chartData.data.labels
        || !this.chart.chartData.data.datasets
    ) {
      // check if the global date filter should be on or off
      // the filter should work only if all the datasets have a dateField
      let canDateFilter = true;
      let gXType;
      this.datasets.map((dataset) => {
        if (!dataset.options || !dataset.options.dateField) {
          canDateFilter = false;
        }
        return dataset;
      });

      for (let i = 0; i < this.datasets.length; i++) {
        const dataset = this.datasets[i];
        const { yAxisOperation, dateField } = dataset.options;
        let { xAxis, yAxis } = dataset.options;
        let xData;
        let yData;
        let yType;
        let xType;
        let xAxisData = [];
        let yAxisData = [];

        let filteredData = dataFilter(dataset.data, xAxis, dataset.options.conditions);

        if (dateField && this.chart.startDate && this.chart.endDate && canDateFilter) {
          let startDate = moment(this.chart.startDate);
          let endDate = moment(this.chart.endDate);

          if (this.chart.currentEndDate) {
            const timeDiff = endDate.diff(startDate, "days");
            endDate = moment().endOf("day");
            startDate = endDate.clone().subtract(timeDiff, "days").startOf("day");
          }

          const dateConditions = [{
            field: dateField,
            value: startDate,
            operator: "greaterOrEqual",
          }, {
            field: dateField,
            value: endDate,
            operator: "lessOrEqual",
          }];

          filteredData = dataFilter(filteredData, dateField, dateConditions);
        }

        // first, handle the xAxis
        if (xAxis.indexOf("root[]") > -1) {
          xAxis = xAxis.replace("root[].", "");
          // and data stays the same
          xData = filteredData;
        } else {
          const arrayFinder = xAxis.substring(0, xAxis.indexOf("]") - 1).replace("root.", "");
          xAxis = xAxis.replace("[]", "").replace("root.", "");
          xData = _.get(filteredData, arrayFinder);
        }

        let xAxisFieldName = xAxis;

        if (xAxisFieldName.indexOf(".") > -1) {
          xAxisFieldName = xAxisFieldName.substring(xAxisFieldName.lastIndexOf(".") + 1);
          xAxis = xAxisFieldName;
        }

        if (!(xData instanceof Array)) throw new Error("The X field is not part of an Array");
        xData.map((item) => {
          const xValue = _.get(item, xAxis);
          if (xValue) {
            xType = determineType(xValue);
          }
          xAxisData.push(xValue);
          return item;
        });

        gXType = xType;

        // X AXIS data processing
        switch (xType) {
          case "date":
            xAxisData = this.processDate(xAxisData, canDateFilter);
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
          const arrayFinder = yAxis.substring(0, yAxis.indexOf("]") - 1).replace("root.", "");
          yAxis = yAxis.substring(yAxis.indexOf("]") + 2);

          yData = _.get(filteredData, arrayFinder);
          yData = _.map(yData, yAxis);
        }

        if (!(yData instanceof Array)) throw new Error("The Y field is not part of an Array");
        yData.map((item, index) => {
          const yValue = _.get(item, yAxis);
          if (yValue) {
            yType = determineType(yValue);
            // only add the yValue if it corresponds to one of the x values found above
            if (_.indexOf(xAxisData.filtered, yData[index][xAxisFieldName]) > -1) {
              yAxisData.push({ x: xAxisData.filtered[index], y: yValue });
            } else if (xType === "date"
                && _.findIndex(
                  xAxisData.filtered,
                  (dateValue) => (
                    new Date(dateValue).getTime()
                      === new Date(yData[index][xAxisFieldName]).getTime()
                  )
                )) {
              yAxisData.push({ x: xAxisData.formatted[index], y: yValue });
            }
          } else {
            yType = determineType(item);
            yAxisData.push({ x: xAxisData.filtered[index], y: item });
          }
          return item;
        });

        // Y CHART data processing
        switch (yAxisOperation) {
          case "none":
            yAxisData = this.noOp(yAxisData, xAxisData.formatted, xType, yType);
            break;
          case "count":
            yAxisData = this.count(xAxisData.formatted);
            break;
          case "avg":
            yAxisData = this.noOp(yAxisData, xAxisData.formatted, xType, yType, "avg");
            break;
          case "sum":
            yAxisData = this.noOp(yAxisData, xAxisData.formatted, xType, yType, "sum");
            break;
          default:
            yAxisData = this.noOp(yAxisData, xAxisData.formatted, xType, yType);
            break;
        }

        // now push the final data into the axis data x & y
        this.axisData.y.push([]);
        this.axisData.x.push([]);
        const xLength = this.axisData.x.length - 1;
        const yLength = this.axisData.y.length - 1;

        Object.keys(yAxisData).forEach((key) => {
          // if the key doesn't already exist on the X axis, add it
          if (xType !== "date" && _.indexOf(this.axisData.x[xLength], key) === -1) {
            this.axisData.x[xLength].push(key);
          } else if (xType === "date") {
            let timestampFormat = null;
            if (
              parseInt(key, 10).toString() === key.toString()
              && key.toString().length === 10
            ) {
              timestampFormat = "X";
            }
            // need to check if a date in the same interval already exists in the array
            const existingDate = _
              .find(
                this.axisData.x[xLength], (x) => {
                  return moment(x, timestampFormat)
                    .isSame(moment(key, timestampFormat), this.chart.timeInterval);
                }
              );

            if (!existingDate) this.axisData.x[xLength].push(key);
          }

          // add the y values
          this.axisData.y[yLength].push(yAxisData[key]);
        });

        // if the include zero values on the chart is selected
        if (this.chart.includeZeros && gXType === "date") {
          const tempXData = this.axisData.x[xLength];

          const newX = [];
          const newY = [];

          for (let i = 0; i < tempXData.length; i++) {
            newX.push(tempXData[i]);
            newY.push(this.axisData.y[yLength][i]);

            if (i === tempXData.length - 1) break;

            const currDate = moment(tempXData[i], this.dateFormat);
            const nextDate = moment(tempXData[i + 1], this.dateFormat);
            if (nextDate.diff(currDate, this.chart.timeInterval) > 1) {
              currDate.add(1, this.chart.timeInterval);
              while (currDate.isBefore(nextDate)) {
                newX.push(currDate.format(this.dateFormat));
                newY.push(0);
                currDate.add(1, this.chart.timeInterval);
              }
            }
          }

          this.axisData.x[xLength] = newX;
          this.axisData.y[yLength] = newY;
        }

        // if it's an accumulation chart
        if (this.chart.subType.indexOf("AddTimeseries") > -1) {
          const newY = [];
          this.axisData.y[yLength].map((item, index) => {
            if (index > 0) {
              newY.push(item + newY[newY.length - 1]);
            } else {
              newY.push(item);
            }

            return item;
          });

          this.axisData.y[yLength] = newY;
        }
      }

      // now unify all the datasets
      // all the arrays on the Y Axis must correspond with only one array on X
      let unifiedX = [];
      this.axisData.x.map((arr) => {
        unifiedX = _.concat(unifiedX, arr);
        return arr;
      });
      unifiedX = _.uniq(unifiedX)
        .sort((a, b) => moment(a, this.dateFormat).diff(moment(b, this.dateFormat)));

      unifiedX.map((x, index) => {
        for (let i = 0; i < this.axisData.x.length; i++) {
          if (_.indexOf(this.axisData.x[i], x) === -1) {
            this.axisData.x[i].splice(index, 0, x);

            if (this.chart.subType.indexOf("AddTimeseries") > -1) {
              if (index > 0) this.axisData.y[i].splice(index, 0, this.axisData.y[i][index - 1]);
              else this.axisData.y[i].splice(index, 0, this.axisData.y[i][index]);
            } else {
              this.axisData.y[i].splice(index, 0, 0);
            }
          }
        }
        return x;
      });

      this.axisData.x = unifiedX;
    }

    if (skipDataProcessing) {
      this.axisData.x = this.chart.chartData.data.labels;
      this.chart.chartData.data.datasets.map((dataset) => {
        this.axisData.y.push(dataset.data);
        return dataset;
      });
    }

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
    for (let i = 0; i < axisData.length; i++) {
      if (
        parseInt(axisData[i], 10).toString() === axisData[i].toString()
        && axisData[i].toString().length === 10
      ) {
        axisData[i] = moment(axisData[i], "X");
      } else {
        axisData[i] = moment(axisData[i]);
      }
    }
    axisData = axisData.sort((a, b) => a.diff(b));

    finalData.filtered = _.clone(axisData);
    finalData.filtered = finalData.filtered.map((item) => item.format());

    const startDate = axisData[0];
    const endDate = axisData[axisData.length - 1];
    // format the dates
    for (let i = 0; i < axisData.length; i++) {
      switch (this.chart.timeInterval) {
        case "hour":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year()) {
            this.dateFormat = "YYYY/MM/DD hA";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM Do hA";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "day":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year() || moment().year() !== startDate.year()) {
            this.dateFormat = "YYYY MMM D";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM D";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "week":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year() || moment().year() !== startDate.year()) {
            this.dateFormat = "YYYY MMM [w] w";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM [w] w";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "month":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year() || moment().year() !== startDate.year()) {
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
  noOp(data, xData, xType, yType, op) {
    const yData = {};

    data.map((item, index) => {
      let key = item.x;
      if (xType === "date") key = xData[index];

      if (!yData[key] && yData[key] !== 0) {
        yData[key] = [item.y];
      } else {
        yData[key].push(item.y);
      }

      return item;
    });

    const finalData = {};
    Object.keys(yData).forEach((key) => {
      let finalItem = yData[key][0];
      if (op === "sum" && yType === "number") finalItem = _.reduce(yData[key], (sum, n) => sum + n);
      if (op === "avg" && yType === "number") {
        finalItem = _.reduce(yData[key], (avg, n) => avg + n);
        finalItem /= yData[key].length;
        finalItem = parseFloat(finalItem.toFixed(2));
      }

      finalData[key] = finalItem;
    });

    return finalData;
  }

  count(xData) {
    const countData = {};
    xData.map((item) => {
      if (!countData[item]) countData[item] = 1;
      else countData[item]++;

      return item;
    });

    return countData;
  }
}

module.exports = AxisChart;
