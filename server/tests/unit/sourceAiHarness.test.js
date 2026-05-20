import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const firestoreProtocol = require("../../sources/plugins/firestore/firestore.protocol");
const realtimeDbProtocol = require("../../sources/plugins/realtimedb/realtimedb.protocol");
const CustomerioConnection = require("../../sources/plugins/customerio/customerio.connection");
const googleAnalyticsConnection = require("../../sources/plugins/googleAnalytics/googleAnalytics.connection");
const googleAnalyticsProtocol = require("../../sources/plugins/googleAnalytics/googleAnalytics.protocol");
const jiraConnection = require("../../sources/plugins/jira/jira.connection");
const jiraProtocol = require("../../sources/plugins/jira/jira.protocol");
const stripeOfficialProtocol = require("../../sources/plugins/stripeOfficial/stripeOfficial.protocol");
const apiProtocol = require("../../sources/shared/protocols/api.protocol");
const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const createChart = require("../../modules/ai/orchestrator/tools/createChart");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const generateQueryTool = require("../../modules/ai/orchestrator/tools/generateQuery");
const getSchemaTool = require("../../modules/ai/orchestrator/tools/getSchema");
const { sourceUsesSourceOwnedConfiguration } = require("../../modules/ai/orchestrator/sourceSupport");
const {
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceResolveContext,
  sourceRunAction,
  sourceSearchRecords,
  sourceValidateConfiguration,
} = require("../../modules/ai/orchestrator/tools/sourceTools");
const { getSourceById } = require("../../sources");

const ALLOWED_STATUSES = new Set([
  "ok",
  "fallback",
  "needs_disambiguation",
  "needs_more_context",
  "needs_model_planning",
  "unsupported",
  "error",
]);

const SOURCE_OWNED_IDS = [
  "api",
  "customerio",
  "firestore",
  "googleAnalytics",
  "jira",
  "realtimedb",
  "stripeOfficial",
];

const QUERY_GENERATION_IDS = [
  "postgres",
  "rdsPostgres",
  "supabasedb",
  "timescaledb",
  "mysql",
  "rdsMysql",
  "clickhouse",
  "mongodb",
];

const TOOL_TEAM_ID = 7;

const apiContext = [
  "GET /orders",
  "Returns { \"data\": [{ \"id\": \"ord_1\", \"amount\": 25, \"status\": \"paid\", \"created_at\": \"2026-05-01\" }] }",
  "Use data as the array path.",
  "Filter dates with start_date and end_date. Date format YYYY-MM-DD.",
].join("\n");

function expectNoSensitiveOutput(value, { maxLength = 20000 } = {}) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/bearer\s+[a-z0-9._-]+/i);
  expect(serialized).not.toMatch(/api[_-]?key["']?\s*[:=]\s*["'][^"']+/i);
  expect(serialized).not.toMatch(/authorization["']?\s*[:=]/i);
  expect(serialized.length).toBeLessThan(maxLength);
}

function expectToolOutputContract(value, { maxLength = 20000, maxRows = 5 } = {}) {
  expectNoSensitiveOutput(value, { maxLength });
  expect(!Array.isArray(value?.rows) || value.rows.length <= maxRows).toBe(true);
  expect(!Array.isArray(value?.resources) || value.resources.length <= 50).toBe(true);
  expect(!Array.isArray(value?.collections) || value.collections.length <= 50).toBe(true);
  expect(!Array.isArray(value?.campaigns) || value.campaigns.length <= 25).toBe(true);
  expect(!Array.isArray(value?.segments) || value.segments.length <= 25).toBe(true);
}

function expectDataRequestContract(sourceId, plan) {
  const dataRequest = plan.dataRequest || {};
  const hasQuery = Boolean(dataRequest.query || plan.query);
  const hasRoute = Boolean(dataRequest.route || plan.route);
  const hasMethod = Boolean(dataRequest.method || plan.method);
  const hasConfiguration = Boolean(plan.configuration || dataRequest.configuration);

  expect(sourceId !== "firestore" || hasQuery).toBe(true);
  expect(!["api", "customerio", "realtimedb"].includes(sourceId) || hasRoute).toBe(true);
  expect(!["api", "customerio"].includes(sourceId) || hasMethod).toBe(true);
  expect(!["googleAnalytics", "jira", "stripeOfficial"].includes(sourceId) || hasConfiguration).toBe(true);
}

function expectChartPlanContract(plan) {
  const spec = plan.chartSpec || {};
  expect(spec.type).toBeTruthy();
  const isTable = spec.type === "table";
  const isKpiStyle = ["kpi", "avg", "gauge"].includes(spec.type);
  const requiresAxes = !isTable && !isKpiStyle;
  const requiresDateField = spec.type === "line" && /date|time|period/i.test(spec.xAxis || "");

  expect(!isKpiStyle || Boolean(spec.yAxis)).toBe(true);
  expect(!isKpiStyle || Boolean(spec.yAxisOperation || "none")).toBe(true);
  expect(!requiresAxes || Boolean(spec.xAxis)).toBe(true);
  expect(!requiresAxes || Boolean(spec.yAxis)).toBe(true);
  expect(!requiresDateField || Boolean(spec.dateField || spec.xAxis)).toBe(true);
}

function expectChartDatasetConfigContract({ chartType, chartDatasetConfig, expected = {} }) {
  const isTable = chartType === "table";
  const isKpiStyle = ["kpi", "avg", "gauge"].includes(chartType);
  const needsXAxis = !isTable && !isKpiStyle;
  const needsYAxis = !isTable;

  expect(chartDatasetConfig.dataset_id).toBeTruthy();
  expect(!isTable || chartDatasetConfig.xAxis === "root[]").toBe(true);
  expect(!isKpiStyle || Boolean(chartDatasetConfig.yAxis)).toBe(true);
  expect(!isKpiStyle || Boolean(chartDatasetConfig.xAxis || chartDatasetConfig.yAxis)).toBe(true);
  expect(!needsXAxis || Boolean(chartDatasetConfig.xAxis)).toBe(true);
  expect(!needsYAxis || Boolean(chartDatasetConfig.yAxis)).toBe(true);
  expect(chartDatasetConfig).toMatchObject(expected);
}

async function planFixture(fixture) {
  if (fixture.setup) await fixture.setup();
  const source = getSourceById(fixture.sourceId);
  const plan = await source.backend.ai.planDataset(fixture.payload);
  return { source, plan };
}

async function validateFixturePlan({ source, sourceId, payload, plan }) {
  if (["googleAnalytics", "jira", "stripeOfficial"].includes(sourceId)) {
    return source.backend.ai.validateConfiguration(plan.configuration);
  }

  const dataRequest = {
    query: plan.query || plan.dataRequest?.query,
    method: plan.method || plan.dataRequest?.method,
    route: plan.route || plan.dataRequest?.route,
    itemsLimit: plan.itemsLimit || plan.dataRequest?.itemsLimit,
    conditions: plan.conditions || plan.dataRequest?.conditions,
    configuration: plan.configuration || plan.dataRequest?.configuration,
    variables: plan.variables || plan.dataRequest?.variables,
  };

  if (sourceId === "api") {
    return source.backend.ai.validateConfiguration(dataRequest, { connection: payload.connection });
  }

  return source.backend.ai.validateConfiguration(dataRequest);
}

const plannerContractFixtures = [{
  name: "GA4 timeseries",
  sourceId: "googleAnalytics",
  payload: {
    question: "Show users over time",
    overrides: { propertyId: "properties/123" },
  },
}, {
  name: "Customer.io table",
  sourceId: "customerio",
  payload: {
    question: "Show recent purchase events",
  },
}, {
  name: "Firestore count",
  sourceId: "firestore",
  setup: async () => {
    vi.spyOn(firestoreProtocol, "getBuilderMetadata").mockResolvedValue({
      collections: [{ id: "users", path: "users" }],
    });
  },
  payload: {
    connection: { id: 42, type: "firestore", subType: "firestore" },
    question: "Count users",
  },
}, {
  name: "Firestore follow-up doughnut breakdown",
  sourceId: "firestore",
  setup: async () => {
    vi.spyOn(firestoreProtocol, "getBuilderMetadata").mockResolvedValue({
      collections: [{ id: "connections", path: "connections" }],
    });
  },
  payload: {
    connection: { id: 42, type: "firestore", subType: "firestore" },
    question: "actually can you make a donut chart to show connection types?",
  },
  expectedChartSpec: {
    type: "doughnut",
    xAxis: "root[].type",
    yAxis: "root[]._id",
    yAxisOperation: "count",
  },
}, {
  name: "Realtime DB count",
  sourceId: "realtimedb",
  payload: {
    question: "Count /orders",
  },
}, {
  name: "Generic API timeseries from context",
  sourceId: "api",
  payload: {
    connection: {
      id: 42,
      type: "api",
      subType: "api",
      host: "https://api.example.com",
      schema: {
        apiAiContext: {
          raw: apiContext,
        },
      },
    },
    question: "Show orders over time for the last 30 days",
  },
}, {
  name: "Stripe Official timeseries",
  sourceId: "stripeOfficial",
  payload: {
    question: "Create an MRR chart over the last 6 months",
  },
}, {
  name: "Jira issue breakdown",
  sourceId: "jira",
  payload: {
    question: "Show open Jira issues by status",
  },
}];

const toolHarnessConnections = {
  api: {
    id: 101,
    team_id: TOOL_TEAM_ID,
    type: "api",
    subType: "api",
    host: "https://api.example.com",
    schema: {
      apiAiContext: {
        raw: apiContext,
      },
    },
  },
  customerio: {
    id: 102,
    team_id: TOOL_TEAM_ID,
    type: "customerio",
    subType: "customerio",
    host: "us",
    password: "redacted-test-token",
  },
  firestore: {
    id: 103,
    team_id: TOOL_TEAM_ID,
    type: "firestore",
    subType: "firestore",
    name: "Firestore",
  },
  googleAnalytics: {
    id: 104,
    team_id: TOOL_TEAM_ID,
    type: "googleAnalytics",
    subType: "googleAnalytics",
    oauth_id: 1004,
    schema: {
      googleAnalytics: {
        accountId: "accounts/1",
        propertyId: "properties/123",
        propertyName: "Example GA4",
      },
    },
  },
  jira: {
    id: 107,
    team_id: TOOL_TEAM_ID,
    type: "jira",
    subType: "jira",
    name: "Jira",
    host: "https://chartbrew.atlassian.net",
    authentication: {
      email: "raz@example.com",
      apiToken: "redacted-test-token",
    },
    options: {
      jira: {
        fieldMappings: {
          storyPoints: "customfield_10016",
        },
      },
    },
  },
  realtimedb: {
    id: 105,
    team_id: TOOL_TEAM_ID,
    type: "realtimedb",
    subType: "realtimedb",
    schema: {
      aiContext: {
        paths: [{ path: "orders", label: "Orders" }],
      },
    },
  },
  stripeOfficial: {
    id: 106,
    team_id: TOOL_TEAM_ID,
    type: "stripeOfficial",
    subType: "stripeOfficial",
    name: "Stripe",
  },
};

function getToolConnection(sourceId) {
  return toolHarnessConnections[sourceId];
}

function mockToolConnections() {
  vi.spyOn(db.Connection, "findByPk").mockImplementation(async (id) => {
    return Object.values(toolHarnessConnections).find((connection) => connection.id === Number(id)) || null;
  });
}

function setupApiToolRuntime() {
  vi.spyOn(apiProtocol, "previewDataRequest").mockResolvedValue({
    data: [{
      id: "ord_1",
      amount: 25,
      status: "paid",
      created_at: "2026-05-01",
    }],
  });
}

function setupCustomerioToolRuntime() {
  vi.spyOn(CustomerioConnection, "getAllCampaigns").mockResolvedValue([{
    id: 1,
    name: "Welcome",
    active: true,
  }]);
  vi.spyOn(CustomerioConnection, "getAllSegments").mockResolvedValue([{
    id: 2,
    name: "Customers",
    type: "manual",
  }]);
  vi.spyOn(CustomerioConnection, "getAllObjectTypes").mockResolvedValue([{
    id: "user",
    name: "User",
  }]);
  vi.spyOn(CustomerioConnection, "getActivities").mockResolvedValue({
    activities: [{
      id: "act_1",
      type: "event",
      name: "purchase",
      timestamp: 1770000000,
    }],
    activity_count: 1,
  });
}

function setupFirestoreToolRuntime() {
  vi.spyOn(firestoreProtocol, "getBuilderMetadata").mockResolvedValue({
    collections: [{ id: "connections", path: "connections" }],
  });
  vi.spyOn(firestoreProtocol, "createFirestoreConnection").mockReturnValue({
    get: vi.fn().mockResolvedValue({
      data: [{ _id: "conn_1", type: "api" }],
      configuration: {},
    }),
  });
}

function setupGoogleAnalyticsToolRuntime() {
  vi.spyOn(googleAnalyticsProtocol, "getBuilderMetadata").mockResolvedValue({
    accounts: [{
      account: "accounts/1",
      displayName: "Example Account",
      propertySummaries: [{
        property: "properties/123",
        displayName: "Example GA4",
      }],
    }],
    metadata: null,
  });
  vi.spyOn(googleAnalyticsProtocol, "getSavedConnection").mockResolvedValue(getToolConnection("googleAnalytics"));
  vi.spyOn(googleAnalyticsProtocol, "getOAuth").mockResolvedValue({
    refreshToken: "redacted-refresh-token",
  });
  vi.spyOn(googleAnalyticsConnection, "getAnalytics").mockResolvedValue([{
    date: "20260501",
    activeUsers: 12,
  }]);
}

function setupJiraToolRuntime() {
  vi.spyOn(jiraConnection, "jiraRequest").mockResolvedValue({
    issues: [{
      key: "CHART-1",
      fields: {
        summary: "Build Jira source",
        project: { key: "CHART" },
        issuetype: { name: "Story" },
        status: { name: "In Progress", statusCategory: { name: "In Progress" } },
        assignee: { displayName: "Raz" },
        priority: { name: "High" },
        created: "2026-05-01T00:00:00.000Z",
        updated: "2026-05-02T00:00:00.000Z",
        customfield_10016: 5,
      },
    }],
    total: 1,
  });
  vi.spyOn(jiraProtocol, "fetchJiraRows").mockResolvedValue([{
    key: "CHART-1",
    fields: {
      summary: "Build Jira source",
      project: { key: "CHART" },
      issuetype: { name: "Story" },
      status: { name: "In Progress", statusCategory: { name: "In Progress" } },
      assignee: { displayName: "Raz" },
      priority: { name: "High" },
      created: "2026-05-01T00:00:00.000Z",
      updated: "2026-05-02T00:00:00.000Z",
      customfield_10016: 5,
    },
  }]);
}

function setupRealtimeDbToolRuntime() {
  vi.spyOn(realtimeDbProtocol, "createRealtimeDatabase").mockReturnValue({
    getData: vi.fn().mockResolvedValue([{ _key: "order_1", total: 25 }]),
  });
}

function setupStripeOfficialToolRuntime() {
  vi.spyOn(stripeOfficialProtocol, "previewDataRequest").mockResolvedValue({
    responseData: {
      data: [{
        id: "txn_1",
        created: 1770000000,
        net: 2500,
      }],
      configuration: {
        warnings: [],
      },
    },
  });
}

const compactToolFixtures = [{
  sourceId: "api",
  question: "Show orders over time",
  resource: "/orders",
  previewConfiguration: {
    method: "GET",
    route: "/orders",
    itemsLimit: 5,
    useGlobalHeaders: true,
  },
  setup: setupApiToolRuntime,
}, {
  sourceId: "customerio",
  question: "Show recent purchase events",
  resource: "activities",
  previewConfiguration: {
    method: "GET",
    route: "activities",
    itemsLimit: 5,
    configuration: { limit: 5 },
  },
  setup: setupCustomerioToolRuntime,
}, {
  sourceId: "firestore",
  question: "Show connection records",
  resource: "connections",
  previewConfiguration: {
    query: "connections",
    configuration: { limit: 5 },
    conditions: [],
  },
  setup: setupFirestoreToolRuntime,
}, {
  sourceId: "googleAnalytics",
  question: "Show users over time",
  resource: "ga4_report",
  previewConfiguration: {
    accountId: "accounts/1",
    propertyId: "properties/123",
    startDate: "7daysAgo",
    endDate: "yesterday",
    metrics: "activeUsers",
    dimensions: "date",
  },
  setup: setupGoogleAnalyticsToolRuntime,
}, {
  sourceId: "jira",
  question: "Show Jira issues by status",
  resource: "issues",
  previewConfiguration: {
    source: "jira",
    resource: "issues",
    mode: "jql",
    jql: "project = CHART",
    fields: ["key", "summary", "status", "assignee", "created", "updated"],
    transform: { type: "grouped", groupBy: "status", metric: "count" },
    pagination: { startAt: 0, maxResults: 100, maxRecords: 5 },
  },
  setup: setupJiraToolRuntime,
}, {
  sourceId: "realtimedb",
  question: "Show /orders",
  resource: "orders",
  previewConfiguration: {
    route: "orders",
    configuration: { limitToLast: 5, limitToFirst: 0 },
  },
  setup: setupRealtimeDbToolRuntime,
}, {
  sourceId: "stripeOfficial",
  question: "Show latest balance transactions",
  resource: "balance_transactions",
  previewConfiguration: {
    source: "stripeOfficial",
    mode: "raw",
    resource: "balance_transactions",
    dateField: "created",
    rawColumns: ["id", "created", "net"],
    pagination: { maxRecords: 5 },
  },
  setup: setupStripeOfficialToolRuntime,
}];

const toolRoutingReplays = [{
  name: "source-owned chart preview",
  sourceId: "firestore",
  steps: ["source_get_capabilities", "source_plan_dataset", "create_temporary_chart"],
  finalStatus: "ok",
}, {
  name: "source-owned missing context",
  sourceId: "realtimedb",
  steps: ["source_get_capabilities", "source_plan_dataset"],
  finalStatus: "needs_more_context",
  forbidden: ["create_temporary_chart", "create_chart"],
}, {
  name: "query-generation database chart",
  sourceId: "postgres",
  steps: ["get_schema", "generate_query", "run_query", "suggest_chart"],
  forbidden: ["source_plan_dataset", "source_validate_configuration", "source_preview_configuration"],
}];

const queryGenerationFixtures = [{
  sourceId: "postgres",
  type: "postgres",
  subType: "postgres",
  instructionPattern: /PostgreSQL|SELECT/i,
}, {
  sourceId: "rdsPostgres",
  type: "postgres",
  subType: "rdsPostgres",
  instructionPattern: /PostgreSQL|SELECT/i,
}, {
  sourceId: "supabasedb",
  type: "postgres",
  subType: "supabasedb",
  instructionPattern: /PostgreSQL|SELECT/i,
}, {
  sourceId: "timescaledb",
  type: "postgres",
  subType: "timescaledb",
  instructionPattern: /time_bucket|date_trunc/i,
}, {
  sourceId: "mysql",
  type: "mysql",
  subType: "mysql",
  instructionPattern: /MySQL|SELECT/i,
}, {
  sourceId: "rdsMysql",
  type: "mysql",
  subType: "rdsMysql",
  instructionPattern: /MySQL|SELECT/i,
}, {
  sourceId: "clickhouse",
  type: "clickhouse",
  subType: "clickhouse",
  instructionPattern: /ClickHouse|SELECT/i,
}, {
  sourceId: "mongodb",
  type: "mongodb",
  subType: "mongodb",
  instructionPattern: /Mongo|read-only/i,
}];

function getQueryGenerationConnection(fixture) {
  return {
    id: 300 + queryGenerationFixtures.indexOf(fixture),
    team_id: TOOL_TEAM_ID,
    type: fixture.type,
    subType: fixture.subType,
    name: `${fixture.sourceId} connection`,
    schema: {
      entities: [{
        name: "orders",
        columns: [{
          name: "id",
          type: "string",
        }, {
          name: "created_at",
          type: "date",
        }, {
          name: "amount",
          type: "number",
        }],
      }],
    },
  };
}

describe("Source AI harness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete global.openaiClient;
  });

  it.each(plannerContractFixtures)("$name satisfies the source-owned planner contract", async (fixture) => {
    const { source, plan } = await planFixture(fixture);
    const validation = await validateFixturePlan({
      source,
      sourceId: fixture.sourceId,
      payload: fixture.payload,
      plan,
    });

    expect(ALLOWED_STATUSES.has(plan.status)).toBe(true);
    expect(plan.status).toBe("ok");
    expectDataRequestContract(fixture.sourceId, plan);
    expectChartPlanContract(plan);
    expect(plan.chartSpec).toMatchObject(fixture.expectedChartSpec || {});
    expectNoSensitiveOutput(plan);
    expect(validation.valid).toBe(true);
    expectNoSensitiveOutput(validation);
  });

  it("standardizes missing-context responses", async () => {
    const { plan } = await planFixture({
      sourceId: "realtimedb",
      payload: { question: "Show recent records" },
    });

    expect(plan).toMatchObject({
      status: "needs_more_context",
      requiredContext: expect.any(Array),
    });
    expect(plan.message).toBeTruthy();
    expectNoSensitiveOutput(plan);
  });

  it("keeps source-owned capability responses compact and token-safe", async () => {
    for (const sourceId of SOURCE_OWNED_IDS) {
      const source = getSourceById(sourceId);
      expect(source.capabilities.ai).toMatchObject({
        canGenerateDatasets: true,
        canGenerateQueries: false,
        hasSourceInstructions: true,
        hasTools: true,
      });

      const capabilities = await source.backend.ai.getCapabilities({
        connection: {
          id: 42,
          type: source.type,
          subType: source.subType,
          host: sourceId === "api" ? "https://api.example.com" : undefined,
        },
      });
      expect(capabilities.instructions.length).toBeLessThan(2500);
      expectNoSensitiveOutput(capabilities);
    }
  });

  it("keeps source tool policy split between configuration planning and query generation", () => {
    for (const sourceId of SOURCE_OWNED_IDS) {
      const source = getSourceById(sourceId);
      expect(source.capabilities.ai).toMatchObject({
        canGenerateDatasets: true,
        canGenerateQueries: false,
        hasTools: true,
      });
      expect(source.backend.ai.planDataset).toEqual(expect.any(Function));
      expect(source.backend.ai.generateQuery).toBeUndefined();
    }

    for (const sourceId of QUERY_GENERATION_IDS) {
      const source = getSourceById(sourceId);
      expect(source.capabilities.ai).toMatchObject({
        canGenerateDatasets: true,
        canGenerateQueries: true,
        hasSourceInstructions: true,
        hasTools: false,
      });
      expect(source.backend.ai.generateQuery).toEqual(expect.any(Function));
      expect(source.backend.ai.getCapabilities).toEqual(expect.any(Function));
      expect(source.backend.ai.planDataset).toBeUndefined();
    }
  });

  it.each(queryGenerationFixtures)("$sourceId exposes compact query-generation instructions through get_schema", async (fixture) => {
    const source = getSourceById(fixture.sourceId);
    const connection = getQueryGenerationConnection(fixture);
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(connection);

    const capabilities = await source.backend.ai.getCapabilities({ connection });
    const schema = await getSchemaTool({
      team_id: TOOL_TEAM_ID,
      connection_id: connection.id,
    });

    expect(source.capabilities.ai).toMatchObject({
      canGenerateDatasets: true,
      canGenerateQueries: true,
      hasSourceInstructions: true,
      hasTools: false,
    });
    expect(capabilities.instructions).toMatch(fixture.instructionPattern);
    expect(capabilities.instructions.length).toBeLessThan(1200);
    expect(schema.sourceInstructions).toMatch(fixture.instructionPattern);
    expect(schema.sourceInstructions.length).toBeLessThan(1200);
    expectToolOutputContract(capabilities);
    expectToolOutputContract(schema);
  });

  it.each(queryGenerationFixtures)("$sourceId injects compact instructions into generate_query", async (fixture) => {
    const source = getSourceById(fixture.sourceId);
    const generateQuerySpy = vi.spyOn(source.backend.ai, "generateQuery").mockResolvedValue({
      query: fixture.sourceId === "mongodb"
        ? "collection('orders').find().limit(10)"
        : "SELECT id, created_at, amount FROM orders LIMIT 10",
    });
    global.openaiClient = {};

    const result = await generateQueryTool({
      source_id: fixture.sourceId,
      question: "Show recent orders",
      schema: {
        entities: [{
          name: "orders",
          columns: [{ name: "id", type: "string" }],
        }],
      },
    });
    const generationPayload = generateQuerySpy.mock.calls[0][0];

    expect(result.status).toBe("ok");
    expect(generationPayload.schema.sourceInstructions).toMatch(fixture.instructionPattern);
    expect(generationPayload.schema.sourceInstructions.length).toBeLessThan(1200);
    expect(result.query).toBeTruthy();
  });

  it.each(compactToolFixtures)("$sourceId source tools return compact bounded outputs", async (fixture) => {
    mockToolConnections();
    fixture.setup();
    const connection = getToolConnection(fixture.sourceId);
    const basePayload = {
      team_id: TOOL_TEAM_ID,
      connection_id: connection.id,
      source_id: fixture.sourceId,
    };

    const capabilities = await sourceGetCapabilities(basePayload);
    const resources = await sourceListResources(basePayload);
    const plan = await sourcePlanDataset({
      ...basePayload,
      question: fixture.question,
      overrides: fixture.sourceId === "googleAnalytics"
        ? { propertyId: "properties/123" }
        : {},
    });
    const validation = await sourceValidateConfiguration({
      ...basePayload,
      configuration: fixture.previewConfiguration,
    });
    const preview = await sourcePreviewConfiguration({
      ...basePayload,
      configuration: fixture.previewConfiguration,
      row_limit: 5,
    });
    const sample = await sourceGetSampleData({
      ...basePayload,
      resource: fixture.resource,
      row_limit: 5,
    });

    expect(plan.status).toBe("ok");
    expect(validation.valid).toBe(true);
    expect(preview.status).toBe("ok");
    expect(["ok", "needs_more_context"].includes(sample.status)).toBe(true);
    expectToolOutputContract(capabilities);
    expectToolOutputContract(resources, { maxLength: 30000 });
    expectToolOutputContract(plan);
    expectToolOutputContract(validation);
    expectToolOutputContract(preview);
    expectToolOutputContract(sample);
  });

  it("resolves Jira context through the generic source tool", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(toolHarnessConnections.jira);
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "D2371",
      name: "D2371 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "D2371 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "Sprint 14",
      state: "active",
    }]);

    const result = await sourceResolveContext({
      team_id: TOOL_TEAM_ID,
      connection_id: toolHarnessConnections.jira.id,
      source_id: "jira",
      question: "show active sprint status for D2371",
      intent: { id: "sprint_status", resource: "sprint_issues" },
      mode: "preview",
    });

    expect(result.source).toBe("jira");
    expect(result.resolution.entities.project).toMatchObject({
      key: "D2371",
    });
    expect(result.resolution.entities.board).toMatchObject({
      id: "77",
    });
    expect(result.resolution.entities.sprint).toMatchObject({
      id: "123",
    });
    expectToolOutputContract(result);
  });

  it("runs safe Jira source actions through the generic source tool", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(toolHarnessConnections.jira);
    vi.spyOn(jiraConnection, "listUsers").mockResolvedValue([{
      accountId: "raz-account",
      displayName: "Razvan Ilin",
      active: true,
    }]);

    const result = await sourceRunAction({
      team_id: TOOL_TEAM_ID,
      connection_id: toolHarnessConnections.jira.id,
      source_id: "jira",
      action: "listUsers",
      params: { query: "Razvan", maxResults: 10 },
    });

    expect(result).toMatchObject({
      source: "jira",
      action: "listUsers",
      rows: [expect.objectContaining({
        accountId: "raz-account",
        displayName: "Razvan Ilin",
      })],
      rowCount: 1,
    });
    expectToolOutputContract(result);
  });

  it("searches compact Jira issue records without creating a dataset", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(toolHarnessConnections.jira);
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([]);
    vi.spyOn(jiraConnection, "listUsers").mockResolvedValue([{
      accountId: "raz-account",
      displayName: "Razvan Ilin",
    }]);
    vi.spyOn(jiraConnection, "jiraRequest").mockResolvedValue({
      issues: [{
        key: "D2371-1",
        fields: {
          summary: "Fix Jira AI search",
          status: { name: "In Progress", statusCategory: { name: "In Progress", key: "indeterminate" } },
          assignee: { displayName: "Razvan Ilin" },
          priority: { name: "High" },
          issuetype: { name: "Task" },
          created: "2026-05-15T00:00:00.000Z",
          updated: "2026-05-18T00:00:00.000Z",
        },
      }],
    });

    const result = await sourceSearchRecords({
      team_id: TOOL_TEAM_ID,
      connection_id: toolHarnessConnections.jira.id,
      source_id: "jira",
      question: "Show all open issues assigned to Razvan",
      row_limit: 10,
    });

    expect(result).toMatchObject({
      source: "jira",
      status: "ok",
      rows: [expect.objectContaining({
        key: "D2371-1",
        summary: "Fix Jira AI search",
        status: "In Progress",
        assignee: "Razvan Ilin",
      })],
      rowCount: 1,
    });
    expect(jiraConnection.jiraRequest).toHaveBeenCalledWith(expect.any(Object), "/rest/api/3/search/jql", {
      method: "POST",
      body: expect.objectContaining({
        jql: expect.stringContaining("assignee IN (\"raz-account\")"),
        maxResults: 10,
      }),
    });
    expect(jiraConnection.jiraRequest.mock.calls[0][2].body.jql).toContain("statusCategory != Done");
    expect(jiraConnection.jiraRequest.mock.calls[0][2].body.jql).not.toContain("project IN ()");
    expectToolOutputContract(result);
  });

  it("keeps Jira fallback plans usable for preview", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(toolHarnessConnections.jira);
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{ id: "10001", key: "D2371", name: "D2371 Project" }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{ id: 77, name: "D2371 Scrum Board", type: "scrum" }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([]);

    const plan = await sourcePlanDataset({
      team_id: TOOL_TEAM_ID,
      connection_id: toolHarnessConnections.jira.id,
      source_id: "jira",
      question: "show active sprint status for D2371",
      mode: "preview",
    });

    expect(plan.status).toBe("fallback");
    expect(plan.configuration).toMatchObject({ source: "jira", resource: "issues" });
    expect(plan.chartSpec).toMatchObject({ type: "bar", xAxis: "root[].status", yAxis: "root[].issueCount" });
    expect(plan.needs_user_input).toBeUndefined();
    expectToolOutputContract(plan);
  });

  it("passes persist mode through Jira source planning before saved creation", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(toolHarnessConnections.jira);
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "D2371",
      name: "D2371 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "D2371 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "Sprint 14",
      state: "active",
    }, {
      id: 124,
      name: "Sprint 15",
      state: "active",
    }]);

    const plan = await sourcePlanDataset({
      team_id: TOOL_TEAM_ID,
      connection_id: toolHarnessConnections.jira.id,
      source_id: "jira",
      question: "save the active sprint status for D2371",
      mode: "persist",
    });

    expect(plan.needs_user_input).toBe(true);
    expect(plan.status).toBe("needs_disambiguation");
    expect(plan.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "sprint:123" }),
      expect.objectContaining({ value: "sprint:124" }),
    ]));
  });

  it("flattens Jira sprint disambiguation through the generic source tool", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(toolHarnessConnections.jira);
    vi.spyOn(jiraConnection, "listProjects").mockResolvedValue([{
      id: "10001",
      key: "D2371",
      name: "D2371 Project",
    }]);
    vi.spyOn(jiraConnection, "listBoards").mockResolvedValue([{
      id: 77,
      name: "D2371 Scrum Board",
      type: "scrum",
    }]);
    vi.spyOn(jiraConnection, "listSprints").mockResolvedValue([{
      id: 123,
      name: "Sprint 14",
      state: "active",
    }, {
      id: 124,
      name: "Sprint 15",
      state: "active",
    }]);

    const result = await sourceResolveContext({
      team_id: TOOL_TEAM_ID,
      connection_id: toolHarnessConnections.jira.id,
      source_id: "jira",
      question: "show active sprint status for D2371",
      intent: { id: "sprint_status", resource: "sprint_issues" },
      mode: "persist",
    });

    expect(result.needs_user_input).toBe(true);
    expect(result.prompt).toBeTruthy();
    expect(result.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: "sprint:123" }),
      expect.objectContaining({ value: "sprint:124" }),
    ]));
    expect(result.resolution.needsDisambiguation).toBe(true);
  });

  it.each(toolRoutingReplays)("$name follows the allowed high-risk tool sequence", (replay) => {
    const source = getSourceById(replay.sourceId);
    const usedTools = new Set(replay.steps);
    const forbiddenTools = replay.forbidden || [];

    for (const toolName of forbiddenTools) {
      expect(usedTools.has(toolName)).toBe(false);
    }

    expect(!source.capabilities.ai.hasTools || !usedTools.has("generate_query")).toBe(true);
    expect(!source.capabilities.ai.canGenerateQueries || !usedTools.has("source_plan_dataset")).toBe(true);
    expect(replay.finalStatus !== "needs_more_context" || !usedTools.has("create_temporary_chart")).toBe(true);
    expect(replay.finalStatus !== "needs_more_context" || !usedTools.has("create_chart")).toBe(true);
  });

  it("persists safe CDC bindings for temporary chart table payloads", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "api",
      subType: "api",
      host: "https://api.example.com",
      schema: {
        apiAiContext: {
          raw: apiContext,
        },
      },
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: true,
    });
    vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "Orders",
      DataRequests: [{ id: 1001 }],
    });
    const createChartSpy = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "Orders",
      type: "table",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: "Orders",
      original_question: "Show orders from the API",
      type: "table",
      configuration: {},
    });
    const chartPayload = createChartSpy.mock.calls[0][0];

    expectChartDatasetConfigContract({
      chartType: chartPayload.type,
      chartDatasetConfig: chartPayload.chartDatasetConfigs[0],
      expected: {
        dataset_id: 99,
        xAxis: "root[]",
      },
    });
    expect(result).toMatchObject({
      status: "ok",
      chart_created: true,
    });
  });

  it("persists safe CDC bindings for saved KPI payloads", async () => {
    const datasetUpdate = vi.fn().mockResolvedValue(null);
    vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({
      id: 99,
      team_id: 7,
      name: "Users",
      project_ids: [],
      DataRequests: [{ id: 1001, configuration: {} }],
      update: datasetUpdate,
    });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: false,
    });
    const createChartSpy = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "Users count",
      type: "kpi",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createChart({
      team_id: 7,
      project_id: 77,
      dataset_id: 99,
      name: "Users count",
      type: "kpi",
      yAxis: "root[]._id",
      yAxisOperation: "count",
    });
    const chartPayload = createChartSpy.mock.calls[0][0];

    expect(datasetUpdate).toHaveBeenCalledWith({ project_ids: [77] });
    expectChartDatasetConfigContract({
      chartType: chartPayload.type,
      chartDatasetConfig: chartPayload.chartDatasetConfigs[0],
      expected: {
        dataset_id: 99,
        xAxis: "root[]._id",
        yAxis: "root[]._id",
        yAxisOperation: "count",
      },
    });
    expect(result).toMatchObject({
      status: "ok",
      chart_created: true,
    });
  });

  it("formats Jira request errors without raw request headers", () => {
    const message = jiraConnection.getSafeJiraErrorMessage({
      statusCode: 400,
      error: {
        errorMessages: ["Invalid JQL"],
        errors: {
          jql: "The sprint field is invalid",
        },
      },
      options: {
        headers: {
          authorization: "Basic abc123",
        },
      },
    });

    expect(message).toBe("400 - Invalid JQL The sprint field is invalid");
    expectNoSensitiveOutput(message);
  });

  it("preserves plain Jira error bodies without request metadata", () => {
    const message = jiraConnection.getSafeJiraErrorMessage({
      statusCode: 401,
      error: "Client must be authenticated to access this resource.",
      request: {
        headers: {
          authorization: "Basic abc123",
        },
      },
    });

    expect(message).toBe("401 - Client must be authenticated to access this resource.");
    expectNoSensitiveOutput(message);
  });

  it("marks Jira as source-owned configuration so generic run_query stays out of the flow", () => {
    expect(sourceUsesSourceOwnedConfiguration(getSourceById("jira"))).toBe(true);
    expect(sourceUsesSourceOwnedConfiguration(getSourceById("postgres"))).toBe(false);
  });
});
