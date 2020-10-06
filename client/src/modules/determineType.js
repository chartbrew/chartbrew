import { isValid } from "date-fns";

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
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "number") {
    dataType = "number";
  }
  if (typeof data !== "object" && !(data instanceof Array) && typeof data === "string") {
    dataType = "string";
  }
  if (typeof data !== "object" && !(data instanceof Array) && isValid(data)
    && ((typeof data === "number" && data.toString().length > 9) || (typeof data !== "number"))) {
    dataType = "date";
  }

  return dataType;
}
