const { aggregateRows } = require("./aggregate");
const { getFieldValue, selectRows } = require("./fieldPath");
const { getMarkDefinition, getSlotDefinition } = require("./registry");
const { createSeriesId, getSeriesLabel, serializeTypedValue } = require("./seriesIdentity");
const { assertVisualizationSpec } = require("./spec");
const { bucketTime } = require("./time");
const { applyFrameTransforms, applyRowTransforms } = require("./transforms");

const FRAME_VERSION = 1;
const DEFAULT_CARDINALITY_WARNING = 50;

function getEncodingSelectors(encoding) {
  return Object.values(encoding).flatMap((definition) => {
    if (Array.isArray(definition)) return definition.map((item) => item.field);
    return definition?.field ? [definition.field] : [];
  });
}

function normalizeDimensionValue(value, encoding) {
  if (value !== null && value !== undefined) return { include: true, value };

  const policy = encoding.nullPolicy || "exclude";
  if (policy === "exclude") return { include: false, value };
  if (policy === "label") {
    return {
      include: true,
      value: encoding.nullLabel || "Unclassified",
    };
  }

  return { include: true, value };
}

function projectRows(rows, layer, markDefinition, options = {}) {
  const dimensionRoles = [];
  const measureEncodings = {};

  Object.entries(layer.encoding).forEach(([role, encoding]) => {
    const slot = getSlotDefinition(layer.mark, role);
    if (!slot || Array.isArray(encoding)) return;
    if (slot.kind === "dimension") dimensionRoles.push(role);
    if (slot.kind === "measure") measureEncodings[role] = encoding;
  });

  const projected = [];
  rows.forEach((row) => {
    const item = {};
    let include = true;

    Object.entries(layer.encoding).forEach(([role, encoding]) => {
      const slot = getSlotDefinition(layer.mark, role);
      if (!slot || Array.isArray(encoding)) return;

      let value = getFieldValue(row, encoding.field);
      if (role === "time") {
        value = bucketTime(
          value,
          encoding.timeUnit || options.timeInterval || "day",
          options.timezone,
          encoding.format
        );
      }
      if (slot.kind === "dimension") {
        const normalized = normalizeDimensionValue(value, encoding);
        include = include && normalized.include;
        item[role] = normalized.value;
      } else {
        item[role] = value;
      }
    });

    if (include) projected.push(item);
  });

  return {
    dimensionRoles,
    measureEncodings,
    projected,
    passthrough: Boolean(markDefinition.passthrough),
  };
}

function buildSeriesCatalog(layer, rows) {
  const breakdown = layer.encoding.breakdown;
  if (!breakdown) {
    const label = layer.name || layer.style?.label || layer.encoding.value?.title || "Series";
    const id = createSeriesId(layer.id, "__default__");
    rows.forEach((row) => {
      row.__seriesId = id;
    });

    return [{
      id,
      key: serializeTypedValue("__default__"),
      label,
      value: null,
    }];
  }

  const byKey = new Map();
  rows.forEach((row) => {
    const key = serializeTypedValue(row.breakdown);
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: createSeriesId(layer.id, row.breakdown),
        key,
        label: getSeriesLabel(row.breakdown, breakdown.nullLabel || "Unclassified"),
        value: row.breakdown,
      });
    }
    row.__seriesId = byKey.get(key).id;
  });

  return [...byKey.values()].sort((left, right) => {
    const byLabel = left.label.localeCompare(right.label);
    return byLabel === 0 ? left.key.localeCompare(right.key) : byLabel;
  });
}

function buildLayerFrame(layer, data, options = {}) {
  const markDefinition = getMarkDefinition(layer.mark);
  const selectors = getEncodingSelectors(layer.encoding);
  const selectedRows = selectRows(data, selectors, layer.rowPath);
  const rowTransforms = layer.transforms.filter((transform) => transform.type === "filter");
  const frameTransforms = layer.transforms.filter((transform) => {
    return transform.type === "sort" || transform.type === "limit" || transform.type === "window";
  });
  const filteredRows = applyRowTransforms(selectedRows, rowTransforms);
  const warnings = [];

  if (markDefinition.passthrough) {
    return {
      bindingId: layer.bindingId,
      fields: layer.encoding,
      id: layer.id,
      mark: layer.mark,
      rows: filteredRows,
      series: [],
      stats: {
        filteredRows: filteredRows.length,
        inputRows: selectedRows.length,
        outputRows: filteredRows.length,
      },
      warnings,
    };
  }

  const projection = projectRows(filteredRows, layer, markDefinition, options);
  let outputRows = aggregateRows(
    projection.projected,
    projection.dimensionRoles,
    projection.measureEncodings
  );
  if (projection.dimensionRoles.includes("time")) {
    outputRows.sort((left, right) => left.time - right.time);
  }
  outputRows = applyFrameTransforms(outputRows, frameTransforms);
  const series = buildSeriesCatalog(layer, outputRows);
  const cardinalityWarning = options.cardinalityWarning || DEFAULT_CARDINALITY_WARNING;

  if (layer.encoding.breakdown && series.length > cardinalityWarning) {
    warnings.push({
      code: "HIGH_BREAKDOWN_CARDINALITY",
      count: series.length,
      message: `Breakdown generated ${series.length} series`,
      threshold: cardinalityWarning,
    });
  }

  if (selectedRows.length > 0 && outputRows.length === 0) {
    warnings.push({
      code: "NO_ROWS_AFTER_TRANSFORMS",
      message: "No rows remain after filters and null handling",
    });
  }

  return {
    bindingId: layer.bindingId,
    fields: layer.encoding,
    id: layer.id,
    mark: layer.mark,
    rows: outputRows,
    series,
    stats: {
      filteredRows: filteredRows.length,
      inputRows: selectedRows.length,
      outputRows: outputRows.length,
    },
    warnings,
  };
}

function getBindingId(dataset) {
  return dataset?.bindingId
    ?? dataset?.options?.cdc_id
    ?? dataset?.options?.id
    ?? null;
}

function buildVisualizationFrame({ visualization, datasets = [] }, options = {}) {
  const spec = assertVisualizationSpec(visualization, options);
  const frameOptions = {
    ...options,
    timeInterval: options.timeInterval || spec.settings?.timeInterval || "day",
  };
  const datasetsByBinding = new Map(datasets.map((dataset) => {
    return [`${getBindingId(dataset)}`, dataset];
  }));

  const layers = spec.layers.map((layer) => {
    if (getMarkDefinition(layer.mark)?.bindingRequired === false) {
      return buildLayerFrame(layer, layer.content ?? null, frameOptions);
    }

    const dataset = datasetsByBinding.get(`${layer.bindingId}`);
    if (!dataset) {
      throw new Error(`No dataset result found for visualization binding ${layer.bindingId}`);
    }

    return buildLayerFrame(layer, dataset.data, frameOptions);
  });

  return {
    layers,
    stats: {
      inputRows: layers.reduce((total, layer) => total + layer.stats.inputRows, 0),
      outputRows: layers.reduce((total, layer) => total + layer.stats.outputRows, 0),
    },
    version: FRAME_VERSION,
    warnings: layers.flatMap((layer) => layer.warnings.map((warning) => ({
      ...warning,
      layerId: layer.id,
    }))),
  };
}

module.exports = {
  DEFAULT_CARDINALITY_WARNING,
  FRAME_VERSION,
  buildLayerFrame,
  buildSeriesCatalog,
  buildVisualizationFrame,
  normalizeDimensionValue,
};
