import assert from "node:assert/strict";
import test from "node:test";

import {
  didAiUpdateActiveChart,
  getChartStudioPreviewState,
  normalizeChartTables,
} from "./chartStudioState.js";

test("uses tabs below 1600px and restores the selected view", () => {
  assert.deepEqual(getChartStudioPreviewState(1599, "data"), {
    mode: "compact",
    settingsPlacement: "bottom",
    showChart: false,
    showData: true,
    showTabs: true,
  });
  assert.deepEqual(getChartStudioPreviewState(1600, "data"), {
    mode: "wide",
    settingsPlacement: "right",
    showChart: true,
    showData: true,
    showTabs: false,
  });
  assert.equal(getChartStudioPreviewState(1599, "data").showData, true);
  assert.equal(getChartStudioPreviewState(900, "chart").mode, "mobile");
});

test("normalizes shown and native table output without changing values or input", () => {
  const shownRows = [{ Category: "Jan", Revenue: 0, Active: false, Note: "", Missing: null }];
  const input = Object.freeze({
    Revenue: Object.freeze(shownRows),
    Native: Object.freeze({
      columns: Object.freeze([
        Object.freeze({ Header: "Name", accessor: "name" }),
        Object.freeze({
          Header: "Details",
          columns: Object.freeze([Object.freeze({ Header: "Count", accessor: "details?count" })]),
        }),
      ]),
      data: Object.freeze([Object.freeze({ name: "Alpha", "details?count": 2 })]),
    }),
  });

  const normalized = normalizeChartTables(input);
  assert.deepEqual(normalized.tables.map((table) => table.name), ["Revenue", "Native"]);
  assert.deepEqual(normalized.tables[0].columns.map((column) => column.key), [
    "Category", "Revenue", "Active", "Note", "Missing",
  ]);
  assert.equal(normalized.tables[0].rows[0].Revenue, 0);
  assert.equal(normalized.tables[0].rows[0].Active, false);
  assert.equal(normalized.tables[0].rows[0].Note, "");
  assert.equal(normalized.tables[0].rows[0].Missing, null);
  assert.deepEqual(normalized.tables[1].columns, [
    { key: "name", label: "Name" },
    { key: "details?count", label: "Count" },
  ]);
  assert.equal(input.Revenue, shownRows);
});

test("distinguishes unavailable output from an available empty result", () => {
  assert.deepEqual(normalizeChartTables(undefined), { available: false, tables: [] });
  assert.deepEqual(normalizeChartTables({ Empty: [] }), {
    available: true,
    tables: [{ columns: [], name: "Empty", rows: [] }],
  });
});

test("refreshes only after a completed update for the active chart", () => {
  const orchestration = {
    chartPreviews: [{ chartId: 42 }],
    workSummary: [{ name: "update_chart", status: "complete" }],
  };
  assert.equal(didAiUpdateActiveChart(orchestration, 42), true);
  assert.equal(didAiUpdateActiveChart(orchestration, 43), false);
  assert.equal(didAiUpdateActiveChart({ workSummary: [] }, 42), false);
});
