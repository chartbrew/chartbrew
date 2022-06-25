const _ = require("lodash");
const moment = require("moment");

const determineType = require("../modules/determineType");

function compareDates(data, field, condition) {
  let newData = data;

  if (!condition.value
    && (condition.operator !== "isNull" && condition.operator !== "isNotNull")) {
    return data;
  }

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value && value[selectors[i]];
    }

    if (!value) return null;

    // check for a potential timestamp format
    if (parseInt(value, 10).toString() === value.toString() && value.toString().length === 10) {
      return moment(value, "X");
    }

    return moment(value);
  };

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => {
        const val = getValue(o);

        return val ? val.isSame(condition.value) : false;
      });
      break;
    case "isNot":
      newData = _.filter(newData, (o) => {
        const val = getValue(o);
        return val ? !val.isSame(condition.value) : false;
      });
      break;
    case "greaterThan":
      newData = _.filter(newData, (o) => {
        const val = getValue(o);
        return val ? val.isAfter(condition.value) : false;
      });
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => {
        const val = getValue(o);
        return val ? val.isSameOrAfter(condition.value) : false;
      });
      break;
    case "lessThan":
      newData = _.filter(newData, (o) => {
        const val = getValue(o);
        return val ? val.isBefore(condition.value) : false;
      });
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => {
        const val = getValue(o);
        return val ? val.isSameOrBefore(condition.value) : false;
      });
      break;
    case "isNotNull":
      newData = _.filter(newData, (o) => getValue(o) !== null);
      break;
    case "isNull":
      newData = _.filter(newData, (o) => getValue(o) === null);
      break;
    default:
      break;
  }

  return newData;
}

function compareNumbers(data, field, condition) {
  let newData = data;

  if (!condition.value && condition.value !== 0
    && (condition.operator !== "isNull" && condition.operator !== "isNotNull")) {
    return data;
  }

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }

    if (!value && (value !== 0 || value !== "0")) {
      return null;
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
    case "isNotNull":
      newData = _.filter(newData, (o) => getValue(o) !== null);
      break;
    case "isNull":
      newData = _.filter(newData, (o) => getValue(o) === null);
      break;
    default:
      break;
  }
  return newData;
}

function compareStrings(data, field, condition) {
  let newData = data;

  if (!condition.value
      && (condition.operator !== "isNull" && condition.operator !== "isNotNull")) {
    return data;
  }

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }

    if (!value && (value !== 0 || value !== "0")) {
      return null;
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
    case "isNotNull":
      newData = _.filter(newData, (o) => getValue(o) !== null);
      break;
    case "isNull":
      newData = _.filter(newData, (o) => getValue(o) === null);
      break;
    default:
      break;
  }

  return newData;
}

function compareBooleans(data, field, condition) {
  let newData = data;

  if (!condition.value && condition.value !== false && condition.value !== "false"
    && (condition.operator !== "isNull" && condition.operator !== "isNotNull")) {
    return data;
  }

  // extract value
  const getValue = (obj) => {
    const selectors = field.split(".");
    let value = obj;
    for (let i = 0; i < selectors.length; i++) {
      value = value[selectors[i]];
    }

    if (!value && (value !== 0 || value !== "0") && value !== false) {
      return null;
    }

    return value;
  };

  switch (condition.operator) {
    case "is":
      newData = _.filter(newData, (o) => `${getValue(o)}` === `${condition.value}`);
      break;
    case "isNot":
      newData = _.filter(newData, (o) => `${getValue(o)}` !== `${condition.value}`);
      break;
    case "contains":
      newData = _.filter(newData, (o) => `${getValue(o)}` === `${condition.value}`);
      break;
    case "notContains":
      newData = _.filter(newData, (o) => `${getValue(o)}` !== `${condition.value}`);
      break;
    case "greaterOrEqual":
      newData = _.filter(newData, (o) => `${getValue(o)}` === `${condition.value}`);
      break;
    case "lessOrEqual":
      newData = _.filter(newData, (o) => `${getValue(o)}` !== `${condition.value}`);
      break;
    case "isNotNull":
      newData = _.filter(newData, (o) => getValue(o) !== null);
      break;
    case "isNull":
      newData = _.filter(newData, (o) => getValue(o) === null);
      break;
    default:
      break;
  }

  return newData;
}

module.exports = (data, selectedField, conditions) => {
  if (!conditions || conditions.length < 1) {
    return { data };
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

  const conditionsOptions = [];
  conditions.map((condition) => {
    const { field } = condition;

    let fieldFinder;
    if (selectedField.indexOf("root[]") > -1) {
      fieldFinder = field.replace("root[].", "");
    } else {
      fieldFinder = field.substring(field.indexOf("]") + 2);
    }

    conditionsOptions.push({
      field,
      exposed: condition.exposed,
      values: _.uniq(_.map(finalData, fieldFinder))
    });

    let exactField = field;
    let foundData = finalData;
    exactField = field.substring(field.indexOf("]") + 2);

    const foundObj = _.find(foundData, exactField);
    if (!foundObj) return condition;

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

  return {
    data: finalData,
    conditionsOptions,
  };
};
