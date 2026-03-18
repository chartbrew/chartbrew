const { getDatasetDisplayName } = require("../datasetIdentity");

const SUPPORTED_LEGACY_CHART_TYPES = Object.freeze(["line", "bar", "kpi", "avg"]);
const SUPPORTED_AGGREGATIONS = Object.freeze(["none", "sum", "avg", "min", "max", "count", "countUnique"]);

function createIssue(code, message) {
  return { code, message };
}

function normalizeLegacyChartType(chart = {}) {
  if (chart?.type === "line" && chart?.mode === "kpi") {
    return "kpi";
  }

  return chart?.type || null;
}

function normalizeLegacyAggregation(value) {
  const normalized = String(value || "none").trim();

  if (SUPPORTED_AGGREGATIONS.includes(normalized)) {
    return normalized;
  }

  return null;
}

function normalizeSortDirection(value) {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return null;
}

function extractFieldNameFromPath(path) {
  if (!path || typeof path !== "string") {
    return "field";
  }

  const normalizedPath = path.replace(/\[\]/g, "");
  const segments = normalizedPath.split(".").filter(Boolean);
  const fieldName = segments[segments.length - 1] || normalizedPath;

  return fieldName.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildFieldMetadataIndex(fieldsMetadata = []) {
  const index = new Map();

  if (!Array.isArray(fieldsMetadata)) {
    return index;
  }

  fieldsMetadata.forEach((field) => {
    if (!field) {
      return;
    }

    if (field.id) {
      index.set(field.id, field);
    }

    if (field.legacyPath) {
      index.set(field.legacyPath, field);
    }
  });

  return index;
}

function resolveFieldReference(dataset = {}, legacyPath) {
  if (!legacyPath) {
    return null;
  }

  const metadataIndex = buildFieldMetadataIndex(dataset.fieldsMetadata);
  const metadataField = metadataIndex.get(legacyPath);
  const schemaType = dataset?.fieldsSchema?.[legacyPath] || null;

  if (metadataField) {
    return {
      fieldId: metadataField.id || metadataField.legacyPath || legacyPath,
      legacyPath,
      type: metadataField.type || schemaType || null,
      label: metadataField.label || extractFieldNameFromPath(legacyPath),
      fromMetadata: true,
    };
  }

  return {
    fieldId: legacyPath,
    legacyPath,
    type: schemaType,
    label: extractFieldNameFromPath(legacyPath),
    fromMetadata: false,
  };
}

function isDateField(fieldReference, fallbackPath) {
  if (!fieldReference && !fallbackPath) {
    return false;
  }

  if (fieldReference?.type === "date") {
    return true;
  }

  const path = fallbackPath || fieldReference?.legacyPath || fieldReference?.fieldId || "";

  return /(date|time|timestamp|created_at|updated_at)$/i.test(path);
}

function buildMetricStyle(chart = {}, cdc = {}) {
  let pointRadius = 0;

  if (Number.isInteger(cdc.pointRadius)) {
    pointRadius = cdc.pointRadius;
  } else if (Number.isInteger(chart.pointRadius)) {
    pointRadius = chart.pointRadius;
  }

  const fillColor = cdc.fill === true
    ? (cdc.fillColor || cdc.datasetColor || "transparent")
    : "transparent";

  return {
    color: cdc.datasetColor || null,
    fillColor,
    lineStyle: "solid",
    pointRadius,
    goal: cdc.goal ?? null,
  };
}

function buildCompatibilityOptions({ chart, dataset, dateFieldReference }) {
  return {
    includeEmptyBuckets: chart?.includeZeros !== false,
    compatibility: {
      legacyChartType: chart?.type || null,
      legacyMode: chart?.mode || null,
      legacyDateFieldId: dateFieldReference?.fieldId || null,
      legacyDateFormat: dataset?.dateFormat || chart?.dateVarsFormat || null,
      preserveDatasetConditions:
        Array.isArray(dataset?.conditions) && dataset.conditions.length > 0,
    },
  };
}

function legacyToVizConfig({ chart, dataset, cdc }) {
  const reasons = [];
  const warnings = [];

  if (!chart) {
    reasons.push(createIssue("missing_chart", "Chart context is required for legacy migration."));
  }

  if (!dataset) {
    reasons.push(createIssue("missing_dataset", "Dataset context is required for legacy migration."));
  }

  if (!cdc) {
    reasons.push(createIssue("missing_cdc", "Chart dataset config context is required for legacy migration."));
  }

  if (reasons.length > 0) {
    return {
      supported: false,
      status: "unsupported",
      reasons,
      warnings,
      vizVersion: 1,
      vizConfig: null,
    };
  }

  if (Number.parseInt(cdc.vizVersion, 10) === 2 && cdc.vizConfig) {
    return {
      supported: false,
      status: "already_migrated",
      reasons,
      warnings,
      vizVersion: 2,
      vizConfig: cdc.vizConfig,
      summary: {
        chartType: normalizeLegacyChartType(chart),
        metricFieldId: cdc?.vizConfig?.metrics?.[0]?.fieldId || null,
        dimensionFieldId: cdc?.vizConfig?.dimensions?.[0]?.fieldId || null,
      },
    };
  }

  const legacyChartType = normalizeLegacyChartType(chart);
  if (!SUPPORTED_LEGACY_CHART_TYPES.includes(legacyChartType)) {
    reasons.push(
      createIssue(
        "unsupported_chart_type",
        `Chart type "${legacyChartType || "unknown"}" is not supported by the Phase 2 migration utility.`
      )
    );
  }

  if (!dataset.xAxis) {
    reasons.push(createIssue("missing_x_axis", "Dataset is missing a legacy xAxis field."));
  }

  if (!dataset.yAxis) {
    reasons.push(createIssue("missing_y_axis", "Dataset is missing a legacy yAxis field."));
  }

  const aggregation = normalizeLegacyAggregation(dataset.yAxisOperation);
  if (!aggregation) {
    reasons.push(
      createIssue(
        "unsupported_y_axis_operation",
        `Legacy aggregation "${dataset.yAxisOperation}" is not supported by the Phase 2 migration utility.`
      )
    );
  }

  const dimensionField = resolveFieldReference(dataset, dataset.xAxis);
  const metricField = resolveFieldReference(dataset, dataset.yAxis);
  const dateFieldReference = resolveFieldReference(dataset, dataset.dateField);

  if (!dimensionField) {
    reasons.push(createIssue("unresolved_x_axis", "Could not resolve the dataset xAxis field reference."));
  }

  if (!metricField) {
    reasons.push(createIssue("unresolved_y_axis", "Could not resolve the dataset yAxis field reference."));
  }

  if (reasons.length > 0) {
    return {
      supported: false,
      status: "unsupported",
      reasons,
      warnings,
      vizVersion: 1,
      vizConfig: null,
    };
  }

  if (Array.isArray(dataset.conditions) && dataset.conditions.length > 0) {
    warnings.push(
      createIssue(
        "dataset_conditions_preserved",
        "Dataset conditions remain on the dataset and are not copied into vizConfig during migration."
      )
    );
  }

  if (dataset.dateField && dataset.dateField !== dataset.xAxis) {
    warnings.push(
      createIssue(
        "legacy_date_field_preserved",
        "The legacy dateField differs from xAxis and is preserved in compatibility options for the future V2 engine."
      )
    );
  }

  const metricId = `metric_${cdc.id}`;
  const dimensionId = `dimension_${cdc.id}`;
  const xAxisIsDate = isDateField(dimensionField, dataset.xAxis)
    || dataset.xAxis === dataset.dateField;

  const vizConfig = {
    version: 2,
    dimensions: [{
      id: dimensionId,
      fieldId: dimensionField.fieldId,
      role: "x",
      grain: xAxisIsDate ? (chart.timeInterval || null) : null,
    }],
    metrics: [{
      id: metricId,
      fieldId: metricField.fieldId,
      aggregation,
      label: cdc.legend || getDatasetDisplayName(dataset) || metricField.label,
      axis: "left",
      enabled: true,
      style: buildMetricStyle(chart, cdc),
    }],
    filters: [],
    filterControls: [],
    sort: normalizeSortDirection(cdc.sort)
      ? [{ ref: metricId, dir: normalizeSortDirection(cdc.sort) }]
      : [],
    limit: Number.isInteger(cdc.maxRecords) && cdc.maxRecords > 0 ? cdc.maxRecords : null,
    postOperations: cdc.formula
      ? [{ type: "formula", metricId, expression: cdc.formula }]
      : [],
    options: buildCompatibilityOptions({ chart, dataset, dateFieldReference }),
  };

  return {
    supported: true,
    status: "ready",
    reasons,
    warnings,
    vizVersion: 2,
    vizConfig,
    summary: {
      chartType: legacyChartType,
      metricFieldId: metricField.fieldId,
      dimensionFieldId: dimensionField.fieldId,
      dateFieldId: dateFieldReference?.fieldId || null,
      aggregation,
    },
  };
}

module.exports = {
  SUPPORTED_AGGREGATIONS,
  SUPPORTED_LEGACY_CHART_TYPES,
  buildCompatibilityOptions,
  extractFieldNameFromPath,
  legacyToVizConfig,
  normalizeLegacyAggregation,
  normalizeLegacyChartType,
  normalizeSortDirection,
  resolveFieldReference,
};
