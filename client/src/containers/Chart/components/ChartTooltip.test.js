import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTooltipBodyLine,
  getTooltipFormulas,
} from "./ChartTooltip.js";

test("formats a tooltip from the chart-level formula fallback", () => {
  const result = formatTooltipBodyLine(
    "Payment volume: 684.5",
    {
      dataset: { label: "Payment volume" },
      datasetIndex: 0,
      formattedValue: "684.5",
    },
    0,
    "${val / 100}",
  );

  assert.deepEqual(result, {
    category: "Payment volume",
    value: "$684.5",
  });
});

test("resolves formulas from canonical visualization layers for cached chart data", () => {
  const chart = {
    chartData: {
      data: {
        datasets: [{ label: "Payment volume" }],
      },
      meta: {
        series: [{ layerId: "payment-volume" }],
      },
    },
    visualization: {
      layers: [{
        id: "payment-volume",
        encoding: {
          value: { formula: "${val / 100}" },
        },
      }],
    },
  };

  assert.deepEqual(getTooltipFormulas(chart), { 0: "${val / 100}" });
});
