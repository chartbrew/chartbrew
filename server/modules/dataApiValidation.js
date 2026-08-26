const moment = require("moment-timezone");

const { getDataApiLimits } = require("./dataApiLimits");
const { DataApiError } = require("./dataApiResponse");

const FIELD_OPERATORS = new Set([
  "is", "isNot", "contains", "notContains", "greaterThan", "greaterOrEqual",
  "lessThan", "lessOrEqual", "isNull", "isNotNull",
]);
const CLIENT_ONLY_TYPES = new Set([
  "pagination", "page", "sort", "localSort", "local_sort", "display", "view",
  "columnToggle", "column_toggle",
]);
const FIELD_FILTER_KEYS = new Set([
  "type", "field", "operator", "value", "scope", "cdcId", "forceSourceRefresh",
]);
const DATE_FILTER_KEYS = new Set([
  "type", "startDate", "endDate", "scope",
]);
const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function parseDataApiId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new DataApiError("INVALID_REQUEST");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new DataApiError("INVALID_REQUEST");
  return parsed;
}

function stringWithinLimit(value, maxBytes) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maxBytes;
}

function validateJsonValue(value, limits, depth = 0, ancestors = new Set()) {
  if (depth > limits.maxValueDepth) return false;
  if (value === null || ["boolean", "number"].includes(typeof value)) {
    return typeof value !== "number" || Number.isFinite(value);
  }
  if (typeof value === "string") return stringWithinLimit(value, limits.maxStringBytes);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    return value.every((item) => validateJsonValue(item, limits, depth + 1, nextAncestors));
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([key, item]) => {
    return key.length > 0
      && !UNSAFE_OBJECT_KEYS.has(key)
      && stringWithinLimit(key, limits.maxStringBytes)
      && validateJsonValue(item, limits, depth + 1, nextAncestors);
  });
}

function validateVariables(variables, limits) {
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    throw new DataApiError("INVALID_VARIABLE");
  }
  const entries = Object.entries(variables);
  if (entries.length > limits.maxVariables) throw new DataApiError("INVALID_VARIABLE");
  entries.forEach(([key, value]) => {
    if (!key || UNSAFE_OBJECT_KEYS.has(key) || !stringWithinLimit(key, limits.maxStringBytes)
      || !validateJsonValue(value, limits)) {
      throw new DataApiError("INVALID_VARIABLE");
    }
  });
}

function rejectUnknownKeys(value, allowed, code) {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new DataApiError(code);
}

function validateFieldFilter(filter, limits) {
  rejectUnknownKeys(filter, FIELD_FILTER_KEYS, "INVALID_FILTER");
  if ((filter.type !== undefined && filter.type !== "field") || CLIENT_ONLY_TYPES.has(filter.type)
    || typeof filter.field !== "string" || !filter.field
    || !stringWithinLimit(filter.field, limits.maxStringBytes)
    || !FIELD_OPERATORS.has(filter.operator)
    || !stringWithinLimit(filter.operator, limits.maxStringBytes)) {
    throw new DataApiError("INVALID_FILTER");
  }
  if (filter.forceSourceRefresh !== undefined
    && typeof filter.forceSourceRefresh !== "boolean") {
    throw new DataApiError("INVALID_FILTER");
  }
  if (!["isNull", "isNotNull"].includes(filter.operator)
    && !Object.hasOwn(filter, "value")) {
    throw new DataApiError("INVALID_FILTER");
  }
  if (Object.hasOwn(filter, "value") && !validateJsonValue(filter.value, limits)) {
    throw new DataApiError("INVALID_FILTER");
  }
  if (filter.scope !== undefined && !["chart", "cdc"].includes(filter.scope)) {
    throw new DataApiError("INVALID_FILTER");
  }
}

function validateDateFilter(filter, limits) {
  rejectUnknownKeys(filter, DATE_FILTER_KEYS, "INVALID_FILTER");
  if ((filter.scope !== undefined && filter.scope !== "chart")
    || !stringWithinLimit(filter.startDate, limits.maxStringBytes)
    || !stringWithinLimit(filter.endDate, limits.maxStringBytes)) {
    throw new DataApiError("INVALID_FILTER");
  }
  const startMoment = moment(filter.startDate, moment.ISO_8601, true);
  const endMoment = moment(filter.endDate, moment.ISO_8601, true);
  if (!startMoment.isValid() || !endMoment.isValid() || startMoment.isAfter(endMoment)) {
    throw new DataApiError("INVALID_FILTER");
  }
}

function validateFilters(filters, options, limits) {
  if (!Array.isArray(filters) || filters.length > limits.maxFilters) {
    throw new DataApiError("INVALID_FILTER");
  }
  const cdcIds = new Set((options.cdcIds || []).map((id) => `${id}`));
  const schemaFields = options.schemaFields ? new Set(options.schemaFields) : null;

  filters.forEach((filter) => {
    if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
      throw new DataApiError("INVALID_FILTER");
    }
    if (filter.type === "date") {
      if (options.resourceType !== "chart") throw new DataApiError("INVALID_FILTER");
      validateDateFilter(filter, limits);
      return;
    }
    validateFieldFilter(filter, limits);
    if (options.resourceType === "dataset") {
      if (filter.scope === "cdc" || filter.cdcId !== undefined) {
        throw new DataApiError("INVALID_FILTER");
      }
      if ((filter.field.match(/\[\]/g) || []).length !== 1
        || !/^root(?:\[\]|\.)/.test(filter.field)) {
        throw new DataApiError("INVALID_FILTER");
      }
      if (schemaFields && schemaFields.size > 0 && !schemaFields.has(filter.field)) {
        throw new DataApiError("INVALID_FILTER");
      }
      return;
    }
    if (filter.scope === "cdc") {
      if (filter.cdcId === undefined || !cdcIds.has(`${filter.cdcId}`)) {
        throw new DataApiError("INVALID_FILTER");
      }
    } else if (filter.cdcId !== undefined) {
      throw new DataApiError("INVALID_FILTER");
    }
  });
}

function validatePostBody(body, options = {}) {
  const limits = options.limits || getDataApiLimits();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DataApiError("INVALID_REQUEST");
  }
  const allowed = options.resourceType === "dataset"
    ? new Set(["variables", "filters", "refresh", "timezone"])
    : new Set(["variables", "filters", "refresh"]);
  rejectUnknownKeys(body, allowed, "INVALID_REQUEST");

  const request = {
    filters: body.filters === undefined ? [] : body.filters,
    refresh: body.refresh === undefined ? false : body.refresh,
    variables: body.variables === undefined ? {} : body.variables,
  };
  if (typeof request.refresh !== "boolean") throw new DataApiError("INVALID_REQUEST");
  validateVariables(request.variables, limits);
  validateFilters(request.filters, options, limits);

  if (options.resourceType === "dataset") {
    request.timezone = body.timezone === undefined ? "UTC" : body.timezone;
    if (typeof request.timezone !== "string" || !moment.tz.zone(request.timezone)) {
      throw new DataApiError("INVALID_REQUEST");
    }
  }
  return request;
}

function requiresRefreshScope(request) {
  return request.refresh
    || Object.keys(request.variables || {}).length > 0
    || (request.filters || []).some((filter) => filter.type === "date" || filter.forceSourceRefresh);
}

module.exports = {
  FIELD_OPERATORS,
  parseDataApiId,
  requiresRefreshScope,
  validateJsonValue,
  validatePostBody,
};
