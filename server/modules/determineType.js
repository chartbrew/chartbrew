const moment = require("moment");

function determineType(data) {
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
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "number") {
    dataType = "number";
  }
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "string") {
    dataType = "string";
  }
  if ((moment(`${data})`).isValid() && ((typeof data === "number" && data.toString().length === 10) || typeof data !== "number"))
    || (data && `${data}`.length === 10 && moment(data, "X").isValid())) {
    dataType = "date";
  }

  return dataType;
}

module.exports = determineType;
