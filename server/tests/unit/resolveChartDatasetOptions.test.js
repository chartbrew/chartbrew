import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { resolveChartDatasetOptions, getDatasetName } = require("../../modules/resolveChartDatasetOptions.js");

describe("resolveChartDatasetOptions", () => {
  it("prefers CDC binding fields over legacy dataset fields", () => {
    const options = resolveChartDatasetOptions(
      {
        id: "cdc-1",
        dataset_id: 10,
        xAxis: "root[].created_at",
        yAxis: "root[].revenue",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        legend: "Revenue",
        conditions: [{ field: "root[].status", operator: "is", value: "paid" }],
      },
      {
        id: 10,
        name: "Orders",
        legend: "Legacy Orders",
        xAxis: "root[].day",
        yAxis: "root[].count",
        yAxisOperation: "count",
        dateField: "root[].day",
        conditions: [{ field: "root[].status", operator: "is", value: "open" }],
      }
    );

    expect(options.id).toBe("cdc-1");
    expect(options.cdc_id).toBe("cdc-1");
    expect(options.dataset_id).toBe(10);
    expect(options.name).toBe("Orders");
    expect(options.legend).toBe("Revenue");
    expect(options.xAxis).toBe("root[].created_at");
    expect(options.yAxis).toBe("root[].revenue");
    expect(options.yAxisOperation).toBe("sum");
    expect(options.conditions).toEqual([{ field: "root[].status", operator: "is", value: "paid" }]);
  });

  it("uses dataset name fallback when CDC legend is absent", () => {
    const options = resolveChartDatasetOptions(
      {
        id: "cdc-2",
        dataset_id: 11,
      },
      {
        id: 11,
        legend: "Legacy Dataset Name",
      }
    );

    expect(options.name).toBe("Legacy Dataset Name");
    expect(options.legend).toBe("Legacy Dataset Name");
  });

  it("treats empty arrays and empty strings on CDC as explicit overrides", () => {
    const options = resolveChartDatasetOptions(
      {
        id: "cdc-3",
        dataset_id: 12,
        legend: "",
        conditions: [],
      },
      {
        id: 12,
        name: "Dataset Name",
        legend: "Legacy Legend",
        conditions: [{ field: "root[].status", operator: "is", value: "paid" }],
      }
    );

    expect(options.legend).toBe("");
    expect(options.conditions).toEqual([]);
  });
});

describe("getDatasetName", () => {
  it("prefers name over legacy legend", () => {
    expect(getDatasetName({ name: "Canonical Name", legend: "Legacy" })).toBe("Canonical Name");
    expect(getDatasetName({ legend: "Legacy" })).toBe("Legacy");
  });
});
