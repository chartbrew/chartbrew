import { describe, expect, it } from "vitest";

describe("client chartRuntimeFilters helper", () => {
  it("builds a stable runtime payload from dashboard and chart-local filters", async () => {
    const { buildChartRuntimeRequest } = await import("../../../client/src/modules/chartRuntimeFilters.js");

    const runtimeRequest = buildChartRuntimeRequest({
      chart: { id: 42 },
      dashboardFilters: [{
        type: "variable",
        variable: "date_start",
        value: "2026-01-01",
      }, {
        type: "variable",
        variable: "date_end",
        value: "2026-01-31",
      }, {
        type: "field",
        field: "root[].team",
        operator: "is",
        value: "growth",
      }, {
        type: "date",
        startDate: "2026-01-05",
        endDate: "2026-01-20",
        charts: [42],
      }],
      chartFilters: [{
        id: "condition-1",
        type: "field",
        field: "root[].type",
        operator: "is",
        value: "api",
        exposed: true,
        cdcId: "cdc-1",
      }],
    });

    expect(runtimeRequest.variables).toEqual({
      date_end: "2026-01-31",
      date_start: "2026-01-01",
    });
    expect(runtimeRequest.filters).toHaveLength(3);
    expect(runtimeRequest.filters).toContainEqual({
      type: "field",
      field: "root[].team",
      operator: "is",
      value: "growth",
      origin: "dashboard",
      scope: "chart",
      clientOnly: false,
    });
    expect(runtimeRequest.filters).toContainEqual({
      type: "field",
      field: "root[].type",
      operator: "is",
      value: "api",
      exposed: true,
      cdcId: "cdc-1",
      origin: "chart",
      scope: "cdc",
      clientOnly: false,
    });
    expect(runtimeRequest.filters).toContainEqual({
      type: "date",
      startDate: "2026-01-05",
      endDate: "2026-01-20",
      origin: "dashboard",
      scope: "chart",
      clientOnly: false,
    });
    expect(runtimeRequest.needsSourceRefresh).toBe(true);
    expect(runtimeRequest.hasRuntimeFilters).toBe(true);
    expect(runtimeRequest.sourceAffecting.filters).toHaveLength(1);
    expect(runtimeRequest.serverParseAffecting.filters).toHaveLength(2);
  });

  it("drops cleared dashboard variables but preserves empty-state hashes", async () => {
    const { buildChartRuntimeRequest } = await import("../../../client/src/modules/chartRuntimeFilters.js");

    const runtimeRequest = buildChartRuntimeRequest({
      chart: { id: 7 },
      dashboardFilters: [{
        type: "variable",
        variable: "date_start",
        value: "",
      }],
      chartFilters: [],
    });

    expect(runtimeRequest.variables).toEqual({});
    expect(runtimeRequest.filters).toEqual([]);
    expect(runtimeRequest.hasRuntimeFilters).toBe(false);
    expect(runtimeRequest.filterHash).toBe(JSON.stringify({
      filters: [],
      variables: {},
    }));
  });

  it("resolves the displayed rolling date window from the configured anchors", async () => {
    const {
      resolveChartConfiguredDateRange,
    } = await import("../../../client/src/modules/chartRuntimeFilters.js");

    const range = resolveChartConfiguredDateRange({
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-30T23:59:59.999Z",
      currentEndDate: true,
      fixedStartDate: false,
      timeInterval: "day",
    }, new Date("2026-07-23T12:00:00.000Z"));

    expect(range.startDate).toBe("2026-06-24T00:00:00.000Z");
    expect(range.endDate).toBe("2026-07-23T23:59:59.999Z");
  });
});
