import assert from "node:assert/strict";
import test from "node:test";

import { getBarDataLabelDisplay } from "./barDataLabels.js";

const createContext = ({
  value = 10,
  width = 40,
  height = 40,
  measuredWidth = 12,
} = {}) => ({
  chart: {
    ctx: {
      font: "",
      measureText: () => ({ width: measuredWidth }),
      restore: () => {},
      save: () => {},
    },
    getDatasetMeta: () => ({
      controller: {
        getParsed: () => ({ y: value }),
      },
      data: [{ height, horizontal: false, width }],
      vScale: { axis: "y" },
    }),
  },
  dataIndex: 0,
  dataset: { data: [value] },
  datasetIndex: 0,
});

test("bar labels hide zero values even when the bar has room", () => {
  assert.equal(getBarDataLabelDisplay(createContext({ value: 0 })), false);
});

test("bar labels hide values that round to zero", () => {
  assert.equal(getBarDataLabelDisplay(createContext({ value: 0.4 })), false);
});

test("bar labels hide when a segment is too short", () => {
  assert.equal(getBarDataLabelDisplay(createContext({ height: 18 })), false);
});

test("bar labels hide when a narrow bar cannot contain the text", () => {
  assert.equal(getBarDataLabelDisplay(createContext({ measuredWidth: 30, width: 35 })), false);
});

test("bar labels render when they fit inside their segment", () => {
  assert.equal(getBarDataLabelDisplay(createContext()), true);
});
