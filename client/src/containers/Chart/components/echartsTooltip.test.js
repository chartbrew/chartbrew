import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDoughnutHoverTitle,
  buildDoughnutValueTitle,
  createEChartsTooltipFormatter,
  formatDoughnutPercent,
  getDoughnutSliceFromChart,
} from "./echartsTooltip.js";

const colors = {
  muted: "#71717a",
  text: "#27272a",
};

test("formats cartesian tooltips with one heading and regular-weight rows", () => {
  const html = createEChartsTooltipFormatter(colors)([{
    axisValueLabel: "Aug 11",
    color: "#4385F5",
    data: ["Aug 11", 8, 8],
    encode: { y: [1] },
    seriesName: "Signups",
    seriesType: "bar",
    value: ["Aug 11", 8, 8],
  }, {
    axisValueLabel: "Aug 11",
    color: "#FF9500",
    data: ["Aug 11", 8, 8],
    encode: { y: [2] },
    seriesName: "Trials",
    seriesType: "bar",
    value: ["Aug 11", 8, 8],
  }]);

  assert.equal((html.match(/Aug 11/g) || []).length, 1);
  assert.match(html, /Signups/);
  assert.match(html, /Trials/);
  assert.match(html, /ui-monospace/);
  assert.doesNotMatch(html, /font-weight:(?:600|700|bold)/);
});

test("formats compact cartesian tooltips as date and value", () => {
  const html = createEChartsTooltipFormatter(colors, { compact: true })({
    axisValueLabel: "Aug 7",
    color: "#4385F5",
    data: ["Aug 7", 146],
    encode: { y: [1] },
    seriesName: "Visits in the last 30 days",
    seriesType: "line",
    value: ["Aug 7", 146],
  });

  assert.match(html, /color:#71717a/);
  assert.match(html, /Aug 7: /);
  assert.match(html, /color:#27272a/);
  assert.match(html, />146</);
  assert.doesNotMatch(html, /Visits in the last 30 days/);
  assert.doesNotMatch(html, /min-width/);
});

test("formats compact multi-series tooltips without series names", () => {
  const html = createEChartsTooltipFormatter(colors, { compact: true })([{
    axisValueLabel: "Aug 7",
    color: "#4385F5",
    data: ["Aug 7", 146, 20],
    encode: { y: [1] },
    seriesName: "Visits in the last 30 days",
    seriesType: "line",
    value: ["Aug 7", 146, 20],
  }, {
    axisValueLabel: "Aug 7",
    color: "#FF9500",
    data: ["Aug 7", 146, 20],
    encode: { y: [2] },
    seriesName: "Tools visits",
    seriesType: "line",
    value: ["Aug 7", 146, 20],
  }]);

  assert.match(html, /Aug 7: /);
  assert.match(html, />146</);
  assert.match(html, />20</);
  assert.doesNotMatch(html, /Visits in the last 30 days/);
  assert.doesNotMatch(html, /Tools visits/);
});

test("formats matrix tooltips without repeating the date", () => {
  const html = createEChartsTooltipFormatter(colors)({
    color: "#F17041",
    data: { date: "May 6, 2024", value: 1 },
    name: "May 6, 2024",
    seriesName: "User signups",
    seriesType: "heatmap",
  });

  assert.equal((html.match(/May 6, 2024/g) || []).length, 1);
  assert.match(html, /User signups/);
  assert.match(html, />1</);
});

test("reads doughnut slices from dataset rows or hover params", () => {
  const instance = {
    getOption: () => ({
      dataset: [{
        source: [
          { category: "api", value: 412 },
          { category: "web", value: 239 },
        ],
      }],
    }),
  };

  assert.deepEqual(
    getDoughnutSliceFromChart(instance, { dataIndex: 0 }),
    { name: "api", percent: 412 / 651 * 100, value: 412 }
  );
  assert.deepEqual(
    getDoughnutSliceFromChart(instance, { data: { category: "web", value: 239 }, name: "web" }),
    { name: "web", percent: 239 / 651 * 100, value: 239 }
  );
});

test("formats doughnut hover titles as label, value, then percentage", () => {
  assert.equal(
    buildDoughnutHoverTitle({ name: "api", percent: 63.28, value: 412 }),
    "{label|api}\n{value|412}\n{percent|63.3%}"
  );
  assert.equal(buildDoughnutValueTitle(651), "{value|651}");
  assert.equal(formatDoughnutPercent(12), "12%");
  assert.equal(formatDoughnutPercent(12.04), "12%");
  assert.equal(formatDoughnutPercent(12.25), "12.3%");
});

test("formats tight doughnut tooltips as the segment name only", () => {
  const html = createEChartsTooltipFormatter(colors, { doughnutNameOnly: true })({
    name: "api",
    seriesName: "Connections",
    seriesType: "pie",
    value: 412,
  });

  assert.equal((html.match(/api/g) || []).length, 1);
  assert.doesNotMatch(html, /Connections/);
  assert.doesNotMatch(html, /412/);
  assert.doesNotMatch(html, /min-width/);
});

test("formats gauge range tooltips as one compact label", () => {
  const html = createEChartsTooltipFormatter(colors)({
    name: "Action required",
    seriesId: "series-1-ranges",
    seriesType: "pie",
  });

  assert.equal((html.match(/Action required/g) || []).length, 1);
  assert.doesNotMatch(html, /min-width/);
});
