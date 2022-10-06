const _ = require("lodash");
const moment = require("moment");
const {
  isSameDay, isSameHour, isSameWeek, isSameMonth, isSameYear,
} = require("date-fns");
const FormulaParser = require("hot-formula-parser").Parser;

const BarChart = require("./BarChart");
const LineChart = require("./LineChart");
const PieChart = require("./PieChart");
const determineType = require("../modules/determineType");
const dataFilter = require("./dataFilter");

moment.suppressDeprecationWarnings = true;

const parser = new FormulaParser();

const areDatesTheSame = (first, second, interval) => {
  let isTimestamp = false;
  let firstDate = first;
  if (`${first}` === `${parseInt(first, 10)}`) {
    isTimestamp = true;
    firstDate = parseInt(first, 10);
  }

  switch (interval) {
    case "hour":
      if (isTimestamp) firstDate *= 1000;
      return isSameHour(new Date(firstDate), new Date(second));
    case "day":
      if (isTimestamp) firstDate *= 1000;
      return isSameDay(new Date(firstDate), new Date(second));
    case "week":
      if (isTimestamp) firstDate *= 1000;
      return isSameWeek(new Date(firstDate), new Date(second));
    case "month":
      if (isTimestamp) firstDate *= 1000;
      return isSameMonth(new Date(firstDate), new Date(second));
    case "year":
      if (isTimestamp) firstDate *= 1000;
      return isSameYear(new Date(firstDate), new Date(second));
    default:
      return false;
  }
};

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

  plot(skipDataProcessing, filters) {
    // skip the data processing if not required (this algorithm is CPU-intensive)
    const conditionsOptions = [];

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

      let startDate;
      let endDate;
      if (this.chart.startDate && this.chart.endDate) {
        startDate = moment(this.chart.startDate);
        endDate = moment(this.chart.endDate);
      }

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

        const filterData = dataFilter(dataset.data, xAxis, dataset.options.conditions);
        if (filterData.conditionsOptions) {
          conditionsOptions.push({
            dataset_id: dataset.options.id,
            conditions: filterData.conditionsOptions,
          });
        }
        let filteredData = filterData.data;

        if (dateField && this.chart.startDate && this.chart.endDate && canDateFilter) {
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

          filteredData = dataFilter(filteredData, dateField, dateConditions).data;
        }

        if (filters && filters.length > 0) {
          if (dataset.options && dataset.options.fieldsSchema) {
            let found = false;
            Object.keys(dataset.options.fieldsSchema).forEach((key) => {
              if (_.find(filters, (o) => o.field === key)) {
                found = true;
              }
            });

            if (found) {
              filters.map((filter) => {
                filteredData = dataFilter(filteredData, filter.field, filters).data;
                return filter;
              });
            }
          }
        }

        // first, handle the xAxis
        if (xAxis.indexOf("root[]") > -1) {
          xAxis = xAxis.replace("root[].", "");
          // and data stays the same
          xData = filteredData;
        } else {
          const arrayFinder = xAxis.substring(0, xAxis.indexOf("]") - 1).replace("root.", "");
          xAxis = xAxis.substring(xAxis.indexOf("]") + 2);

          xData = _.get(filteredData, arrayFinder);
        }

        let xAxisFieldName = xAxis;

        if (xAxisFieldName.indexOf(".") > -1) {
          xAxisFieldName = xAxisFieldName.substring(xAxisFieldName.lastIndexOf(".") + 1);
        }

        if (!(xData instanceof Array)) throw new Error("The X field is not part of an Array");
        const unprocessedX = [];
        xData.map((item) => {
          const xValue = _.get(item, xAxis);
          if (xValue) {
            xType = determineType(xValue);
          }
          unprocessedX.push(xValue);
          return item;
        });

        gXType = xType;
        // X AXIS data processing
        switch (xType) {
          case "date":
            xAxisData = this.processDate(unprocessedX, canDateFilter);
            break;
          case "number":
            xAxisData = this.processNumber(unprocessedX);
            break;
          case "string":
            xAxisData = this.processString(unprocessedX);
            break;
          case "boolean":
            xAxisData = this.processBoolean(unprocessedX);
            break;
          case "object":
            xAxisData = this.processObject(unprocessedX);
            break;
          case "array":
            xAxisData = this.processObject(unprocessedX);
            break;
          default:
            xAxisData = this.processObject(unprocessedX);
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
        }

        // make sure the y results are ordered according to the x results for date types
        if (gXType === "date") {
          const orderHelper = [];
          const yDataTemp = _.cloneDeep(yData);
          xAxisData.filtered.forEach((xItem) => {
            // go through each y item in the yData array to make sure they are ordered correctly
            for (let y = 0; y < yDataTemp.length; y++) {
              const valToCompare = _.get(yDataTemp[y], xAxis);
              if (valToCompare
                && ((
                  valToCompare.toString().length === 10
                  && areDatesTheSame(parseInt(valToCompare, 10), xItem, this.chart.interval))
                || areDatesTheSame(valToCompare, xItem, this.chart.timeInterval))
              ) {
                orderHelper.push(yDataTemp[y]);
                yDataTemp.splice(y, 1);
                break;
              }
            }
          });

          yData = orderHelper;
        }

        if (!(yData instanceof Array)) throw new Error("The Y field is not part of an Array");

        yData.forEach((item, index) => {
          const yValue = _.get(item, yAxis);
          if (yValue || yValue === 0) {
            yType = determineType(yValue);
            // only add the yValue if it corresponds to one of the x values found above
            const selectorValue = xAxis.indexOf(".") > -1 ? _.get(yData[index], xAxis) : yData[index][xAxisFieldName];

            // the index check is used only in case we're looking for dates
            let indexCheck;
            if (xType === "date") {
              indexCheck = _.findIndex(
                xAxisData.filtered,
                (dateValue) => (
                  areDatesTheSame(dateValue, yData[index][xAxisFieldName], this.chart.interval)
                )
              );
            }

            if (_.indexOf(xAxisData.filtered, selectorValue) > -1) {
              yAxisData.push({ x: xAxisData.filtered[index], y: yValue });
            } else if (xType === "date" && (indexCheck !== -1 || indexCheck !== false)) {
              yAxisData.push({ x: xAxisData.formatted[index], y: yValue });
            }
          } else {
            let newItem = item;
            if (yValue === 0) {
              yType = "number";
            } else if (yType === "array") {
              newItem = [];
            } else if (yAxis && yAxis.split("[]").length > 1) {
              const nestedArray = _.get(item, yAxis.split("[]")[0]);
              // console.log("nestedArray", nestedArray);
              const arrayField = _.get(nestedArray[0], yAxis.split("[]")[1].slice(1));
              yType = determineType(arrayField);
            }
            yAxisData.push({ x: xAxisData.filtered[index], y: newItem });
          }
        });

        // Y CHART data processing
        switch (yAxisOperation) {
          case "none":
            yAxisData = this.operate(yAxisData, xAxisData.formatted, xType, yType, yAxis);
            break;
          case "count":
            yAxisData = this.count(xAxisData.formatted, yType, yAxisData, yAxis);
            break;
          case "avg":
            if (yType === "array") {
              yAxisData = this.count(xAxisData.formatted, yType, yAxisData, "avg", yAxis, dataset.options.averageByTotal);
            } else {
              yAxisData = this.operate(yAxisData, xAxisData.formatted, xType, yType, "avg", yAxis, dataset.options.averageByTotal);
            }
            break;
          case "sum":
            if (yType === "array") {
              yAxisData = this.count(xAxisData.formatted, yType, yAxisData, yAxis);
            } else {
              yAxisData = this.operate(yAxisData, xAxisData.formatted, xType, yType, "sum", yAxis);
            }
            break;
          case "min":
            if (yType === "array") {
              yAxisData = this.count(xAxisData.formatted, yType, yAxisData, "min", yAxis);
            } else {
              yAxisData = this.operate(yAxisData, xAxisData.formatted, xType, yType, "min", yAxis);
            }
            break;
          case "max":
            if (yType === "array") {
              yAxisData = this.count(xAxisData.formatted, yType, yAxisData, "max", yAxis);
            } else {
              yAxisData = this.operate(yAxisData, xAxisData.formatted, xType, yType, "max", yAxis);
            }
            break;
          default:
            yAxisData = this.operate(yAxisData, xAxisData.formatted, xType, yType, yAxis);
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
      // if we're dealing with weekly or hourly data, make sure to not add the same data twice
      let unifiedX = [];
      this.axisData.x.forEach((arr, index) => {
        if ((this.chart.timeInterval === "week" || this.chart.timeInterval === "hour") && index > 0) {
          arr.forEach((item) => {
            if (unifiedX.indexOf(item) === -1) {
              const allItemsFound = arr.filter((x) => x === item);
              unifiedX = _.concat(unifiedX, allItemsFound);
            }
          });
        } else {
          unifiedX = _.concat(unifiedX, arr);
        }
      });

      if (this.chart.timeInterval === "week" || this.chart.timeInterval === "hour") {
        unifiedX = unifiedX
          .sort((a, b) => moment(a, this.dateFormat).diff(moment(b, this.dateFormat)));
      } else {
        unifiedX = _.uniq(unifiedX)
          .sort((a, b) => moment(a, this.dateFormat).diff(moment(b, this.dateFormat)));
      }

      // if we're dealing with dates, make sure to add the missing ones at the end
      if (gXType === "date" && startDate && endDate) {
        const lastValue = moment(unifiedX[unifiedX.length - 1], this.dateFormat);
        lastValue.add(1, this.chart.timeInterval);
        while (lastValue.isBefore(endDate)) {
          unifiedX.push(lastValue.clone().format(this.dateFormat));
          lastValue.add(1, this.chart.timeInterval);
        }
      }

      unifiedX.forEach((x, index) => {
        for (let i = 0; i < this.axisData.x.length; i++) {
          if (_.indexOf(this.axisData.x[i], x) === -1) {
            this.axisData.x[i].splice(index, 0, x);

            if (index > 0 && this.chart.subType.indexOf("AddTimeseries") > -1) {
              this.axisData.y[i].splice(index, 0, this.axisData.y[i][index - 1]);
            } else {
              this.axisData.y[i].splice(index, 0, 0);
            }
          }
        }
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

    if (!skipDataProcessing) {
      for (let i = 0; i < this.datasets.length; i++) {
        if (this.datasets[i].options && this.datasets[i].options.formula) {
          const { formula } = this.datasets[i].options;
          this.axisData.y[i] = this.axisData.y[i].map((val) => {
            const before = formula.substring(0, formula.indexOf("{"));
            const after = formula.substring(formula.indexOf("}") + 1);
            const expressionString = formula.substring(formula.indexOf("{") + 1, formula.indexOf("}"));
            const expression = expressionString.replace(/val/g, val);

            const newVal = parser.parse(expression);

            let finalVal = `${before}${+(newVal.result.toFixed(2)).toLocaleString()}${after}`;
            if (this.chart.mode !== "kpi") {
              finalVal = +(newVal.result.toFixed(2)).toLocaleString();
            }

            return finalVal;
          });
        }
      }
    }

    let chart;
    switch (this.chart.type) {
      case "line":
        chart = new LineChart(this.chart, this.datasets, this.axisData);
        break;
      case "bar":
        chart = new BarChart(this.chart, this.datasets, this.axisData);
        break;
      case "avg":
        this.axisData.y = this.axisData.y.map((dataset) => {
          let newDataset = 0;
          dataset.forEach((d) => { newDataset += d; });
          newDataset /= dataset.length;
          if (`${newDataset}`.indexOf(".") > -1) {
            newDataset = newDataset.toFixed(2);
          }

          return [newDataset];
        });
        chart = new LineChart(this.chart, this.datasets, this.axisData);
        break;
      default:
        chart = new PieChart(this.chart, this.datasets, this.axisData);
        break;
    }

    const configuration = chart.getConfiguration();

    const newDatasets = configuration.data.datasets;
    const newLabels = configuration.data.labels;

    // apply sorting if available
    let shouldSort = false;
    let sortIndex;
    this.datasets.forEach((d, index) => {
      if (d.options.sort) {
        sortIndex = index;
        shouldSort = true;
      }
    });

    if (shouldSort) {
      for (let i = 0; i < newDatasets[sortIndex].data.length - 1; i++) {
        for (let j = i + 1; j < newDatasets[sortIndex].data.length; j++) {
          let sortCondition;
          if (this.datasets[sortIndex].options.sort === "asc") {
            sortCondition = newDatasets[sortIndex].data[i] > newDatasets[sortIndex].data[j];
          } else if (this.datasets[sortIndex].options.sort === "desc") {
            sortCondition = newDatasets[sortIndex].data[i] < newDatasets[sortIndex].data[j];
          }

          if (sortCondition) {
            // first, sort the dataset with the sorting option enabled
            const saved = newDatasets[sortIndex].data[i];
            newDatasets[sortIndex].data[i] = newDatasets[sortIndex].data[j];
            newDatasets[sortIndex].data[j] = saved;

            // then sort the labels in the same way
            const savedLabel = newLabels[i];
            newLabels[i] = newLabels[j];
            newLabels[j] = savedLabel;

            // finally, sort the rest of the datasets
            for (let d = 0; d < newDatasets.length; d++) {
              if (d !== sortIndex) {
                const savedDataset = newDatasets[d].data[i];
                newDatasets[d].data[i] = newDatasets[d].data[j];
                newDatasets[d].data[j] = savedDataset;
              }
            }
          }
        }
      }
    }

    configuration.data.datasets = newDatasets;
    configuration.data.labels = newLabels;
    // calculate the growth values
    configuration.growth = [];
    configuration.data.datasets.forEach((d, index) => {
      const { formula } = this.datasets[index].options;
      const before = formula ? formula.substring(0, formula.indexOf("{")) : "";
      const after = formula ? formula.substring(formula.indexOf("}") + 1) : "";

      if (d.data && d.data.length > 1 && d.data[d.data.length - 2] !== 0) {
        // get the last and previous values and make sure to format them as numbers
        let currentValue;
        let previousValue;

        try {
          const currArr = `${d.data[d.data.length - 1]}`.match(/[\d.]+/g);
          const prevArr = `${d.data[d.data.length - 2]}`.match(/[\d.]+/g);
          currentValue = parseFloat(currArr.filter((n) => n !== ".")[0]);
          previousValue = parseFloat(prevArr.filter((n) => n !== ".")[0]);
        } catch (e) { /** */ }

        if (determineType(currentValue) === "number" && determineType(previousValue) === "number") {
          let result = (currentValue - previousValue)
            / previousValue;
          result *= 100;

          configuration.growth.push({
            value: `${before}${currentValue.toLocaleString()}${after}`,
            comparison: (result === 0 && 0) || +(result.toFixed(2)).toLocaleString(),
            status: (result > 0 && "positive") || (result < 0 && "negative") || "neutral",
            label: d.label,
          });
        }
      } else if (d.data && d.data.length === 1) {
        configuration.growth.push({
          value: `${before}${d.data[0]}${after}`,
          comparison: 100,
          status: "positive",
          label: d.label,
        });
      } else if (d.data.length > 1) {
        let currentValue;
        try {
          const currArr = `${d.data[d.data.length - 1]}`.match(/[\d.]+/g);
          currentValue = parseFloat(currArr.filter((n) => n !== ".")[0]);
        } catch (e) {
          //
        }

        configuration.growth.push({
          value: `${before}${currentValue.toLocaleString()}${after}`,
          comparison: currentValue * 100,
          status: (currentValue > 0 && "positive") || (currentValue < 0 && "negative") || "neutral",
          label: d.label,
        });
      }
    });

    return {
      configuration,
      conditionsOptions,
    };
  }

  processDate(data) {
    const finalData = {
      filtered: [],
      formatted: [],
    };

    let axisData = [];
    data.map((item) => {
      if (
        item
        && parseInt(item, 10).toString() === item.toString()
        && item.toString().length === 10
      ) {
        axisData.push(moment.utc(item, "X"));
      } else if (item) {
        axisData.push(moment.utc(item));
      }
      return item;
    });

    axisData = axisData.sort((a, b) => a && b && a.diff(b));

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
            this.dateFormat = "YYYY MMM [w] W";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM [w] W";
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
  operate(data, xData, xType, yType, op, yAxis, averageByTotal) {
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
    let totalNumberOfItems = 0;
    Object.keys(yData).forEach((key) => {
      let finalItem = yData[key];

      // check if we're dealing with nested arrays
      const nestedArray = yAxis && yAxis.split("[]");
      if (nestedArray && nestedArray[1] && determineType(finalItem) === "array") {
        const collection = [...finalItem];

        let nestedResult = 0;
        let minValue;
        let maxValue;
        collection.forEach((c) => {
          const nestedData = _.get(c, nestedArray[0]);
          // get the objects in the nested array
          if (op !== "count" && yType === "number") {
            nestedData.forEach((current) => {
              nestedResult += _.get(current, nestedArray[1].slice(1));
            });
          }
        });

        if (averageByTotal) {
          totalNumberOfItems += collection.length;
        }

        if (op === "avg" && !averageByTotal) {
          finalItem = nestedResult / collection.length;
        } else if (op === "min") {
          if (nestedResult < minValue || (!minValue && minValue !== 0)) {
            finalItem = nestedResult;
            minValue = nestedResult;
          }
        } else if (op === "max") {
          if (nestedResult > maxValue || (!maxValue && maxValue !== 0)) {
            finalItem = nestedResult;
            maxValue = nestedResult;
          }
        } else if (op === "count") {
          finalItem = collection.length;
        } else {
          finalItem = nestedResult;
        }
      } else {
        finalItem = finalItem[yData[key].length - 1];
        if (op === "sum" && yType === "number") finalItem = _.reduce(yData[key], (sum, n) => sum + n);
        if (op === "avg" && yType === "number") {
          if (averageByTotal) {
            totalNumberOfItems += yData[key].length;
          } else {
            finalItem = _.reduce(yData[key], (avg, n) => avg + n);
            finalItem /= yData[key].length;
            finalItem = parseFloat(finalItem.toFixed(2));
          }
        }
        if (op === "min") finalItem = _.min(yData[key]);
        if (op === "max") finalItem = _.max(yData[key]);
      }

      finalData[key] = finalItem;
    });

    if (averageByTotal) {
      Object.keys(finalData).forEach((key) => {
        finalData[key] /= totalNumberOfItems;
        finalData[key] = parseFloat(finalData[key].toFixed(2));
      });
    }

    return finalData;
  }

  // average is used for the mean number of elements in arrays (if type == array)
  count(xData, type, yData, op) {
    const countData = {};

    if (type === "array") {
      const avgCounter = {};
      if (op === "count") {
        yData.forEach((item) => {
          if (item.y) countData[item.x] = item.y.length;
        });
      } else if (op === "min") {
        yData.forEach((item) => {
          if (item.y) countData[item.x] = _.min(item.y);
        });
      } else if (op === "max") {
        yData.forEach((item) => {
          if (item.y) countData[item.x] = _.max(item.y);
        });
      } else {
        yData.forEach((item) => {
          if (!countData[item.x] && item.y) countData[item.x] = item.y.reduce((a, b) => a + b);
          else if (item.y) countData[item.x] += item.y.reduce((a, b) => a + b);

          if (!avgCounter[item.x]) avgCounter[item.x] = item.y.length;
          else avgCounter[item.x] += item.y.length;
        });

        if (op === "avg") {
          Object.keys(avgCounter).forEach((key) => {
            countData[key] /= avgCounter[key];
          });
        }
      }
    } else {
      xData.forEach((item) => {
        if (!countData[item]) countData[item] = 1;
        else countData[item]++;
      });
    }

    return countData;
  }
}

module.exports = AxisChart;
