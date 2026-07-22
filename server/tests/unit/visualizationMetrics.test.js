import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildChartMetrics } = require("../../visualization/metrics.js");

describe("visualization chart metrics", () => {
  it("builds growth and goal metadata from compiled series", () => {
    const configuration = {
      data: {
        datasets: [{ label: "Revenue", data: [100, 125] }],
      },
    };

    buildChartMetrics(configuration, [{
      datasetColor: "#112233",
      formula: "${val}",
      goal: 200,
      id: "series-revenue",
      layerId: "revenue",
    }], { invertGrowth: false });

    expect(configuration.growth).toEqual([{
      color: "#112233",
      comparison: 25,
      datasetIndex: 0,
      label: "Revenue",
      layerId: "revenue",
      seriesId: "series-revenue",
      status: "positive",
      value: "$125",
    }]);
    expect(configuration.goals).toEqual([{
      formattedMax: "$200",
      formattedValue: "$125",
      goalIndex: 0,
      layerId: "revenue",
      max: 200,
      seriesId: "series-revenue",
      value: 125,
    }]);
  });

  it("inverts growth semantics when configured", () => {
    const configuration = {
      data: { datasets: [{ label: "Errors", data: [10, 5] }] },
    };

    buildChartMetrics(configuration, [{}], { invertGrowth: true });

    expect(configuration.growth[0]).toMatchObject({
      comparison: 50,
      status: "positive",
    });
  });
});
