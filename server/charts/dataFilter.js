const _ = require("lodash");
const moment = require("moment");

const determineType = require("../modules/determineType");

function compareDates(data, field, condition) {
  let newData = data;

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }

    // check for a potential timestamp format
    if (value.toString().length === 10) {
      return moment(value, "X");
    }
    return moment(value);
  };

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => getValue(o).isSame(condition.value));
      break;
    case "isNot":
      newData = _.filter(newData, (o) => getValue(o).isSame(condition.value));
      break;
    case "greaterThan":
      newData = _.filter(newData, (o) => getValue(o).isAfter(condition.value));
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => getValue(o).isSameOrAfter(condition.value));
      break;
    case "lessThan":
      newData = _.filter(newData, (o) => getValue(o).isBefore(condition.value));
      break;
    case "lessThanOrEqual":
      newData = _.filter(newData, (o) => getValue(o).isSameOrBefore(condition.value));
      break;
    default:
      break;
  }

  return newData;
}

function compareNumbers(data, field, condition) {
  let newData = data;

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }
    return value;
  };

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => getValue(o) === parseFloat(condition.value));
      break;
    case "isNot":
      newData = _.filter(newData, (o) => getValue(o) !== parseFloat(condition.value));
      break;
    case "contains":
      newData = _.filter(newData, (o) => getValue(o) === parseFloat(condition.value));
      break;
    case "notContains":
      newData = _.filter(newData, (o) => getValue(o) !== parseFloat(condition.value));
      break;
    case "greaterThan":
      newData = _.filter(newData, (o) => getValue(o) > parseFloat(condition.value));
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => getValue(o) >= parseFloat(condition.value));
      break;
    case "lessThan":
      newData = _.filter(newData, (o) => getValue(o) < parseFloat(condition.value));
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => getValue(o) <= parseFloat(condition.value));
      break;
    default:
      break;
  }
  return newData;
}

function compareStrings(data, field, condition) {
  let newData = data;

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }
    return value;
  };

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => getValue(o) === condition.value);
      break;
    case "isNot":
      newData = _.filter(newData, (o) => getValue(o) !== condition.value);
      break;
    case "contains":
      newData = _.filter(newData, (o) => getValue(o).indexOf(condition.value) > -1);
      break;
    case "notContains":
      newData = _.filter(newData, (o) => getValue(o).indexOf(condition.value) === -1);
      break;
    case "greaterThan":
      newData = _.filter(newData, (o) => getValue(o) > condition.value);
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => getValue(o) >= condition.value);
      break;
    case "lessThan":
      newData = _.filter(newData, (o) => getValue(o) < condition.value);
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => getValue(o) <= condition.value);
      break;
    default:
      break;
  }

  return newData;
}

function compareBooleans(data, field, condition) {
  let newData = data;

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }
    return value;
  };

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => getValue(o) == condition.value); // eslint-disable-line
      break;
    case "isNot":
      newData = _.filter(newData, (o) => getValue(o) != condition.value); // eslint-disable-line
      break;
    case "contains":
      newData = _.filter(newData, (o) => getValue(o) == condition.value); // eslint-disable-line
      break;
    case "notContains":
      newData = _.filter(newData, (o) => getValue(o) != condition.value); // eslint-disable-line
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => getValue(o) == condition.value); // eslint-disable-line
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => getValue(o) != condition.value); // eslint-disable-line
      break;
    default:
      break;
  }

  return newData;
}

module.exports = (data, selectedField, conditions) => {
  if (!conditions || conditions.length < 1) {
    return data;
  }

  let finalData;
  let arrayField;
  if (selectedField.indexOf("root[]") > -1) {
    finalData = data;
  } else {
    const arrayFinder = selectedField.substring(0, selectedField.indexOf("]") - 1).replace("root.", "");
    arrayField = selectedField.substring(0, selectedField.indexOf("["));
    arrayField = arrayField.substring(arrayField.lastIndexOf(".") + 1);
    finalData = _.get(data, arrayFinder);
  }

  conditions.map((condition) => {
    const { field } = condition;

    let exactField = field;
    let foundData = finalData;
    exactField = field.substring(field.indexOf("]") + 2);

    const foundObj = _.find(foundData, exactField);
    const selectors = exactField.split(".");
    let value = foundObj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }
    const dataType = determineType(value);

    switch (dataType) {
      case "string":
        foundData = compareStrings(_.clone(foundData), exactField, condition);
        break;
      case "number":
        foundData = compareNumbers(foundData, exactField, condition);
        break;
      case "boolean":
        foundData = compareBooleans(foundData, exactField, condition);
        break;
      case "date":
        foundData = compareDates(foundData, exactField, condition);
        break;
      default:
        break;
    }

    finalData = foundData;
    return condition;
  });

  if (arrayField) {
    const oldFormattedData = data;
    oldFormattedData[arrayField] = _.clone(finalData);
    finalData = oldFormattedData;
  }

  return finalData;
};
