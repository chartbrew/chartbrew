import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine.js");

function buildInput(options = {}) {
  return {
    chart: {
      id: 1,
      type: "bar",
      timeInterval: "day",
      displayLegend: true,
      includeZeros: false,
      visualization: {
        version: 2,
        layers: [{
          id: "revenue",
          bindingId: "cdc-1",
          mark: "bar",
          encoding: {
            category: { field: "root[].month", type: "nominal" },
            value: { field: "root[].amount", type: "quantitative", aggregate: "sum" },
          },
        }],
      },
    },
    datasets: [{
      options: {
        id: "cdc-1",
        fieldsSchema: {
          "root[].amount": "number",
          "root[].month": "string",
          "root[].status": "string",
        },
        legend: "Revenue",
        ...options,
      },
      data: [
        { month: "Jan", amount: 100, status: "paid" },
        { month: "Feb", amount: 200, status: "pending" },
      ],
    }],
  };
}

describe("visualization dataset filtering", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies saved CDC conditions before aggregation and returns condition options", () => {
    const input = buildInput({
      conditions: [{
        exposed: true,
        field: "root[].status",
        operator: "is",
        value: "paid",
      }],
    });
    const result = new VisualizationEngine(input).render();

    expect(result.configuration.data.labels).toEqual(["Jan"]);
    expect(result.configuration.data.datasets[0].data).toEqual([100]);
    expect(result.conditionsOptions).toEqual([{
      dataset_id: "cdc-1",
      conditions: [expect.objectContaining({
        field: "root[].status",
        values: ["paid", "pending"],
      })],
    }]);
  });

  it("applies runtime field filters through the shared runtime context", () => {
    const result = new VisualizationEngine(buildInput()).render({
      filters: [{
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "pending",
      }],
    });

    expect(result.configuration.data.labels).toEqual(["Feb"]);
    expect(result.configuration.data.datasets[0].data).toEqual([200]);
  });

  it("resolves mustache-backed CDC conditions from runtime variables", () => {
    const input = buildInput({
      conditions: [{
        field: "root[].status",
        operator: "is",
        value: "{{status}}",
      }],
    });
    const result = new VisualizationEngine(input).render({
      variables: { status: "paid" },
    });

    expect(result.configuration.data.labels).toEqual(["Jan"]);
  });

  it("uses the semantic time field when a CDC date field is missing", () => {
    const input = buildInput({
      fieldsSchema: {
        "root[].amount": "number",
        "root[].createdAt": "date",
      },
    });
    input.chart.startDate = "2026-02-01T00:00:00.000Z";
    input.chart.endDate = "2026-02-28T23:59:59.999Z";
    input.chart.visualization.layers[0].encoding = {
      time: { field: "root[].createdAt", type: "temporal" },
      value: { field: "root[].amount", type: "quantitative", aggregate: "sum" },
    };
    input.datasets[0].data = [{
      createdAt: "2026-01-15T12:00:00.000Z",
      amount: 100,
    }, {
      createdAt: "2026-02-15T12:00:00.000Z",
      amount: 200,
    }];

    const engine = new VisualizationEngine(input);
    const frameResult = engine.buildFrame();
    const result = engine.render();

    expect(frameResult.datasets[0].options.dateField).toBe("root[].createdAt");
    expect(result.configuration.data.datasets[0].data).toEqual([200]);
  });

  it("falls back to a sampled date field for categorical charts", () => {
    const input = buildInput({
      fieldsSchema: {
        "root[].amount": "number",
        "root[].createdAt": "date",
        "root[].month": "string",
      },
    });
    input.chart.startDate = "2026-02-01T00:00:00.000Z";
    input.chart.endDate = "2026-02-28T23:59:59.999Z";
    input.datasets[0].data = [{
      month: "Jan",
      createdAt: "2026-01-15T12:00:00.000Z",
      amount: 100,
    }, {
      month: "Feb",
      createdAt: "2026-02-15T12:00:00.000Z",
      amount: 200,
    }];

    const engine = new VisualizationEngine(input);
    const frameResult = engine.buildFrame();
    const result = engine.render();

    expect(frameResult.datasets[0].options.dateField).toBe("root[].createdAt");
    expect(result.configuration.data.labels).toEqual(["Feb"]);
  });

  it("filters canonical chart data using the shifted rolling window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T12:00:00.000Z"));

    const input = buildInput({
      dateField: "root[].createdAt",
      fieldsSchema: {
        "root[].amount": "number",
        "root[].createdAt": "date",
      },
    });
    input.chart.startDate = "2026-07-01T00:00:00.000Z";
    input.chart.endDate = "2026-07-03T23:59:59.999Z";
    input.chart.currentEndDate = true;
    input.chart.fixedStartDate = false;
    input.chart.visualization.layers[0].encoding = {
      time: { field: "root[].createdAt", type: "temporal" },
      value: { field: "root[].amount", type: "quantitative", aggregate: "sum" },
    };
    input.datasets[0].data = [{
      createdAt: "2026-07-20T12:00:00.000Z",
      amount: 100,
    }, {
      createdAt: "2026-07-21T12:00:00.000Z",
      amount: 200,
    }, {
      createdAt: "2026-07-23T12:00:00.000Z",
      amount: 300,
    }];

    const result = new VisualizationEngine(input).render();

    expect(result.configuration.data.datasets[0].data).toEqual([200, 300]);
  });
});
