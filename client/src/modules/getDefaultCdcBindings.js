import autoFieldSelector from "./autoFieldSelector";
import { getDatasetFieldOptionsFromSchema } from "./getDatasetFieldOptions";

const bindingKeys = [
  "xAxis",
  "xAxisOperation",
  "yAxis",
  "yAxisOperation",
  "dateField",
  "dateFormat",
];

function hasValue(value) {
  return value !== null && typeof value !== "undefined" && value !== "";
}

export default function getDefaultCdcBindings(dataset = {}) {
  const fieldOptions = dataset.fieldsSchema
    ? getDatasetFieldOptionsFromSchema(dataset.fieldsSchema)
    : [];
  const autoFields = autoFieldSelector(fieldOptions);

  return bindingKeys.reduce((bindings, key) => {
    if (hasValue(dataset[key])) {
      bindings[key] = dataset[key];
    } else if (hasValue(autoFields[key])) {
      bindings[key] = autoFields[key];
    }

    return bindings;
  }, {});
}
