import assert from "node:assert/strict";
import test from "node:test";
import grid from "react-grid-layout/build/utils.js";
import React from "react";
import gridLayout from "react-grid-layout/build/ReactGridLayout.js";
import responsiveGrid from "react-grid-layout/build/ResponsiveReactGridLayout.js";
import { breakpoints, cols, getAvailableChartLayout, getBreakpoint, getLayouts, validateLayout, widths } from "../../../shared/dashboard/layout.mjs";

import { getLayoutPreviewGeometry, reserveChartLayout } from "./autoLayout.js";

test("dashboard and report keep the window layout when their sidebars have different widths", () => {
  const charts = [
    { id: "first", type: "kpi" },
    { id: "second", type: "line" },
    { id: "third", type: "table" },
  ];
  const layouts = getLayouts(charts);
  const children = charts.map(({ id }) => React.createElement("div", { key: id }));
  for (const windowWidth of [390, 1024, 1440, 1640, 1728, 2560, 4000]) {
    const breakpoint = getBreakpoint(windowWidth);
    for (const width of [windowWidth, windowWidth - 64, Math.max(240, windowWidth - 360)]) {
      const props = {
        ...gridLayout.default.defaultProps,
        width, cols: cols[breakpoint], layout: layouts[breakpoint], children, compactType: null,
      };
      const dashboard = new gridLayout.default(props);
      const positions = (items) => items.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
      assert.deepEqual(positions(dashboard.state.layout), positions(layouts[breakpoint]));
    }
  }
});

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

test("replaces concurrent creators in place in any completion order on every screen size", () => {
  const first = { id: "creator-1", layout: reserveChartLayout([]) };
  const second = { id: "creator-2", layout: reserveChartLayout([first]) };
  const third = { id: "creator-3", layout: reserveChartLayout([first, second]) };
  const before = getLayouts([first, second, third]);
  for (const order of [[first, second, third], [third, second, first], [second, first, third]]) {
    const saved = [];
    for (const creator of order) {
      const layout = getAvailableChartLayout(creator.layout, saved);
      assert.deepEqual(layout, creator.layout);
      saved.push({ id: `saved-${creator.id}`, layout });
      const remaining = [first, second, third].filter((item) => !saved.some((chart) => chart.id === `saved-${item.id}`));
      const layouts = getLayouts([...saved, ...remaining]);
      for (const bp of breakpoints) {
        validateLayout(layouts[bp], bp);
        const children = [...saved, ...remaining].map(({ id }) => React.createElement("div", { key: id }));
        const rendered = grid.synchronizeLayoutWithChildren(layouts[bp], children, cols[bp], null);
        for (const item of rendered) {
          const original = before[bp].find((entry) => entry.i === item.i.replace("saved-", ""));
          assert.deepEqual([item.x, item.y, item.w, item.h], [original.x, original.y, original.w, original.h]);
        }
      }
    }
  }
  assert.deepEqual(getLayouts([third]).lg[0], before.lg[2]);
});

test("reserves space beside the last widget only when it does not overlap taller widgets", () => {
  const charts = [
    { id: "tall", layout: { lg: [6, 0, 6, 6] } },
    { id: "short", layout: { lg: [0, 2, 6, 2] } },
  ];
  assert.deepEqual(reserveChartLayout(charts).lg, [0, 6, 6, 2]);
});

test("rejects invalid chart positions and falls back when another chart has taken the space", () => {
  const layout = reserveChartLayout([]);
  assert.equal(getAvailableChartLayout(layout, [{ id: "existing", layout }]), null);
  for (const rect of [null, [0, 0, 6], [-1, 0, 6, 2], [0, -1, 6, 2], [0, 0, 99, 2], [0, 0, 6, 0], [0, 0.5, 6, 2]]) {
    assert.throws(() => getAvailableChartLayout({ ...layout, lg: rect }));
  }
  assert.throws(() => getAvailableChartLayout({ lg: layout.lg }));
});
