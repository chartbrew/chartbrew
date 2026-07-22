import { describe, expect, it } from "vitest";

import { buildChartRuntimeRequest } from "./chartRuntimeFilters";

describe("buildChartRuntimeRequest", () => {
  it("keeps runtime payloads stable when dashboard filters are reordered", () => {
    const chart = { id: 42 };
    const filters = [{
      id: "status-filter",
      type: "field",
      field: "root[].status",
      operator: "is",
      value: "paid",
    }, {
      id: "country-filter",
      type: "field",
      field: "root[].country",
      operator: "is",
      value: "GB",
    }];

    const original = buildChartRuntimeRequest({ chart, dashboardFilters: filters });
    const reordered = buildChartRuntimeRequest({ chart, dashboardFilters: [...filters].reverse() });

    expect(reordered.filterHash).toBe(original.filterHash);
    expect(reordered.cacheableChartPayload).toEqual(original.cacheableChartPayload);
  });
});
