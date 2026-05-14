import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dataExtractor = require("../../charts/DataExtractor");

describe("DataExtractor", () => {
  it("uses the root array when table bindings omit xAxis", () => {
    const result = dataExtractor({
      chart: {
        id: 1,
        type: "table",
        ChartDatasetConfigs: [],
      },
      datasets: [{
        options: {
          id: 10,
          legend: "Insights",
          conditions: [],
        },
        data: [{
          id: 1,
          name: "Signup funnel",
        }, {
          id: 2,
          name: "Activation",
        }],
      }],
    }, [], "UTC");

    expect(result.configuration.Insights).toEqual([{
      id: 1,
      name: "Signup funnel",
    }, {
      id: 2,
      name: "Activation",
    }]);
  });
});
