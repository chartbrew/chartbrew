import {
  createFieldLabel,
  getAllowedMetricAggregationValues,
  getDefaultAggregation,
  isChartableScalarField,
  normalizeEditableFieldsMetadata,
} from "./datasetFieldMetadata";

export const V2_SYNTHETIC_COUNT_FIELD_ID = "__cb_row_count__";

export const V2_CHART_TYPE_OPTIONS = [{
  key: "line",
  label: "Line",
}, {
  key: "bar",
  label: "Bar",
}, {
  key: "pie",
  label: "Pie",
}, {
  key: "doughnut",
  label: "Doughnut",
}, {
  key: "radar",
  label: "Radar",
}, {
  key: "polar",
  label: "Polar",
}, {
  key: "table",
  label: "Table",
}, {
  key: "kpi",
  label: "KPI",
}, {
  key: "avg",
  label: "Average",
}, {
  key: "gauge",
  label: "Gauge",
}];

export function isVisualizationV2Chart(chart = {}) {
  if (!Array.isArray(chart?.ChartDatasetConfigs) || chart.ChartDatasetConfigs.length === 0) {
    return false;
  }

  return chart.ChartDatasetConfigs.every((cdc) => (
    Number.parseInt(cdc?.vizVersion, 10) === 2 && Boolean(cdc?.vizConfig)
  ));
}

export function isSyntheticMetricFieldId(fieldId) {
  return `${fieldId}` === V2_SYNTHETIC_COUNT_FIELD_ID;
}

export function getSyntheticCountMetricField() {
  return {
    id: V2_SYNTHETIC_COUNT_FIELD_ID,
    legacyPath: null,
    label: "Row count",
    type: "synthetic",
    role: "metric",
    aggregation: "count",
    enabled: true,
    missing: false,
    synthetic: "rowCount",
  };
}

function inferRoleFromType(type = "") {
  if (type === "date") {
    return "date";
  }

  if (type === "number" || type === "boolean") {
    return "metric";
  }

  return "dimension";
}

function buildFieldCatalogFromSchema(fieldsSchema = {}) {
  return Object.keys(fieldsSchema || {}).map((fieldPath) => {
    const type = fieldsSchema[fieldPath];
    const role = inferRoleFromType(type);

    return {
      id: fieldPath,
      legacyPath: fieldPath,
      label: createFieldLabel(fieldPath),
      type,
      role,
      aggregation: role === "metric" ? getDefaultAggregation(role, type) : "none",
      enabled: true,
      missing: false,
    };
  });
}

export function getDatasetFieldCatalog(dataset = {}) {
  if (Array.isArray(dataset?.fieldsMetadata) && dataset.fieldsMetadata.length > 0) {
    return normalizeEditableFieldsMetadata(dataset.fieldsMetadata)
      .filter((field) => field.enabled !== false && field.missing !== true);
  }

  return buildFieldCatalogFromSchema(dataset?.fieldsSchema).filter((field) => field.enabled !== false);
}

export function getFieldById(dataset = {}, fieldId) {
  return getDatasetFieldCatalog(dataset).find((field) => `${field.id}` === `${fieldId}`)
    || null;
}

export function getMetricFieldOptions(dataset = {}) {
  const metricFields = getDatasetFieldCatalog(dataset)
    .filter((field) => isChartableScalarField(field))
    .sort((left, right) => {
      if ((left.role === "metric") !== (right.role === "metric")) {
        return left.role === "metric" ? -1 : 1;
      }

      if ((left.type === "number") !== (right.type === "number")) {
        return left.type === "number" ? -1 : 1;
      }

      return (left.label || left.id).localeCompare(right.label || right.id);
    });
  return [getSyntheticCountMetricField(), ...metricFields];
}

export function getDefaultMetricField(dataset = {}) {
  const fields = getMetricFieldOptions(dataset);
  return fields.find((field) => field.role === "metric" && field.type === "number")
    || fields.find((field) => field.role === "metric")
    || fields.find((field) => field.id === V2_SYNTHETIC_COUNT_FIELD_ID)
    || fields.find((field) => field.type === "number")
    || null;
}

export function getDimensionFieldOptions(dataset = {}) {
  return getDatasetFieldCatalog(dataset)
    .filter((field) => isChartableScalarField(field))
    .sort((left, right) => {
      if ((left.role === "date") !== (right.role === "date")) {
        return left.role === "date" ? -1 : 1;
      }

      if ((left.role === "dimension") !== (right.role === "dimension")) {
        return left.role === "dimension" ? -1 : 1;
      }

      if ((left.type === "date") !== (right.type === "date")) {
        return left.type === "date" ? -1 : 1;
      }

      return (left.label || left.id).localeCompare(right.label || right.id);
    });
}

export function getDefaultDimensionField(dataset = {}) {
  const fields = getDimensionFieldOptions(dataset);
  return fields.find((field) => field.role === "date")
    || fields.find((field) => field.role === "dimension")
    || fields.find((field) => field.type === "date")
    || fields[0]
    || null;
}

export function getDefaultTimeInterval(dataset = {}) {
  const dimensionField = getDefaultDimensionField(dataset);
  if (dimensionField?.type === "date") {
    return "day";
  }

  return "day";
}

export function getChartDataMode(chartType = "line") {
  if (chartType === "table") {
    return "table";
  }

  if (chartType === "avg") {
    return "seriesAverage";
  }

  if (chartType === "kpi" || chartType === "gauge") {
    return "latestValue";
  }

  return "series";
}

export function buildDefaultVizConfig({
  dataset,
  chartType = "line",
  dimensionFieldId,
  metricFieldId,
  aggregation,
  limit = null,
  sortDirection = null,
  filters = [],
  display = {},
  breakoutFieldId = null,
}) {
  const dimensionField = getDimensionFieldOptions(dataset).find((field) => `${field.id}` === `${dimensionFieldId}`)
    || getDefaultDimensionField(dataset);
  const metricField = isSyntheticMetricFieldId(metricFieldId)
    ? getSyntheticCountMetricField()
    : (
      getMetricFieldOptions(dataset).find((field) => `${field.id}` === `${metricFieldId}`)
      || getDefaultMetricField(dataset)
    );
  const allowedAggregations = getAllowedMetricAggregationValues(metricField?.type);
  const resolvedAggregation = allowedAggregations.includes(aggregation)
    ? aggregation
    : (
      allowedAggregations.includes(metricField?.aggregation)
        ? metricField?.aggregation
        : getDefaultAggregation("metric", metricField?.type)
    );
  const dataMode = getChartDataMode(chartType);

  const dimensions = [];
  if (dimensionField) {
    dimensions.push({
      id: "dimension_primary",
      fieldId: dimensionField.id,
      role: chartType === "table" ? "table" : "x",
      grain: dimensionField.type === "date" ? display.timeInterval || "day" : null,
    });
  }

  if (breakoutFieldId) {
    dimensions.push({
      id: "dimension_breakout",
      fieldId: breakoutFieldId,
      role: "breakout",
      grain: null,
    });
  }

  const metrics = chartType === "table" || !metricField ? [] : [{
    id: "metric_primary",
    fieldId: metricField.id,
    aggregation: resolvedAggregation,
    label: metricField.label,
    synthetic: metricField.synthetic || null,
    axis: "left",
    enabled: true,
    style: {
      color: display.datasetColor || null,
      fillColor: display.fillColor || "transparent",
      lineStyle: "solid",
      pointRadius: display.pointRadius ?? 0,
      goal: display.goal ?? null,
    },
  }];

  const compatibility = {
    legacyChartType: chartType,
    legacyMode: "chart",
    legacyDateFieldId: dimensionField?.type === "date" ? dimensionField.id : null,
    legacyDateFormat: dataset?.dateFormat || null,
    preserveDatasetConditions: Array.isArray(dataset?.conditions) && dataset.conditions.length > 0,
    legacyDimensionFieldId: dimensionField?.id || null,
    legacyMetricFieldId: metricField?.synthetic ? null : (metricField?.id || null),
  };

  return {
    version: 2,
    dimensions,
    metrics,
    filters: filters.map((filter, index) => ({
      id: filter.id || `filter_${index + 1}`,
      bindingId: filter.exposed === true ? (filter.bindingId || filter.id || `filter_${index + 1}`) : (filter.bindingId || null),
      fieldId: filter.fieldId,
      operator: filter.operator || "is",
      value: filter.value,
      type: filter.type || null,
      exposed: filter.exposed === true,
      valueSource: filter.valueSource || (filter.exposed === true ? "chartFilter" : "static"),
    })),
    filterControls: [],
    sort: sortDirection && chartType !== "table" ? [{
      ref: "metric_primary",
      dir: sortDirection,
    }] : [],
    limit: limit || null,
    postOperations: [],
    options: {
      includeEmptyBuckets: display.includeZeros !== false,
      visualization: {
        type: chartType,
        dataMode,
        mode: "chart",
        subType: chartType === "line" || chartType === "bar" ? "timeseries" : null,
        displayLegend: display.displayLegend === true,
        dataLabels: display.dataLabels === true,
        stacked: display.stacked === true,
        horizontal: display.horizontal === true,
        showGrowth: display.showGrowth === true,
        invertGrowth: display.invertGrowth === true,
        isLogarithmic: display.isLogarithmic === true,
        xLabelTicks: display.xLabelTicks || "default",
        minValue: display.minValue ?? null,
        maxValue: display.maxValue ?? null,
        ranges: chartType === "gauge" ? (display.ranges || null) : null,
        defaultRowsPerPage: chartType === "table" ? (display.defaultRowsPerPage || 10) : null,
        table: chartType === "table" ? {
          collectionFieldId: dimensionField?.id || null,
          excludedFields: display.excludedFields || [],
          columnsOrder: display.columnsOrder || [],
          columnsFormatting: display.columnsFormatting || null,
          summaryField: display.summaryField || null,
        } : null,
      },
      compatibility,
    },
  };
}
