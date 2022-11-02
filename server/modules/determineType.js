const moment = require("moment");

function determineType(data) {
  // regex to check if the string is made only of numbers
  const checkNumbersOnly = /^\d+$/;

  let dataType;
  if (data !== null && typeof data === "object" && data instanceof Array) {
    dataType = "array";
  }
  if (data !== null && typeof data === "object" && !(data instanceof Array)) {
    dataType = "object";
  }
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "boolean") {
    dataType = "boolean";
  }
  if (typeof data !== "object" && !(data instanceof Array) && (typeof data === "number" || `${data}`.match(checkNumbersOnly))) {
    dataType = "number";
  }
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "string" && !`${data}`.match(checkNumbersOnly)) {
    dataType = "string";
  }

  try {
    if (data
      && ((!Number.isNaN(new Date(data).getTime()) && `${data}`.length > 9 && `${data}`.replace(/\D/g, "").length > 3)
      || (moment(`${data}`).isValid() && !checkNumbersOnly.test(data) && ((typeof data === "number" && data.toString().length === 10) || typeof data !== "number"))
      || (moment(`${data}`, "X").isValid() && (typeof data === "string" && data.length === 10) && checkNumbersOnly.test(data))
      || (data && `${data}`.length === 10 && `${data}`[0] === "1" && moment(data, "X").isValid() && typeof data === "number"))) {
      dataType = "date";
    }
  } catch (e) {
    //
  }

  return dataType;
}

module.exports = determineType;
