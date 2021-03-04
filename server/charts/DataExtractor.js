const moment = require("moment");
const _ = require("lodash");

const dataFilter = require("./dataFilter");

module.exports = (data, filters) => {
  const { chart, datasets } = data;

  // check if the global date filter should be on or off
  // the filter should work only if all the datasets have a dateField
  let canDateFilter = true;
  datasets.map((dataset) => {
    if (!dataset.options || !dataset.options.dateField) {
      canDateFilter = false;
    }
    return dataset;
  });

  let startDate;
  let endDate;
  if (chart.startDate && chart.endDate) {
    startDate = moment(chart.startDate);
    endDate = moment(chart.endDate);
  }

  // this is only used when exporting data
  const exportData = [];

  for (let i = 0; i < datasets.length; i++) {
    const dataset = datasets[i];
    const { dateField } = dataset.options;
    let { xAxis } = dataset.options;
    let xData;

    let filteredData = dataFilter(dataset.data, xAxis, dataset.options.conditions);

    if (dateField && chart.startDate && chart.endDate && canDateFilter) {
      if (chart.currentEndDate) {
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
            filteredData = dataFilter(filteredData, filter.field, filters);
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

    exportData[dataset.options.legend] = xData;
  }

  return exportData;
};
