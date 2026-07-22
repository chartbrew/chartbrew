import { describe, expect, it } from "vitest";

import { mergeDashboardFilters } from "./dashboardFilters";

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
