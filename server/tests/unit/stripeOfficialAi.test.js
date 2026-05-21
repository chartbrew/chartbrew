import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const moment = require("moment-timezone");
const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const { availableTools } = require("../../modules/ai/orchestrator/orchestrator");
const createChart = require("../../modules/ai/orchestrator/tools/createChart");
const createDataset = require("../../modules/ai/orchestrator/tools/createDataset");
const {
  getSupportedSourceForConnection,
  getSupportedSourceIds,
} = require("../../modules/ai/orchestrator/sourceSupport");
const {
  sourcePlanDataset,
  sourceValidateConfiguration,
  sourcePreviewConfiguration,
} = require("../../modules/ai/orchestrator/tools/sourceTools");
const {
  stripeOfficialPlanDataset,
  stripeOfficialValidateConfiguration,
} = require("../../modules/ai/orchestrator/tools/stripeOfficialTools");
const { getSourceById } = require("../../sources");
const stripeOfficialProtocol = require("../../sources/plugins/stripeOfficial/stripeOfficial.protocol");

function epoch(date) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

describe("Stripe Official AI layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("declares Stripe Official as an orchestrator-supported tool source", () => {
    const source = getSourceById("stripeOfficial");

    expect(source.capabilities.ai).toMatchObject({
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    });
    expect(source.backend.ai.planDataset).toEqual(expect.any(Function));
    expect(source.backend.ai.previewConfiguration).toEqual(expect.any(Function));
    expect(getSupportedSourceIds()).toContain("stripeOfficial");
    expect(getSupportedSourceForConnection({
      type: "stripeOfficial",
      subType: "stripeOfficial",
    })?.id).toBe("stripeOfficial");
  });

  it("plans net revenue as a Stripe configuration with chart bindings", () => {
    const source = getSourceById("stripeOfficial");
    const plan = source.backend.ai.planDataset({
      question: "What was net revenue last month?",
    });

    expect(plan).toMatchObject({
      status: "ok",
      source: "stripeOfficial",
      configuration: {
        source: "stripeOfficial",
        mode: "aggregate",
        resource: "balance_transactions",
        metric: {
          field: "net",
          operation: "sum",
        },
        filters: [{
          field: "type",
          operator: "is",
          value: "charge",
        }],
      },
      chartSpec: {
        yAxis: "root[].value",
        yAxisOperation: "none",
        formula: "{val / 100}",
      },
    });
    expect(plan.configuration.dateRange.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan.configuration.dateRange.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("plans MRR as a compiled metric with caveats and currency display", () => {
    const source = getSourceById("stripeOfficial");
    const plan = source.backend.ai.planDataset({
      question: "Create an MRR chart over the last 6 months",
    });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric: "mrr",
        inputs: ["subscriptions", "subscription_items", "prices", "invoices"],
        dimension: {
          field: "period",
          interval: "month",
        },
      },
      chartSpec: {
        type: "line",
        xAxis: "root[].period",
        yAxis: "root[].value",
        formula: "{val / 100}",
      },
    });
    expect(plan.warnings[0]).toContain("direct-API estimates");
  });

  it("validates Stripe AI configurations and rejects Search API mode", () => {
    const source = getSourceById("stripeOfficial");
    const validation = source.backend.ai.validateConfiguration({
      source: "stripeOfficial",
      mode: "aggregate",
      resource: "payment_intents",
      queryMode: "search",
      pagination: { maxRecords: 100 },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Stripe Search API is not available to AI tools yet; use queryMode=list.");
  });

  it("validates Stripe AI filter fields and operators per resource", () => {
    const source = getSourceById("stripeOfficial");
    const validation = source.backend.ai.validateConfiguration({
      source: "stripeOfficial",
      mode: "aggregate",
      resource: "balance_transactions",
      queryMode: "list",
      filters: [{
        field: "status",
        operator: "contains",
        value: "paid",
      }],
      pagination: { maxRecords: 100 },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Unsupported Stripe filter for balance_transactions: status");
  });

  it("validates manual Stripe configuration filters, expand fields, and Search controls", () => {
    const valid = stripeOfficialProtocol.validateConfiguration({
      source: "stripeOfficial",
      mode: "raw",
      resource: "subscriptions",
      queryMode: "search",
      searchQuery: "status:'active'",
      filters: [{
        field: "items.data.price.product",
        operator: "is",
        value: "prod_123",
      }, {
        field: "metadata.plan",
        operator: "contains",
        value: "pro",
      }],
      expand: ["data.items.data.price"],
      rawObjectMode: true,
      pagination: { maxRecords: 100 },
    });
    const invalid = stripeOfficialProtocol.validateConfiguration({
      source: "stripeOfficial",
      mode: "aggregate",
      resource: "balance_transactions",
      filters: [{
        field: "metadata.plan",
        operator: "contains",
        value: "pro",
      }],
      expand: ["data.customer"],
      pagination: { maxRecords: 100 },
    });

    expect(valid.valid).toBe(true);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toEqual(expect.arrayContaining([
      "Unsupported Stripe filter for balance_transactions: metadata.plan",
      "Unsupported Stripe expand field for balance_transactions: data.customer",
    ]));
  });

  it("merges runtime Stripe filters and date ranges into request configuration", () => {
    const config = stripeOfficialProtocol._private.mergeRuntimeFilters({
      source: "stripeOfficial",
      mode: "aggregate",
      resource: "balance_transactions",
      dateRange: {
        field: "created",
        start: "last_90_days",
        end: "now",
      },
      filters: [{
        field: "type",
        operator: "is",
        value: "charge",
      }],
      pagination: { maxRecords: 100 },
    }, [{
      type: "date",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    }, {
      field: "root[].currency",
      operator: "is",
      value: "gbp",
    }, {
      field: "root[].status",
      operator: "is",
      value: "paid",
    }]);

    expect(config.dateRange).toMatchObject({
      start: "2026-04-01",
      end: "2026-04-30",
    });
    expect(config.filters).toEqual([
      { field: "type", operator: "is", value: "charge" },
      { field: "currency", operator: "is", value: "gbp" },
    ]);
  });

  it("pushes supported Stripe list filters and applies local operators", () => {
    const params = stripeOfficialProtocol._private.buildListParams({
      resource: "balance_transactions",
      dateRange: {
        field: "created",
        start: "2026-04-01",
        end: "2026-04-30",
      },
      filters: [{
        field: "type",
        operator: "is",
        value: "charge",
      }, {
        field: "currency",
        operator: "is",
        value: "gbp",
      }],
      pagination: { limit: 100 },
    }, {
      endpoint: "/balance_transactions",
      defaultDateField: "created",
    });
    const rows = stripeOfficialProtocol._private.applyLocalFilters([
      { id: "txn_1", amount: 2500, currency: "gbp" },
      { id: "txn_2", amount: 500, currency: "gbp" },
      { id: "txn_3", amount: 3000, currency: "usd" },
    ], [{
      field: "amount",
      operator: "greaterOrEqual",
      value: "1000",
    }, {
      field: "currency",
      operator: "is",
      value: "gbp",
    }]);

    expect(params).toMatchObject({
      type: "charge",
    });
    expect(params.currency).toBeUndefined();
    expect(rows).toEqual([{ id: "txn_1", amount: 2500, currency: "gbp" }]);
  });

  it("builds Stripe Search params and filters nested subscription price/product fields", () => {
    const params = stripeOfficialProtocol._private.buildSearchParams({
      searchQuery: "metadata['plan']:'pro'",
      pagination: { limit: 25 },
      expand: ["data.items.data.price"],
    });
    const rows = stripeOfficialProtocol._private.applyLocalFilters([
      {
        id: "sub_1",
        metadata: { plan: "pro" },
        items: {
          data: [{
            price: {
              id: "price_1",
              product: "prod_1",
            },
          }],
        },
      },
      {
        id: "sub_2",
        metadata: { plan: "starter" },
        items: {
          data: [{
            price: {
              id: "price_2",
              product: "prod_2",
            },
          }],
        },
      },
    ], [{
      field: "items.data.price.product",
      operator: "is",
      value: "prod_1",
    }, {
      field: "metadata.plan",
      operator: "contains",
      value: "pro",
    }]);

    expect(params).toEqual({
      query: "metadata['plan']:'pro'",
      limit: 25,
      expand: ["data.items.data.price"],
    });
    expect(rows).toEqual([expect.objectContaining({ id: "sub_1" })]);
  });

  it("covers Stripe protocol aggregation, raw row shape, and subscription defaults", () => {
    const subscriptionParams = stripeOfficialProtocol._private.buildListParams({
      resource: "subscriptions",
      dateRange: {
        field: "created",
        start: "2026-01-01",
        end: "2026-01-31",
      },
      filters: [{
        field: "status",
        operator: "is",
        value: "",
      }],
      pagination: { limit: 100 },
    }, {
      endpoint: "/subscriptions",
      defaultDateField: "created",
      defaultParams: { status: "all" },
    });
    const aggregateRows = stripeOfficialProtocol._private.aggregateRows([
      { id: "txn_1", created: 1770163200, net: 1200, currency: "usd" },
      { id: "txn_2", created: 1770163300, net: 800, currency: "usd" },
      { id: "txn_3", created: 1770249600, net: 500, currency: "usd" },
    ], {
      metric: { field: "net", operation: "sum" },
      dimension: { field: "created", type: "date", interval: "day" },
    });
    const rawRows = stripeOfficialProtocol._private.normalizeRawRows([{
      id: "ch_1",
      amount: 2500,
      billing_details: {
        address: {
          country: "GB",
        },
      },
    }], {
      rawColumns: ["id", "amount", "billing_details.address.country"],
    }, {});

    expect(subscriptionParams.status).toBe("all");
    expect(aggregateRows).toEqual([
      {
        period: "2026-02-04",
        dimension: "2026-02-04",
        value: 2000,
        currency: "usd",
        recordsProcessed: 2,
      },
      {
        period: "2026-02-05",
        dimension: "2026-02-05",
        value: 500,
        currency: "usd",
        recordsProcessed: 1,
      },
    ]);
    expect(rawRows).toEqual([{
      id: "ch_1",
      amount: 2500,
      billing_details_address_country: "GB",
    }]);
  });

  it("calculates MRR with Stripe-style active/past_due monthly-normalized snapshots", () => {
    const rows = stripeOfficialProtocol._private.calculateRecurringMetricRows([
      {
        id: "sub_monthly",
        status: "active",
        customer: "cus_1",
        start_date: epoch("2020-01-15"),
        currency: "usd",
        items: {
          data: [{
            quantity: 2,
            price: {
              unit_amount: 10000,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_annual",
        status: "past_due",
        customer: "cus_2",
        start_date: epoch("2020-03-10"),
        currency: "usd",
        items: {
          data: [{
            quantity: 1,
            price: {
              unit_amount: 120000,
              currency: "usd",
              recurring: { interval: "year", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_trialing",
        status: "trialing",
        customer: "cus_3",
        start_date: epoch("2020-01-01"),
        trial_end: epoch("2020-04-01"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 50000,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_metered",
        status: "active",
        customer: "cus_4",
        start_date: epoch("2020-01-01"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 99900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "metered" },
            },
          }],
        },
      },
    ], {
      compiledMetric: "mrr",
      dimension: { field: "period", interval: "month" },
      dateRange: {
        start: "2020-01-01",
        end: "2020-03-15",
      },
      currency: "usd",
    }, "mrr");

    expect(rows.map((row) => ({
      period: row.period,
      value: row.value,
      activeSubscriptions: row.activeSubscriptions,
      activeCustomers: row.activeCustomers,
    }))).toEqual([
      {
        period: "2020-01-01",
        value: 20000,
        activeSubscriptions: 1,
        activeCustomers: 1,
      },
      {
        period: "2020-02-01",
        value: 20000,
        activeSubscriptions: 1,
        activeCustomers: 1,
      },
      {
        period: "2020-03-01",
        value: 30000,
        activeSubscriptions: 2,
        activeCustomers: 2,
      },
    ]);
  });

  it("subtracts subscription item discounts from MRR", () => {
    const mrr = stripeOfficialProtocol._private.getSubscriptionMrr({
      id: "sub_discounted",
      status: "active",
      customer: "cus_discounted",
      start_date: epoch("2020-01-01"),
      currency: "usd",
      items: {
        data: [{
          quantity: 1,
          discounts: [{
            start: epoch("2020-01-01"),
            coupon: {
              percent_off: 50,
              duration: "forever",
            },
          }],
          price: {
            unit_amount: 2900,
            currency: "usd",
            recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
          },
        }],
      },
    }, moment("2020-03-01"));

    expect(mrr).toBe(1450);
  });

  it("subtracts customer-level discounts from MRR", () => {
    const mrr = stripeOfficialProtocol._private.getSubscriptionMrr({
      id: "sub_customer_discounted",
      status: "active",
      customer: {
        id: "cus_discounted",
        discount: {
          start: epoch("2020-01-01"),
          coupon: {
            percent_off: 100,
            duration: "forever",
          },
        },
      },
      start_date: epoch("2020-01-01"),
      currency: "usd",
      items: {
        data: [{
          quantity: 1,
          price: {
            unit_amount: 2900,
            currency: "usd",
            recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
          },
        }],
      },
    }, moment("2020-03-01"));

    expect(mrr).toBe(0);
  });

  it("calculates subscriber churn with customer-level positive-MRR subscribers", () => {
    const rows = stripeOfficialProtocol._private.calculateChurnMetricRows([
      {
        id: "sub_customer_with_second_active_subscription",
        status: "canceled",
        customer: "cus_keep",
        start_date: epoch("2020-01-01"),
        canceled_at: epoch("2020-03-10"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_customer_still_active",
        status: "active",
        customer: "cus_keep",
        start_date: epoch("2020-01-01"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_customer_churned",
        status: "canceled",
        customer: "cus_churned",
        start_date: epoch("2020-01-01"),
        canceled_at: epoch("2020-03-15"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_new_customer_churned",
        status: "canceled",
        customer: "cus_new_churned",
        start_date: epoch("2020-03-05"),
        canceled_at: epoch("2020-03-20"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
    ], {
      compiledMetric: "subscriber_churn_rate",
      dimension: { field: "period", interval: "month" },
      dateRange: {
        start: "2020-03-01",
        end: "2020-03-31",
      },
      currency: "usd",
    }, "subscriber_churn_rate");

    expect(rows[0]).toMatchObject({
      value: 2 / 3,
      startingSubscribers: 2,
      newSubscribers: 1,
      churnedSubscribers: 2,
    });
  });

  it("calculates customer lifetime value from ARPA divided by subscriber churn rate", () => {
    const rows = stripeOfficialProtocol._private.calculateCustomerLifetimeValueRows([
      {
        id: "sub_active",
        status: "active",
        customer: "cus_active",
        start_date: epoch("2020-01-01"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_churned",
        status: "canceled",
        customer: "cus_churned",
        start_date: epoch("2020-01-01"),
        canceled_at: epoch("2020-03-15"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
    ], {
      compiledMetric: "customer_lifetime_value",
      dimension: { field: "period", interval: "month" },
      dateRange: {
        start: "2020-03-01",
        end: "2020-03-31",
      },
      currency: "usd",
    });

    expect(rows[0]).toMatchObject({
      value: 5800,
      averageRevenuePerUser: 2900,
      subscriberChurnRate: 0.5,
      activeSubscribers: 1,
    });
  });

  it("calculates active subscribers as customers with positive MRR", () => {
    const rows = stripeOfficialProtocol._private.calculateActiveSubscriberRows([
      {
        id: "sub_one",
        status: "active",
        customer: "cus_one",
        start_date: epoch("2020-01-01"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_two_same_customer",
        status: "active",
        customer: "cus_one",
        start_date: epoch("2020-01-01"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 2900,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
      {
        id: "sub_free",
        status: "active",
        customer: "cus_free",
        start_date: epoch("2020-01-01"),
        currency: "usd",
        items: {
          data: [{
            price: {
              unit_amount: 0,
              currency: "usd",
              recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            },
          }],
        },
      },
    ], {
      compiledMetric: "active_subscribers",
      dimension: { field: "period", interval: "month" },
      dateRange: {
        start: "2020-03-01",
        end: "2020-03-31",
      },
      currency: "usd",
    });

    expect(rows[0]).toMatchObject({
      value: 1,
      activeSubscribers: 1,
      activeSubscriptions: 2,
    });
  });

  it("recommends Stripe templates from business goals", () => {
    const source = getSourceById("stripeOfficial");
    const recommendations = source.backend.ai.recommendTemplates({
      question: "Which churn templates should I add?",
    });

    expect(recommendations.recommendations).toContainEqual(expect.objectContaining({
      slug: "compiled-metrics",
      recommendedCharts: expect.arrayContaining([
        expect.objectContaining({ id: "subscriber-churn-rate" }),
      ]),
    }));
  });

  it("caps Stripe previews and returns compact warnings", async () => {
    const source = getSourceById("stripeOfficial");
    const previewSpy = vi.spyOn(stripeOfficialProtocol, "previewDataRequest").mockResolvedValue({
      responseData: {
        data: [{ period: "2026-04-01", value: 1200 }],
        configuration: {
          warnings: ["Result capped at 3 records. Narrow the date range for more complete data."],
        },
      },
    });

    const preview = await source.backend.ai.previewConfiguration({
      connection: { id: 42 },
      rowLimit: 3,
      configuration: {
        source: "stripeOfficial",
        mode: "aggregate",
        resource: "balance_transactions",
        queryMode: "list",
        pagination: { maxRecords: 1000 },
      },
    });

    expect(previewSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequest: expect.objectContaining({
        configuration: expect.objectContaining({
          pagination: expect.objectContaining({ maxRecords: 3 }),
        }),
      }),
    }));
    expect(preview).toMatchObject({
      status: "ok",
      rows: [{ period: "2026-04-01", value: 1200 }],
      warnings: ["Result capped at 3 records. Narrow the date range for more complete data."],
    });
  });

  it("exposes compact Stripe resource schema to the orchestrator", () => {
    const source = getSourceById("stripeOfficial");
    const schema = source.backend.ai.getSchema();

    expect(schema.entities).toContainEqual(expect.objectContaining({
      name: "balance_transactions",
      kind: "stripe_resource",
      columns: expect.arrayContaining([
        expect.objectContaining({ name: "net", type: "number" }),
      ]),
    }));
    expect(schema.entities).toContainEqual(expect.objectContaining({
      name: "mrr",
      kind: "stripe_compiled_metric",
    }));
  });

  it("registers Stripe source tools and makes query optional for config-backed creation", async () => {
    const tools = await availableTools();
    const names = tools.map((tool) => tool.name);
    const createDataset = tools.find((tool) => tool.name === "create_dataset");
    const createTemporaryChart = tools.find((tool) => tool.name === "create_temporary_chart");

    expect(names).toEqual(expect.arrayContaining([
      "source_get_capabilities",
      "source_list_resources",
      "source_get_sample_data",
      "source_list_templates",
      "source_recommend_templates",
      "source_plan_dataset",
      "source_validate_configuration",
      "source_preview_configuration",
      "stripe_official_plan_dataset",
      "stripe_official_validate_configuration",
      "stripe_official_preview_configuration",
    ]));
    expect(createDataset.parameters.required).toEqual(["connection_id", "name"]);
    expect(createTemporaryChart.parameters.required).toEqual(["connection_id", "name"]);
  });

  it("team-scopes Stripe Official planning tools", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "stripeOfficial",
      subType: "stripeOfficial",
      name: "Stripe",
    });

    const plan = await stripeOfficialPlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "Create a revenue chart",
    });
    const validation = await stripeOfficialValidateConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.configuration,
    });

    expect(db.Connection.findByPk).toHaveBeenCalledWith(42);
    expect(plan.status).toBe("ok");
    expect(validation.valid).toBe(true);
  });

  it("routes generic source planning tools through source-owned Stripe AI", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "stripeOfficial",
      subType: "stripeOfficial",
      name: "Stripe",
    });
    const previewSpy = vi.spyOn(stripeOfficialProtocol, "previewDataRequest").mockResolvedValue({
      responseData: {
        data: [{ period: "2026-04-01", value: 1200 }],
      },
    });

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "Create an MRR chart",
    });
    const validation = await sourceValidateConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.configuration,
    });
    const preview = await sourcePreviewConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.configuration,
      row_limit: 3,
    });

    expect(db.Connection.findByPk).toHaveBeenCalledWith(42);
    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric: "mrr",
      },
    });
    expect(validation.valid).toBe(true);
    expect(previewSpy).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({ id: 42 }),
    }));
    expect(preview.rows).toEqual([{ period: "2026-04-01", value: 1200 }]);
  });

  it("creates configuration-backed Stripe datasets without requiring a query", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "stripeOfficial",
      subType: "stripeOfficial",
      name: "Stripe",
    });
    const createSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "Stripe revenue",
      DataRequests: [{ id: 1001 }],
    });

    const result = await createDataset({
      team_id: 7,
      connection_id: 42,
      name: "Stripe revenue",
      configuration: {
        source: "stripeOfficial",
        mode: "aggregate",
        resource: "balance_transactions",
      },
    });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      team_id: 7,
      dataRequests: [expect.objectContaining({
        connection_id: 42,
        query: undefined,
        configuration: expect.objectContaining({
          source: "stripeOfficial",
        }),
      })],
    }));
    expect(result).toMatchObject({
      dataset_id: 99,
      data_request_id: 1001,
      name: "Stripe revenue",
    });
  });

  it("places created Stripe charts in the requested dashboard and returns placement ids", async () => {
    vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({
      id: 99,
      team_id: 7,
      project_ids: [],
      name: "Stripe revenue",
      update: vi.fn().mockResolvedValue({}),
    });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({
      id: 13,
      team_id: 7,
      ghost: false,
    });
    vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 456,
      name: "Stripe revenue chart",
      type: "line",
      project_id: 13,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createChart({
      team_id: 7,
      project_id: 13,
      dataset_id: 99,
      name: "Stripe revenue chart",
      type: "line",
      xAxis: "root[].period",
      yAxis: "root[].value",
      yAxisOperation: "none",
      formula: "{val / 100}",
    });

    expect(ChartController.prototype.createWithChartDatasetConfigs).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 13,
      chartDatasetConfigs: [expect.objectContaining({
        dataset_id: 99,
        xAxis: "root[].period",
        yAxis: "root[].value",
        formula: "{val / 100}",
      })],
    }), null);
    expect(result).toMatchObject({
      chart_id: 456,
      dataset_id: 99,
      project_id: 13,
      dashboard_url: expect.stringContaining("/dashboard/13"),
    });
  });
});
