import fieldFinder from "./fieldFinder";

function createFieldOption(field, type, isObject = false) {
  let text = field && field.replace("root[].", "").replace("root.", "");
  if (type === "array") text += "(get element count)";

  return {
    key: field,
    text,
    value: field,
    type,
    isObject,
    label: {
      style: { width: 55, textAlign: "center" },
      content: type || "unknown",
      size: "mini",
      color: type === "date" ? "warning"
        : type === "number" ? "accent"
          : type === "string" ? "success"
            : type === "boolean" ? "danger-soft"
              : "default",
    },
  };
}

export function getDatasetFieldOptionsFromResponse(datasetResponse) {
  const fieldOptions = [];
  const fieldsSchema = {};

  const fields = fieldFinder(datasetResponse);
  const objectFields = fieldFinder(datasetResponse, false, true);

  fields.forEach((field) => {
    if (field.field) {
      fieldOptions.push(createFieldOption(field.field, field.type));
    }
    fieldsSchema[field.field] = field.type;
  });

  objectFields.forEach((field) => {
    if (field.field) {
      fieldOptions.push(createFieldOption(field.field, field.type, true));
    }
    fieldsSchema[field.field] = field.type;
  });

  return {
    fieldOptions,
    fieldsSchema,
  };
}

export function getDatasetFieldOptionsFromSchema(fieldsSchema = {}) {
  return Object.keys(fieldsSchema).map((field) => createFieldOption(
    field,
    fieldsSchema[field],
    field.indexOf("[]") === -1
  ));
}
