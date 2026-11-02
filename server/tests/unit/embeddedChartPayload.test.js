import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const getEmbeddedChartData = require("../../modules/getEmbeddedChartData");

describe("embedded chart payload", () => {
  it("keeps observation processing data out of public chart responses", () => {
    const payload = getEmbeddedChartData({
      ChartDatasetConfigs: [],
      chartData: { data: { datasets: [], labels: [] } },
      frame: {
        layers: [{
          rows: [{ customer_email: "maya@example.com", revenue: 42 }],
        }],
      },
      id: 12,
      name: "Revenue",
      observation: {
        score: 0.98,
      },
      project_id: 4,
      render: {
        configuration: { series: [] },
        renderer: "echarts",
      },
      type: "line",
      visualization: { layers: [] },
    });

    expect(payload.id).toBe(12);
    expect(payload.render).toEqual({
      configuration: { series: [] },
      renderer: "echarts",
    });
    expect(payload).not.toHaveProperty("chartData");
    expect(payload).not.toHaveProperty("frame");
    expect(payload).not.toHaveProperty("observation");
  });
});
