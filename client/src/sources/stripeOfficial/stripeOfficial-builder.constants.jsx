import {
  LuArrowRight,
  LuCalculator,
  LuCreditCard,
  LuDollarSign,
  LuFileText,
  LuRefreshCw,
  LuUndo2,
  LuUsers,
} from "react-icons/lu";

export const DATE_VARIABLES = {
  start: "startDate",
  end: "endDate",
};

export const CATEGORY_OPTIONS = [{
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

export const RESOURCE_LABELS = {
  payment_intents: "Payment Intents",
  charges: "Charges",
  balance_transactions: "Balance transactions",
  customers: "Customers",
  subscriptions: "Subscriptions",
  invoices: "Invoices",
  refunds: "Refunds",
  payouts: "Payouts",
};

export const RESOURCE_METRICS = {
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

export const DIMENSION_OPTIONS = [{
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

export const INTERVAL_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export const FILTER_OPERATOR_OPTIONS = {
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

export const RESOURCE_FILTERS = {
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

export const RESOURCE_EXPAND_FIELDS = {
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

export const SEARCHABLE_RESOURCES = ["payment_intents", "charges", "customers", "subscriptions", "invoices"];

export const MAX_RECORD_OPTIONS = [
  { value: "1000", label: "1,000" },
  { value: "5000", label: "5,000" },
  { value: "10000", label: "10,000" },
];

export const COMPILED_METRIC_OPTIONS = [{
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

export const QUICK_STARTS = {
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

export const PREVIEW_ROW_LIMIT = 7;
export const PREVIEW_COLUMN_LIMIT = 7;
export const PREVIEW_COLUMN_PRIORITY = [
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
