const moment = require("moment-timezone");
const request = require("request-promise");

const db = require("../../../models/models");
const drCacheController = require("../../../controllers/DataRequestCacheController");
const { processVariablesInString } = require("../../shared/variables/stringVariables");
const { serializeResponsePreview } = require("../../../modules/updateAudit");
const {
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
} = require("../../shared/connectorRuntime");
const {
  COMPILED_METRICS,
  STRIPE_RESOURCES,
} = require("./stripeOfficial.resources");

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const DEFAULT_MAX_RECORDS = 5000;
const DEFAULT_PAGE_LIMIT = 100;
const STRIPE_MRR_STATUSES = ["active", "past_due"];
const DEFAULT_CONFIGURATION = {
  source: "stripeOfficial",
  resource: "balance_transactions",
  mode: "aggregate",
  metric: {
    field: "net",
    operation: "sum",
  },
  dimension: {
    field: "created",
    interval: "day",
  },
  dateRange: {
    field: "created",
    start: "last_30_days",
    end: "now",
  },
  filters: [],
  expand: [],
  pagination: {
    limit: DEFAULT_PAGE_LIMIT,
    maxRecords: DEFAULT_MAX_RECORDS,
  },
  queryMode: "list",
};

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toJSON === "function") return value.toJSON();
  return { ...value };
}

function getSavedConnection(connection) {
  if (!connection?.id) return Promise.resolve(connection);

  return db.Connection.findByPk(connection.id)
    .then((savedConnection) => savedConnection || connection)
    .catch(() => connection);
}

function getStripeApiKey(connection) {
  const plainConnection = toPlainObject(connection);
  return plainConnection.authentication?.token
    || plainConnection.authentication?.apiKey
    || plainConnection.authentication?.user
    || plainConnection.password
    || "";
}

function validateApiKey(apiKey) {
  if (!apiKey) {
    throw new Error("Enter your Stripe secret or restricted API key");
  }

  if (apiKey.startsWith("pk_")) {
    throw new Error("Publishable Stripe keys cannot read Stripe data");
  }

  if (!apiKey.startsWith("sk_") && !apiKey.startsWith("rk_")) {
    throw new Error("Stripe keys should start with sk_ or rk_");
  }
}

function stripeRequest(connection, endpoint, qs = {}) {
  const apiKey = getStripeApiKey(connection);
  validateApiKey(apiKey);

  return request({
    method: "GET",
    uri: `${STRIPE_API_BASE_URL}${endpoint}`,
    auth: {
      bearer: apiKey,
    },
    qs,
    json: true,
  });
}

async function getAccountMetadata(connection) {
  try {
    const account = await stripeRequest(connection, "/account");
    return {
      accountId: account.id || null,
      businessProfileName: account.business_profile?.name || null,
      country: account.country || null,
      defaultCurrency: account.default_currency || null,
      livemode: account.livemode ?? null,
      timezone: account.settings?.dashboard?.timezone || null,
    };
  } catch (error) {
    const balance = await stripeRequest(connection, "/balance");
    return {
      accountId: null,
      businessProfileName: null,
      country: null,
      defaultCurrency: balance.available?.[0]?.currency || null,
      livemode: balance.livemode ?? null,
      timezone: null,
    };
  }
}

function testConnection({ connection }) {
  return getAccountMetadata(connection)
    .then((metadata) => ({
      success: true,
      metadata,
    }));
}

function testUnsavedConnection({ connection }) {
  return testConnection({ connection });
}

async function prepareConnectionData({ connection }) {
  const metadata = await getAccountMetadata(connection);
  return {
    ...connection,
    type: "stripeOfficial",
    subType: "stripeOfficial",
    host: STRIPE_API_BASE_URL,
    schema: {
      stripeOfficial: metadata,
      resources: Object.keys(STRIPE_RESOURCES),
      compiledMetrics: Object.keys(COMPILED_METRICS),
    },
    options: {
      ...(connection.options || {}),
      stripeOfficial: metadata,
    },
  };
}

function getDefaultDataRequest() {
  return {
    method: "GET",
    route: null,
    headers: {},
    body: "null",
    conditions: null,
    configuration: { ...DEFAULT_CONFIGURATION },
    query: null,
    pagination: true,
    items: "data",
    itemsLimit: DEFAULT_MAX_RECORDS,
    offset: "starting_after",
    paginationField: null,
    template: "stripeOfficial",
    useGlobalHeaders: true,
  };
}

function getBuilderMetadata() {
  return Promise.resolve({
    source: "stripeOfficial",
    resources: STRIPE_RESOURCES,
    compiledMetrics: COMPILED_METRICS,
    defaults: DEFAULT_CONFIGURATION,
  });
}

function convertVariableValue(value, binding) {
  if (binding?.type === "number") {
    return Number.isNaN(Number(value)) ? "0" : String(value);
  }
  if (binding?.type === "boolean") {
    return (value === true || value === "true") ? "true" : "false";
  }
  return String(value);
}

function processConfigValue(value, dataRequest, variables) {
  if (typeof value === "string") {
    return processVariablesInString({
      value,
      dataRequest,
      variables,
      convertValue: convertVariableValue,
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => processConfigValue(item, dataRequest, variables));
  }

  if (value && typeof value === "object") {
    return Object.keys(value).reduce((processed, key) => ({
      ...processed,
      [key]: processConfigValue(value[key], dataRequest, variables),
    }), {});
  }

  return value;
}

function applyVariables({ dataRequest, variables }) {
  const configuration = dataRequest.configuration || {};
  const processedConfiguration = processConfigValue(configuration, dataRequest, variables);

  return {
    dataRequest,
    processedDataRequest: {
      ...toPlainObject(dataRequest),
      configuration: processedConfiguration,
      Connection: dataRequest.Connection,
      VariableBindings: dataRequest.VariableBindings,
    },
  };
}

function getConfiguration(dataRequest) {
  return {
    ...DEFAULT_CONFIGURATION,
    ...(dataRequest.configuration || {}),
    metric: {
      ...DEFAULT_CONFIGURATION.metric,
      ...(dataRequest.configuration?.metric || {}),
    },
    dimension: {
      ...DEFAULT_CONFIGURATION.dimension,
      ...(dataRequest.configuration?.dimension || {}),
    },
    dateRange: {
      ...DEFAULT_CONFIGURATION.dateRange,
      ...(dataRequest.configuration?.dateRange || {}),
    },
    pagination: {
      ...DEFAULT_CONFIGURATION.pagination,
      ...(dataRequest.configuration?.pagination || {}),
    },
  };
}

function getResource(config) {
  const resource = STRIPE_RESOURCES[config.resource];
  if (!resource) {
    throw new Error(`Unsupported Stripe resource: ${config.resource}`);
  }
  return resource;
}

function normalizeMetadataField(field) {
  if (!field) return field;
  return String(field).replace(/^metadata\[/, "metadata.").replace(/\]$/, "");
}

function getFilterDefinition(resource, field) {
  const normalizedField = normalizeMetadataField(normalizeFilterField(field));
  return (resource.filters || []).find((candidate) => {
    if (candidate.pattern && candidate.field === "metadata.*") {
      return /^metadata\.[^.]+$/.test(normalizedField);
    }
    return candidate.field === normalizedField;
  });
}

function validateConfiguration(configuration = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const config = getConfiguration({ configuration });
  const allowSearch = options.allowSearch !== false;

  if (config.source !== "stripeOfficial") {
    errors.push("configuration.source must be stripeOfficial");
  }

  if (!["aggregate", "raw", "compiled_metric"].includes(config.mode)) {
    errors.push("mode must be aggregate, raw, or compiled_metric");
  }

  if (config.mode === "compiled_metric") {
    if (!COMPILED_METRICS[config.compiledMetric]) {
      errors.push(`Unsupported compiled Stripe metric: ${config.compiledMetric || "missing"}`);
    }
    warnings.push("Compiled Stripe metrics are direct-API estimates and may not be accounting-grade.");
  } else {
    const resource = STRIPE_RESOURCES[config.resource];
    if (!resource) {
      errors.push(`Unsupported Stripe resource: ${config.resource || "missing"}`);
    } else {
      const queryMode = config.queryMode || "list";
      if (!resource.supportedQueryModes.includes(queryMode)) {
        errors.push(`Stripe ${resource.label} does not support queryMode=${queryMode}.`);
      }
      if (queryMode === "search") {
        if (!allowSearch) {
          errors.push("Stripe Search API is not available to AI tools yet; use queryMode=list.");
        }
        if (!config.searchQuery || !String(config.searchQuery).trim()) {
          errors.push("searchQuery is required when queryMode=search.");
        }
      }

      (config.filters || []).forEach((filter) => {
        if (!filter?.field) return;
        const normalizedField = normalizeMetadataField(normalizeFilterField(filter.field));
        const filterDefinition = getFilterDefinition(resource, normalizedField);
        if (!filterDefinition) {
          errors.push(`Unsupported Stripe filter for ${config.resource}: ${normalizedField}`);
          return;
        }
        if (!filterDefinition.operators.includes(filter.operator || "is")) {
          errors.push(`Unsupported Stripe filter operator for ${config.resource}.${normalizedField}: ${filter.operator || "is"}`);
        }
      });

      (config.expand || []).forEach((expandField) => {
        if (!(resource.expandableFields || []).includes(expandField)) {
          errors.push(`Unsupported Stripe expand field for ${config.resource}: ${expandField}`);
        }
      });
    }
  }

  const maxRecords = Number(config.pagination?.maxRecords);
  if (!Number.isFinite(maxRecords) || maxRecords <= 0) {
    errors.push("pagination.maxRecords must be a positive number");
  } else if (maxRecords > 10000) {
    warnings.push("pagination.maxRecords is high. Large Stripe requests can be slow; narrow the date range when possible.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configuration: config,
  };
}

function assertValidConfiguration(configuration) {
  const validation = validateConfiguration(configuration);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }
  return validation.configuration;
}

function parseEpoch(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === "number") return value;
  if (/^\d+$/.test(String(value))) return Number(value);

  const normalized = String(value).trim().toLowerCase();
  if (["now", "today"].includes(normalized)) {
    return moment().endOf("day").unix();
  }
  if (normalized === "yesterday") {
    return moment().subtract(1, "day").endOf("day").unix();
  }

  const daysMatch = normalized.match(/^last_(\d+)_days$/);
  if (daysMatch) {
    return moment().subtract(Number(daysMatch[1]), "days").startOf("day").unix();
  }

  const monthsMatch = normalized.match(/^last_(\d+)_months$/);
  if (monthsMatch) {
    return moment().subtract(Number(monthsMatch[1]), "months").startOf("month").unix();
  }

  const date = moment(value);
  if (!date.isValid()) return fallback;
  return date.unix();
}

function readNestedValue(value, keys) {
  if (value === null || value === undefined) return null;
  if (!keys.length) return value;
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const itemValue = readNestedValue(item, keys);
      return Array.isArray(itemValue) ? itemValue : [itemValue];
    }).filter((item) => item !== null && item !== undefined);
  }

  const [key, ...remainingKeys] = keys;
  return readNestedValue(value[key], remainingKeys);
}

function getNestedValue(row, field) {
  if (!field) return null;
  const normalizedField = normalizeMetadataField(normalizeFilterField(field));
  return readNestedValue(row, String(normalizedField).split("."));
}

function normalizeFilterField(field) {
  if (!field) return field;

  return String(field)
    .replace(/^root\[\]\./, "")
    .replace(/^root\./, "");
}

function hasFilterValue(filter = {}) {
  if (["isNull", "isNotNull"].includes(filter.operator)) return true;
  return filter.value !== undefined && filter.value !== null && filter.value !== "";
}

function normalizeRuntimeFilter(filter = {}) {
  if (!filter || filter.clientOnly) return null;

  if (filter.type === "date" && filter.startDate && filter.endDate) {
    return {
      field: null,
      operator: "between",
      start: filter.startDate,
      end: filter.endDate,
      runtimeDateRange: true,
    };
  }

  if (!filter.field || !hasFilterValue(filter)) return null;

  return {
    field: normalizeFilterField(filter.field),
    operator: filter.operator || "is",
    value: filter.value,
  };
}

function isSupportedFilter(config, filter) {
  if (!filter || filter.runtimeDateRange) return false;

  const resource = STRIPE_RESOURCES[config.resource];
  if (!resource) return false;

  const definition = getFilterDefinition(resource, filter.field);
  return Boolean(definition && definition.operators.includes(filter.operator));
}

function mergeRuntimeFilters(config, runtimeFilters = []) {
  const normalizedRuntimeFilters = (runtimeFilters || [])
    .map(normalizeRuntimeFilter)
    .filter(Boolean);
  const dateRuntimeFilter = normalizedRuntimeFilters.find((filter) => filter.runtimeDateRange);
  const fieldRuntimeFilters = normalizedRuntimeFilters.filter((filter) => {
    return !filter.runtimeDateRange && isSupportedFilter(config, filter);
  });

  return {
    ...config,
    dateRange: dateRuntimeFilter
      ? {
        ...config.dateRange,
        start: dateRuntimeFilter.start,
        end: dateRuntimeFilter.end,
      }
      : config.dateRange,
    filters: [
      ...(config.filters || []),
      ...fieldRuntimeFilters,
    ],
  };
}

function getListParamName(config, filter) {
  if (!hasFilterValue(filter)) return null;
  if (filter.operator !== "is") return null;
  if (filter.field === "customer") return "customer";
  if (filter.field === "type" && config.resource === "balance_transactions") return "type";
  if (filter.field === "status" && ["subscriptions", "invoices", "payouts"].includes(config.resource)) return "status";
  if (filter.field === "charge" && config.resource === "refunds") return "charge";
  if (filter.field === "payment_intent" && config.resource === "refunds") return "payment_intent";
  if (filter.field === "source" && config.resource === "balance_transactions") return "source";

  return null;
}

function isPushdownFilter(config, filter) {
  return Boolean(getListParamName(config, filter));
}

function buildListParams(config, resource) {
  const limit = Math.min(Number(config.pagination?.limit || DEFAULT_PAGE_LIMIT), DEFAULT_PAGE_LIMIT);
  const params = {
    ...(resource.defaultParams || {}),
    limit,
  };
  const dateField = config.dateRange?.field || resource.defaultDateField || "created";
  const start = parseEpoch(config.dateRange?.start);
  const end = parseEpoch(config.dateRange?.end);

  if (start || end) {
    params[dateField] = {};
    if (start) params[dateField].gte = start;
    if (end) params[dateField].lte = end;
  }

  (config.filters || []).forEach((filter) => {
    const paramName = getListParamName(config, filter);
    if (paramName) params[paramName] = filter.value;
  });

  if (Array.isArray(config.expand) && config.expand.length > 0) {
    params.expand = config.expand;
  }

  return params;
}

function buildSearchParams(config) {
  const limit = Math.min(Number(config.pagination?.limit || DEFAULT_PAGE_LIMIT), DEFAULT_PAGE_LIMIT);
  const params = {
    limit,
    query: String(config.searchQuery || "").trim(),
  };

  if (Array.isArray(config.expand) && config.expand.length > 0) {
    params.expand = config.expand;
  }

  return params;
}

async function fetchStripeRows(connection, config, resource) {
  if (config.queryMode === "search") {
    const maxRecords = Math.max(1, Number(config.pagination?.maxRecords || DEFAULT_MAX_RECORDS));
    const rows = [];
    const params = buildSearchParams(config);
    let hasMore = true;
    let page = null;

    while (hasMore && rows.length < maxRecords) {
      // oxlint-disable-next-line no-await-in-loop
      const response = await stripeRequest(connection, resource.searchEndpoint || `${resource.endpoint}/search`, {
        ...params,
        ...(page ? { page } : {}),
      });
      const pageRows = Array.isArray(response?.data) ? response.data : [];
      rows.push(...applyLocalFilters(pageRows, config.filters));

      hasMore = response?.has_more === true && pageRows.length > 0;
      page = response?.next_page || null;
    }

    const capped = rows.length > maxRecords || hasMore;
    return {
      rows: rows.slice(0, maxRecords),
      recordsProcessed: Math.min(rows.length, maxRecords),
      capped,
      maxRecords,
    };
  }

  const maxRecords = Math.max(1, Number(config.pagination?.maxRecords || DEFAULT_MAX_RECORDS));
  const rows = [];
  const params = buildListParams(config, resource);
  const localFilters = (config.filters || []).filter((filter) => !isPushdownFilter(config, filter));
  const hasLocalFilters = localFilters.length > 0;
  let hasMore = true;
  let startingAfter = null;
  let scannedRows = 0;

  while (hasMore && rows.length < maxRecords) {
    // oxlint-disable-next-line no-await-in-loop
    const response = await stripeRequest(connection, resource.endpoint, {
      ...params,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const pageRows = Array.isArray(response?.data) ? response.data : [];
    scannedRows += pageRows.length;
    rows.push(...(hasLocalFilters ? applyLocalFilters(pageRows, config.filters) : pageRows));

    hasMore = response?.has_more === true && pageRows.length > 0;
    startingAfter = pageRows[pageRows.length - 1]?.id || null;
  }

  const capped = rows.length > maxRecords || hasMore;
  return {
    rows: rows.slice(0, maxRecords),
    recordsProcessed: hasLocalFilters ? scannedRows : Math.min(rows.length, maxRecords),
    capped,
    maxRecords,
  };
}

function passesFilter(row, filter) {
  const value = getNestedValue(row, filter.field);
  const expected = filter.value;
  const values = Array.isArray(value) ? value : [value];
  const hasAnyValue = values.some((item) => item !== null && item !== undefined && item !== "");

  switch (filter.operator) {
    case "is":
      return values.some((item) => `${item}` === `${expected}`);
    case "isNot":
      return values.every((item) => `${item}` !== `${expected}`);
    case "greaterThan":
      return values.some((item) => Number(item) > Number(expected));
    case "greaterOrEqual":
      return values.some((item) => Number(item) >= Number(expected));
    case "lessThan":
      return values.some((item) => Number(item) < Number(expected));
    case "lessOrEqual":
      return values.some((item) => Number(item) <= Number(expected));
    case "contains":
      return values.some((item) => String(item || "").includes(String(expected || "")));
    case "notContains":
      return values.every((item) => !String(item || "").includes(String(expected || "")));
    case "isNull":
      return !hasAnyValue;
    case "isNotNull":
      return hasAnyValue;
    default:
      return true;
  }
}

function applyLocalFilters(rows, filters = []) {
  if (!Array.isArray(filters) || filters.length === 0) return rows;
  return rows.filter((row) => filters.every((filter) => {
    if (!hasFilterValue(filter)) return true;
    return passesFilter(row, {
      ...filter,
      field: normalizeFilterField(filter.field),
      operator: filter.operator || "is",
    });
  }));
}

function getPeriod(value, interval) {
  const date = moment.unix(Number(value));
  if (!date.isValid()) return "unknown";

  if (interval === "month") return date.startOf("month").format("YYYY-MM-DD");
  if (interval === "week") return date.startOf("isoWeek").format("YYYY-MM-DD");
  if (interval === "year") return date.startOf("year").format("YYYY-MM-DD");
  return date.startOf("day").format("YYYY-MM-DD");
}

function calculateMetric(rows, metric) {
  const operation = metric?.operation || "count";
  if (operation === "count") return rows.length;

  const values = rows.map((row) => Number(getNestedValue(row, metric.field) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);

  if (operation === "avg") {
    return values.length > 0 ? total / values.length : 0;
  }
  if (operation === "min") {
    return values.length > 0 ? Math.min(...values) : 0;
  }
  if (operation === "max") {
    return values.length > 0 ? Math.max(...values) : 0;
  }

  return total;
}

function aggregateRows(rows, config) {
  const dimension = config.dimension || {};
  const metric = config.metric || { operation: "count" };
  const interval = dimension.interval || "day";
  const groups = {};

  rows.forEach((row) => {
    const dimensionValue = getNestedValue(row, dimension.field);
    const period = dimension.type === "date" || ["created", "available_on", "arrival_date"].includes(dimension.field)
      ? getPeriod(dimensionValue, interval)
      : dimensionValue || "unknown";
    const groupKey = String(period);

    if (!groups[groupKey]) {
      groups[groupKey] = {
        rows: [],
        period,
        dimension: period,
      };
    }
    groups[groupKey].rows.push(row);
  });

  return Object.keys(groups).sort().map((key) => {
    const group = groups[key];
    const firstCurrency = group.rows.find((row) => row.currency)?.currency || null;
    return {
      period: group.period,
      dimension: group.dimension,
      value: calculateMetric(group.rows, metric),
      currency: firstCurrency,
      recordsProcessed: group.rows.length,
    };
  });
}

function normalizeRawRows(rows, resource, config) {
  const columns = config.rawColumns || resource.rawColumns || [];
  if (!columns.length || config.rawObjectMode) return rows;

  return rows.map((row) => columns.reduce((record, column) => ({
    ...record,
    [column.replace(/\./g, "_")]: getNestedValue(row, column),
  }), {}));
}

function buildWarnings(fetchResult) {
  const warnings = [];
  if (fetchResult?.capped) {
    warnings.push(`Result capped at ${fetchResult.maxRecords} records. Narrow the date range for more complete data.`);
  }
  return warnings;
}

function getDateWindow(config, fallbackMonths = 12) {
  const end = parseEpoch(config.dateRange?.end, moment().unix());
  const start = parseEpoch(
    config.dateRange?.start,
    moment.unix(end).subtract(fallbackMonths, "months").startOf("month").unix(),
  );

  return {
    start,
    end,
  };
}

function getPeriodMoment(epoch, interval) {
  const date = moment.unix(Number(epoch));
  if (interval === "year") return date.startOf("year");
  if (interval === "week") return date.startOf("isoWeek");
  if (interval === "day") return date.startOf("day");
  return date.startOf("month");
}

function addPeriod(date, interval) {
  if (interval === "year") return date.add(1, "year");
  if (interval === "week") return date.add(1, "week");
  if (interval === "day") return date.add(1, "day");
  return date.add(1, "month");
}

function getPeriodRange(startEpoch, endEpoch, interval = "month") {
  const periods = [];
  const cursor = getPeriodMoment(startEpoch, interval);
  const end = getPeriodMoment(endEpoch, interval);

  while (cursor.isSameOrBefore(end)) {
    periods.push({
      key: cursor.format("YYYY-MM-DD"),
      start: cursor.clone(),
      end: addPeriod(cursor.clone(), interval).subtract(1, "second"),
    });
    addPeriod(cursor, interval);
  }

  return periods;
}

function getPriceMonthlyAmount(price, quantity = 1) {
  if (!price?.recurring) return 0;
  if (price.recurring.usage_type === "metered") return 0;

  const amount = Number(price.unit_amount_decimal || price.unit_amount || 0) * Number(quantity || 1);
  const intervalCount = Number(price.recurring.interval_count || 1);

  if (price.recurring.interval === "year") return amount / (12 * intervalCount);
  if (price.recurring.interval === "week") return (amount * 52) / (12 * intervalCount);
  if (price.recurring.interval === "day") return (amount * 365) / (12 * intervalCount);
  return amount / intervalCount;
}

function getSubscriptionItems(subscription) {
  if (Array.isArray(subscription.items?.data)) return subscription.items.data;
  return [];
}

function getSubscriptionCurrency(subscription) {
  return subscription.currency || getSubscriptionItems(subscription).find((item) => {
    return item.price?.currency;
  })?.price?.currency || null;
}

function getSubscriptionDiscounts(subscription) {
  if (Array.isArray(subscription.discounts)) {
    return subscription.discounts.filter((discount) => discount && typeof discount === "object");
  }
  return subscription.discount ? [subscription.discount] : [];
}

function isDiscountActiveAt(discount, snapshot) {
  const timestamp = snapshot.unix();
  if (discount.start && Number(discount.start) > timestamp) return false;
  if (discount.end && Number(discount.end) <= timestamp) return false;
  return true;
}

function applySubscriptionDiscounts(amount, subscription, snapshot) {
  if (amount <= 0) return 0;

  const subscriptionCurrency = getSubscriptionCurrency(subscription);
  const discountedAmount = getSubscriptionDiscounts(subscription).reduce((currentAmount, discount) => {
    if (!isDiscountActiveAt(discount, snapshot)) return currentAmount;

    const coupon = discount.coupon || {};
    if (coupon.percent_off) {
      return currentAmount * (1 - (Number(coupon.percent_off) / 100));
    }
    if (
      coupon.amount_off
      && coupon.duration !== "once"
      && (!coupon.currency || !subscriptionCurrency || coupon.currency === subscriptionCurrency)
    ) {
      return currentAmount - Number(coupon.amount_off || 0);
    }

    return currentAmount;
  }, amount);

  return Math.max(0, discountedAmount);
}

function getSubscriptionMrr(subscription, snapshot = moment()) {
  const monthlyAmount = getSubscriptionItems(subscription).reduce((total, item) => {
    return total + getPriceMonthlyAmount(item.price, item.quantity || 1);
  }, 0);

  return applySubscriptionDiscounts(monthlyAmount, subscription, snapshot);
}

function getSubscriptionStart(subscription) {
  return Number(subscription.start_date || subscription.created || 0);
}

function getSubscriptionEnd(subscription) {
  return Number(subscription.ended_at || subscription.canceled_at || 0);
}

function wasSubscriptionMrrActiveAt(subscription, snapshot) {
  const start = getSubscriptionStart(subscription);
  const end = getSubscriptionEnd(subscription);
  const timestamp = snapshot.unix();

  if (start > timestamp) return false;
  if (end && end <= timestamp) return false;
  if (subscription.trial_end && Number(subscription.trial_end) > timestamp) return false;

  if (STRIPE_MRR_STATUSES.includes(subscription.status)) return true;
  if (["canceled", "unpaid"].includes(subscription.status) && end && end > timestamp) return true;

  return false;
}

function wasSubscriptionCanceledDuring(subscription, period) {
  const canceledAt = Number(subscription.canceled_at || subscription.ended_at || 0);
  return canceledAt >= period.start.unix() && canceledAt <= period.end.unix();
}

function matchesCurrency(row, currency) {
  if (!currency) return true;
  const rowCurrency = getSubscriptionCurrency(row);
  return !rowCurrency || String(rowCurrency).toLowerCase() === String(currency).toLowerCase();
}

function getCompiledCurrency(config, rows = []) {
  if (config.currency && config.currency !== "auto") return String(config.currency).toLowerCase();
  return rows.find((row) => row.currency)?.currency || null;
}

function getSubscriptionSnapshot(period, endEpoch) {
  const now = moment();
  const configuredEnd = moment.unix(endEpoch);
  return moment.min(period.end.clone(), configuredEnd, now);
}

async function fetchSubscriptionsForCompiledMetric(connection, config) {
  const resource = STRIPE_RESOURCES.subscriptions;
  const { end } = getDateWindow(config);
  const fetchConfig = {
    ...config,
    resource: "subscriptions",
    mode: "raw",
    dateRange: {
      field: "created",
      end,
    },
    expand: Array.from(new Set([
      ...(config.expand || []),
      "data.items.data.price",
    ])),
  };

  return fetchStripeRows(connection, fetchConfig, resource);
}

function calculateRecurringMetricRows(subscriptions, config, metricKey) {
  const interval = config.dimension?.interval || "month";
  const { start, end } = getDateWindow(config);
  const currency = config.currency && config.currency !== "auto" ? String(config.currency).toLowerCase() : null;
  const periods = getPeriodRange(start, end, interval);
  const filteredSubscriptions = subscriptions.filter((subscription) => matchesCurrency(subscription, currency));

  return periods.map((period) => {
    const snapshot = getSubscriptionSnapshot(period, end);
    const activeSubscriptions = filteredSubscriptions.map((subscription) => ({
      subscription,
      mrr: wasSubscriptionMrrActiveAt(subscription, snapshot) ? getSubscriptionMrr(subscription, snapshot) : 0,
    })).filter((item) => item.mrr > 0);
    const mrr = activeSubscriptions.reduce((total, item) => total + item.mrr, 0);
    const activeSubscriptionRows = activeSubscriptions.map((item) => item.subscription);
    const customers = new Set(activeSubscriptionRows.map((subscription) => subscription.customer).filter(Boolean));
    let value = mrr;

    if (metricKey === "arr") value = mrr * 12;
    if (metricKey === "arpa") value = customers.size > 0 ? mrr / customers.size : 0;

    return {
      period: period.key,
      dimension: period.key,
      value,
      currency: getCompiledCurrency(config, activeSubscriptionRows),
      recordsProcessed: activeSubscriptionRows.length,
      activeSubscriptions: activeSubscriptions.length,
      activeCustomers: customers.size,
      snapshotAt: snapshot.unix(),
    };
  });
}

function calculateChurnMetricRows(subscriptions, config, metricKey) {
  const interval = config.dimension?.interval || "month";
  const { start, end } = getDateWindow(config);
  const currency = config.currency && config.currency !== "auto" ? String(config.currency).toLowerCase() : null;
  const periods = getPeriodRange(start, end, interval);
  const filteredSubscriptions = subscriptions.filter((subscription) => matchesCurrency(subscription, currency));

  return periods.map((period) => {
    const startingSnapshot = period.start.clone();
    const endingSnapshot = getSubscriptionSnapshot(period, end);
    const startingSubscriptions = filteredSubscriptions.filter((subscription) => {
      return wasSubscriptionMrrActiveAt(subscription, startingSnapshot)
        && getSubscriptionMrr(subscription, startingSnapshot) > 0;
    });
    const canceledSubscriptions = filteredSubscriptions.filter((subscription) => {
      return wasSubscriptionCanceledDuring(subscription, period);
    });
    const startingMrr = startingSubscriptions.reduce((total, subscription) => total + getSubscriptionMrr(subscription, startingSnapshot), 0);
    const canceledMrr = canceledSubscriptions.reduce((total, subscription) => total + getSubscriptionMrr(subscription, endingSnapshot), 0);
    let value = 0;

    if (metricKey === "subscriber_churn_rate") {
      value = startingSubscriptions.length > 0 ? canceledSubscriptions.length / startingSubscriptions.length : 0;
    } else {
      value = startingMrr > 0 ? canceledMrr / startingMrr : 0;
    }

    return {
      period: period.key,
      dimension: period.key,
      value,
      recordsProcessed: startingSubscriptions.length + canceledSubscriptions.length,
      startingMrr,
      canceledMrr,
      startingSubscribers: startingSubscriptions.length,
      canceledSubscribers: canceledSubscriptions.length,
    };
  });
}

async function calculateNetCashFlow(connection, config) {
  const resource = STRIPE_RESOURCES.balance_transactions;
  const fetchConfig = {
    ...config,
    resource: "balance_transactions",
    mode: "aggregate",
    metric: {
      field: "net",
      operation: "sum",
    },
    dimension: {
      field: config.dimension?.field || "created",
      type: "date",
      interval: config.dimension?.interval || "month",
    },
  };
  const fetchResult = await fetchStripeRows(connection, fetchConfig, resource);
  const filteredRows = applyLocalFilters(fetchResult.rows, fetchConfig.filters);

  return {
    data: aggregateRows(filteredRows, fetchConfig),
    recordsProcessed: fetchResult.recordsProcessed,
    capped: fetchResult.capped,
    maxRecords: fetchResult.maxRecords,
    warnings: [
      ...buildWarnings(fetchResult, config),
      "Net cash flow uses balance transaction net amounts. It includes fees and account balance movements available through direct Stripe API data, but it is not a full accounting ledger.",
    ],
  };
}

async function calculateCustomerLifetimeValue(connection, config) {
  const invoiceResource = STRIPE_RESOURCES.invoices;
  const subscriptionFetch = await fetchSubscriptionsForCompiledMetric(connection, config);
  const invoiceFetch = await fetchStripeRows(connection, {
    ...config,
    resource: "invoices",
    mode: "raw",
  }, invoiceResource);
  const paidInvoices = applyLocalFilters(invoiceFetch.rows, [
    ...(config.filters || []),
    { field: "status", operator: "is", value: "paid" },
  ]);
  const revenue = paidInvoices.reduce((total, invoice) => total + Number(invoice.amount_paid || 0), 0);
  const payingCustomers = new Set(paidInvoices.map((invoice) => invoice.customer).filter(Boolean));
  const churnRows = calculateChurnMetricRows(subscriptionFetch.rows, config, "subscriber_churn_rate");
  const churnRateValues = churnRows.map((row) => row.value).filter((value) => value > 0);
  const averageChurnRate = churnRateValues.length > 0
    ? churnRateValues.reduce((sum, value) => sum + value, 0) / churnRateValues.length
    : 0;
  const averageRevenuePerCustomer = payingCustomers.size > 0 ? revenue / payingCustomers.size : 0;
  const value = averageChurnRate > 0
    ? averageRevenuePerCustomer / averageChurnRate
    : averageRevenuePerCustomer;
  const { end } = getDateWindow(config);

  return {
    data: [{
      period: getPeriodMoment(end, config.dimension?.interval || "month").format("YYYY-MM-DD"),
      dimension: "Customer lifetime value",
      value,
      currency: getCompiledCurrency(config, paidInvoices),
      recordsProcessed: paidInvoices.length + subscriptionFetch.recordsProcessed,
      averageRevenuePerCustomer,
      averageChurnRate,
      payingCustomers: payingCustomers.size,
    }],
    recordsProcessed: paidInvoices.length + subscriptionFetch.recordsProcessed,
    capped: subscriptionFetch.capped || invoiceFetch.capped,
    maxRecords: Math.max(subscriptionFetch.maxRecords, invoiceFetch.maxRecords),
    warnings: [
      ...buildWarnings(subscriptionFetch, config),
      ...buildWarnings(invoiceFetch, config),
      "Customer lifetime value is estimated from paid invoices and subscriber churn. If no churn is detected, it falls back to average revenue per paying customer.",
    ],
  };
}

async function calculateRecurringCompiledMetric(connection, config, metricKey) {
  const fetchResult = await fetchSubscriptionsForCompiledMetric(connection, config);
  const filteredRows = applyLocalFilters(fetchResult.rows, config.filters);
  const data = ["gross_mrr_churn_rate", "net_mrr_churn_rate", "subscriber_churn_rate"].includes(metricKey)
    ? calculateChurnMetricRows(filteredRows, config, metricKey)
    : calculateRecurringMetricRows(filteredRows, config, metricKey);
  const warnings = [
    ...buildWarnings(fetchResult, config),
    "Recurring revenue metrics use Stripe-style MRR rules where possible: monthly-normalized licensed recurring prices for active and past_due subscriptions, excluding trialing, unpaid/canceled, free, metered, and tax amounts. Historical price changes and multi-currency conversion may still require a later accounting-grade pass.",
  ];

  if (metricKey === "net_mrr_churn_rate") {
    warnings.push("Net MRR churn currently uses canceled MRR only. Expansion, contraction, and reactivation movements require historical subscription item changes and are not included yet.");
  }

  return {
    data,
    recordsProcessed: fetchResult.recordsProcessed,
    capped: fetchResult.capped,
    maxRecords: fetchResult.maxRecords,
    warnings,
  };
}

async function calculateCompiledMetric(connection, config) {
  const metricKey = config.compiledMetric;
  const metric = COMPILED_METRICS[metricKey];
  if (!metric) {
    throw new Error(`Unsupported compiled Stripe metric: ${metricKey}`);
  }

  if (metricKey === "net_cash_flow") {
    return calculateNetCashFlow(connection, config);
  }
  if (metricKey === "customer_lifetime_value") {
    return calculateCustomerLifetimeValue(connection, config);
  }

  return calculateRecurringCompiledMetric(connection, config, metricKey);
}

async function runDataRequest({
  connection,
  dataRequest,
  getCache,
  filters = [],
  processedDataRequest = null,
  auditContext = null,
}) {
  if (getCache) {
    const drCache = await checkAndGetCache(connection.id, dataRequest);
    if (drCache) {
      await completeConnectorAudit(auditContext, {
        cacheHit: true,
        connectionType: "stripeOfficial",
        ...serializeResponsePreview(drCache.responseData),
      });
      return drCache;
    }
  }

  const dataRequestToRun = processedDataRequest || dataRequest;
  const config = assertValidConfiguration(mergeRuntimeFilters(getConfiguration(dataRequestToRun), filters));
  const savedConnection = await getSavedConnection(connection);

  try {
    let data;
    let runtimeSummary;
    let auditResource = config.resource;

    if (config.mode === "compiled_metric") {
      const compiledResult = await calculateCompiledMetric(savedConnection, config);
      data = compiledResult.data;
      auditResource = config.compiledMetric;
      runtimeSummary = {
        recordsProcessed: compiledResult.recordsProcessed,
        warnings: compiledResult.warnings,
      };
    } else {
      const resource = getResource(config);
      const fetchResult = await fetchStripeRows(savedConnection, config, resource);
      const filteredRows = applyLocalFilters(fetchResult.rows, config.filters);
      data = config.mode === "raw"
        ? normalizeRawRows(filteredRows, resource, config)
        : aggregateRows(filteredRows, config);
      runtimeSummary = {
        recordsProcessed: fetchResult.recordsProcessed,
        warnings: buildWarnings(fetchResult, config),
      };
    }

    const dataToCache = {
      dataRequest,
      responseData: {
        data,
        configuration: {
          source: "stripeOfficial",
          ...runtimeSummary,
        },
      },
      connection_id: savedConnection.id,
    };

    if (dataRequest.id) {
      await drCacheController.create(dataRequest.id, dataToCache);
    }
    await completeConnectorAudit(auditContext, {
      cacheHit: false,
      connectionType: "stripeOfficial",
      resource: auditResource,
      ...serializeResponsePreview(dataToCache.responseData),
    });

    return dataToCache;
  } catch (error) {
    await failConnectorAudit(auditContext, error, "connection", {
      cacheHit: false,
      connectionType: "stripeOfficial",
      resource: config.mode === "compiled_metric" ? config.compiledMetric : config.resource,
    });
    return Promise.reject(error);
  }
}

function previewDataRequest(options) {
  return runDataRequest({
    ...options,
    getCache: false,
  });
}

module.exports = {
  DEFAULT_CONFIGURATION,
  _private: {
    aggregateRows,
    applyLocalFilters,
    buildListParams,
    buildSearchParams,
    calculateRecurringMetricRows,
    getPriceMonthlyAmount,
    getSubscriptionMrr,
    getFilterDefinition,
    mergeRuntimeFilters,
    normalizeFilterField,
    normalizeRawRows,
  },
  applyVariables,
  getBuilderMetadata,
  getDefaultDataRequest,
  prepareConnectionData,
  previewDataRequest,
  runDataRequest,
  testConnection,
  testUnsavedConnection,
  validateConfiguration,
};
