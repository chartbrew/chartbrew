const crypto = require("crypto");

const { getSlotDefinition } = require("./registry");

const PREPARED_DATA_VERSION = 1;
const SERIES_IDENTITY_VERSION = 1;
const SEMANTIC_FIELD_ORDER = [
  "time",
  "category",
  "row",
  "column",
  "x",
  "y",
  "value",
  "breakdown",
  "size",
  "detail",
  "location",
  "latitude",
  "longitude",
  "source",
  "target",
  "hierarchy",
  "columns",
  "content",
];
const SAFE_SOURCE_OPTION_KEYS = [
  "columnsOrder",
  "configuration",
  "excludedFields",
  "groupBy",
  "groups",
  "legend",
  "name",
];

function getBindingId(dataset) {
  return dataset?.bindingId
    ?? dataset?.options?.cdc_id
    ?? dataset?.options?.id
    ?? null;
}

function getSafeSourceOptions(options = {}) {
  return SAFE_SOURCE_OPTION_KEYS.reduce((safeOptions, key) => {
    if (options[key] !== undefined) safeOptions[key] = options[key];
    return safeOptions;
  }, {});
}

function inferFieldType(value) {
  if (value === null || value === undefined) return "unknown";
  if (value instanceof Date) return "temporal";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return "quantitative";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "record";
  return "nominal";
}

function getFirstFieldValue(rows, key) {
  for (const row of rows || []) {
    if (row && typeof row === "object" && row[key] !== null && row[key] !== undefined) {
      return row[key];
    }
  }
  return null;
}

function getSemanticFieldOrder(key) {
  const index = SEMANTIC_FIELD_ORDER.indexOf(key);
  return index === -1 ? SEMANTIC_FIELD_ORDER.length : index;
}

function getFieldListKey(definition, fallback) {
  const sourceField = definition?.field;
  if (typeof sourceField !== "string" || sourceField.length === 0) return fallback;
  const withoutRoot = sourceField.replace(/^root\.?/, "").replace(/\[\]/g, "");
  const parts = withoutRoot.split(".").filter(Boolean);
  return parts[parts.length - 1] || fallback;
}

function buildFieldMetadata(layer, layerFrame, rows) {
  const fields = Object.entries(layerFrame.fields || {}).flatMap(([key, encoding]) => {
    const definitions = Array.isArray(encoding) ? encoding : [encoding];
    const slot = getSlotDefinition(layerFrame.mark, key);
    return definitions.map((definition, index) => ({
      key: slot?.kind === "fieldList"
        ? getFieldListKey(definition, `${key}.${index}`)
        : key,
      role: slot?.kind === "measure" ? "measure" : "dimension",
      sourceField: definition?.field || null,
      type: definition?.type || inferFieldType(getFirstFieldValue(rows, key)),
    }));
  });

  if (fields.length > 0) {
    return fields.sort((left, right) => {
      return getSemanticFieldOrder(left.key) - getSemanticFieldOrder(right.key)
        || left.key.localeCompare(right.key);
    });
  }

  if (layerFrame.mark === "markdown") {
    return [{ key: "content", role: "dimension", sourceField: null, type: "nominal" }];
  }

  const keys = new Set();
  rows.forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    Object.keys(row).forEach((key) => {
      if (!key.startsWith("__")) keys.add(key);
    });
  });

  return [...keys].sort().map((key) => ({
    key,
    role: "dimension",
    sourceField: layer?.rowPath ? `${layer.rowPath}.${key}` : key,
    type: inferFieldType(getFirstFieldValue(rows, key)),
  }));
}

function prepareRow(row, mark) {
  if (mark === "markdown" && (row === null || typeof row !== "object" || Array.isArray(row))) {
    return { content: row ?? "" };
  }
  if (!row || typeof row !== "object" || Array.isArray(row)) return { value: row };

  const prepared = Object.entries(row).reduce((result, [key, value]) => {
    if (!key.startsWith("__")) result[key] = value;
    return result;
  }, {});
  if (Object.prototype.hasOwnProperty.call(row, "__seriesId")) {
    prepared.seriesId = row.__seriesId;
  }
  return prepared;
}

function createPreparedData({
  chart,
  datasets = [],
  frame,
  generatedAt = new Date(),
  timezone = "UTC",
  visualization,
}) {
  const layersById = new Map((visualization?.layers || []).map((layer) => [`${layer.id}`, layer]));
  const datasetsByBinding = new Map(datasets.map((dataset) => [`${getBindingId(dataset)}`, dataset]));
  const results = frame.layers.map((layerFrame) => {
    const layer = layersById.get(`${layerFrame.id}`) || {};
    const rows = (layerFrame.rows || []).map((row) => prepareRow(row, layerFrame.mark));
    const dataset = datasetsByBinding.get(`${layerFrame.bindingId}`);

    return {
      availableSeries: layerFrame.availableSeries || layerFrame.series || [],
      bindingId: layerFrame.bindingId,
      fields: buildFieldMetadata(layer, layerFrame, rows),
      id: layerFrame.id,
      mark: layerFrame.mark,
      name: layer.name || null,
      rows,
      series: layerFrame.series || [],
      sourceOptions: getSafeSourceOptions(dataset?.options),
      stats: layerFrame.stats,
      warnings: layerFrame.warnings || [],
    };
  });
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);

  return {
    frameVersion: frame.version,
    generatedAt: generatedDate.toISOString(),
    identityVersion: SERIES_IDENTITY_VERSION,
    resource: {
      id: chart?.id ?? null,
      kind: "chart",
    },
    results,
    stats: frame.stats,
    timezone: timezone || "UTC",
    version: PREPARED_DATA_VERSION,
    warnings: frame.warnings || [],
  };
}

function toJsonValue(value, inArray = false) {
  if (value === null) return null;
  if (value === undefined) return inArray ? null : undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return `${value}`;
  if (["string", "boolean"].includes(typeof value)) return value;
  if (["function", "symbol"].includes(typeof value)) return inArray ? null : undefined;
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item, true));
  if (typeof value !== "object") return `${value}`;

  return Object.keys(value).sort().reduce((result, key) => {
    const normalized = toJsonValue(value[key], false);
    if (normalized !== undefined) result[key] = normalized;
    return result;
  }, {});
}

function serializeWarningOrder(warnings = []) {
  return [...warnings].sort((left, right) => {
    return JSON.stringify(toJsonValue(left)).localeCompare(JSON.stringify(toJsonValue(right)));
  });
}

function serializeTemporalValue(value) {
  if (value === null || value === undefined || value === "") return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toPublicResult(result) {
  const temporalFields = new Set((result.fields || [])
    .filter((field) => field.type === "temporal")
    .map((field) => field.key));
  const rows = (result.rows || []).map((row) => {
    return Object.entries(row || {}).reduce((publicRow, [key, value]) => {
      if (key.startsWith("__")) return publicRow;
      publicRow[key] = temporalFields.has(key) ? serializeTemporalValue(value) : value;
      return publicRow;
    }, {});
  });

  return {
    availableSeries: result.availableSeries || [],
    fields: result.fields || [],
    id: result.id,
    mark: result.mark,
    name: result.name,
    rows,
    series: result.series || [],
    stats: result.stats,
    warnings: serializeWarningOrder(result.warnings),
  };
}

function toPublicPreparedData(preparedData, options = {}) {
  const publicData = {
    frameVersion: preparedData.frameVersion,
    generatedAt: preparedData.generatedAt,
    identityVersion: preparedData.identityVersion,
    resource: preparedData.resource,
    results: (preparedData.results || []).map(toPublicResult),
    stats: preparedData.stats,
    version: preparedData.version,
    warnings: serializeWarningOrder(preparedData.warnings),
  };
  if (options.includeGeneratedAt === false) delete publicData.generatedAt;
  return toJsonValue(publicData);
}

function serializePreparedData(preparedData, options = {}) {
  return JSON.stringify(toPublicPreparedData(preparedData, options));
}

function getPreparedDataFingerprint(preparedData) {
  return crypto.createHash("sha256")
    .update(serializePreparedData(preparedData, { includeGeneratedAt: false }))
    .digest("hex");
}

function assertPreparedData(preparedData) {
  if (!preparedData || preparedData.version !== PREPARED_DATA_VERSION) {
    throw new Error(`PreparedData version must be ${PREPARED_DATA_VERSION}`);
  }
  if (!Array.isArray(preparedData.results)) {
    throw new Error("PreparedData results must be an array");
  }
  preparedData.results.forEach((result, index) => {
    if (!result?.id) throw new Error(`PreparedData results[${index}].id is required`);
    if (!Array.isArray(result.rows)) {
      throw new Error(`PreparedData results[${index}].rows must be an array`);
    }
  });
  return preparedData;
}

module.exports = {
  PREPARED_DATA_VERSION,
  SERIES_IDENTITY_VERSION,
  assertPreparedData,
  buildFieldMetadata,
  createPreparedData,
  getPreparedDataFingerprint,
  getSafeSourceOptions,
  inferFieldType,
  serializePreparedData,
  toJsonValue,
  toPublicPreparedData,
};
