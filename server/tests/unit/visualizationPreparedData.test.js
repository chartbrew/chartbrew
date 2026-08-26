import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine.js");
const {
  getPreparedDataFingerprint,
  serializePreparedData,
  toPublicPreparedData,
} = require("../../visualization/preparedData.js");
const { createSeriesId } = require("../../visualization/seriesIdentity.js");

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/visualization/${name}`, import.meta.url), "utf8"));
}

function buildEngine({
  chart = {},
  datasets,
  encoding,
  layer = {},
  mark = "bar",
  timezone = "UTC",
}) {
  return new VisualizationEngine({
    chart: {
      displayLegend: true,
      id: 42,
      mode: "chart",
      name: "Golden chart",
      timeInterval: "day",
      type: mark,
      ...chart,
      visualization: chart.visualization || {
        version: 2,
        layers: [{
          bindingId: mark === "markdown" ? null : "main",
          encoding: encoding || {},
          id: "golden-layer",
          mark,
          ...layer,
        }],
        settings: {},
      },
    },
    datasets: datasets || [{
      data: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      options: { id: "main" },
    }],
    timezone,
  });
}

function buildCurrentMarkEngine(mark) {
  if (["bar", "horizontalBar", "line", "pie", "doughnut", "radar", "polar"].includes(mark)) {
    return buildEngine({
      encoding: {
        category: { field: "root[].category", type: "nominal" },
        value: { aggregate: "sum", field: "root[].value", type: "quantitative" },
      },
      mark,
    });
  }
  if (["kpi", "avg", "gauge"].includes(mark)) {
    return buildEngine({
      encoding: {
        value: {
          aggregate: mark === "avg" ? "avg" : "sum",
          field: "root[].value",
          type: "quantitative",
        },
      },
      mark,
    });
  }
  if (mark === "matrix") {
    return buildEngine({
      datasets: [{
        data: [{ time: "2024-01-01", value: 10 }, { time: "2024-01-02", value: 20 }],
        options: { id: "main" },
      }],
      encoding: {
        time: { field: "root[].time", timeUnit: "day", type: "temporal" },
        value: { aggregate: "sum", field: "root[].value", type: "quantitative" },
      },
      mark,
    });
  }
  if (mark === "table") {
    return buildEngine({
      datasets: [{
        data: { payload: { rows: [{ name: "A", value: 10 }, { name: "B", value: 20 }] } },
        options: { id: "main" },
      }],
      layer: { name: "Rows", rowPath: "root.payload.rows[]" },
      mark,
    });
  }
  return buildEngine({
    chart: {
      content: "# Prepared markdown",
      visualization: {
        version: 2,
        layers: [{
          bindingId: null,
          content: "# Prepared markdown",
          encoding: {},
          id: "golden-layer",
          mark: "markdown",
        }],
      },
    },
    datasets: [],
    mark: "markdown",
  });
}

function getGoldenOutput(mark, result) {
  if (mark === "table") {
    return {
      preparedRows: result.preparedData.results[0].rows,
      renderedRows: result.configuration.Rows.data,
    };
  }
  if (mark === "markdown") {
    return {
      content: result.configuration.content,
      preparedRows: result.preparedData.results[0].rows,
    };
  }
  if (mark === "matrix") {
    return {
      preparedRows: result.preparedData.results[0].rows.map((row) => {
        return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "seriesId"));
      }),
      renderedPoints: result.configuration.data.datasets[0].data,
    };
  }
  return {
    labels: result.configuration.data.labels,
    preparedRows: result.preparedData.results[0].rows.map((row) => {
      return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "seriesId"));
    }),
    values: result.configuration.data.datasets.map((dataset) => dataset.data),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PreparedData v1", () => {
  it("serializes the same semantic data to the same bytes except for generatedAt", () => {
    const engine = buildEngine({
      datasets: [{
        data: [{ segment: "Pro", month: "Jan", value: 12 }, {
          value: 8,
          month: "Feb",
          segment: "Pro",
        }],
        options: { id: "main" },
      }],
      encoding: {
        category: { field: "root[].month", type: "nominal" },
        breakdown: { field: "root[].segment", type: "nominal" },
        value: { aggregate: "sum", field: "root[].value", type: "quantitative" },
      },
    });
    const first = engine.prepare({ generatedAt: "2026-08-19T01:00:00.000Z" }).preparedData;
    const second = engine.prepare({ generatedAt: "2026-08-19T02:00:00.000Z" }).preparedData;

    expect(serializePreparedData(first)).not.toBe(serializePreparedData(second));
    expect(serializePreparedData(first, { includeGeneratedAt: false }))
      .toBe(serializePreparedData(second, { includeGeneratedAt: false }));
    expect(getPreparedDataFingerprint(first)).toBe(getPreparedDataFingerprint(second));
  });

  it("publishes JSON-safe rows and removes internal binding and source metadata", () => {
    const preparedData = buildEngine({
      datasets: [{
        data: [{ time: "2026-01-01T00:30:00.000Z", value: Number.POSITIVE_INFINITY }],
        options: { id: "main", query: "private" },
      }],
      encoding: {
        time: { field: "root[].time", timeUnit: "day", type: "temporal" },
        value: { aggregate: "sum", field: "root[].value", type: "quantitative" },
      },
      mark: "line",
      timezone: "Asia/Bangkok",
    }).prepare({ generatedAt: "2026-08-19T00:00:00.000Z" }).preparedData;
    const publicData = toPublicPreparedData(preparedData);
    const serialized = serializePreparedData(preparedData);

    expect(publicData.results[0].rows[0].time).toBe("2025-12-31T17:00:00.000Z");
    expect(publicData.results[0].rows[0].value).toBe(null);
    expect(serialized).not.toContain("bindingId");
    expect(serialized).not.toContain("sourceOptions");
    expect(serialized).not.toContain("__seriesId");
    expect(serialized).not.toContain("private");
  });

  it("keeps typed series identities stable when source rows move", () => {
    const data = readFixture("exam-income-long.json");
    const options = {
      datasets: [{ data, options: { id: "main" } }],
      encoding: {
        category: { field: "root.rows[].program", type: "nominal" },
        breakdown: { field: "root.rows[].level", nullPolicy: "label", type: "nominal" },
        value: { aggregate: "sum", field: "root.rows[].revenue", type: "quantitative" },
      },
    };
    const normal = buildEngine(options).prepare().preparedData.results[0];
    const reversed = buildEngine({
      ...options,
      datasets: [{ data: { rows: [...data.rows].reverse() }, options: { id: "main" } }],
    }).prepare().preparedData.results[0];
    const idsByLabel = (result) => Object.fromEntries(result.series.map((series) => {
      return [series.label, series.id];
    }));

    expect(idsByLabel(normal)).toEqual(idsByLabel(reversed));
    expect(createSeriesId("golden-layer", 1)).not.toBe(createSeriesId("golden-layer", "1"));
  });

  it("locks the v1 typed and hashed series identity algorithm", () => {
    expect(createSeriesId("revenue", "Pro")).toBe("series-ec3bc4d7d9f66b02");
    expect(createSeriesId("revenue", "__default__")).toBe("series-d38db6b0b58ec777");
    expect(createSeriesId("revenue", { a: 1, b: 2 }))
      .toBe(createSeriesId("revenue", { b: 2, a: 1 }));
  });

  it("prepares long, wide, nested, scalar, sparse, and multiple-binding fixtures", () => {
    const longData = readFixture("exam-income-long.json");
    const long = buildEngine({
      datasets: [{ data: longData, options: { id: "main" } }],
      encoding: {
        category: { field: "root.rows[].program", type: "nominal" },
        breakdown: { field: "root.rows[].level", nullPolicy: "label", type: "nominal" },
        value: { aggregate: "sum", field: "root.rows[].revenue", type: "quantitative" },
      },
      layer: {
        transforms: [{
          field: "root.rows[].currency",
          operator: "equals",
          type: "filter",
          value: "nzd",
        }],
      },
    }).prepare().preparedData;
    const wideData = readFixture("wide-metrics.json");
    const wide = new VisualizationEngine({
      chart: {
        id: 43,
        type: "line",
        visualization: {
          version: 2,
          layers: ["revenue", "cost"].map((field) => ({
            bindingId: "wide",
            encoding: {
              category: { field: "root[].month", type: "nominal" },
              value: { aggregate: "sum", field: `root[].${field}`, type: "quantitative" },
            },
            id: field,
            mark: "line",
            name: field,
          })),
        },
      },
      datasets: [{ data: wideData, options: { id: "wide" } }],
    }).prepare().preparedData;
    const nested = buildEngine({
      datasets: [{ data: readFixture("nested-orders.json"), options: { id: "main" } }],
      layer: { rowPath: "root.data.items[]" },
      mark: "table",
    }).prepare().preparedData;
    const scalar = buildEngine({
      datasets: [{ data: readFixture("scalar-metric.json"), options: { id: "main" } }],
      encoding: {
        value: { aggregate: "none", field: "root.total", type: "quantitative" },
      },
      mark: "kpi",
    }).prepare().preparedData;
    const sparse = buildEngine({
      datasets: [{ data: readFixture("preaggregated-sparse.json"), options: { id: "main" } }],
      encoding: {
        category: { field: "root[].period", type: "nominal" },
        breakdown: { field: "root[].segment", type: "nominal" },
        value: { aggregate: "sum", field: "root[].total", type: "quantitative" },
      },
    }).prepare().preparedData;
    const bindings = readFixture("multi-binding.json");
    const multiple = new VisualizationEngine({
      chart: {
        id: 44,
        type: "line",
        visualization: {
          version: 2,
          layers: ["actual", "target"].map((bindingId) => ({
            bindingId,
            encoding: {
              category: { field: "root[].month", type: "nominal" },
              value: { aggregate: "sum", field: "root[].value", type: "quantitative" },
            },
            id: bindingId,
            mark: "line",
          })),
        },
      },
      datasets: [{ bindingId: "actual", data: bindings.actual }, {
        bindingId: "target",
        data: bindings.target,
      }],
    }).prepare().preparedData;

    expect(long.results[0].rows).toHaveLength(5);
    expect(wide.results.map((result) => result.id)).toEqual(["revenue", "cost"]);
    expect(nested.results[0].rows).toHaveLength(3);
    expect(scalar.results[0].rows[0].value).toBe(512);
    expect(sparse.results[0].series.map((series) => series.label)).toEqual(["New", "Returning"]);
    expect(multiple.results.map((result) => result.bindingId)).toEqual(["actual", "target"]);
  });

  it("applies filters, variables, timezone, formulas, goals, and breakdowns before projection", () => {
    const engine = buildEngine({
      chart: { includeZeros: false },
      datasets: [{
        data: [{
          amount: 1200,
          date: "2026-01-01T00:30:00.000Z",
          segment: "Pro",
          status: "paid",
        }, {
          amount: 800,
          date: "2026-01-02T00:30:00.000Z",
          segment: "Free",
          status: "pending",
        }],
        options: {
          conditions: [{
            field: "root[].status",
            operator: "is",
            value: "{{status}}",
          }],
          fieldsSchema: {
            "root[].amount": "number",
            "root[].date": "date",
            "root[].segment": "string",
            "root[].status": "string",
          },
          id: "main",
        },
      }],
      encoding: {
        time: { field: "root[].date", timeUnit: "day", type: "temporal" },
        breakdown: { field: "root[].segment", type: "nominal" },
        value: {
          aggregate: "sum",
          field: "root[].amount",
          formula: "${val / 100}",
          type: "quantitative",
        },
      },
      layer: { goal: 20 },
      mark: "line",
      timezone: "Asia/Bangkok",
    });
    const result = engine.render({
      generatedAt: "2026-08-19T00:00:00.000Z",
      variables: { status: "paid" },
    });

    expect(result.preparedData.results[0].rows).toHaveLength(1);
    expect(toPublicPreparedData(result.preparedData).results[0].rows[0].time)
      .toBe("2025-12-31T17:00:00.000Z");
    expect(result.configuration.data.datasets[0].data).toEqual([12]);
    expect(result.configuration.goals).toEqual([]);
  });
});

describe("current chart type goldens through PreparedData", () => {
  const expected = {
    bar: {
      labels: ["A", "B"],
      preparedRows: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      values: [[10, 20]],
    },
    horizontalBar: {
      labels: ["A", "B"],
      preparedRows: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      values: [[10, 20]],
    },
    line: {
      labels: ["A", "B"],
      preparedRows: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      values: [[10, 20]],
    },
    pie: {
      labels: ["A", "B"],
      preparedRows: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      values: [[10, 20]],
    },
    doughnut: {
      labels: ["A", "B"],
      preparedRows: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      values: [[10, 20]],
    },
    radar: {
      labels: ["A", "B"],
      preparedRows: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      values: [[10, 20]],
    },
    polar: {
      labels: ["A", "B"],
      preparedRows: [{ category: "A", value: 10 }, { category: "B", value: 20 }],
      values: [[10, 20]],
    },
    kpi: {
      labels: ["Value"],
      preparedRows: [{ value: 30 }],
      values: [[30]],
    },
    avg: {
      labels: ["Value"],
      preparedRows: [{ value: 15 }],
      values: [[15]],
    },
    gauge: {
      labels: ["Value"],
      preparedRows: [{ value: 30 }],
      values: [[30]],
    },
    matrix: {
      preparedRows: [{ time: 1704067200000, value: 10 }, { time: 1704153600000, value: 20 }],
      renderedPoints: [{ d: "Jan 1", v: 10, x: "2024-01-01", y: "Mon" }, {
        d: "Jan 2",
        v: 20,
        x: "2024-01-02",
        y: "Tue",
      }],
    },
    table: {
      preparedRows: [{ name: "A", value: 10 }, { name: "B", value: 20 }],
      renderedRows: [{ name: "A", value: 10 }, { name: "B", value: 20 }],
    },
    markdown: {
      content: "# Prepared markdown",
      preparedRows: [{ content: "# Prepared markdown" }],
    },
  };

  it.each(Object.keys(expected))("keeps the %s golden output", (mark) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T00:00:00.000Z"));
    const result = buildCurrentMarkEngine(mark).render({
      generatedAt: "2026-08-19T00:00:00.000Z",
    });

    expect(getGoldenOutput(mark, result)).toEqual(expected[mark]);
  });

  it.each(Object.keys(expected))("keeps prepared-only %s data equal to the normal chart path", (mark) => {
    const generatedAt = "2026-08-19T00:00:00.000Z";
    const preparedEngine = buildCurrentMarkEngine(mark);
    const normalEngine = buildCurrentMarkEngine(mark);
    const preparedOnly = preparedEngine.prepare({ generatedAt }).preparedData;
    const normal = normalEngine.render({ generatedAt }).preparedData;

    expect(toPublicPreparedData(preparedOnly)).toEqual(toPublicPreparedData(normal));
    expect(serializePreparedData(preparedOnly)).toBe(serializePreparedData(normal));
  });
});
