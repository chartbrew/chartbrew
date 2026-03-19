import { describe, expect, it } from "vitest";

const {
  buildChartFilterRequest,
  mergeChartFilters,
  removeChartCondition,
  shouldRunFilterRequest,
  upsertChartCondition,
} = await import(new URL("../../../client/src/modules/chartFilterRuntime.js", import.meta.url));

describe("chartFilterRuntime", () => {
  it("upserts inline chart conditions by id", () => {
    const nextConditions = upsertChartCondition([
      { id: "region", value: "emea" },
      { id: "status", value: "paid" },
    ], { id: "region", value: "apac" });

    expect(nextConditions).toEqual([
      { id: "region", value: "apac" },
      { id: "status", value: "paid" },
    ]);
  });

  it("removes inline chart conditions by id", () => {
    expect(removeChartCondition([
      { id: "region", value: "emea" },
      { id: "status", value: "paid" },
    ], { id: "region" })).toEqual([
      { id: "status", value: "paid" },
    ]);
  });

  it("merges dashboard filters with inline chart filters using inline precedence", () => {
    expect(mergeChartFilters([
      { id: "region", type: "field", value: "emea" },
      {
        id: "team", type: "variable", variable: "team", value: "sales"
      },
    ], [
      { id: "region", type: "field", value: "apac" },
    ])).toEqual([
      {
        id: "team", type: "variable", variable: "team", value: "sales"
      },
      { id: "region", type: "field", value: "apac" },
    ]);
  });

  it("builds chart filter requests with chart-scoped date filters and falsey variables", () => {
    const result = buildChartFilterRequest({
      storedFilters: [
        {
          id: "date_filter",
          type: "date",
          startDate: "2026-03-01T00:00:00Z",
          endDate: "2026-03-10T23:59:59Z",
          charts: [10],
        },
        {
          id: "include_zeroes",
          type: "variable",
          variable: "include_zeroes",
          value: false,
        },
        {
          id: "page",
          type: "variable",
          variable: "page",
          value: 0,
        },
      ],
      inlineFilters: [
        {
          id: "status",
          type: "field",
          field: "root[].status",
          operator: "is",
          value: "paid",
        },
      ],
      chartId: 10,
    });

    expect(result.applicableFilters).toEqual([
      {
        id: "date_filter",
        type: "date",
        startDate: "2026-03-01T00:00:00Z",
        endDate: "2026-03-10T23:59:59Z",
        charts: [10],
      },
      {
        id: "status",
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "paid",
      },
    ]);
    expect(result.variables).toEqual({
      include_zeroes: false,
      page: 0,
    });
  });

  it("falls back to dashboard variables when inline chart filters are cleared", () => {
    const result = buildChartFilterRequest({
      storedFilters: [
        {
          id: "region_variable",
          type: "variable",
          variable: "region",
          value: "emea",
        },
      ],
      inlineFilters: [],
      chartId: 10,
    });

    expect(result.applicableFilters).toEqual([]);
    expect(result.variables).toEqual({
      region: "emea",
    });
    expect(shouldRunFilterRequest({
      filters: result.applicableFilters,
      variables: result.variables,
    })).toBe(true);
  });

  it("returns false only when no filters or variables remain", () => {
    expect(shouldRunFilterRequest({
      filters: [],
      variables: {},
    })).toBe(false);
  });
});
