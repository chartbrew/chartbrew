import assert from "node:assert/strict";
import test from "node:test";
import grid from "react-grid-layout/build/utils.js";
import React from "react";
import gridLayout from "react-grid-layout/build/ReactGridLayout.js";
import responsiveGrid from "react-grid-layout/build/ResponsiveReactGridLayout.js";
import { cols, getBreakpoint, widths } from "../../../shared/dashboard/layout.mjs";

import { getLayoutPreviewGeometry } from "./autoLayout.js";

test("sets the current screen size even when the grid does not cross a breakpoint", () => {
  let breakpoint = null;
  let breakpointChanges = 0;
  const props = {
    ...responsiveGrid.default.defaultProps,
    width: 1400, breakpoints: widths, cols, layouts: {}, children: [],
    onBreakpointChange: () => { breakpointChanges += 1; },
    onWidthChange: (width) => { breakpoint = getBreakpoint(width); },
  };
  const responsive = new responsiveGrid.default(props);
  responsive.onWidthChange(props);
  assert.equal(breakpointChanges, 0);
  assert.equal(breakpoint, "lg");
});

test("resizing keeps the grid mode unchanged so it does not restore the previous dimensions", () => {
  const layout = [{ i: "first", x: 0, y: 0, w: 4, h: 2 }];
  const children = [React.createElement("div", { key: "first" })];
  const props = { layout, children, cols: 12, compactType: null };
  const state = {
    propsLayout: layout, children, compactType: null, activeDrag: null,
    layout: [{ ...layout[0], w: 6, h: 3 }],
  };
  assert.equal(gridLayout.default.getDerivedStateFromProps(props, state), null);
  const reset = gridLayout.default.getDerivedStateFromProps({ ...props, compactType: "vertical" }, state);
  assert.equal(reset.layout[0].w, 4);
  assert.equal(reset.layout[0].h, 2);
});

test("fits wide previews, scales their height, and leaves smaller previews at actual size", () => {
  for (const width of [1201, 1601, 2561, 3841]) {
    const { scale, height } = getLayoutPreviewGeometry(976, width, 1800);
    assert.equal(width * scale, 976);
    assert.equal(height, 1800 * scale);
  }
  assert.deepEqual(getLayoutPreviewGeometry(976, 481, 1800), { scale: 1, height: 1800 });
  assert.deepEqual(getLayoutPreviewGeometry(976, 976, 1800), { scale: 1, height: 1800 });
  assert.deepEqual(getLayoutPreviewGeometry(0, 3841, 1800), { scale: 1, height: 1800 });
});

test("vertical compaction swaps charts during a drag instead of pushing the remaining charts down", () => {
  let layout = ["first", "second", "third"].map((i, index) => ({
    i, x: 0, y: index * 2, w: 6, h: 2,
  }));
  for (const y of [1, 2, 3]) {
    layout = grid.compact(grid.moveElement(
      layout, layout.find((item) => item.i === "first"), 0, y, true, false, "vertical", 12
    ), "vertical", 12);
  }
  assert.deepEqual(layout.map(({ i, y }) => [i, y]), [["first", 2], ["second", 0], ["third", 4]]);

  layout = grid.compact(grid.moveElement(
    layout, layout.find((item) => item.i === "first"), 0, 0, true, false, "vertical", 12
  ), "vertical", 12);
  assert.deepEqual(layout.map(({ i, y }) => [i, y]), [["first", 0], ["second", 2], ["third", 4]]);
});
