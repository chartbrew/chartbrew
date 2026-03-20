const determineType = require("./determineType");

const MAX_FIELD_SCAN_ROWS = 20;
const MAX_FIELD_PREVIEW_VALUES = 5;

const METRIC_NAME_PATTERN = /(count|total|sum|revenue|amount|price|cost|value|score|qty|quantity|metric)/i;
const DIMENSION_NAME_PATTERN = /(^id$|(^|[_\-.])id$|uuid|key)/i;

function normalizeFieldPath(fieldPath) {
  return String(fieldPath || "");
}

function stripRootPrefix(fieldPath) {
  return normalizeFieldPath(fieldPath)
    .replace(/^root\[\]\.?/, "")
    .replace(/^root\./, "");
}

function extractFieldName(fieldPath) {
  return stripRootPrefix(fieldPath)
    .replace(/\[\]/g, "")
    .split(".")
    .filter(Boolean)
    .join(".");
}

function createFieldLabel(fieldPath) {
  return stripRootPrefix(fieldPath)
    .replace(/\[\]/g, "")
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getComparablePreviewValue(value, type) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return "null";
  }

  if (type === "date") {
    try {
      return new Date(value).toISOString();
    } catch (error) {
      return String(value);
    }
  }

  if (type === "array") {
    return `Array(${Array.isArray(value) ? value.length : 0})`;
  }

  if (type === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "[Object]";
    }
  }

  return String(value);
}

function getPreviewValue(value, type) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (type === "date") {
    try {
      return new Date(value).toISOString();
    } catch (error) {
      return String(value);
    }
  }

  if (type === "array") {
    return `Array(${Array.isArray(value) ? value.length : 0})`;
  }

  if (type === "object") {
    try {
      const stringified = JSON.stringify(value);
      return stringified.length > 120 ? `${stringified.slice(0, 117)}...` : stringified;
    } catch (error) {
      return "[Object]";
    }
  }

  return value;
}

function addPreviewSample(fieldEntry, value, type) {
  const previewSample = fieldEntry.previewSample || [];

  if (previewSample.length >= MAX_FIELD_PREVIEW_VALUES) {
    return previewSample;
  }

  const comparableValue = getComparablePreviewValue(value, type);
  if (comparableValue === null) {
    return previewSample;
  }

  if (
    previewSample.some((sample) => (
      getComparablePreviewValue(sample, type) === comparableValue
    ))
  ) {
    return previewSample;
  }

  previewSample.push(getPreviewValue(value, type));
  return previewSample;
}

function registerField(fieldMap, fieldPath, value, type) {
  if (!fieldPath) {
    return;
  }

  const normalizedFieldPath = normalizeFieldPath(fieldPath);
  const nextType = type || determineType(value);
  const existingField = fieldMap.get(normalizedFieldPath);

  if (!existingField) {
    fieldMap.set(normalizedFieldPath, {
      field: normalizedFieldPath,
      type: nextType,
      previewSample: [],
    });
  } else if (!existingField.type && nextType) {
    existingField.type = nextType;
  }

  const fieldEntry = fieldMap.get(normalizedFieldPath);
  fieldEntry.previewSample = addPreviewSample(fieldEntry, value, nextType)
    || fieldEntry.previewSample
    || [];
}

function collectFieldsFromObject(collection, currentKey, first, fieldMap, onlyObjects = false) {
  if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
    return;
  }

  if (determineType(collection) === "array" && onlyObjects) {
    return;
  }

  Object.keys(collection).forEach((field) => {
    const value = collection[field];
    let fieldPath = field;

    if (currentKey) {
      fieldPath = `${currentKey}.${field}`;
      if (first && !onlyObjects) {
        fieldPath = `root.${currentKey}[].${field}`;
      }
    } else {
      if (first && !onlyObjects) {
        fieldPath = `root[].${field}`;
      }

      if (first && onlyObjects && `${field}` !== `${Number.parseInt(field, 10)}`) {
        fieldPath = `root.${field}`;
      }
    }

    const fieldType = determineType(value);
    registerField(fieldMap, fieldPath, value, fieldType);

    if (fieldType === "array" && fieldPath.split("[]").length < 3 && !onlyObjects && Array.isArray(value) && value.length > 0) {
      const firstValue = value[0];
      if (firstValue && typeof firstValue === "object" && !Array.isArray(firstValue)) {
        collectFieldsFromObject(firstValue, `${fieldPath}[]`, false, fieldMap, false);
      }
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      collectFieldsFromObject(value, fieldPath, false, fieldMap, onlyObjects);
    }
  });
}

function collectFieldCandidates(collection, onlyObjects = false) {
  const fieldMap = new Map();

  if (!collection) {
    return [];
  }

  if (onlyObjects) {
    if (collection && typeof collection === "object" && !Array.isArray(collection)) {
      collectFieldsFromObject(collection, "", true, fieldMap, true);
    }

    return Array.from(fieldMap.values());
  }

  if (Array.isArray(collection)) {
    const iterations = Math.min(collection.length, MAX_FIELD_SCAN_ROWS);
    for (let i = 0; i < iterations; i += 1) {
      collectFieldsFromObject(collection[i], "", true, fieldMap, false);
    }

    return Array.from(fieldMap.values());
  }

  if (collection && typeof collection === "object") {
    const arrayKeys = Object.keys(collection).filter((key) => Array.isArray(collection[key]));

    if (arrayKeys.length > 0) {
      arrayKeys.forEach((field) => {
        const values = collection[field];
        const iterations = Math.min(values.length, MAX_FIELD_SCAN_ROWS);

        for (let i = 0; i < iterations; i += 1) {
          collectFieldsFromObject(values[i], field, true, fieldMap, false);
        }
      });
    } else {
      collectFieldsFromObject(collection, "", true, fieldMap, false);
    }
  }

  return Array.from(fieldMap.values());
}

function inferRole(type, fieldPath) {
  const normalizedFieldName = extractFieldName(fieldPath).toLowerCase();

  if (type === "date") {
    return "date";
  }

  if (DIMENSION_NAME_PATTERN.test(normalizedFieldName)) {
    return "dimension";
  }

  if (type === "number") {
    return "metric";
  }

  if (METRIC_NAME_PATTERN.test(normalizedFieldName)) {
    return "metric";
  }

  return "dimension";
}

function inferAggregation(type, role, fieldPath) {
  const normalizedFieldName = extractFieldName(fieldPath).toLowerCase();

  if (role !== "metric") {
    return "none";
  }

  if (
    type === "boolean"
    || type === "string"
    || type === "date"
    || normalizedFieldName.includes("count")
  ) {
    return "count";
  }

  return "sum";
}

function normalizeExistingFieldMetadata(fieldsMetadata = []) {
  if (!Array.isArray(fieldsMetadata)) {
    return [];
  }

  return fieldsMetadata
    .filter((field) => field && (field.id || field.legacyPath))
    .map((field) => ({
      ...field,
      id: normalizeFieldPath(field.id || field.legacyPath),
      legacyPath: normalizeFieldPath(field.legacyPath || field.id),
      name: field.name || extractFieldName(field.id || field.legacyPath),
      label: field.label || createFieldLabel(field.id || field.legacyPath),
      description: field.description || "",
      previewSample: Array.isArray(field.previewSample)
        ? field.previewSample.slice(0, MAX_FIELD_PREVIEW_VALUES)
        : [],
      autoGenerated: field.autoGenerated !== false,
      enabled: field.enabled !== false,
      missing: field.missing === true,
    }));
}

function mergeEditableOverrides(existingField, inferredField) {
  if (!existingField) {
    return inferredField;
  }

  return {
    ...inferredField,
    label: existingField.label || inferredField.label,
    description: existingField.description || "",
    role: existingField.role || inferredField.role,
    aggregation: existingField.aggregation || inferredField.aggregation,
    enabled: existingField.enabled !== undefined
      ? existingField.enabled
      : inferredField.enabled,
    autoGenerated: existingField.autoGenerated !== undefined
      ? existingField.autoGenerated
      : inferredField.autoGenerated,
    excludeFromCharts: existingField.excludeFromCharts !== undefined
      ? existingField.excludeFromCharts
      : inferredField.excludeFromCharts,
    missing: false,
  };
}

function inferDatasetFieldMetadata(collection, existingFieldsMetadata = []) {
  const inferredFieldMap = new Map();
  const existingFieldMap = new Map(
    normalizeExistingFieldMetadata(existingFieldsMetadata)
      .map((field) => [field.id, field])
  );

  collectFieldCandidates(collection, false).forEach((field) => {
    inferredFieldMap.set(field.field, field);
  });

  collectFieldCandidates(collection, true).forEach((field) => {
    if (!inferredFieldMap.has(field.field)) {
      inferredFieldMap.set(field.field, field);
    }
  });

  const nextFieldIds = new Set();

  const inferredMetadata = Array.from(inferredFieldMap.values())
    .sort((left, right) => left.field.localeCompare(right.field))
    .map((field) => {
      const fieldId = normalizeFieldPath(field.field);
      const fieldType = field.type || "string";
      const role = inferRole(fieldType, fieldId);
      const inferredField = {
        id: fieldId,
        legacyPath: fieldId,
        name: extractFieldName(fieldId),
        label: createFieldLabel(fieldId),
        description: "",
        type: fieldType,
        role,
        aggregation: inferAggregation(fieldType, role, fieldId),
        previewSample: field.previewSample || [],
        autoGenerated: true,
        enabled: true,
        excludeFromCharts: false,
        missing: false,
      };

      nextFieldIds.add(fieldId);

      return mergeEditableOverrides(existingFieldMap.get(fieldId), inferredField);
    });

  const missingFields = normalizeExistingFieldMetadata(existingFieldsMetadata)
    .filter((field) => !nextFieldIds.has(field.id))
    .map((field) => ({
      ...field,
      missing: true,
    }));

  return inferredMetadata.concat(missingFields);
}

function buildFieldsSchemaFromMetadata(fieldsMetadata = []) {
  return fieldsMetadata
    .filter((field) => field && field.id && field.type && field.missing !== true)
    .sort((left, right) => left.id.localeCompare(right.id))
    .reduce((acc, field) => {
      acc[field.id] = field.type;
      return acc;
    }, {});
}

module.exports = {
  buildFieldsSchemaFromMetadata,
  createFieldLabel,
  extractFieldName,
  inferAggregation,
  inferDatasetFieldMetadata,
  inferRole,
  normalizeExistingFieldMetadata,
};
