import moment from "moment";

// regex to check if the string is made only of numbers
const checkNumbersOnly = /^\d+$/;
// regex to check if numbers only and if length is 10 or 13
const checkNumbersOnlyAndLength = /^\d{10,13}$/;

export default function determineType(data) {
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
      && ((!Number.isNaN(new Date(data).getTime()) && `${data}`.length > 9 && `${data}`.replace(/\D/g, "").length > 3 && `${data}`.replace(/\D/g, "").length < 14 && (`${data}`[0] === "1" || `${data}`[0] === "2"))
      || (moment(`${data}`).isValid() && !checkNumbersOnlyAndLength.test(data) && ((typeof data === "number" && data.toString().length === 10) || (typeof data !== "number" && !checkNumbersOnly.test(data))))
      || (moment(`${data}`, "X").isValid() && (typeof data === "string" && data.length === 10) && checkNumbersOnlyAndLength.test(data))
      || (data && `${data}`.length === 10 && `${data}`[0] === "1" && moment(data, "X").isValid() && typeof data === "number"))) {
      dataType = "date";
    }
  } catch (e) {
    //
  }

  return dataType;
}
