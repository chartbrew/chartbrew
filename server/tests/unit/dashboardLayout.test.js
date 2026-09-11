import { describe, expect, it } from "vitest";
import { appendCharts, arrangeRows, autoArrange, tidyLayout, visualOrder, breakpoints, cols, defaultSize, deriveLayouts, getBreakpoint, getLayouts, getReportOrder, validateLayout, widths } from "../../../shared/dashboard/layout.mjs";
import { createRequire } from "module";

const chart = (id, rect, type = "bar") => ({ id, type, layout: Object.fromEntries(breakpoints.map((bp) => [bp, rect])) });

describe("Dashboard layout rules", () => {
  it("keeps dimensions and order, repairs overlaps, and stays unchanged on repeated Tidy", () => {
    for (const bp of breakpoints) {
      const items = Array.from({ length: 40 }, (_, index) => ({
        i: String(index), x: 0, y: 0, w: 2 + index % (cols[bp] - 1), h: 1 + index % 4,
      }));
      const arranged = tidyLayout(items, bp);
      validateLayout(arranged, bp);
      expect(arranged.map(({ i, w, h }) => ({ i, w, h }))).toEqual(items.map(({ i, w, h }) => ({ i, w, h })));
      expect(tidyLayout(arranged, bp)).toEqual(arranged);
      expect(arranged.every((item) => !["xs", "xxs"].includes(bp) || item.x === 0)).toBe(true);
    }
    expect(() => tidyLayout([{ i: "1", x: 0, y: 0, w: 50, h: 1 }], "lg")).toThrow("Auto-arrange");
  });

  it("closes the gap below short cards without moving their columns or resizing", () => {
    const items = [
      { i: "1", x: 0, y: 0, w: 3, h: 1 },
      { i: "2", x: 3, y: 0, w: 3, h: 1 },
      { i: "3", x: 6, y: 0, w: 6, h: 3 },
      { i: "4", x: 0, y: 3, w: 3, h: 1 },
      { i: "5", x: 3, y: 3, w: 3, h: 1 },
    ];
    const result = tidyLayout(items, "lg");
    expect(result.map(({ x, y, w, h }) => [x, y, w, h])).toEqual([
      [0, 0, 3, 1], [3, 0, 3, 1], [6, 0, 6, 3], [0, 1, 3, 1], [3, 1, 3, 1],
    ]);
    expect(tidyLayout(result, "lg")).toEqual(result);
    expect(items[3].y).toBe(3);
  });

  it("fills rows, keeps text and table boundaries, and arranges the same way twice on every screen", () => {
    const types = ["kpi", "kpi", "line", "kpi", "kpi", "doughnut", "table", "bar", "kpi", "markdown", "bar"];
    const charts = types.map((type, id) => ({ id, type }));
    const items = charts.map(({ id }) => ({ i: String(id) }));
    for (const bp of breakpoints) {
      const result = autoArrange(items, charts, bp);
      validateLayout(result, bp);
      expect(result.map(({ i }) => i)).toEqual(["0", "1", "3", "4", "2", "5", "6", "8", "7", "9", "10"]);
      expect(autoArrange(visualOrder(result), charts, bp)).toEqual(result);
      const area = result.reduce((total, item) => total + item.w * item.h, 0);
      expect(area).toBe(cols[bp] * Math.max(...result.map((item) => item.y + item.h)));
    }
    const desktop = autoArrange(items, charts, "lg");
    expect(desktop.slice(0, 4).map(({ x, y, w, h }) => [x, y, w, h])).toEqual([
      [0, 0, 3, 1], [3, 0, 3, 1], [6, 0, 3, 1], [9, 0, 3, 1],
    ]);
    expect(desktop[4]).toMatchObject({ x: 0, y: 1, w: 6, h: 2 });
    expect(desktop[6]).toMatchObject({ x: 0, y: 3, w: 12, h: 2 });
    const derived = deriveLayouts({ lg: desktop }, desktop.map(({ i }) => i), ["lg"]);
    breakpoints.forEach((bp) => {
      validateLayout(derived[bp], bp);
      expect(derived[bp].reduce((total, item) => total + item.w * item.h, 0))
        .toBe(cols[bp] * Math.max(...derived[bp].map((item) => item.y + item.h)));
    });
    const custom = [{ id: "custom", type: "bar", layoutIntent: { sizes: { lg: [8, 4] } } }];
    expect(autoArrange([{ i: "custom" }], custom, "lg")[0]).toMatchObject({ w: 8, h: 4 });
  });

  it("starts the next row below its tallest widget without backfilling a gap", () => {
    const result = arrangeRows([{ i: "a", w: 7, h: 4 }, { i: "b", w: 6, h: 1 }, { i: "c", w: 3, h: 1 }], "lg");
    expect(result.map(({ x, y }) => [x, y])).toEqual([[0, 0], [0, 4], [6, 4]]);
    validateLayout(result, "lg");
  });

  it("appends a batch together below existing content without changing it", () => {
    const existing = [chart(1, [0, 5, 2, 3]), chart(2, [2, 0, 2, 1])];
    const before = structuredClone(existing);
    const result = appendCharts(existing, [{ id: 3, type: "kpi" }, { id: 4, type: "kpi" }]);
    expect(result[3].lg).toEqual([0, 8, 6, 1]);
    expect(result[4].lg).toEqual([6, 8, 6, 1]);
    expect(existing).toEqual(before);
    expect(appendCharts([], [])).toEqual({});
  });

  it("adds text at half width with room for its editor, and uses full width on mobile", () => {
    const text = { id: "note", type: "markdown" };
    const layouts = appendCharts([], [text]);
    breakpoints.forEach((bp) => {
      const width = ["xs", "xxs"].includes(bp) ? cols[bp] : Math.floor(cols[bp] / 2);
      expect(defaultSize(text, bp)).toEqual({ w: width, h: 2 });
      expect(layouts.note[bp]).toEqual([0, 0, width, 2]);
    });
    const existing = chart("saved-note", [0, 0, 4, 1], "markdown");
    expect(getLayouts([existing]).lg[0]).toMatchObject({ w: 4, h: 1 });
  });

  it("preserves legacy positions and fills missing keys without overlaps", () => {
    const charts = [chart(1, [0, 4, 2, 2]), { id: 2, type: "kpi", layout: { lg: [3, 0, 3, 1] } }];
    const before = structuredClone(charts);
    const result = getLayouts(charts);
    expect(result.lg[0]).toMatchObject({ x: 0, y: 4, w: 2, h: 2 });
    expect(result.sm.find((item) => item.i === "2")).toMatchObject({ x: 0, y: 6 });
    breakpoints.forEach((bp) => validateLayout(result[bp], bp));
    expect(charts).toEqual(before);
    expect(getReportOrder(charts)).toEqual(["2", "1"]);
    expect(getReportOrder(charts, ["1", "missing", "1"])).toEqual(["1", "2"]);
  });

  it("derives screens from Desktop while keeping custom layouts unchanged", () => {
    const layouts = getLayouts([chart(1, [0, 8, 6, 1]), chart(2, [3, 8, 6, 3])]);
    const derived = deriveLayouts(layouts, ["2", "1"], ["lg", "sm"]);
    expect(derived.sm).toEqual(layouts.sm);
    expect(derived.lg).toEqual(layouts.lg);
    expect(derived.xs.map(({ i, x, y, w }) => [i, x, y, w])).toEqual([["2", 0, 0, 6], ["1", 0, 3, 6]]);
    const appended = appendCharts([], [{ id: 1, type: "kpi" }], ["lg"]);
    const one = deriveLayouts({ lg: [{ i: "1", x: 0, y: 0, ...defaultSize({ type: "kpi" }, "lg") }] }, ["1"], ["lg"]);
    breakpoints.forEach((bp) => expect(appended[1][bp][2]).toBe(one[bp][0].w));
  });

  it("preserves existing legacy problems but rejects new overlaps", () => {
    const old = [{ i: "1", x: 0, y: 0, w: 3, h: 1 }, { i: "2", x: 0, y: 0, w: 3, h: 1 }];
    expect(() => validateLayout(old, "lg", old)).not.toThrow();
    expect(() => validateLayout([...old, { i: "3", x: 0, y: 1, w: 3, h: 1 }], "lg", old)).not.toThrow();
    expect(() => validateLayout([...old, { i: "3", x: 0, y: 0, w: 3, h: 1 }], "lg", old)).toThrow("overlap");
  });

  it("reads both native and text JSON values returned by database drivers", () => {
    const require = createRequire(import.meta.url);
    const { Project } = require("../../models/models");
    const project = Project.build();
    project.setDataValue("layoutOrder", '["1","2"]');
    project.setDataValue("layoutCustom", '["lg"]');
    expect(project.layoutOrder).toEqual(["1", "2"]);
    expect(project.layoutCustom).toEqual(["lg"]);
    project.setDataValue("layoutOrder", ["2", "1"]);
    project.setDataValue("layoutCustom", null);
    expect(project.layoutOrder).toEqual(["2", "1"]);
    expect(project.layoutCustom).toBeNull();
  });

  it("matches grid breakpoint boundaries and rejects invalid geometry", () => {
    breakpoints.forEach((bp, index) => {
      expect(getBreakpoint(widths[bp] + 1)).toBe(bp);
      expect(getBreakpoint(widths[bp])).toBe(breakpoints[index + 1] || "xxs");
    });
    expect(() => validateLayout([{ i: "a", x: 0, y: 0, w: 3, h: 1 }, { i: "a", x: 4, y: 0, w: 3, h: 1 }], "lg")).toThrow("widgets");
    expect(() => validateLayout([{ i: "a", x: 11, y: 0, w: 3, h: 1 }], "lg")).toThrow("widgets");
    expect(() => validateLayout([null], "lg")).toThrow("widgets");
  });
});
