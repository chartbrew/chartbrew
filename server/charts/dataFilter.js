const _ = require("lodash");
const moment = require("moment");

const determineType = require("../modules/determineType");

// TODO: deal with nested objects when field = "fieldParent.fieldChild"
function compareDates(data, field, condition) {
  let newData = data;

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => moment(o[field]).isSame(condition.value));
      break;
    case "isNot":
      newData = _.filter(newData, (o) => !moment(o[field]).isSame(condition.value));
      break;
    case "greaterThan":
      newData = _.filter(newData, (o) => moment(o[field]).isAfter(condition.value));
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => moment(o[field]).isSameOrAfter(condition.value));
      break;
    case "lessThan":
      newData = _.filter(newData, (o) => moment(o[field]).isBefore(condition.value));
      break;
    case "lessThanOrEqual":
      newData = _.filter(newData, (o) => moment(o[field]).isSameOrBefore(condition.value));
      break;
    default:
      break;
  }

  return newData;
}

function compareNumbers(data, field, condition) {
  let newData = data;

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => o[field] === parseFloat(condition.value));
      break;
    case "isNot":
      newData = _.filter(newData, (o) => o[field] !== parseFloat(condition.value));
      break;
    case "contains":
      newData = _.filter(newData, (o) => o[field] === parseFloat(condition.value));
      break;
    case "notContains":
      newData = _.filter(newData, (o) => o[field] !== parseFloat(condition.value));
      break;
    case "greaterThan":
      newData = _.filter(newData, (o) => o[field] > parseFloat(condition.value));
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => o[field] >= parseFloat(condition.value));
      break;
    case "lessThan":
      newData = _.filter(newData, (o) => o[field] < parseFloat(condition.value));
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => o[field] <= parseFloat(condition.value));
      break;
    default:
      break;
  }

  return newData;
}

function compareStrings(data, field, condition) {
  let newData = data;

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => o[field] === condition.value);
      break;
    case "isNot":
      newData = _.filter(newData, (o) => o[field] !== condition.value);
      break;
    case "contains":
      newData = _.filter(newData, (o) => o[field].indexOf(condition.value) > -1);
      break;
    case "notContains":
      newData = _.filter(newData, (o) => o[field].indexOf(condition.value) === -1);
      break;
    case "greaterThan":
      newData = _.filter(newData, (o) => o[field] > condition.value);
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => o[field] >= condition.value);
      break;
    case "lessThan":
      newData = _.filter(newData, (o) => o[field] < condition.value);
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => o[field] <= condition.value);
      break;
    default:
      break;
  }

  return newData;
}

function compareBooleans(data, field, condition) {
  let newData = data;

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => o[field] == condition.value); // eslint-disable-line
      break;
    case "isNot":
      newData = _.filter(newData, (o) => o[field] != condition.value); // eslint-disable-line
      break;
    case "contains":
      newData = _.filter(newData, (o) => o[field] == condition.value); // eslint-disable-line
      break;
    case "notContains":
      newData = _.filter(newData, (o) => o[field] != condition.value); // eslint-disable-line
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => o[field] == condition.value); // eslint-disable-line
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => o[field] != condition.value); // eslint-disable-line
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
  if (selectedField.indexOf("root[]") > -1) {
    finalData = data;
  } else {
    const arrayFinder = selectedField.substring(0, selectedField.indexOf("]") - 1);
    finalData = _.get(data, arrayFinder);
  }

  conditions.map((condition) => {
    const { field } = condition;

    let exactField = field;
    let foundData = finalData;
    exactField = field.substring(field.indexOf("]") + 2);

    const dataType = determineType(_.find(foundData, exactField)[exactField]);

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

  return finalData;
};
