import { describe, expect, it } from "vitest";

import {
  mergeDashboardFilters,
  resolveDateFilterChartSelection,
  serializeDateFilterChartSelection,
} from "./dashboardFilters";

describe("mergeDashboardFilters", () => {
  it("uses shared order while preserving local values and appending personal filters", () => {
    const sharedFilters = [{
      id: "shared-2",
      configuration: { type: "variable", variable: "country", value: "US" },
      onReport: true,
    }, {
      id: "shared-1",
      configuration: { type: "variable", variable: "currency", value: "usd" },
      onReport: false,
    }];
    const localFilters = [{
      id: "shared-1",
      type: "variable",
      variable: "currency",
      value: "gbp",
      onReport: false,
    }, {
      id: "personal-1",
      type: "field",
      field: "root[].status",
      value: "paid",
    }, {
      id: "shared-2",
      type: "variable",
      variable: "country",
      value: "GB",
      onReport: true,
    }];

    expect(mergeDashboardFilters(sharedFilters, localFilters)).toEqual([
      expect.objectContaining({ id: "shared-2", value: "GB" }),
      expect.objectContaining({ id: "shared-1", value: "gbp" }),
      expect.objectContaining({ id: "personal-1", value: "paid" }),
    ]);
  });

  it("drops removed shared filters instead of turning them into personal filters", () => {
    expect(mergeDashboardFilters([], [{
      id: "removed-shared",
      type: "variable",
      variable: "currency",
      value: "gbp",
      onReport: false,
    }])).toEqual([]);
  });
});

describe("date filter chart selection", () => {
  it("shows all eligible charts as selected for the all-charts sentinel", () => {
    expect(resolveDateFilterChartSelection([1, 2, 3], [])).toEqual([1, 2, 3]);
  });

  it("keeps a configured chart subset and drops unavailable charts", () => {
    expect(resolveDateFilterChartSelection([1, 2, 3], [2, 4])).toEqual([2]);
  });

  it("serializes a full selection as the dynamic all-charts sentinel", () => {
    expect(serializeDateFilterChartSelection([1, 2, 3], [3, 1, 2])).toEqual([]);
    expect(serializeDateFilterChartSelection([1, 2, 3], [1, 3])).toEqual([1, 3]);
  });
});
