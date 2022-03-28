import moment from "moment";

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

  try {
    if (data
      && ((!Number.isNaN(new Date(data).getTime()) && `${data}`.length > 9 && `${data}`.replace(/\D/g, "").length > 3)
      || (moment(`${data})`).isValid() && ((typeof data === "number" && data.toString().length === 10) || typeof data !== "number"))
      || (moment(`${data})`, "X").isValid() && (typeof data === "string" && data.length === 10))
      || (data && `${data}`.length === 10 && `${data}`[0] === "1" && moment(data, "X").isValid() && typeof data === "number"))) {
      dataType = "date";
    }
  } catch (e) {
    //
  }

  return dataType;
}
