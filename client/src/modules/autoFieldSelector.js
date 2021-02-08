export default function autoFieldSelector(fields) {
  let xAxis;
  let yAxis;
  let yAxisOperation;
  let dateField;

  // create date pair
  // xAxis
  fields.map((field) => {
    if (field.value.toLowerCase().indexOf("create") > -1 && field.type === "date") {
      xAxis = field.value;
      dateField = field.value;
    } else if (!xAxis && field.value.toLowerCase().indexOf("timestamp") > -1 && field.type === "date") {
      xAxis = field.value;
      dateField = field.value;
    } else if (!xAxis && field.type === "date") {
      xAxis = field.value;
      dateField = field.value;
    }

    return field;
  });

  // yAxis
  if (xAxis && xAxis.type === "date") {
    fields.map((field) => {
      if (field.value.toLowerCase().indexOf("id") > -1
        && (field.type === "number" || field.type === "string")
      ) {
        yAxis = field.value;
        yAxisOperation = "count";
      } else if (!yAxis && (field.type === "number" || field.type === "string")) {
        yAxis = field.value;
        yAxisOperation = "count";
      }
      return field;
    });
  }

  // create random string - number pair
  if (!xAxis || !yAxis) {
    // xAxis - try to select a string-number first
    fields.map((field) => {
      if (!xAxis && field.type === "string") {
        xAxis = field.value;
      }

      if (!yAxis && field.type === "number") {
        yAxis = field.value;
        yAxisOperation = "count";
      }

      return field;
    });

    // try number - string if not
    if (!xAxis || !yAxis) {
      fields.map((field) => {
        if (!xAxis && field.type === "number") {
          xAxis = field.value;
        }

        if (!yAxis && field.type === "string") {
          yAxis = field.value;
          yAxisOperation = "count";
        }
        return field;
      });
    }
  }

  // if yAxis still not chosen, try selecting an object
  // only yAxis, because X will make objects appear as a label...might explode
  if (!yAxis) {
    fields.map((field) => {
      if (field.type === "object") {
        yAxis = field.value;
        yAxisOperation = "count";
      }
      return field;
    });
  }

  return {
    xAxis,
    yAxis,
    yAxisOperation,
    dateField,
  };
}
