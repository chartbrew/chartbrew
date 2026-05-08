import React, {
  useEffect, useMemo, useRef, useState,
} from "react";
import PropTypes from "prop-types";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Disclosure,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Switch,
  Table,
  TextField,
} from "@heroui/react";
import {
  LuArrowRight,
  LuBraces,
  LuCalculator,
  LuChartLine,
  LuCreditCard,
  LuDollarSign,
  LuEye,
  LuFileText,
  LuPlay,
  LuPlus,
  LuRefreshCw,
  LuSave,
  LuSparkles,
  LuTable2,
  LuTrash,
  LuUndo2,
  LuUsers,
  LuX,
} from "react-icons/lu";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";

import AceEditor from "../../components/CodeEditor";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import DataTransform from "../../containers/Dataset/DataTransform";
import { runDataRequest, selectDataRequests } from "../../slices/dataset";
import { selectTeam } from "../../slices/team";
import { DEFAULT_CONFIGURATION } from "./stripeOfficial.source";

const CATEGORY_OPTIONS = [{
  id: "payments",
  label: "Payments",
  defaultResource: "payment_intents",
  resources: ["payment_intents", "charges"],
  icon: LuCreditCard,
  iconClassName: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
}, {
  id: "revenue",
  label: "Revenue",
  defaultResource: "balance_transactions",
  resources: ["balance_transactions"],
  icon: LuDollarSign,
  iconClassName: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
}, {
  id: "customers",
  label: "Customers",
  defaultResource: "customers",
  resources: ["customers"],
  icon: LuUsers,
  iconClassName: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
}, {
  id: "subscriptions",
  label: "Subscriptions",
  defaultResource: "subscriptions",
  resources: ["subscriptions"],
  icon: LuRefreshCw,
  iconClassName: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
}, {
  id: "invoices",
  label: "Invoices",
  defaultResource: "invoices",
  resources: ["invoices"],
  icon: LuFileText,
  iconClassName: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
}, {
  id: "refunds",
  label: "Refunds",
  defaultResource: "refunds",
  resources: ["refunds"],
  icon: LuUndo2,
  iconClassName: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
}, {
  id: "business",
  label: "Business metrics",
  defaultResource: "compiled_metric:mrr",
  resources: [],
  icon: LuCalculator,
  iconClassName: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
}, {
  id: "payouts",
  label: "Payouts",
  defaultResource: "payouts",
  resources: ["payouts"],
  icon: LuArrowRight,
  iconClassName: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
}];

const RESOURCE_LABELS = {
  payment_intents: "Payment Intents",
  charges: "Charges",
  balance_transactions: "Balance transactions",
  customers: "Customers",
  subscriptions: "Subscriptions",
  invoices: "Invoices",
  refunds: "Refunds",
  payouts: "Payouts",
};

const RESOURCE_METRICS = {
  payment_intents: [
    { label: "Count payments", operation: "count" },
    { label: "Sum amount", field: "amount", operation: "sum" },
    { label: "Average amount", field: "amount", operation: "avg" },
    { label: "Sum amount received", field: "amount_received", operation: "sum" },
  ],
  charges: [
    { label: "Count charges", operation: "count" },
    { label: "Sum amount", field: "amount", operation: "sum" },
    { label: "Average amount", field: "amount", operation: "avg" },
  ],
  balance_transactions: [
    { label: "Sum net", field: "net", operation: "sum" },
    { label: "Sum gross", field: "amount", operation: "sum" },
    { label: "Sum fees", field: "fee", operation: "sum" },
    { label: "Count transactions", operation: "count" },
  ],
  customers: [
    { label: "Count customers", operation: "count" },
  ],
  subscriptions: [
    { label: "Count subscriptions", operation: "count" },
  ],
  invoices: [
    { label: "Count invoices", operation: "count" },
    { label: "Sum amount paid", field: "amount_paid", operation: "sum" },
    { label: "Sum amount due", field: "amount_due", operation: "sum" },
  ],
  refunds: [
    { label: "Count refunds", operation: "count" },
    { label: "Sum amount", field: "amount", operation: "sum" },
  ],
  payouts: [
    { label: "Count payouts", operation: "count" },
    { label: "Sum amount", field: "amount", operation: "sum" },
  ],
};

const DIMENSION_OPTIONS = [{
  label: "Created date",
  field: "created",
  type: "date",
}, {
  label: "Status",
  field: "status",
}, {
  label: "Currency",
  field: "currency",
}, {
  label: "Customer",
  field: "customer",
}, {
  label: "Type",
  field: "type",
}, {
  label: "Reporting category",
  field: "reporting_category",
}];

const INTERVAL_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const FILTER_OPERATOR_OPTIONS = {
  is: { value: "is", label: "Is" },
  isNot: { value: "isNot", label: "Is not" },
  greaterThan: { value: "greaterThan", label: "Greater than" },
  greaterOrEqual: { value: "greaterOrEqual", label: "Greater or equal" },
  lessThan: { value: "lessThan", label: "Less than" },
  lessOrEqual: { value: "lessOrEqual", label: "Less or equal" },
  contains: { value: "contains", label: "Contains" },
  notContains: { value: "notContains", label: "Does not contain" },
  isNull: { value: "isNull", label: "Is empty" },
  isNotNull: { value: "isNotNull", label: "Is not empty" },
};

const RESOURCE_FILTERS = {
  payment_intents: [
    { field: "status", label: "Status", type: "text", operators: ["is", "isNot"] },
    { field: "currency", label: "Currency", type: "text", operators: ["is"] },
    { field: "amount", label: "Amount", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "customer", label: "Customer", type: "text", operators: ["is"] },
    { field: "metadata.*", label: "Metadata", type: "metadata", operators: ["is", "isNot", "contains", "notContains", "isNull", "isNotNull"] },
  ],
  charges: [
    { field: "status", label: "Status", type: "text", operators: ["is", "isNot"] },
    { field: "currency", label: "Currency", type: "text", operators: ["is"] },
    { field: "amount", label: "Amount", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "customer", label: "Customer", type: "text", operators: ["is"] },
    { field: "billing_details.address.country", label: "Country", type: "text", operators: ["is"] },
    { field: "metadata.*", label: "Metadata", type: "metadata", operators: ["is", "isNot", "contains", "notContains", "isNull", "isNotNull"] },
  ],
  balance_transactions: [
    { field: "type", label: "Type", type: "text", operators: ["is", "isNot"] },
    { field: "currency", label: "Currency", type: "text", operators: ["is"] },
    { field: "reporting_category", label: "Reporting category", type: "text", operators: ["is"] },
    { field: "source", label: "Source", type: "text", operators: ["is"] },
    { field: "amount", label: "Gross amount", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "net", label: "Net amount", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "fee", label: "Fee", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
  ],
  customers: [
    { field: "currency", label: "Currency", type: "text", operators: ["is"] },
    { field: "email", label: "Email", type: "text", operators: ["is", "contains"] },
    { field: "name", label: "Name", type: "text", operators: ["is", "contains"] },
    { field: "metadata.*", label: "Metadata", type: "metadata", operators: ["is", "isNot", "contains", "notContains", "isNull", "isNotNull"] },
  ],
  subscriptions: [
    { field: "status", label: "Status", type: "text", operators: ["is", "isNot"] },
    { field: "customer", label: "Customer", type: "text", operators: ["is"] },
    { field: "items.data.price.id", label: "Price", type: "text", operators: ["is", "isNot"] },
    { field: "items.data.price.product", label: "Product", type: "text", operators: ["is", "isNot"] },
    { field: "metadata.*", label: "Metadata", type: "metadata", operators: ["is", "isNot", "contains", "notContains", "isNull", "isNotNull"] },
  ],
  invoices: [
    { field: "status", label: "Status", type: "text", operators: ["is", "isNot"] },
    { field: "currency", label: "Currency", type: "text", operators: ["is"] },
    { field: "customer", label: "Customer", type: "text", operators: ["is"] },
    { field: "amount_paid", label: "Amount paid", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "amount_due", label: "Amount due", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "subscription", label: "Subscription", type: "text", operators: ["is"] },
    { field: "metadata.*", label: "Metadata", type: "metadata", operators: ["is", "isNot", "contains", "notContains", "isNull", "isNotNull"] },
  ],
  refunds: [
    { field: "status", label: "Status", type: "text", operators: ["is", "isNot"] },
    { field: "currency", label: "Currency", type: "text", operators: ["is"] },
    { field: "amount", label: "Amount", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "charge", label: "Charge", type: "text", operators: ["is"] },
    { field: "payment_intent", label: "Payment Intent", type: "text", operators: ["is"] },
    { field: "metadata.*", label: "Metadata", type: "metadata", operators: ["is", "isNot", "contains", "notContains", "isNull", "isNotNull"] },
  ],
  payouts: [
    { field: "status", label: "Status", type: "text", operators: ["is", "isNot"] },
    { field: "currency", label: "Currency", type: "text", operators: ["is"] },
    { field: "amount", label: "Amount", type: "number", operators: ["greaterThan", "greaterOrEqual", "lessThan", "lessOrEqual"] },
    { field: "metadata.*", label: "Metadata", type: "metadata", operators: ["is", "isNot", "contains", "notContains", "isNull", "isNotNull"] },
  ],
};

const RESOURCE_EXPAND_FIELDS = {
  payment_intents: [
    { value: "data.customer", label: "Customer" },
    { value: "data.latest_charge", label: "Latest charge" },
    { value: "data.payment_method", label: "Payment method" },
  ],
  charges: [
    { value: "data.customer", label: "Customer" },
    { value: "data.balance_transaction", label: "Balance transaction" },
    { value: "data.payment_intent", label: "Payment Intent" },
  ],
  balance_transactions: [
    { value: "data.source", label: "Source object" },
  ],
  subscriptions: [
    { value: "data.customer", label: "Customer" },
    { value: "data.items.data.price", label: "Subscription item prices" },
    { value: "data.default_payment_method", label: "Default payment method" },
  ],
  invoices: [
    { value: "data.customer", label: "Customer" },
    { value: "data.subscription", label: "Subscription" },
    { value: "data.payment_intent", label: "Payment Intent" },
    { value: "data.charge", label: "Charge" },
  ],
  refunds: [
    { value: "data.charge", label: "Charge" },
    { value: "data.payment_intent", label: "Payment Intent" },
  ],
};

const SEARCHABLE_RESOURCES = ["payment_intents", "charges", "customers", "subscriptions", "invoices"];

const MAX_RECORD_OPTIONS = [
  { value: "1000", label: "1,000" },
  { value: "5000", label: "5,000" },
  { value: "10000", label: "10,000" },
];

const COMPILED_METRIC_OPTIONS = [{
  value: "mrr",
  label: "MRR",
  category: "business",
}, {
  value: "arr",
  label: "ARR",
  category: "business",
}, {
  value: "arpa",
  label: "ARPA",
  category: "business",
}, {
  value: "net_cash_flow",
  label: "Net cash flow",
  category: "revenue",
}, {
  value: "gross_mrr_churn_rate",
  label: "Gross MRR churn rate",
  category: "subscriptions",
}, {
  value: "net_mrr_churn_rate",
  label: "Net MRR churn rate",
  category: "subscriptions",
}, {
  value: "subscriber_churn_rate",
  label: "Subscriber churn rate",
  category: "subscriptions",
}, {
  value: "customer_lifetime_value",
  label: "Customer lifetime value",
  category: "customers",
}];

const QUICK_STARTS = {
  payments: [{
    label: "Payment volume",
    configuration: {
      resource: "payment_intents",
      mode: "aggregate",
      metric: { field: "amount_received", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }, {
    label: "Payments by status",
    configuration: {
      resource: "payment_intents",
      mode: "aggregate",
      metric: { operation: "count" },
      dimension: { field: "status" },
    },
  }, {
    label: "Average order value",
    configuration: {
      resource: "payment_intents",
      mode: "aggregate",
      metric: { field: "amount", operation: "avg" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }, {
    label: "Latest payments",
    configuration: {
      resource: "payment_intents",
      mode: "raw",
    },
  }],
  revenue: [{
    label: "Net revenue",
    configuration: {
      resource: "balance_transactions",
      mode: "aggregate",
      metric: { field: "net", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }, {
    label: "Net cash flow",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "net_cash_flow",
      dimension: { field: "created", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Gross revenue",
    configuration: {
      resource: "balance_transactions",
      mode: "aggregate",
      metric: { field: "amount", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }, {
    label: "Stripe fees",
    configuration: {
      resource: "balance_transactions",
      mode: "aggregate",
      metric: { field: "fee", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }],
  customers: [{
    label: "New customers",
    configuration: {
      resource: "customers",
      mode: "aggregate",
      metric: { operation: "count" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }, {
    label: "ARPA",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "arpa",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Customer lifetime value",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "customer_lifetime_value",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }],
  subscriptions: [{
    label: "MRR",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "mrr",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "ARR",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "arr",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "MRR churn",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "gross_mrr_churn_rate",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Active subscriptions",
    configuration: {
      resource: "subscriptions",
      mode: "raw",
      filters: [{ field: "status", operator: "is", value: "active" }],
    },
  }, {
    label: "New subscriptions",
    configuration: {
      resource: "subscriptions",
      mode: "aggregate",
      metric: { operation: "count" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }],
  invoices: [{
    label: "Open invoices",
    configuration: {
      resource: "invoices",
      mode: "raw",
      filters: [{ field: "status", operator: "is", value: "open" }],
    },
  }, {
    label: "Paid invoices",
    configuration: {
      resource: "invoices",
      mode: "aggregate",
      metric: { field: "amount_paid", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }],
  refunds: [{
    label: "Refunds over time",
    configuration: {
      resource: "refunds",
      mode: "aggregate",
      metric: { field: "amount", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }],
  payouts: [{
    label: "Payouts over time",
    configuration: {
      resource: "payouts",
      mode: "aggregate",
      metric: { field: "amount", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    },
  }],
  business: [{
    label: "MRR",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "mrr",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "ARR",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "arr",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "ARPA",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "arpa",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Net cash flow",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "net_cash_flow",
      dimension: { field: "created", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Gross MRR churn",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "gross_mrr_churn_rate",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Net MRR churn",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "net_mrr_churn_rate",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Subscriber churn",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "subscriber_churn_rate",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }, {
    label: "Customer lifetime value",
    configuration: {
      mode: "compiled_metric",
      compiledMetric: "customer_lifetime_value",
      dimension: { field: "period", type: "date", interval: "month" },
      currency: "auto",
    },
  }],
};

function serializeMetric(metric) {
  return JSON.stringify({
    field: metric.field || null,
    operation: metric.operation,
  });
}

function parseMetric(value) {
  try {
    return JSON.parse(value);
  } catch {
    return { operation: "count" };
  }
}

function mergeConfiguration(dataRequest) {
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
    dateRange: {
      ...DEFAULT_CONFIGURATION.dateRange,
      ...(dataRequest?.configuration?.dateRange || {}),
    },
    pagination: {
      ...DEFAULT_CONFIGURATION.pagination,
      ...(dataRequest?.configuration?.pagination || {}),
    },
  };
}

function getOptionValue(option) {
  return String(option.value || option.field || option.label);
}

function findLabel(options, value) {
  return options.find((option) => getOptionValue(option) === String(value))?.label || value || "";
}

function formatMaxRecords(value) {
  if (!value && value !== 0) return "5,000";
  return Number(value).toLocaleString();
}

function getFilterDefinitions(resource) {
  return RESOURCE_FILTERS[resource] || [];
}

function getFilterDefinition(resource, field) {
  return getFilterDefinitions(resource).find((filter) => {
    if (filter.field === "metadata.*") return /^metadata\.?[^.]*$/.test(field);
    return filter.field === field;
  });
}

function getDefaultFilter(resource) {
  const filter = getFilterDefinitions(resource)[0];
  if (!filter) return null;

  return {
    field: filter.field,
    operator: filter.operators[0] || "is",
    value: filter.type === "boolean" ? true : "",
  };
}

function sanitizeFiltersForResource(filters = [], resource) {
  return filters.filter((filter) => {
    const definition = getFilterDefinition(resource, filter.field);
    return definition && definition.operators.includes(filter.operator || "is");
  });
}

function getExpandFields(resource) {
  return RESOURCE_EXPAND_FIELDS[resource] || [];
}

function sanitizeExpandForResource(expand = [], resource) {
  const supportedExpand = getExpandFields(resource).map((option) => option.value);
  return (expand || []).filter((field) => supportedExpand.includes(field));
}

function isSearchSupported(resource) {
  return SEARCHABLE_RESOURCES.includes(resource);
}

const PREVIEW_ROW_LIMIT = 7;
const PREVIEW_COLUMN_LIMIT = 7;
const PREVIEW_COLUMN_PRIORITY = [
  "period",
  "dimension",
  "value",
  "currency",
  "recordsProcessed",
  "id",
  "amount",
  "amount_received",
  "amount_paid",
  "net",
  "fee",
  "status",
  "type",
  "reporting_category",
  "customer",
  "created",
];

function getPreviewResponseData(payload) {
  if (Array.isArray(payload)) return { data: payload };
  if (Array.isArray(payload?.data)) return payload;
  if (Array.isArray(payload?.responseData?.data)) return payload.responseData;
  if (Array.isArray(payload?.dataRequest?.responseData?.data)) return payload.dataRequest.responseData;
  if (Array.isArray(payload?.response?.dataRequest?.responseData?.data)) {
    return payload.response.dataRequest.responseData;
  }
  return { data: [] };
}

function getPreviewRows(payload) {
  return sortPreviewRowsByDateDesc(getPreviewResponseData(payload).data || []);
}

function getPreviewWarnings(payload) {
  return getPreviewResponseData(payload).configuration?.warnings || [];
}

function getPreviewRecordsProcessed(payload) {
  return getPreviewResponseData(payload).configuration?.recordsProcessed || null;
}

function parsePreviewDateValue(value) {
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

function getPreviewRowTimestamp(row) {
  if (!row || typeof row !== "object") return null;

  return [
    row.created,
    row.period,
    row.available_on,
    row.arrival_date,
    row.dimension,
  ].map(parsePreviewDateValue).find((value) => value !== null) || null;
}

function sortPreviewRowsByDateDesc(rows) {
  return [...rows].sort((a, b) => {
    const aTime = getPreviewRowTimestamp(a);
    const bTime = getPreviewRowTimestamp(b);

    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return bTime - aTime;
  });
}

function getPreviewColumns(rows) {
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

function formatPreviewColumnLabel(column) {
  return String(column)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPreviewCellValue(column, value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && ["created", "available_on", "arrival_date"].includes(column)) {
    return new Date(value * 1000).toISOString().slice(0, 10);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getSelectedCategory(configuration) {
  if (configuration.mode === "compiled_metric") {
    const compiledMetric = COMPILED_METRIC_OPTIONS.find((option) => option.value === configuration.compiledMetric);
    return CATEGORY_OPTIONS.find((category) => category.id === (compiledMetric?.category || "business")) || CATEGORY_OPTIONS[0];
  }

  return CATEGORY_OPTIONS.find((category) => category.resources.includes(configuration.resource)) || CATEGORY_OPTIONS[0];
}

function StripeOfficialBuilder(props) {
  const {
    dataRequest, onChangeRequest, onSave, onDelete,
  } = props;

  const [stripeRequest, setStripeRequest] = useState(dataRequest || {});
  const [configuration, setConfiguration] = useState(mergeConfiguration(dataRequest));
  const [result, setResult] = useState("");
  const [previewPayload, setPreviewPayload] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [showConfigPreview, setShowConfigPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hydratedRequestRef = useRef({ id: null, signature: null });

  const params = useParams();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const dataRequestConfigurationSignature = useMemo(() => {
    return JSON.stringify(dataRequest?.configuration || {});
  }, [dataRequest?.configuration]);

  const selectedCategory = useMemo(() => {
    return getSelectedCategory(configuration);
  }, [configuration]);

  const metricOptions = useMemo(() => {
    return RESOURCE_METRICS[configuration.resource] || RESOURCE_METRICS.balance_transactions;
  }, [configuration.resource]);

  useEffect(() => {
    const nextRequest = {
      ...stripeRequest,
      method: "GET",
      route: null,
      pagination: true,
      items: "data",
      itemsLimit: configuration.pagination?.maxRecords || 5000,
      offset: "starting_after",
      template: "stripeOfficial",
      useGlobalHeaders: true,
      configuration,
    };
    setStripeRequest(nextRequest);
    onChangeRequest(nextRequest);
  }, [configuration]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((item) => item.id === dataRequest.id);
      if (selectedResponse?.response) {
        const response = selectedResponse.response;
        setPreviewPayload(response);
        setResult(JSON.stringify(response, null, 2));
      }
    }
  }, [stateDrs, dataRequest.id]);

  useEffect(() => {
    if (!dataRequest?.id) return;

    const requestId = String(dataRequest.id);
    if (
      hydratedRequestRef.current.id === requestId
      && hydratedRequestRef.current.signature === dataRequestConfigurationSignature
    ) {
      return;
    }

    const previousRequestId = hydratedRequestRef.current.id;
    const nextConfiguration = mergeConfiguration(dataRequest);

    hydratedRequestRef.current = {
      id: requestId,
      signature: dataRequestConfigurationSignature,
    };
    setStripeRequest(dataRequest);
    setConfiguration(nextConfiguration);

    if (previousRequestId && previousRequestId !== requestId) {
      setPreviewPayload(null);
      setResult("");
    }
  }, [dataRequest, dataRequestConfigurationSignature]);

  const _updateConfiguration = (updates) => {
    setConfiguration({
      ...configuration,
      ...updates,
    });
  };

  const _updateDateRange = (updates) => {
    setConfiguration({
      ...configuration,
      dateRange: {
        ...configuration.dateRange,
        ...updates,
      },
    });
  };

  const _updatePagination = (updates) => {
    setConfiguration({
      ...configuration,
      pagination: {
        ...configuration.pagination,
        ...updates,
      },
    });
  };

  const _updateFilterAt = (index, updates) => {
    const filters = [...(configuration.filters || [])];
    const currentFilter = filters[index] || getDefaultFilter(configuration.resource);
    const updatedField = updates.field === "metadata.*" ? "metadata." : updates.field;
    const nextFilter = {
      ...currentFilter,
      ...updates,
      ...(updatedField ? { field: updatedField } : {}),
    };
    const definition = getFilterDefinition(configuration.resource, nextFilter.field);

    if (definition && updates.field) {
      nextFilter.operator = definition.operators.includes(nextFilter.operator)
        ? nextFilter.operator
        : definition.operators[0] || "is";
      nextFilter.value = definition.type === "boolean" ? true : "";
    }

    filters[index] = nextFilter;
    _updateConfiguration({ filters });
  };

  const _updateMetadataFilterKey = (index, key) => {
    _updateFilterAt(index, { field: key ? `metadata.${key}` : "metadata." });
  };

  const _toggleExpandField = (field, isSelected) => {
    const nextExpand = new Set(configuration.expand || []);
    if (isSelected) {
      nextExpand.add(field);
    } else {
      nextExpand.delete(field);
    }
    _updateConfiguration({ expand: Array.from(nextExpand) });
  };

  const _toggleSearchMode = (isSelected) => {
    _updateConfiguration({
      queryMode: isSelected ? "search" : "list",
      searchQuery: isSelected ? configuration.searchQuery || "" : "",
    });
  };

  const _addFilter = () => {
    const filter = getDefaultFilter(configuration.resource);
    if (!filter) return;
    _updateConfiguration({ filters: [...(configuration.filters || []), filter] });
  };

  const _removeFilterAt = (index) => {
    _updateConfiguration({
      filters: (configuration.filters || []).filter((_, filterIndex) => filterIndex !== index),
    });
  };

  const _selectCategory = (category) => {
    if (category.defaultResource.startsWith("compiled_metric:")) {
      const compiledMetric = category.defaultResource.split(":")[1];
      _updateConfiguration({
        mode: "compiled_metric",
        compiledMetric,
        queryMode: "list",
        searchQuery: "",
        expand: [],
        filters: [],
        dimension: {
          field: "period",
          type: "date",
          interval: "month",
        },
        currency: "auto",
      });
      return;
    }

    const nextMetric = (RESOURCE_METRICS[category.defaultResource] || [])[0] || { operation: "count" };
    const nextMode = configuration.mode === "raw" ? "raw" : "aggregate";
    _updateConfiguration({
      mode: nextMode,
      resource: category.defaultResource,
      compiledMetric: null,
      metric: nextMetric,
      filters: sanitizeFiltersForResource(configuration.filters || [], category.defaultResource),
      expand: sanitizeExpandForResource(configuration.expand || [], category.defaultResource),
      queryMode: isSearchSupported(category.defaultResource) ? configuration.queryMode : "list",
      searchQuery: isSearchSupported(category.defaultResource) ? configuration.searchQuery : "",
      dimension: {
        ...configuration.dimension,
        field: "created",
        type: "date",
      },
    });
  };

  const _selectQuickStart = (quickStart) => {
    const isCompiledQuickStart = quickStart.configuration.mode === "compiled_metric";
    setConfiguration({
      ...configuration,
      ...quickStart.configuration,
      metric: quickStart.configuration.metric || configuration.metric,
      dimension: quickStart.configuration.dimension || configuration.dimension,
      filters: isCompiledQuickStart ? [] : quickStart.configuration.filters || configuration.filters || [],
      expand: isCompiledQuickStart
        ? []
        : sanitizeExpandForResource(quickStart.configuration.expand || configuration.expand || [], quickStart.configuration.resource || configuration.resource),
      queryMode: quickStart.configuration.queryMode || "list",
      searchQuery: quickStart.configuration.searchQuery || "",
    });
  };

  const _selectCompiledMetric = (compiledMetric) => {
    _updateConfiguration({
      mode: "compiled_metric",
      compiledMetric,
      queryMode: "list",
      searchQuery: "",
      expand: [],
      filters: [],
      dimension: {
        field: compiledMetric === "net_cash_flow" ? "created" : "period",
        type: "date",
        interval: configuration.dimension?.interval || "month",
      },
      currency: configuration.currency || "auto",
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(stripeRequest)
      .then(() => setSaveLoading(false))
      .catch(() => setSaveLoading(false));
  };

  const _onTest = () => {
    setRequestLoading(true);
    onSave(stripeRequest).then((savedRequest) => {
      dispatch(runDataRequest({
        team_id: team?.id,
        dataset_id: savedRequest?.payload?.dataset_id || stripeRequest.dataset_id,
        dataRequest_id: savedRequest?.payload?.id || stripeRequest.id,
        getCache: false,
      }))
        .then((data) => {
          const response = data.payload?.response?.dataRequest?.responseData;
          const payload = response || data.payload;
          setPreviewPayload(payload);
          setResult(JSON.stringify(payload, null, 2));
          setRequestLoading(false);
        })
        .catch((error) => {
          toast.error("The Stripe request failed. Please check your configuration.");
          setPreviewPayload(error);
          setResult(JSON.stringify(error, null, 2));
          setRequestLoading(false);
        });
    }).catch((error) => {
      toast.error("The Stripe request could not be saved before testing.");
      setPreviewPayload(error);
      setResult(JSON.stringify(error, null, 2));
      setRequestLoading(false);
    });
  };

  const renderSelectField = ({
    label, value, onChange, options, name, className, isDisabled,
  }) => {
    return (
      <Select
        fullWidth
        isDisabled={isDisabled}
        name={name}
        variant="secondary"
        value={value || null}
        onChange={(nextValue) => onChange(nextValue)}
        className={className}
      >
        <Label>{label}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((option) => {
              const optionValue = getOptionValue(option);
              return (
                <ListBox.Item key={optionValue} id={optionValue} textValue={option.label}>
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>
    );
  };

  const renderFilterValueField = (filter, index, definition) => {
    const operatorNeedsValue = !["isNull", "isNotNull"].includes(filter.operator);
    const metadataKey = definition?.type === "metadata"
      ? String(filter.field || "").replace(/^metadata\./, "")
      : "";
    if (!operatorNeedsValue) {
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {definition?.type === "metadata" && (
            <TextField fullWidth name={`stripe-filter-metadata-key-${index}`}>
              <Label>Metadata key</Label>
              <Input
                placeholder="plan"
                value={metadataKey}
                onChange={(event) => _updateMetadataFilterKey(index, event.target.value)}
                variant="secondary"
              />
            </TextField>
          )}
          <TextField fullWidth name={`stripe-filter-value-${index}`}>
            <Label>Value</Label>
            <Input value="" placeholder="No value needed" disabled variant="secondary" />
          </TextField>
        </div>
      );
    }

    if (definition?.type === "boolean") {
      return renderSelectField({
        name: `stripe-filter-value-${index}`,
        label: "Value",
        value: String(filter.value === true || filter.value === "true"),
        onChange: (value) => _updateFilterAt(index, { value: value === "true" }),
        options: [
          { value: "true", label: "True" },
          { value: "false", label: "False" },
        ],
      });
    }

    const valueField = (
      <TextField fullWidth name={`stripe-filter-value-${index}`}>
        <Label>Value</Label>
        <Input
          type={definition?.type === "number" ? "number" : "text"}
          placeholder={definition?.type === "number" ? "0" : "Enter value"}
          value={filter.value ?? ""}
          onChange={(event) => _updateFilterAt(index, { value: event.target.value })}
          variant="secondary"
        />
      </TextField>
    );

    if (definition?.type !== "metadata") return valueField;

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField fullWidth name={`stripe-filter-metadata-key-${index}`}>
          <Label>Metadata key</Label>
          <Input
            placeholder="plan"
            value={metadataKey}
            onChange={(event) => _updateMetadataFilterKey(index, event.target.value)}
            variant="secondary"
          />
        </TextField>
        {valueField}
      </div>
    );
  };

  const selectedMetric = serializeMetric(configuration.metric || {});
  const selectedDimension = configuration.dimension?.field || "created";
  const selectedInterval = configuration.dimension?.interval || "day";
  const filterDefinitions = configuration.mode === "compiled_metric"
    ? []
    : getFilterDefinitions(configuration.resource);
  const expandFields = configuration.mode === "compiled_metric"
    ? []
    : getExpandFields(configuration.resource);
  const searchSupported = configuration.mode !== "compiled_metric" && isSearchSupported(configuration.resource);
  const compiledMetricOption = COMPILED_METRIC_OPTIONS.find((option) => option.value === configuration.compiledMetric);
  const outputLabel = configuration.mode === "raw"
    ? "Raw table rows"
    : configuration.mode === "compiled_metric" ? "Compiled business metric" : "Aggregated chart data";
  const metricLabel = configuration.mode === "raw"
    ? "Records"
    : configuration.mode === "compiled_metric"
      ? compiledMetricOption?.label || "Compiled metric"
    : findLabel(metricOptions.map((metric) => ({
      value: serializeMetric(metric),
      label: metric.label,
    })), selectedMetric);
  const dimensionLabel = configuration.mode === "raw"
    ? "Latest first"
    : configuration.mode === "compiled_metric"
      ? "Period"
    : findLabel(DIMENSION_OPTIONS, selectedDimension);
  const intervalLabel = configuration.mode === "raw"
    ? ""
    : findLabel(INTERVAL_OPTIONS, selectedInterval);
  const activeFilterCount = (configuration.filters || []).filter((filter) => filter.value || filter.value === true).length;
  const currentQuickStarts = QUICK_STARTS[selectedCategory.id] || [];
  const previewRows = useMemo(() => getPreviewRows(previewPayload), [previewPayload]);
  const previewColumns = useMemo(() => getPreviewColumns(previewRows), [previewRows]);
  const previewWarnings = useMemo(() => getPreviewWarnings(previewPayload), [previewPayload]);
  const previewRecordsProcessed = getPreviewRecordsProcessed(previewPayload);
  const previewSummary = previewRows.length > 0
    ? `${Math.min(previewRows.length, PREVIEW_ROW_LIMIT)} of ${formatMaxRecords(previewRows.length)} rows`
    : "Run test";
  const sourceLabel = configuration.mode === "compiled_metric"
    ? compiledMetricOption?.label || "Compiled metric"
    : RESOURCE_LABELS[configuration.resource] || configuration.resource;

  return (
    <div className="grid grid-cols-12 gap-5 px-2 pb-5 lg:px-4">
      <div className="col-span-12 flex flex-col gap-5 xl:col-span-8 2xl:col-span-9">
        <Card className="border border-divider bg-surface p-0 shadow-none">
          <Card.Content className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground">
                What do you want to build?
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Button
                  variant={configuration.mode === "aggregate" || configuration.mode === "compiled_metric" ? "secondary" : "outline"}
                  className={`h-auto justify-start rounded-2xl border p-4 ${
                    configuration.mode === "aggregate" || configuration.mode === "compiled_metric"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-divider bg-surface text-foreground"
                  }`}
                  onPress={() => _updateConfiguration({ mode: "aggregate" })}
                  fullWidth
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300">
                    <LuChartLine size={20} />
                  </span>
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                    <span className="text-base font-semibold">Chart metric</span>
                    <span className="text-sm font-normal text-muted">Aggregated, grouped data</span>
                  </span>
                </Button>

                <Button
                  variant={configuration.mode === "raw" ? "secondary" : "outline"}
                  className={`h-auto justify-start rounded-2xl border p-4 ${
                    configuration.mode === "raw"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-divider bg-surface text-foreground"
                  }`}
                  onPress={() => _updateConfiguration({ mode: "raw" })}
                  fullWidth
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <LuTable2 size={20} />
                  </span>
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                    <span className="text-base font-semibold">Table of records</span>
                    <span className="text-sm font-normal text-muted">Individual rows, latest first</span>
                  </span>
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card className="border border-divider bg-surface p-0 shadow-none">
          <Card.Content className="flex flex-col gap-5 p-5">
            <div className="flex flex-row flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-accent">Step 1</span>
              <span className="font-semibold text-foreground">Choose a category</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
              {CATEGORY_OPTIONS.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategory.id === category.id;
                return (
                  <Button
                    key={category.id}
                    variant={isSelected ? "secondary" : "outline"}
                    className={`h-24 min-w-0 flex-col justify-center gap-2 rounded-2xl border px-3 ${
                      isSelected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-divider bg-surface text-foreground"
                    }`}
                    onPress={() => _selectCategory(category)}
                    fullWidth
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${category.iconClassName}`}>
                      <Icon size={20} />
                    </span>
                    <span className="w-full truncate text-sm font-semibold">{category.label}</span>
                  </Button>
                );
              })}
            </div>

            <Separator variant="tertiary" />

            <div className="flex flex-col gap-3">
              <div className="flex flex-row flex-wrap items-center gap-2">
                <span className="text-sm text-muted">Quick start:</span>
                {currentQuickStarts.map((quickStart) => (
                  <Button
                    key={quickStart.label}
                    size="sm"
                    className="rounded-full"
                    variant="secondary"
                    onPress={() => _selectQuickStart(quickStart)}
                  >
                    {quickStart.label}
                  </Button>
                ))}
              </div>

              {selectedCategory.id === "payments" && (
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">API source:</span>
                  {["payment_intents", "charges"].map((resource) => (
                    <Button
                      key={resource}
                      size="sm"
                      className="rounded-full"
                      variant={configuration.resource === resource ? "primary" : "secondary"}
                      onPress={() => {
                        const nextMetric = (RESOURCE_METRICS[resource] || [])[0] || { operation: "count" };
                        _updateConfiguration({
                          mode: configuration.mode === "raw" ? "raw" : "aggregate",
                          resource,
                          compiledMetric: null,
                          metric: nextMetric,
                          filters: sanitizeFiltersForResource(configuration.filters || [], resource),
                          expand: sanitizeExpandForResource(configuration.expand || [], resource),
                          queryMode: configuration.queryMode,
                          searchQuery: configuration.searchQuery,
                        });
                      }}
                    >
                      {RESOURCE_LABELS[resource]}
                    </Button>
                  ))}
                  <span className="text-xs text-muted">Payment Intents are recommended for modern accounts</span>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>

        <Card className="border border-divider bg-surface p-0 shadow-none">
          <Card.Content className="flex flex-col gap-5 p-5">
            <div className="flex flex-row flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold text-accent">Step 2</span>
              <span className="text-base font-semibold text-foreground">Configure your dataset</span>
            </div>

            {configuration.mode === "aggregate" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6">
                  {renderSelectField({
                    name: "stripe-metric",
                    label: "Metric",
                    value: selectedMetric,
                    onChange: (value) => _updateConfiguration({ metric: parseMetric(value) }),
                    options: metricOptions.map((metric) => ({
                      value: serializeMetric(metric),
                      label: metric.label,
                    })),
                  })}
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-3">
                  {renderSelectField({
                    name: "stripe-dimension",
                    label: "Group by",
                    value: selectedDimension,
                    onChange: (value) => {
                      const dimension = DIMENSION_OPTIONS.find((option) => option.field === value);
                      _updateConfiguration({
                        dimension: {
                          ...configuration.dimension,
                          field: value,
                          type: dimension?.type,
                        },
                      });
                    },
                    options: DIMENSION_OPTIONS,
                  })}
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-3">
                  {renderSelectField({
                    name: "stripe-interval",
                    label: "Interval",
                    value: selectedInterval,
                    isDisabled: configuration.dimension?.type !== "date",
                    onChange: (value) => _updateConfiguration({
                      dimension: {
                        ...configuration.dimension,
                        interval: value,
                      },
                    }),
                    options: INTERVAL_OPTIONS,
                  })}
                </div>
              </div>
            )}

            {configuration.mode === "compiled_metric" && (
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6">
                  {renderSelectField({
                    name: "stripe-compiled-metric",
                    label: "Metric",
                    value: configuration.compiledMetric || "mrr",
                    onChange: _selectCompiledMetric,
                    options: COMPILED_METRIC_OPTIONS,
                  })}
                </div>
                <div className="col-span-12 md:col-span-6 lg:col-span-3">
                  {renderSelectField({
                    name: "stripe-compiled-interval",
                    label: "Interval",
                    value: selectedInterval,
                    onChange: (value) => _updateConfiguration({
                      dimension: {
                        ...configuration.dimension,
                        interval: value,
                      },
                    }),
                    options: INTERVAL_OPTIONS,
                  })}
                </div>
                <TextField className="col-span-12 md:col-span-6 lg:col-span-3" fullWidth name="stripe-compiled-currency">
                  <Label>Currency</Label>
                  <Input
                    placeholder="auto"
                    value={configuration.currency || "auto"}
                    onChange={(event) => _updateConfiguration({ currency: event.target.value.toLowerCase() || "auto" })}
                    variant="secondary"
                  />
                </TextField>
              </div>
            )}

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-6">
                {renderSelectField({
                  name: "stripe-date-field",
                  label: "Date field",
                  value: configuration.dateRange?.field || "created",
                  onChange: (value) => _updateDateRange({ field: value }),
                  options: [
                    { value: "created", label: "Created date" },
                    { value: "updated", label: "Updated date" },
                  ],
                })}
              </div>
              <div className="col-span-12 md:col-span-6">
                <div className="grid grid-cols-2 gap-3">
                  <TextField fullWidth name="stripe-start-date">
                    <Label>Start</Label>
                    <Input
                      value={configuration.dateRange?.start || ""}
                      onChange={(event) => _updateDateRange({ start: event.target.value })}
                      variant="secondary"
                    />
                  </TextField>
                  <TextField fullWidth name="stripe-end-date">
                    <Label>End</Label>
                    <Input
                      value={configuration.dateRange?.end || ""}
                      onChange={(event) => _updateDateRange({ end: event.target.value })}
                      variant="secondary"
                    />
                  </TextField>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-3">
                <span className="text-base font-semibold text-foreground">Filters</span>
                <span className="text-sm text-muted">
                  {activeFilterCount > 0 ? `${activeFilterCount} active` : "None active"}
                </span>
              </div>

              {configuration.mode === "compiled_metric" && (
                <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-700 dark:text-warning-300">
                  Compiled metric filters need metric-specific rules. Use currency above for this first pass.
                </p>
              )}

              {configuration.mode !== "compiled_metric" && (configuration.filters || []).length === 0 && (
                <div className="rounded-lg border border-dashed border-divider bg-surface-secondary/40 p-4 text-sm text-muted">
                  No filters yet. Add a filter to narrow the Stripe rows before Chartbrew aggregates or renders them.
                </div>
              )}

              {configuration.mode !== "compiled_metric" && (configuration.filters || []).map((filter, index) => {
                const definition = getFilterDefinition(configuration.resource, filter.field) || filterDefinitions[0];
                const operatorOptions = (definition?.operators || ["is"]).map((operator) => FILTER_OPERATOR_OPTIONS[operator]);
                const filterSelectValue = definition?.type === "metadata" ? "metadata.*" : filter.field;

                return (
                  <div key={`${filter.field}-${index}`} className="grid grid-cols-12 gap-3 rounded-lg border border-divider p-3">
                    <div className="col-span-12 md:col-span-4">
                      {renderSelectField({
                        name: `stripe-filter-field-${index}`,
                        label: "Field",
                        value: filterSelectValue,
                        onChange: (value) => _updateFilterAt(index, { field: value }),
                        options: filterDefinitions.map((filterDefinition) => ({
                          value: filterDefinition.field,
                          label: filterDefinition.label,
                        })),
                      })}
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      {renderSelectField({
                        name: `stripe-filter-operator-${index}`,
                        label: "Operator",
                        value: filter.operator || "is",
                        onChange: (value) => _updateFilterAt(index, { operator: value }),
                        options: operatorOptions.filter(Boolean),
                      })}
                    </div>
                    <div className="col-span-12 md:col-span-4">
                      {renderFilterValueField(filter, index, definition)}
                    </div>
                    <div className="col-span-12 flex items-end md:col-span-1">
                      <Button
                        isIconOnly
                        aria-label="Remove filter"
                        variant="tertiary"
                        onPress={() => _removeFilterAt(index)}
                      >
                        <LuX size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {configuration.mode !== "compiled_metric" && (
                <div className="flex flex-row flex-wrap gap-2">
                  <Button
                    className="w-fit"
                    variant="tertiary"
                    onPress={_addFilter}
                    isDisabled={filterDefinitions.length === 0}
                  >
                    <LuPlus size={16} />
                    Add filter
                  </Button>
                  {(configuration.filters || []).length > 0 && (
                    <Button
                      className="w-fit"
                      variant="tertiary"
                      onPress={() => _updateConfiguration({ filters: [] })}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>

            <Separator variant="tertiary" />

            <Disclosure isExpanded={showAdvanced} onExpandedChange={setShowAdvanced}>
              <Disclosure.Heading>
                <Button slot="trigger" variant="ghost">
                  Advanced options
                  <Disclosure.Indicator />
                </Button>
              </Disclosure.Heading>
              <Disclosure.Content>
                <Disclosure.Body className="flex flex-col gap-4 pt-3">
                  {renderSelectField({
                    name: "stripe-max-records",
                    label: "Max records",
                    value: String(configuration.pagination?.maxRecords || 5000),
                    onChange: (value) => _updatePagination({ maxRecords: Number(value) }),
                    options: MAX_RECORD_OPTIONS,
                  })}
                  <p className="-mt-2 text-xs text-muted">
                    Chartbrew paginates automatically until this limit is reached.
                  </p>

                  <div className="flex flex-col gap-3">
                    {configuration.mode === "raw" && (
                      <Switch
                        isSelected={Boolean(configuration.rawObjectMode)}
                        onChange={(isSelected) => _updateConfiguration({ rawObjectMode: isSelected })}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                          <Label className="text-sm">Return full Stripe objects</Label>
                        </Switch.Content>
                      </Switch>
                    )}

                    <Switch
                      isDisabled={!searchSupported}
                      isSelected={configuration.queryMode === "search"}
                      onChange={_toggleSearchMode}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>
                        <div className="flex flex-row flex-wrap items-center gap-2">
                          <Label className="text-sm">Use Stripe Search API</Label>
                          {!searchSupported && <Chip size="sm" variant="soft">not supported</Chip>}
                        </div>
                      </Switch.Content>
                    </Switch>

                    {configuration.queryMode === "search" && (
                      <TextField fullWidth name="stripe-search-query">
                        <Label>Search query</Label>
                        <Input
                          placeholder={"metadata['plan']:'pro' OR email:'customer@example.com'"}
                          value={configuration.searchQuery || ""}
                          onChange={(event) => _updateConfiguration({ searchQuery: event.target.value })}
                          variant="secondary"
                        />
                      </TextField>
                    )}

                    {expandFields.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-foreground">Expand fields</span>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {expandFields.map((field) => (
                            <Checkbox
                              key={field.value}
                              name={`stripe-expand-${field.value}`}
                              isSelected={(configuration.expand || []).includes(field.value)}
                              onChange={(isSelected) => _toggleExpandField(field.value, isSelected)}
                              variant="secondary"
                            >
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                              <Checkbox.Content>
                                <Label>{field.label}</Label>
                              </Checkbox.Content>
                            </Checkbox>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Disclosure.Body>
              </Disclosure.Content>
            </Disclosure>
          </Card.Content>
        </Card>

        <Card className="border border-divider bg-surface p-0 shadow-none">
          <Card.Content className="flex flex-col gap-5 p-5">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex flex-row flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-accent">Step 3</span>
                <span className="text-base font-semibold text-foreground">Test your configuration</span>
              </div>
              <Button isPending={requestLoading} onPress={_onTest} variant="primary">
                {requestLoading ? <ButtonSpinner /> : <LuPlay size={16} />}
                {result ? "Re-run" : "Run test"}
              </Button>
            </div>

            {!result && (
              <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-divider bg-surface-secondary/50 p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted">
                  <LuPlay size={24} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Run a test to see a live sample of your Stripe data
                  </p>
                  <p className="text-sm text-muted">
                    Uses your current configuration to fetch a preview.
                  </p>
                </div>
              </div>
            )}

            {result && previewWarnings.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-700 dark:text-warning-300">
                {previewWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            {result && previewRows.length > 0 && previewColumns.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-row flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground">Preview rows</span>
                  <span className="text-muted">
                    {previewSummary}
                    {previewRecordsProcessed ? ` · ${formatMaxRecords(previewRecordsProcessed)} processed` : ""}
                  </span>
                </div>

                <Table className="border border-divider shadow-none">
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Stripe configuration preview" className="min-w-[760px]">
                      <Table.Header>
                        {previewColumns.map((column, index) => (
                          <Table.Column key={column} id={column} isRowHeader={index === 0}>
                            {formatPreviewColumnLabel(column)}
                          </Table.Column>
                        ))}
                      </Table.Header>
                      <Table.Body>
                        {previewRows.slice(0, PREVIEW_ROW_LIMIT).map((row, rowIndex) => (
                          <Table.Row key={`${row.id || row.period || "row"}-${rowIndex}`} id={`${row.id || row.period || "row"}-${rowIndex}`}>
                            {previewColumns.map((column) => (
                              <Table.Cell key={column}>
                                <span className="block max-w-[220px] truncate" title={formatPreviewCellValue(column, row[column])}>
                                  {formatPreviewCellValue(column, row[column])}
                                </span>
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </div>
            )}

            {result && (previewRows.length === 0 || previewColumns.length === 0) && (
              <AceEditor
                mode="json"
                theme="tomorrow"
                value={result}
                readOnly
                height="260px"
                width="100%"
              />
            )}
          </Card.Content>
        </Card>
      </div>

      <aside className="col-span-12 xl:col-span-4 2xl:col-span-3">
        <div className="sticky top-4 flex flex-col gap-4">
          <Card className="border border-divider bg-surface p-0 shadow-none">
            <Card.Content className="flex flex-col gap-4 p-5">
              <Card.Title className="text-lg">Dataset summary</Card.Title>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Dataset type</span>
                  <span className="text-right font-medium text-foreground">{outputLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Category</span>
                  <span className="text-right font-medium text-foreground">{selectedCategory.label}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Source</span>
                  <span className="text-right font-medium text-foreground">
                    {sourceLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Metric</span>
                  <span className="text-right font-medium text-foreground">{metricLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Grouped by</span>
                  <span className="text-right font-medium text-foreground">
                    {intervalLabel ? `${dimensionLabel} · ${intervalLabel}` : dimensionLabel}
                  </span>
                </div>
                <Separator variant="tertiary" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Preview</span>
                  <span className="text-right font-medium text-emerald-600 dark:text-emerald-300">{previewSummary}</span>
                </div>
              </div>
            </Card.Content>
          </Card>

          <Disclosure isExpanded={showConfigPreview} onExpandedChange={setShowConfigPreview}>
            <Disclosure.Heading>
              <Button slot="trigger" variant="ghost" className="w-full justify-between text-muted">
                <span className="flex items-center gap-2">
                  <LuEye size={16} />
                  Config preview
                </span>
                <Disclosure.Indicator />
              </Button>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body className="pt-2">
                <AceEditor
                  mode="json"
                  theme="tomorrow"
                  value={JSON.stringify(configuration, null, 2)}
                  readOnly
                  height="260px"
                  width="100%"
                />
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>

          <div className="flex flex-col gap-3">
            <Button
              fullWidth
              isPending={saveLoading}
              onPress={_onSavePressed}
              variant="primary"
            >
              {saveLoading ? <ButtonSpinner /> : <LuSave size={16} />}
              Save configuration
            </Button>
            <Button fullWidth onPress={() => setShowTransform(!showTransform)} variant="secondary">
              <LuBraces size={16} />
              {showTransform ? "Hide transform" : "Transform data"}
            </Button>
            <Button fullWidth variant="danger-soft" onPress={onDelete}>
              <LuTrash size={16} />
              Delete request
            </Button>
          </div>
        </div>
      </aside>

      {showTransform && (
        <DataTransform
          isOpen={showTransform}
          onClose={() => setShowTransform(false)}
          initialTransform={stripeRequest.transform}
          onSave={(transform) => {
            setStripeRequest({ ...stripeRequest, transform });
            onChangeRequest({ ...stripeRequest, transform });
          }}
        />
      )}
    </div>
  );
}

StripeOfficialBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default StripeOfficialBuilder;
