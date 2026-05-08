import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const createChart = require("../../modules/ai/orchestrator/tools/createChart");
const createDataset = require("../../modules/ai/orchestrator/tools/createDataset");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const moveChartToDashboard = require("../../modules/ai/orchestrator/tools/moveChartToDashboard");
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

  it("refuses accounting-grade Stripe metric claims", () => {
    const stripeOfficial = getSourceById("stripeOfficial");
    const plan = stripeOfficial.backend.ai.planDataset({
      question: "Create an accounting-grade GAAP MRR revenue recognition chart",
    });
    const validation = stripeOfficial.backend.ai.validateDatasetIntent({
      question: "Create an audited Stripe revenue recognition report",
      configuration: {
        source: "stripeOfficial",
        mode: "compiled_metric",
        compiledMetric: "mrr",
      },
    });

    expect(plan.status).toBe("invalid");
    expect(plan.errors[0]).toContain("not accounting-grade");
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain("Refuse GAAP/IFRS");
  });

  it("creates a revenue-over-time temporary chart from a Stripe plan", async () => {
    const stripeOfficial = getSourceById("stripeOfficial");
    const plan = stripeOfficial.backend.ai.planDataset({
      question: "Create a revenue-over-time temporary chart",
    });
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
      name: plan.datasetName,
      DataRequests: [{ id: 1001 }],
    });
    vi.spyOn(ChartController.prototype, "createWithChartDatasetConfigs").mockResolvedValue({
      id: 55,
      name: plan.datasetName,
      type: "line",
      project_id: 77,
    });
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);

    const result = await createTemporaryChart({
      team_id: 7,
      connection_id: 42,
      name: plan.datasetName,
      question: "Create a revenue-over-time temporary chart",
      configuration: plan.configuration,
      type: plan.chartSpec.type,
      xAxis: plan.chartSpec.xAxis,
      yAxis: plan.chartSpec.yAxis,
      yAxisOperation: plan.chartSpec.yAxisOperation,
      formula: plan.chartSpec.formula,
      spec: plan.chartSpec,
    });

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      project_ids: [],
      dataRequests: [expect.objectContaining({
        connection_id: 42,
        configuration: expect.objectContaining({
          source: "stripeOfficial",
          resource: "balance_transactions",
          metric: {
            field: "net",
            operation: "sum",
          },
        }),
      })],
    }));
    expect(result).toMatchObject({
      chart_id: 55,
      dataset_id: 99,
      data_request_id: 1001,
      project_id: 77,
      is_temporary: true,
    });
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
      formula: "{val / 100}",
    });

    expect(chartSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: "kpi",
      subType: undefined,
    }), null);
    expect(result.chart_sanitization).toEqual({ removedAccumulation: true });
  });

  it("moves a temporary Stripe chart to a dashboard after confirmation", async () => {
    const datasetUpdate = vi.fn().mockResolvedValue({});
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue({
      id: 55,
      project_id: 77,
    });
    vi.spyOn(db.Project, "findByPk")
      .mockResolvedValueOnce({
        id: 77,
        team_id: 7,
        ghost: true,
      })
      .mockResolvedValueOnce({
        id: 13,
        team_id: 7,
        ghost: false,
      });
    vi.spyOn(db.Chart, "findAll").mockResolvedValue([]);
    vi.spyOn(db.Chart, "update").mockResolvedValue([1]);
    vi.spyOn(db.ChartDatasetConfig, "findAll").mockResolvedValue([{
      Dataset: {
        project_ids: [],
        update: datasetUpdate,
      },
    }]);
    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);

    const result = await moveChartToDashboard({
      team_id: 7,
      chart_id: 55,
      target_project_id: 13,
    });

    expect(db.Chart.update).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 13,
    }), { where: { id: 55 } });
    expect(datasetUpdate).toHaveBeenCalledWith({ project_ids: [13] });
    expect(result).toMatchObject({
      chart_id: 55,
      previous_project_id: 77,
      new_project_id: 13,
      dashboard_url: expect.stringContaining("/dashboard/13"),
    });
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
