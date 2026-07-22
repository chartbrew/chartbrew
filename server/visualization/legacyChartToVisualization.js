const { resolveChartDatasetOptions } = require("../modules/resolveChartDatasetOptions");
const { getMarkDefinition } = require("./registry");
const { normalizeVisualizationSpec, validateVisualizationSpec } = require("./spec");

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toJSON === "function") return value.toJSON();
  return { ...value };
}

function getLegacyMark(chart) {
  const requestedMark = chart.type || (chart.mode === "kpichart" ? "kpi" : "line");
  return getMarkDefinition(requestedMark) ? requestedMark : "line";
}

function getFieldType(options, field, fallback) {
  if (!field) return fallback;
  const schemaType = options.fieldsSchema?.[field];
  if (schemaType === "date") return "temporal";
  if (schemaType === "number") return "quantitative";
  if (schemaType === "boolean") return "boolean";
  return fallback;
}

function createFieldEncoding(field, type, options = {}) {
  if (!field) return null;
  return {
    field,
    type,
    ...options,
  };
}

function compactObject(value) {
  return Object.entries(value).reduce((compacted, [key, item]) => {
    if (item !== null && item !== undefined) compacted[key] = item;
    return compacted;
  }, {});
}

function getValueField(options) {
  return options.yAxis || options.xAxis || null;
}

function getValueOperation(options) {
  return options.yAxisOperation || options.xAxisOperation || "none";
}

function buildLegacyEncoding(mark, options) {
  const xAxis = options.xAxis || null;
  const valueField = getValueField(options);
  const value = createFieldEncoding(
    valueField,
    getFieldType(options, valueField, "quantitative"),
    compactObject({
      aggregate: getValueOperation(options),
      formula: options.formula || null,
      title: options.legend || null,
    })
  );

  if (mark === "avg" && value) value.aggregate = "avg";

  if (mark === "table" || mark === "markdown") return {};
  if (mark === "kpi" || mark === "avg" || mark === "gauge") {
    return compactObject({ value });
  }

  if (mark === "matrix") {
    return compactObject({
      time: createFieldEncoding(xAxis, "temporal"),
      value,
    });
  }

  const isTime = Boolean(xAxis)
    && (xAxis === options.dateField || getFieldType(options, xAxis) === "temporal");

  return compactObject({
    [isTime ? "time" : "category"]: createFieldEncoding(
      xAxis,
      isTime ? "temporal" : getFieldType(options, xAxis, "nominal")
    ),
    value,
  });
}

function buildLegacyTransforms(options, mark, chart) {
  const transforms = [];

  if (chart.subType?.includes("AddTimeseries")
    && !["table", "matrix", "markdown"].includes(mark)
  ) {
    transforms.push({
      operation: "cumulativeSum",
      role: "value",
      type: "window",
    });
  }

  if (options.sort && mark !== "matrix") {
    transforms.push({
      direction: options.sort,
      role: "value",
      type: "sort",
    });
  }

  if (Number.isInteger(options.maxRecords) && options.maxRecords >= 0 && mark !== "matrix") {
    transforms.push({
      count: options.maxRecords,
      type: "limit",
    });
  }

  return transforms;
}

function buildLegacyLayer(chart, cdc, index) {
  const plainCdc = toPlainObject(cdc);
  const dataset = toPlainObject(plainCdc.Dataset);
  const options = resolveChartDatasetOptions(plainCdc, dataset);
  const mark = getLegacyMark(chart);

  return {
    bindingId: plainCdc.id,
    encoding: buildLegacyEncoding(mark, options),
    goal: options.goal ?? null,
    id: `legacy-${plainCdc.id || index + 1}`,
    mark,
    name: options.legend || options.name || `Series ${index + 1}`,
    orientation: chart.horizontal ? "horizontal" : "vertical",
    rowPath: mark === "table" ? options.xAxis || "root[]" : undefined,
    stack: chart.stacked ? "normal" : "none",
    style: compactObject({
      color: options.datasetColor || null,
      fill: options.fill ?? null,
      fillColor: options.fillColor || null,
      label: options.legend || null,
      multiFill: options.multiFill ?? null,
      pointRadius: options.pointRadius ?? null,
    }),
    options: mark === "table" ? compactObject({
      columnsOrder: options.columnsOrder || null,
      configuration: options.configuration || null,
      excludedFields: options.excludedFields || null,
    }) : {},
    transforms: buildLegacyTransforms(options, mark, chart),
  };
}

function buildLegacySettings(chart) {
  return compactObject({
    dataLabels: chart.dataLabels ?? null,
    dashedLastPoint: chart.dashedLastPoint ?? null,
    dateWindow: chart.startDate || chart.endDate ? compactObject({
      currentEndDate: chart.currentEndDate ?? null,
      end: chart.endDate || null,
      fixedStartDate: chart.fixedStartDate ?? null,
      start: chart.startDate || null,
    }) : null,
    includeZeros: chart.includeZeros ?? null,
    legend: chart.displayLegend === undefined ? null : { visible: Boolean(chart.displayLegend) },
    logarithmic: chart.isLogarithmic ?? null,
    maxValue: chart.maxValue ?? null,
    minValue: chart.minValue ?? null,
    missingValues: { policy: "zero" },
    timeInterval: chart.timeInterval || null,
    xLabelTicks: chart.xLabelTicks || null,
  });
}

function legacyChartToVisualization(chartValue) {
  const chart = toPlainObject(chartValue);
  const cdcs = Array.isArray(chart.ChartDatasetConfigs) ? chart.ChartDatasetConfigs : [];
  const mark = getLegacyMark(chart);
  const isMarkdown = mark === "markdown";
  const layers = isMarkdown && cdcs.length === 0
    ? [{
      bindingId: null,
      content: chart.content || "",
      encoding: {},
      id: "legacy-markdown",
      mark,
      orientation: "vertical",
      stack: "none",
      style: {},
      transforms: [],
    }]
    : cdcs.map((cdc, index) => buildLegacyLayer(chart, cdc, index));
  let status = "ready";
  if (layers.length === 0) {
    status = "orphan";
  } else if (chart.draft || layers.some((layer) => {
    return Object.keys(layer.encoding).length === 0 && !getMarkDefinition(mark)?.passthrough;
  })) {
    status = "draft";
  }
  let visualization = normalizeVisualizationSpec({
    layers,
    metadata: {
      migratedFrom: "legacy",
    },
    settings: buildLegacySettings(chart),
    status,
  });
  let validation = validateVisualizationSpec(visualization, {
    allowIncomplete: status !== "ready",
  });

  if (!validation.valid && visualization.status === "ready") {
    visualization = normalizeVisualizationSpec({
      ...visualization,
      metadata: {
        ...visualization.metadata,
        migrationWarnings: validation.errors,
      },
      status: "draft",
    });
    validation = validateVisualizationSpec(visualization, { allowIncomplete: true });
  }

  return {
    ...validation,
    visualization,
  };
}

module.exports = {
  buildLegacyEncoding,
  buildLegacyLayer,
  getLegacyMark,
  legacyChartToVisualization,
};
