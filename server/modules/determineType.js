const moment = require("moment");

// regex to check if the string is made only of numbers
const checkNumbersOnly = /^\d+(\.\d+)?$/;
// regex to check if numbers only and if length is 10 or 13
const checkNumbersOnlyAndLength = /^\d{10,13}$/;

const dateFormats = [
  "YYYY-MM-DD", "MM-DD-YYYY", "DD-MM-YYYY", "YYYY/MM/DD", "MM/DD/YYYY", "DD/MM/YYYY",
  "YYYY-MM-DD HH:mm", "MM-DD-YYYY HH:mm", "DD-MM-YYYY HH:mm", "YYYY/MM/DD HH:mm", "MM/DD/YYYY HH:mm", "DD/MM/YYYY HH:mm",
  "YYYY-MM-DD HH:mm:ss", "MM-DD-YYYY HH:mm:ss", "DD-MM-YYYY HH:mm:ss", "YYYY/MM/DD HH:mm:ss", "MM/DD/YYYY HH:mm:ss", "DD/MM/YYYY HH:mm:ss",
  "YYYY-MM-DDTHH:mm:ssZ", "YYYY-MM-DDTHH:mm:ss.SSSZ", moment.ISO_8601, moment.RFC_2822, // ISO 8601
  "YYYY-MM-DDTHH:mm:ss.SSS[Z]", "YYYY-MM-DDTHH:mm:ss.SSSZ", // ISO 8601 with milliseconds
  "ddd MMM DD YYYY HH:mm:ss [GMT]ZZ (zz)", "ddd MMM DD YYYY HH:mm:ss [GMT]ZZ [(]zz[)]", "ddd MMM DD YYYY HH:mm:ss [GMT]ZZ",
];

function isLikelyDate(value, type) {
  const rawData = type === "object" ? value.toISOString() : String(value);
  const data = rawData.replace(/\(.*\)/, "").trim();

  if (data
    && ((!Number.isNaN(new Date(data).getTime()) && data.length > 9 && data.replace(/\D/g, "").length > 3 && data.replace(/\D/g, "").length < 14 && (data[0] === "1" || data[0] === "2"))
      || ((moment(data, dateFormats, true).isValid() || moment(data, moment.ISO_8601).isValid()) && !checkNumbersOnlyAndLength.test(data) && ((typeof data === "number" && data.toString().length === 10) || (typeof data !== "number" && !checkNumbersOnly.test(data))))
      || (moment(data, "X").isValid() && (typeof data === "string" && data.length === 10) && checkNumbersOnlyAndLength.test(data))
      || (data && data.length === 10 && data[0] === "1" && moment(data, "X").isValid() && typeof data === "number")
      || (checkNumbersOnlyAndLength.test(data) && moment(data, "x").isValid())
    )) {
    return true;
  }

  return false;
}

function determineType(data, operation) {
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
    if (isLikelyDate(data, dataType)) {
      dataType = "date";
    }
  } catch (e) {
    //
  }

  if (checkNumbersOnly.test(data) && (operation === "sum" || operation === "avg")) {
    dataType = "number";
  }

  return dataType;
}

module.exports = determineType;
