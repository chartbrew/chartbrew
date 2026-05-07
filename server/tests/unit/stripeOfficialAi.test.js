import {
  beforeEach, describe, expect, it, vi
} from "vitest";

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
  stripeOfficialPlanDataset,
  stripeOfficialValidateConfiguration,
} = require("../../modules/ai/orchestrator/tools/stripeOfficialTools");
const { getSourceById } = require("../../sources");
const stripeOfficialProtocol = require("../../sources/plugins/stripeOfficial/stripeOfficial.protocol");

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
        formula: "${val / 100}",
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
        formula: "${val / 100}",
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
      formula: "${val / 100}",
    });

    expect(ChartController.prototype.createWithChartDatasetConfigs).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 13,
      chartDatasetConfigs: [expect.objectContaining({
        dataset_id: 99,
        xAxis: "root[].period",
        yAxis: "root[].value",
        formula: "${val / 100}",
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
