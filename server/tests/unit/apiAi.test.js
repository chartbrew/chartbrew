import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const apiProtocol = require("../../sources/shared/protocols/api.protocol");
const {
  getSupportedSourceForConnection,
  getSupportedSourceIds,
} = require("../../modules/ai/orchestrator/sourceSupport");
const {
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceValidateConfiguration,
} = require("../../modules/ai/orchestrator/tools/sourceTools");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const { getSourceById } = require("../../sources");

const apiContext = [
  "GET /orders",
  "Returns { \"data\": [{ \"id\": \"ord_1\", \"amount\": 25, \"status\": \"paid\", \"created_at\": \"2026-05-01\" }] }",
  "Use data as the array path.",
  "Filter dates with start_date and end_date. Date format YYYY-MM-DD.",
].join("\n");

describe("Generic API AI layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("declares API as an orchestrator-supported tool source", () => {
    const source = getSourceById("api");

    expect(source.capabilities.ai).toMatchObject({
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    });
    expect(source.backend.ai.planDataset).toEqual(expect.any(Function));
    expect(source.backend.ai.previewConfiguration).toEqual(expect.any(Function));
    expect(getSupportedSourceIds()).toContain("api");
    expect(getSupportedSourceForConnection({
      type: "api",
      subType: "api",
    })?.id).toBe("api");
  });

  it("asks for AI context before planning arbitrary API requests", async () => {
    const source = getSourceById("api");

    const plan = await source.backend.ai.planDataset({
      connection: { id: 42, type: "api", subType: "api", host: "https://api.example.com" },
      question: "Show orders",
    });

    expect(plan).toMatchObject({
      status: "needs_more_context",
      editConnectionUrl: "/connections/42?tab=aiContext",
      requiredContext: ["apiAiContext.raw"],
    });
    expect(plan.contextInstructions).toContain("Open the API connection and go to the AI Context tab.");
    expect(plan.exampleAiContext).toContain("GET /orders");
  });

  it("allows model fallback for recognizable provider API hosts", async () => {
    const source = getSourceById("api");

    const plan = await source.backend.ai.planDataset({
      connection: { id: 42, type: "api", subType: "api", host: "https://app.posthog.com" },
      question: "List all insights",
    });

    expect(plan).toMatchObject({
      status: "needs_model_planning",
      editConnectionUrl: "/connections/42?tab=aiContext",
      providerHint: {
        id: "posthog",
        label: "PostHog",
        modelFallbackAllowed: true,
      },
    });
  });

  it("plans an endpoint from pasted API context", async () => {
    const source = getSourceById("api");

    const plan = await source.backend.ai.planDataset({
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
    });

    expect(plan).toMatchObject({
      status: "ok",
      method: "GET",
      route: "/orders?start_date={{start_date}}&end_date={{end_date}}",
      itemsLimit: 100,
      variables: {
        dateFormat: {
          value: "YYYY-MM-DD",
        },
      },
      dataRequest: {
        useGlobalHeaders: true,
      },
      chartSpec: {
        type: "line",
        xAxis: "root.data[].created_at",
        yAxis: "root.data[].amount",
      },
    });
  });

  it("uses valid root array output paths for table API responses", async () => {
    const source = getSourceById("api");

    const plan = await source.backend.ai.planDataset({
      connection: {
        id: 42,
        type: "api",
        subType: "api",
        host: "https://api.example.com",
        schema: {
          apiAiContext: {
            raw: [
              "GET /users",
              "Returns [{ \"id\": \"user_1\", \"email\": \"a@example.com\" }]",
            ].join("\n"),
          },
        },
      },
      question: "Show users in a table",
    });

    expect(plan).toMatchObject({
      status: "ok",
      chartSpec: {
        type: "table",
      },
      outputFields: ["root[].id", "root[].email"],
    });
  });

  it("routes generic API planning, validation, and preview", async () => {
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
    vi.spyOn(apiProtocol, "previewDataRequest").mockResolvedValue({
      data: [{
        id: "ord_1",
        amount: 25,
        status: "paid",
        created_at: "2026-05-01",
      }],
    });

    const plan = await sourcePlanDataset({
      connection_id: 42,
      team_id: 7,
      question: "Show orders",
    });
    const validation = await sourceValidateConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.dataRequest,
    });
    const preview = await sourcePreviewConfiguration({
      connection_id: 42,
      team_id: 7,
      configuration: plan.dataRequest,
      row_limit: 5,
    });

    expect(plan).toMatchObject({
      status: "ok",
      route: "/orders",
    });
    expect(validation.valid).toBe(true);
    expect(preview).toMatchObject({
      status: "ok",
      rows: [{
        id: "ord_1",
        amount: 25,
        status: "paid",
        created_at: "2026-05-01",
      }],
    });
  });

  it("fills missing API route during temporary chart creation", async () => {
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
    const createDatasetSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
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

    expect(createDatasetSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequests: [expect.objectContaining({
        method: "GET",
        route: "/orders",
        itemsLimit: 100,
        variables: [],
      })],
    }));
    expect(createChartSpy).toHaveBeenCalledWith(expect.objectContaining({
      visualization: expect.objectContaining({
        version: 2,
        metadata: expect.objectContaining({ createdBy: "ai" }),
      }),
      chartDatasetConfigs: [expect.objectContaining({
        templateBindingId: "binding-1",
        xAxis: "root[]",
      })],
    }), null);
    expect(result).toMatchObject({
      status: "ok",
      chart_created: true,
      intent_repair: {
        planned: true,
      },
    });
  });

  it("preserves explicit model-fallback routes for recognizable API hosts", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "api",
      subType: "api",
      host: "https://app.posthog.com",
      schema: {},
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: true,
    });
    const createDatasetSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "PostHog insights",
      DataRequests: [{ id: 1001 }],
    });
    const createChartSpy = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "PostHog insights",
      type: "table",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: "PostHog insights",
      original_question: "List all insights for environment 127973",
      type: "table",
      method: "GET",
      route: "/api/environments/127973/insights/",
      itemsLimit: 100,
      configuration: {},
    });

    expect(createDatasetSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequests: [expect.objectContaining({
        method: "GET",
        route: "/api/environments/127973/insights/",
        itemsLimit: 100,
      })],
    }));
    expect(createChartSpy).toHaveBeenCalledWith(expect.objectContaining({
      chartDatasetConfigs: [expect.objectContaining({
        xAxis: "root[]",
      })],
    }), null);
    expect(result).toMatchObject({
      status: "ok",
      chart_created: true,
    });
  });
});
