const _ = require("lodash");
const momentObj = require("moment");
const FormulaParser = require("hot-formula-parser").Parser;

const BarChart = require("./BarChart");
const LineChart = require("./LineChart");
const PieChart = require("./PieChart");
const determineType = require("../modules/determineType");
const dataFilter = require("./dataFilter");

const checkNumbersOnlyAndLength = /^\d{10,13}$/;

momentObj.suppressDeprecationWarnings = true;

const parser = new FormulaParser();

function formatCompactNumber(number) {
  if (number < 1000) {
    return number;
  } else if (number >= 1000 && number < 1_000_000) {
    return `${(number / 1000).toFixed(1)}K`;
  } else if (number >= 1_000_000 && number < 1_000_000_000) {
    return `${(number / 1_000_000).toFixed(1)}M`;
  } else if (number >= 1_000_000_000 && number < 1_000_000_000_000) {
    return `${(number / 1_000_000_000).toFixed(1)}B`;
  } else if (number >= 1_000_000_000_000 && number < 1_000_000_000_000_000) {
    return `${(number / 1_000_000_000_000).toFixed(1)}T`;
  } else {
    return 0;
  }
}

class AxisChart {
  constructor(data, timezone = "") {
    this.chart = data.chart;
    this.datasets = data.datasets;
    this.axisData = {
      x: [],
      y: [],
    };
    this.dateFormat = "";
    this.removeYear = false;
    this.timezone = timezone;
    if (this.timezone) {
      this.moment = (...args) => momentObj(...args).tz(this.timezone);
    } else {
      this.moment = (...args) => momentObj(...args);
    }
  }

  plot(skipDataProcessing, filters) {
    // skip the data processing if not required (this algorithm is CPU-intensive)
    const conditionsOptions = [];
    let gXType;

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
      this.datasets.map((dataset) => {
        if (!dataset.options || !dataset.options.dateField) {
          canDateFilter = false;
        }
        return dataset;
      });

      let startDate;
      let endDate;

      if (this.timezone) {
        startDate = this.moment(this.chart.startDate);
        endDate = this.moment(this.chart.endDate);
      } else {
        startDate = momentObj.utc(this.chart.startDate);
        endDate = momentObj.utc(this.chart.endDate);
      }

      if (this.chart.startDate && this.chart.endDate) {
        if (this.chart.timeInterval === "month" && this.chart.currentEndDate && !this.chart.fixedStartDate) {
          startDate = startDate.startOf("month").startOf("day");
        } else if (this.chart.timeInterval === "year" && this.chart.currentEndDate && !this.chart.fixedStartDate) {
          startDate = startDate.startOf("year").startOf("day");
        } else if (!this.chart.fixedStartDate) {
          startDate = startDate.startOf("day");
        }

        endDate = endDate.endOf("day");
      }

      if (this.chart.startDate && this.chart.endDate) {
        if (this.chart.currentEndDate) {
          const timeDiff = endDate.diff(startDate, this.chart.timeInterval);
          endDate = this.moment().endOf(this.chart.timeInterval);

          if (!this.chart.fixedStartDate) {
            startDate = endDate.clone()
              .subtract(timeDiff, this.chart.timeInterval)
              .startOf(this.chart.timeInterval);
          }
        }
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
        let alreadyDateFiltered = false;

        const filterData = dataFilter(
          dataset.data, xAxis, dataset.options.conditions, this.timezone, this.chart.timeInterval
        );
        if (filterData.conditionsOptions) {
          conditionsOptions.push({
            dataset_id: dataset.options.id,
            conditions: filterData.conditionsOptions,
          });
        }

        if (filters && filters.length > 0) {
          filters.forEach((filter) => {
            if (filter.field === dateField && filter.exposed && filter.value) {
              alreadyDateFiltered = true;
            }
          });
        }

        let filteredData = filterData.data;

        const dateDashboardFilter = filters && filters?.find((f) => f.type === "date");
        if (dateField
          && ((this.chart.startDate && this.chart.endDate) || dateDashboardFilter)
          && canDateFilter
          && !alreadyDateFiltered
        ) {
          if (filters?.length > 0) {
            if (dateDashboardFilter) {
              startDate = momentObj(dateDashboardFilter.startDate).startOf("day");
              endDate = momentObj(dateDashboardFilter.endDate).endOf("day");
            }
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

          filteredData = dataFilter(
            filteredData, dateField, dateConditions, this.timezone, this.chart.timeInterval
          ).data;
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
                filteredData = dataFilter(
                  filteredData, filter.field, filters, this.timezone, this.chart.timeInterval
                ).data;
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

        if (!(xData instanceof Array) || !xData) {
          const dataFinder = xAxis.substring(xAxis.indexOf(".") + 1);
          xAxis = xAxis.substring(xAxis.lastIndexOf(".") + 1);
          xData = _.get(filteredData, dataFinder);

          if (!xData) {
            throw new Error("Could not find data for xAxis");
          }

          if (xData !== null && xData.constructor.name === "Object") {
            this.axisData.x.push(Object.keys(xData));
            this.axisData.y.push(Object.values(xData));
          } else {
            this.axisData.x.push([xAxis]);
            this.axisData.y.push([xData]);
          }
        } else {
          const unprocessedX = [];
          xData.map((item) => {
            const xValue = _.get(item, xAxis);
            if (xValue) {
              xType = determineType(xValue);
            }
            unprocessedX.push(xValue);
            return item;
          });

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

          gXType = xType;
          // X AXIS data processing
          switch (xType) {
            case "date":
              xAxisData = this.processDate(unprocessedX, yData);
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

          // .yData is set in case of dates only
          // done because the ordering of data happens in processDate to save processing time
          if (xAxisData.yData) yData = xAxisData.yData;

          if (!(yData instanceof Array)) throw new Error("The Y field is not part of an Array");

          yData.forEach((item, index) => {
            const yValue = _.get(item, yAxis);
            if (yValue || yValue === 0) {
              yType = determineType(yValue, yAxisOperation);
              // only add the yValue if it corresponds to one of the x values found above
              const selectorValue = xAxis.indexOf(".") > -1 ? _.get(yData[index], xAxis) : yData[index][xAxisFieldName];

              if (_.indexOf(xAxisData.filtered, selectorValue) > -1) {
                yAxisData.push({ x: xAxisData.filtered[index], y: yValue });
              } else if (xType === "date") {
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
                const arrayField = _.get(nestedArray[0], yAxis.split("[]")[1].slice(1));
                yType = determineType(arrayField, yAxisOperation);
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
              yAxisData = this.count(xAxisData.formatted, yType, yAxisData, "count", yAxis);
              break;
            case "count_unique":
              yAxisData = this.countUnique(yAxisData, yType);
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
                    return this.moment(x, timestampFormat)
                      .isSame(this.moment(key, timestampFormat), this.chart.timeInterval);
                  }
                );

              if (!existingDate) this.axisData.x[xLength].push(key);
            }

            // add the y values
            this.axisData.y[yLength].push(yAxisData[key]);
          });

          // if the include zero values on the chart is selected
          if (this.chart.includeZeros
            && gXType === "date"
            && this.chart.timeInterval !== "minute"
            && this.chart.timeInterval !== "second"
          ) {
            const tempXData = this.axisData.x[xLength];

            const newX = [];
            const newY = [];

            // add the dates that are missing from the start of the chart
            if (startDate) {
              const firstDate = this.moment(tempXData[0], this.dateFormat);
              const difference = firstDate.diff(startDate, this.chart.timeInterval);
              if (difference > 1) {
                let dateModifier = 1;
                if (difference >= 100) {
                  dateModifier = parseInt(difference / 20, 10);
                }
                firstDate.subtract(dateModifier, this.chart.timeInterval);
                while (firstDate.isAfter(startDate)) {
                  newX.push(firstDate.format(this.dateFormat));
                  newY.push(0);
                  firstDate.subtract(dateModifier, this.chart.timeInterval);
                }
              }
            }

            for (let i = 0; i < tempXData.length; i++) {
              newX.push(tempXData[i]);
              newY.push(this.axisData.y[yLength][i]);

              if (i === tempXData.length - 1) break;

              const currDate = this.moment(tempXData[i], this.dateFormat);
              const nextDate = this.moment(tempXData[i + 1], this.dateFormat);
              const difference = nextDate.diff(currDate, this.chart.timeInterval);
              if (nextDate.diff(currDate, this.chart.timeInterval) > 1) {
                let dateModifier = 1;
                if (difference >= 100) {
                  dateModifier = parseInt(difference / 20, 10);
                }
                currDate.add(dateModifier, this.chart.timeInterval);
                while (currDate.isBefore(nextDate)) {
                  newX.push(currDate.format(this.dateFormat));
                  newY.push(0);
                  currDate.add(dateModifier, this.chart.timeInterval);
                }
              }
            }

            this.axisData.x[xLength] = newX;
            this.axisData.y[yLength] = newY;
          }

          // if it's an accumulation chart
          if (this.chart.subType?.indexOf("AddTimeseries") > -1) {
            const newY = [];
            this.axisData.y[yLength].map((item, index) => {
              let formattedItem = item;
              try {
                if (determineType(item) === "number" || determineType(item) === "string") {
                  formattedItem = parseFloat(item);
                }
              } catch (e) {
                // do nothing
              }

              if (index > 0) {
                newY.push(formattedItem + newY[newY.length - 1]);
              } else {
                newY.push(formattedItem);
              }

              return item;
            });

            this.axisData.y[yLength] = newY;
          }
        }
      }

      // now unify all the datasets
      // all the arrays on the Y Axis must correspond with only one array on X
      // if we're dealing with weekly or hourly data, make sure to not add the same data twice
      let unifiedX = [];
      this.axisData.x.forEach((arr, index) => {
        if ((this.chart.timeInterval === "week"
          || this.chart.timeInterval === "hour"
          || this.chart.timeInterval === "minute"
          || this.chart.timeInterval === "second")
          && index > 0
        ) {
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

      if (this.chart.timeInterval === "week"
        || this.chart.timeInterval === "hour"
        || this.chart.timeInterval === "minute"
        || this.chart.timeInterval === "second"
      ) {
        unifiedX = unifiedX
          .sort((a, b) => this.moment(a, this.dateFormat).diff(this.moment(b, this.dateFormat)));
      } else {
        unifiedX = _.uniq(unifiedX)
          .sort((a, b) => this.moment(a, this.dateFormat).diff(this.moment(b, this.dateFormat)));
      }

      // if we're dealing with dates, make sure to add the missing ones at the end
      if (gXType === "date"
        && startDate
        && endDate
        && this.chart.timeInterval !== "minute"
        && this.chart.timeInterval !== "second"
      ) {
        const lastValue = this.moment(unifiedX[unifiedX.length - 1], this.dateFormat);
        lastValue.add(1, this.chart.timeInterval);
        while (lastValue.isBefore(endDate)) {
          if (unifiedX.indexOf(lastValue.clone().format(this.dateFormat)) === -1) {
            unifiedX.push(lastValue.clone().format(this.dateFormat));
          }
          lastValue.add(1, this.chart.timeInterval);
        }
      }

      unifiedX.forEach((x, index) => {
        for (let i = 0; i < this.axisData.x.length; i++) {
          if (_.indexOf(this.axisData.x[i], x) === -1) {
            this.axisData.x[i].splice(index, 0, x);

            if (index > 0 && this.chart.subType.indexOf("AddTimeseries") > -1) {
              this.axisData.y[i].splice(index, 0, this.axisData.y[i][index - 1]);
            } else if (this.chart.timeInterval === "second" && this.datasets.length > 1) {
              this.axisData.y[i].splice(index, 0, this.axisData.y[i][index - 1] || 0);
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
      for (let i = 0; i < this.chart.ChartDatasetConfigs.length; i++) {
        if (this.chart.ChartDatasetConfigs[i]?.formula) {
          const { formula } = this.chart.ChartDatasetConfigs[i];
          this.axisData.y[i] = this.axisData.y[i].map((val) => {
            const before = formula.substring(0, formula.indexOf("{"));
            const after = formula.substring(formula.indexOf("}") + 1);
            const expressionString = formula.substring(formula.indexOf("{") + 1, formula.indexOf("}"));
            const expression = expressionString.replace(/val/g, val);

            const newVal = parser.parse(expression);

            let finalVal = `${before}${newVal.result?.toLocaleString() || 0}${after}`;
            if (this.chart.type !== "kpi") {
              finalVal = +(newVal.result?.toFixed(2) || 0).toLocaleString();
            }

            return finalVal;
          });
        }
      }
    }

    let chart;
    switch (this.chart.type) {
      case "line":
      case "kpi":
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
    let newLabels = configuration.data.labels;

    // apply sorting if available
    let shouldSort = false;
    let sortIndex;
    this.chart.ChartDatasetConfigs.forEach((cdc, index) => {
      if (cdc.sort) {
        sortIndex = index;
        shouldSort = true;
      }
    });

    if (shouldSort) {
      for (let i = 0; i < newDatasets[sortIndex].data.length - 1; i++) {
        for (let j = i + 1; j < newDatasets[sortIndex].data.length; j++) {
          let sortCondition;
          if (this.chart.ChartDatasetConfigs[sortIndex].sort === "asc") {
            sortCondition = newDatasets[sortIndex].data[i] > newDatasets[sortIndex].data[j];
          } else if (this.chart.ChartDatasetConfigs[sortIndex].sort === "desc") {
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

    // apply max records if available
    this.chart.ChartDatasetConfigs.forEach((d, index) => {
      if (d.maxRecords) {
        newDatasets[index].data = newDatasets[index].data.slice(0, d.maxRecords);
        newLabels = newLabels.slice(0, d.maxRecords);
      }
    });

    // remove the year from the labels
    if (this.removeYear) {
      newLabels = newLabels.map((label) => {
        return label.replace(/\b\d{4}\b/g, "").trim();
      });
    }

    configuration.data.datasets = newDatasets;
    configuration.data.labels = newLabels;
    // calculate the growth values
    configuration.growth = [];
    configuration.goals = [];
    configuration.data.datasets.forEach((d, index) => {
      const { formula, goal } = this.chart.ChartDatasetConfigs[index] || {};

      const before = formula ? formula.substring(0, formula.indexOf("{")) : "";
      const after = formula ? formula.substring(formula.indexOf("}") + 1) : "";

      if (d.data && d.data.length > 1 && d.data[d.data.length - 2] !== 0) {
        // get the last and previous values and make sure to format them as numbers
        let numericCurrValue;
        let numericPrevValue;
        let currentValue;
        let previousValue;

        try {
          numericCurrValue = `${d.data[d.data.length - 1]}`.replace(",", "").match(/-?[\d.]+/g);
          numericPrevValue = `${d.data[d.data.length - 2]}`.replace(",", "").match(/-?[\d.]+/g);
          currentValue = parseFloat(numericCurrValue.filter((n) => n !== "." && n !== ",")[0]);
          previousValue = parseFloat(numericPrevValue.filter((n) => n !== "." && n !== ",")[0]);
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

          if (goal) {
            const valueIndex = this.chart.subType.indexOf("AddTimeseries") > -1
              ? d.data.length - 1 : index;
            const goalCurrentValue = `${d.data[valueIndex]}`.replace(",", "").match(/[\d.]+/g);
            configuration.goals.push({
              max: goal,
              formattedMax: `${before}${formatCompactNumber(goal)}${after}`,
              value: goalCurrentValue,
              formattedValue: `${before}${numericCurrValue.toLocaleString()}${after}`,
              goalIndex: index,
            });
          }
        }
      } else if (d.data && d.data.length === 1) {
        configuration.growth.push({
          value: `${before}${d.data[0]}${after}`,
          comparison: 100,
          status: "positive",
          label: d.label,
        });

        if (goal) {
          const numericVal = `${d.data[d.data.length - 1]}`.replace(",", "").match(/[\d.]+/g);
          configuration.goals.push({
            max: goal,
            formattedMax: `${before}${formatCompactNumber(goal)}${after}`,
            value: numericVal,
            formattedValue: `${before}${numericVal.toLocaleString()}${after}`,
            goalIndex: index,
          });
        }
      } else if (d.data?.length > 1) {
        let currentValue;
        try {
          const currArr = `${d.data[d.data.length - 1]}`.match(/-?[\d.]+/g);
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

        if (goal) {
          configuration.goals.push({
            max: goal,
            formattedMax: `${before}${formatCompactNumber(goal)}${after}`,
            value: d.data[d.data.length - 1],
            formattedValue: `${before}${d.data[d.data.length - 1]}${after}`,
            goalIndex: index,
          });
        }
      }
    });

    return {
      isTimeseries: gXType === "date",
      dateFormat: this.dateFormat,
      configuration,
      conditionsOptions,
    };
  }

  processDate(data, yData) {
    const finalData = {
      filtered: [],
      formatted: [],
    };

    let axisData = [];
    let pairedData = [];
    data.forEach((item, index) => {
      let xItem;
      const stringItem = (item && item.toString()) || "";
      if (stringItem && checkNumbersOnlyAndLength.test(stringItem)) {
        if (this.timezone) {
          xItem = this.moment(stringItem, stringItem.length === 10 ? "X" : "x");
        } else {
          xItem = momentObj.utc(stringItem, stringItem.length === 10 ? "X" : "x");
        }
      } else if (item) {
        if (this.timezone) {
          xItem = this.moment(item);
        } else {
          xItem = momentObj.utc(item);
        }
      }

      pairedData.push({ xItem, yItem: yData[index] });
    });

    pairedData = pairedData.sort((a, b) => a.xItem && b.xItem && a.xItem.diff(b.xItem));
    axisData = pairedData.map((item) => item.xItem);
    axisData = axisData.filter((item) => !!item);

    finalData.yData = pairedData.map((item) => item.yItem);

    finalData.filtered = _.cloneDeep(axisData);
    finalData.filtered = finalData.filtered.filter((item) => !!item);
    finalData.timestamps = finalData.filtered.map((item) => item.valueOf());
    finalData.filtered = finalData.filtered.map((item) => item.format());

    const startDate = axisData[0];
    const endDate = axisData[axisData.length - 1];
    // format the dates
    for (let i = 0; i < axisData.length; i++) {
      switch (this.chart.timeInterval) {
        case "second":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year()) {
            this.dateFormat = "YYYY/MM/DD HH:mm:ss";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.month() !== endDate.month()) {
            this.dateFormat = "YYYY MMM Do HH:mm:ss";
            this.removeYear = true;
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.week() !== endDate.week()
            && this.moment().week() !== startDate.week()
          ) {
            this.dateFormat = "ddd Do HH:mm:ss";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.day() !== endDate.day() && this.moment().day() !== startDate.day()) {
            this.dateFormat = "ddd HH:mm:ss";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.day() === endDate.day() && this.moment().day() === startDate.day()) {
            this.dateFormat = "HH:mm:ss";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM Do HH:mm:ss";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "minute":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year()) {
            this.dateFormat = "YYYY/MM/DD HH:mm";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.month() !== endDate.month()) {
            this.dateFormat = "YYYY MMM Do HH:mm";
            this.removeYear = true;
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.week() !== endDate.week()
            && this.moment().week() !== startDate.week()
          ) {
            this.dateFormat = "ddd Do HH:mm";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.day() !== endDate.day() && this.moment().day() !== startDate.day()) {
            this.dateFormat = "ddd HH:mm";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.day() === endDate.day() && this.moment().day() === startDate.day()) {
            this.dateFormat = "HH:mm";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM Do HH:mm";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "hour":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year()) {
            this.dateFormat = "YYYY/MM/DD hA";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.month() !== endDate.month()) {
            this.dateFormat = "YYYY MMM Do hA";
            this.removeYear = true;
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "ddd Do hA";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "day":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year()
            || this.moment().year() !== startDate.year()
          ) {
            this.dateFormat = "YYYY MMM D";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "YYYY MMM D";
            this.removeYear = true;
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "week":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year()
            || this.moment().year() !== startDate.year()
          ) {
            this.dateFormat = "GGGG [W] WW";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            // format to group by weeks in the same year without year
            this.dateFormat = "GGGG [W] WW";
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "month":
          if (this.dateFormat) {
            axisData[i] = axisData[i].format(this.dateFormat);
          } else if (startDate.year() !== endDate.year()
            || this.moment().year() !== startDate.year()
          ) {
            this.dateFormat = "MMM YYYY";
            axisData[i] = axisData[i].format(this.dateFormat);
          } else {
            this.dateFormat = "MMM YYYY";
            this.removeYear = true;
            axisData[i] = axisData[i].format(this.dateFormat);
          }
          break;
        case "year":
          this.dateFormat = "YYYY";
          axisData[i] = axisData[i].format(this.dateFormat);
          break;
        default:
          this.dateFormat = "YYYY MMM D";
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
        let nestedData = [];
        collection.forEach((c) => {
          nestedData = _.get(c, nestedArray[0]);
          // get the objects in the nested array
          if (op !== "count" && yType === "number") {
            nestedData.forEach((current) => {
              nestedResult += _.get(current, nestedArray[1].slice(1)) || 0;
            });
          }
        });

        if (averageByTotal) {
          totalNumberOfItems += collection.length;
        }

        if (op === "avg" && !averageByTotal) {
          finalItem = nestedResult / nestedData.length;
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
        if (op === "sum" && yType === "number") {
          finalItem = _.reduce(yData[key], (sum, n) => sum + (n instanceof Object ? 0 : n), 0);
        }
        if (op === "avg" && yType === "number") {
          if (averageByTotal) {
            totalNumberOfItems += yData[key].length;
          } else {
            finalItem = _.reduce(yData[key], (avg, n) => avg + (n instanceof Object ? 0 : n));
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
          if (!countData[item.x] && item.y) countData[item.x] = item.y.reduce((a, b) => a + b, 0);
          else if (item.y) countData[item.x] += item.y.reduce((a, b) => a + b, 0);

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

  countUnique(yData, type) {
    if (type === "array") return {};
    const countData = {};
    yData.forEach((item) => {
      if (!countData[item.x]) countData[item.x] = [];
      if (countData[item.x].indexOf(item.y) === -1) countData[item.x].push(item.y);
    });

    Object.keys(countData).forEach((key) => {
      countData[key] = countData[key].length;
    });

    return countData;
  }
}

module.exports = AxisChart;
