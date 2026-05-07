import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const createChart = require("../../modules/ai/orchestrator/tools/createChart");
const createDataset = require("../../modules/ai/orchestrator/tools/createDataset");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const { getSourceById } = require("../../sources");

describe("Stripe Official AI anti-hallucination harness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["Create an MRR chart", "mrr"],
    ["Show ARR over time", "arr"],
    ["Create a gross MRR churn chart", "gross_mrr_churn_rate"],
    ["Show subscriber churn rate", "subscriber_churn_rate"],
    ["Show net cash flow", "net_cash_flow"],
    ["Show customer lifetime value", "customer_lifetime_value"],
  ])("plans '%s' through the compiled business metric path", (question, compiledMetric) => {
    const stripeOfficial = getSourceById("stripeOfficial");
    const plan = stripeOfficial.backend.ai.planDataset({ question });

    expect(plan).toMatchObject({
      status: "ok",
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric,
      },
      chartSpec: {
        yAxis: "root[].value",
        yAxisOperation: "none",
      },
    });
    expect(plan.configuration.resource).toBe("balance_transactions");
    expect(plan.rationale.metric).toBe(compiledMetric);
  });

  it("plans current MRR KPI without accumulation", () => {
    const stripeOfficial = getSourceById("stripeOfficial");
    const plan = stripeOfficial.backend.ai.planDataset({
      question: "Add my current MRR as a KPI",
    });

    expect(plan).toMatchObject({
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric: "mrr",
      },
      chartSpec: {
        type: "kpi",
        xAxis: "root[].period",
        yAxis: "root[].value",
      },
    });
    expect(plan.chartSpec.subType).toBeUndefined();
  });

  it("repairs hallucinated MRR datasets that use generic revenue aggregates", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "stripeOfficial",
      subType: "stripeOfficial",
      name: "Stripe",
    });
    const createSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "MRR",
      DataRequests: [{ id: 1001 }],
    });

    const result = await createDataset({
      team_id: 7,
      connection_id: 42,
      name: "MRR",
      configuration: {
        source: "stripeOfficial",
        mode: "aggregate",
        resource: "balance_transactions",
        metric: {
          field: "net",
          operation: "sum",
        },
      },
    });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequests: [expect.objectContaining({
        configuration: expect.objectContaining({
          source: "stripeOfficial",
          mode: "compiled_metric",
          compiledMetric: "mrr",
        }),
      })],
    }));
    expect(result).toMatchObject({
      dataset_id: 99,
      intent_repair: {
        repaired: true,
      },
    });
  });

  it("repairs hallucinated temporary MRR charts before creating preview entities", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "stripeOfficial",
      subType: "stripeOfficial",
      name: "Stripe",
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: true,
    });
    const createSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "Monthly recurring revenue",
      DataRequests: [{ id: 1001 }],
    });
    vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "Monthly recurring revenue",
      type: "kpi",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: "Monthly recurring revenue",
      type: "line",
      xAxis: "root[].period",
      yAxis: "root[].value",
      configuration: {
        source: "stripeOfficial",
        mode: "aggregate",
        resource: "balance_transactions",
        metric: {
          field: "net",
          operation: "sum",
        },
      },
    });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      dataRequests: [expect.objectContaining({
        configuration: expect.objectContaining({
          source: "stripeOfficial",
          mode: "compiled_metric",
          compiledMetric: "mrr",
        }),
      })],
    }));
    expect(result).toMatchObject({
      chart_id: 55,
      dataset_id: 99,
      intent_repair: {
        repaired: true,
      },
    });
  });

  it("removes accumulation from compiled metric temporary KPI charts", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "stripeOfficial",
      subType: "stripeOfficial",
      name: "Stripe",
    });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({
      id: 77,
      team_id: 7,
      ghost: true,
    });
    vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "MRR",
      DataRequests: [{ id: 1001 }],
    });
    const chartSpy = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: "MRR",
      type: "kpi",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: "MRR",
      type: "kpi",
      subType: "AddTimeseries",
      xAxis: "root[].period",
      yAxis: "root[].value",
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric: "mrr",
      },
    });

    expect(chartSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: "kpi",
      subType: undefined,
    }), null);
    expect(result.chart_sanitization).toEqual({ removedAccumulation: true });
  });

  it("removes accumulation from dashboard-placed compiled metric KPI charts", async () => {
    vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({
      id: 99,
      team_id: 7,
      project_ids: [],
      name: "MRR",
      main_dr_id: 1001,
      update: vi.fn().mockResolvedValue({}),
    });
    vi.spyOn(db.DataRequest, "findByPk").mockResolvedValue({
      id: 1001,
      dataset_id: 99,
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric: "mrr",
      },
    });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({
      id: 13,
      team_id: 7,
      ghost: false,
    });
    const chartSpy = vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 456,
      name: "MRR",
      type: "kpi",
      project_id: 13,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createChart({
      team_id: 7,
      project_id: 13,
      dataset_id: 99,
      name: "MRR",
      type: "kpi",
      subType: "AddTimeseries",
      xAxis: "root[].period",
      yAxis: "root[].value",
      yAxisOperation: "none",
      formula: "${val / 100}",
    });

    expect(chartSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: "kpi",
      subType: undefined,
    }), null);
    expect(result.chart_sanitization).toEqual({ removedAccumulation: true });
  });

  it("allows MRR creation when the configuration uses the compiled metric", async () => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
      id: 42,
      team_id: 7,
      type: "stripeOfficial",
      subType: "stripeOfficial",
      name: "Stripe",
    });
    const createSpy = vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockResolvedValue({
      id: 99,
      name: "MRR",
      DataRequests: [{ id: 1001 }],
    });

    const result = await createDataset({
      team_id: 7,
      connection_id: 42,
      name: "MRR",
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric: "mrr",
      },
    });

    expect(createSpy).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      dataset_id: 99,
      data_request_id: 1001,
      name: "MRR",
    });
  });
});
