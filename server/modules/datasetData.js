const crypto = require("crypto");

const { discoverDatasetFieldsSchema } = require("./datasetSchema");
const { toJsonValue } = require("../visualization/preparedData");

const DATASET_DATA_VERSION = 1;
const FIELD_TYPES = new Set(["number", "date", "string", "boolean", "array", "object", "unknown"]);

function unwrapModelValues(value, ancestors = new Set()) {
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  if (ancestors.has(value)) return undefined;
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => unwrapModelValues(item, nextAncestors));
  }

  const source = value.dataValues && typeof value.toJSON === "function" ? value.toJSON() : value;
  return Object.keys(source).reduce((result, key) => {
    const item = unwrapModelValues(source[key], nextAncestors);
    if (item !== undefined) result[key] = item;
    return result;
  }, {});
}

function getDatasetFields(dataset, data) {
  const storedSchema = dataset?.fieldsSchema && typeof dataset.fieldsSchema === "object"
    ? dataset.fieldsSchema
    : null;
  const schema = storedSchema && Object.keys(storedSchema).length > 0
    ? storedSchema
    : discoverDatasetFieldsSchema(data);

  return Object.entries(schema || {}).map(([key, type]) => ({
    key,
    type: FIELD_TYPES.has(type) ? type : "unknown",
  })).sort((left, right) => left.key.localeCompare(right.key));
}

function createDatasetData({ dataset, data, generatedAt = new Date() }) {
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const normalizedData = unwrapModelValues(data);
  return toJsonValue({
    version: DATASET_DATA_VERSION,
    generatedAt: generatedDate.toISOString(),
    resource: {
      kind: "dataset",
      id: dataset.id,
      name: dataset.name || null,
    },
    fields: getDatasetFields(dataset, normalizedData),
    data: normalizedData,
  });
}

function serializeDatasetData(datasetData, options = {}) {
  const value = { ...datasetData };
  if (options.includeGeneratedAt === false) delete value.generatedAt;
  return JSON.stringify(toJsonValue(value));
}

function getDatasetDataFingerprint(datasetData) {
  return crypto.createHash("sha256")
    .update(serializeDatasetData(datasetData, { includeGeneratedAt: false }))
    .digest("hex");
}

module.exports = {
  DATASET_DATA_VERSION,
  createDatasetData,
  getDatasetDataFingerprint,
  getDatasetFields,
  serializeDatasetData,
  unwrapModelValues,
};
