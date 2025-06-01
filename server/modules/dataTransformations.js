const _ = require("lodash");

function flattenNestedArray(data, config) {
  if (!data) return data;

  const { baseArrayPath, nestedArrayPath, outputFields } = config;
  const result = [];

  // Get the base array using the path
  const baseArray = _.get(data, baseArrayPath, []);
  if (!Array.isArray(baseArray)) {
    return data;
  }

  // Process each item in the base array
  baseArray.forEach((baseItem) => {
    // Get the nested array for this base item
    const nestedArray = _.get(baseItem, nestedArrayPath, []);
    if (!Array.isArray(nestedArray)) {
      // If no nested array, create a single item with base fields
      const newItem = {};
      Object.entries(outputFields).forEach(([outputField, fieldConfig]) => {
        if (fieldConfig.from === "base") {
          newItem[outputField] = _.get(baseItem, fieldConfig.path);
        }
      });
      result.push(newItem);
      return;
    }

    // Process each nested item
    nestedArray.forEach((nestedItem) => {
      const newItem = {};
      Object.entries(outputFields).forEach(([outputField, fieldConfig]) => {
        if (fieldConfig.from === "base") {
          newItem[outputField] = _.get(baseItem, fieldConfig.path);
        } else if (fieldConfig.from === "nested") {
          newItem[outputField] = _.get(nestedItem, fieldConfig.path);
        }
      });
      result.push(newItem);
    });
  });

  return result;
}

function applyTransformation(data, transform) {
  if (!transform || !transform.enabled || !transform.type) return data;

  switch (transform.type) {
    case "flattenNested":
      return flattenNestedArray(data, transform.config);
    default:
      return data;
  }
}

module.exports = {
  applyTransformation,
};
