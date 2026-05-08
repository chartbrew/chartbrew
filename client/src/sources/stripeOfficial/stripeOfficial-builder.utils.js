import {
  CATEGORY_OPTIONS,
  COMPILED_METRIC_OPTIONS,
  PREVIEW_COLUMN_LIMIT,
  PREVIEW_COLUMN_PRIORITY,
  PREVIEW_ROW_LIMIT,
  RESOURCE_EXPAND_FIELDS,
  RESOURCE_FILTERS,
  SEARCHABLE_RESOURCES,
} from "./stripeOfficial-builder.constants";
import { DEFAULT_CONFIGURATION } from "./stripeOfficial.source";

export function formatDateValue(date) {
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);

  return {
    start: formatDateValue(start),
    end: formatDateValue(end),
  };
}

export function normalizeDateRangeValue(value, fallback) {
  if (!value) return fallback;
  if (/^\{\{[^}]+\}\}$/.test(String(value || "").trim())) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return value;
  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) return formatDateValue(parsedDate);
  return fallback;
}

export function normalizeDateRange(dateRange = {}) {
  const defaultRange = getDefaultDateRange();

  return {
    ...dateRange,
    start: normalizeDateRangeValue(dateRange.start, defaultRange.start),
    end: normalizeDateRangeValue(dateRange.end, defaultRange.end),
  };
}

export function getPlaceholderVariableName(value) {
  const match = String(value || "").trim().match(/^\{\{([^}]+)\}\}$/);
  return match?.[1]?.trim() || null;
}

export function serializeMetric(metric) {
  return JSON.stringify({
    field: metric.field || null,
    operation: metric.operation,
  });
}

export function parseMetric(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { operation: "count" };
  }
}

export function mergeConfiguration(dataRequest) {
  const dateRange = {
    ...DEFAULT_CONFIGURATION.dateRange,
    ...(dataRequest?.configuration?.dateRange || {}),
  };

  return {
    ...DEFAULT_CONFIGURATION,
    ...(dataRequest?.configuration || {}),
    metric: {
      ...DEFAULT_CONFIGURATION.metric,
      ...(dataRequest?.configuration?.metric || {}),
    },
    dimension: {
      ...DEFAULT_CONFIGURATION.dimension,
      ...(dataRequest?.configuration?.dimension || {}),
    },
    dateRange: normalizeDateRange(dateRange),
    pagination: {
      ...DEFAULT_CONFIGURATION.pagination,
      ...(dataRequest?.configuration?.pagination || {}),
    },
  };
}

export function getOptionValue(option) {
  return String(option.value || option.field || option.label);
}

export function findLabel(options, value) {
  return options.find((option) => getOptionValue(option) === String(value))?.label || value || "";
}

export function formatMaxRecords(value) {
  if (!value && value !== 0) return "5,000";
  return Number(value).toLocaleString();
}

export function getFilterDefinitions(resource) {
  return RESOURCE_FILTERS[resource] || [];
}

export function getFilterDefinition(resource, field) {
  return getFilterDefinitions(resource).find((filter) => {
    if (filter.field === "metadata.*") return /^metadata\.?[^.]*$/.test(field);
    return filter.field === field;
  });
}

export function getDefaultFilter(resource) {
  const filter = getFilterDefinitions(resource)[0];
  if (!filter) return null;

  return {
    field: filter.field,
    operator: filter.operators[0] || "is",
    value: filter.type === "boolean" ? true : "",
  };
}

export function sanitizeFiltersForResource(filters = [], resource) {
  return filters.filter((filter) => {
    const definition = getFilterDefinition(resource, filter.field);
    return definition && definition.operators.includes(filter.operator || "is");
  });
}

export function getExpandFields(resource) {
  return RESOURCE_EXPAND_FIELDS[resource] || [];
}

export function sanitizeExpandForResource(expand = [], resource) {
  const supportedExpand = getExpandFields(resource).map((option) => option.value);
  return (expand || []).filter((field) => supportedExpand.includes(field));
}

export function isSearchSupported(resource) {
  return SEARCHABLE_RESOURCES.includes(resource);
}

export function getPreviewResponseData(payload) {
  if (Array.isArray(payload)) return { data: payload };
  if (Array.isArray(payload?.data)) return payload;
  if (Array.isArray(payload?.responseData?.data)) return payload.responseData;
  if (Array.isArray(payload?.dataRequest?.responseData?.data)) return payload.dataRequest.responseData;
  if (Array.isArray(payload?.response?.dataRequest?.responseData?.data)) {
    return payload.response.dataRequest.responseData;
  }
  return { data: [] };
}

export function getPreviewRows(payload) {
  return sortPreviewRowsByDateDesc(getPreviewResponseData(payload).data || []);
}

export function getPreviewWarnings(payload) {
  return getPreviewResponseData(payload).configuration?.warnings || [];
}

export function getPreviewRecordsProcessed(payload) {
  return getPreviewResponseData(payload).configuration?.recordsProcessed || null;
}

export function parsePreviewDateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return value < 1000000000000 ? value * 1000 : value;
  }

  if (/^\d+$/.test(String(value))) {
    const numericValue = Number(value);
    return numericValue < 1000000000000 ? numericValue * 1000 : numericValue;
  }

  const parsedDate = Date.parse(value);
  return Number.isNaN(parsedDate) ? null : parsedDate;
}

export function getPreviewRowTimestamp(row) {
  if (!row || typeof row !== "object") return null;

  return [
    row.created,
    row.period,
    row.available_on,
    row.arrival_date,
    row.dimension,
  ].map(parsePreviewDateValue).find((value) => value !== null) || null;
}

export function sortPreviewRowsByDateDesc(rows) {
  return [...rows].sort((a, b) => {
    const aTime = getPreviewRowTimestamp(a);
    const bTime = getPreviewRowTimestamp(b);

    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return bTime - aTime;
  });
}

export function getPreviewColumns(rows) {
  const columns = [];
  rows.slice(0, PREVIEW_ROW_LIMIT).forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.keys(row).forEach((key) => {
      if (!columns.includes(key)) columns.push(key);
    });
  });

  return columns.sort((a, b) => {
    const aIndex = PREVIEW_COLUMN_PRIORITY.indexOf(a);
    const bIndex = PREVIEW_COLUMN_PRIORITY.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return columns.indexOf(a) - columns.indexOf(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  }).slice(0, PREVIEW_COLUMN_LIMIT);
}

export function formatPreviewColumnLabel(column) {
  return String(column)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPreviewCellValue(column, value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && ["created", "available_on", "arrival_date"].includes(column)) {
    return new Date(value * 1000).toISOString().slice(0, 10);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function getSelectedCategory(configuration) {
  if (configuration.mode === "compiled_metric") {
    const compiledMetric = COMPILED_METRIC_OPTIONS.find((option) => option.value === configuration.compiledMetric);
    return CATEGORY_OPTIONS.find((category) => category.id === (compiledMetric?.category || "business")) || CATEGORY_OPTIONS[0];
  }

  return CATEGORY_OPTIONS.find((category) => category.resources.includes(configuration.resource)) || CATEGORY_OPTIONS[0];
}
