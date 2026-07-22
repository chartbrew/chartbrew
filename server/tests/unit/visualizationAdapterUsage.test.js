const {
  getAdapterUsage,
  resetAdapterUsage,
} = require("../../visualization/adapterUsage");
const { resolveVisualization } = require("../../visualization/VisualizationEngine");

describe("visualization adapter usage", () => {
  beforeEach(() => resetAdapterUsage());

  it("counts legacy runtime adaptation by chart without counting canonical specs", () => {
    resolveVisualization({
      id: 12,
      type: "kpi",
      ChartDatasetConfigs: [{ id: 90, yAxis: "root[].amount" }],
    });
    resolveVisualization({
      id: 12,
      type: "kpi",
      ChartDatasetConfigs: [{ id: 90, yAxis: "root[].amount" }],
    });
    resolveVisualization({
      id: 13,
      visualization: {
        version: 2,
        status: "ready",
        layers: [{
          id: "value",
          bindingId: 91,
          mark: "kpi",
          encoding: { value: { field: "root[].amount", type: "quantitative" } },
        }],
      },
    });

    expect(getAdapterUsage()).toEqual({
      chartCount: 1,
      charts: [{ chartId: "12", count: 2 }],
      total: 2,
    });
  });
});
