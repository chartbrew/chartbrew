import test from "node:test";
import assert from "node:assert/strict";
import {
  reportThemes, validateReportAppearance, initialReportAppearance,
  reportContrastWarnings, reportColorVariables, resolveReportMode,
} from "../../../shared/reportAppearance.mjs";
import { applyReportChartColors } from "../visualization/reportChartColors.js";

test("all built-in color sets are valid and pass contrast checks", () => {
  for (const theme of reportThemes) {
    assert.deepEqual(validateReportAppearance(theme.appearance), theme.appearance);
    for (const mode of ["light", "dark"]) {
      assert.deepEqual(reportContrastWarnings(theme.appearance[mode]), [], `${theme.name} ${mode}`);
    }
  }
});

test("validation rejects missing and unknown fields, CSS, null, and invalid modes", () => {
  const valid = reportThemes[0].appearance;
  for (const value of [null, {}, { ...valid, mode: "auto" }, { ...valid, css: "body{}" },
    { ...valid, light: { ...valid.light, page: "url(https://example.com)" } },
    { ...valid, dark: { ...valid.dark, unknown: "#FFFFFF" } }]) {
    assert.throws(() => validateReportAppearance(value));
  }
  assert.equal(validateReportAppearance({ ...valid, light: { ...valid.light, page: "#abc" } }).light.page, "#AABBCC");
});

test("Chartbrew uses subtle decorative borders in both modes", () => {
  const { light, dark } = reportThemes[0].appearance;
  assert.equal(reportColorVariables(light)["--border"], "#DFDEDD");
  assert.equal(reportColorVariables(dark)["--border"], "#2A2929");
  const chart = applyReportChartColors({ xAxis: {} }, light);
  assert.equal(chart.xAxis.splitLine.lineStyle.color, light.border);
  assert.deepEqual(reportContrastWarnings({ ...light, border: light.surface }), []);
  assert.ok(reportContrastWarnings({ ...light, text: light.surface }).length > 0);
});

test("legacy conversion does not mutate defaults or invent a dark header", () => {
  const initial = initialReportAppearance({ backgroundColor: "#123", titleColor: "#fff" });
  assert.equal(initial.light.header, "#112233");
  assert.equal(initial.dark.header, "#112233");
  assert.equal(reportThemes[0].appearance.light.header, "#FFFFFF");
  assert.equal(initialReportAppearance({ reportAppearance: initial }), initial);
});

test("mode precedence and variables stay local to the report", () => {
  assert.equal(resolveReportMode({ preview: "dark", query: "light", mode: "light" }), "dark");
  assert.equal(resolveReportMode({ query: "dark", mode: "light" }), "dark");
  assert.equal(resolveReportMode({ query: "invalid", mode: "system", prefersDark: true }), "dark");
  assert.equal(resolveReportMode({ mode: "light", prefersDark: true }), "light");
  assert.deepEqual(reportColorVariables(null), {});
  assert.equal(reportColorVariables(reportThemes[2].appearance.light)["--accent"], "#236B50");
});

test("report colors change chart labels without changing data colors or the source option", () => {
  const option = {
    xAxis: [{ axisLabel: { color: "#000000" } }], yAxis: {},
    legend: { textStyle: { fontSize: 12 } },
    series: [{ type: "bar", itemStyle: { color: "#F17041" }, data: [1, 2] }],
  };
  const updated = applyReportChartColors(option, reportThemes[0].appearance.dark);
  assert.equal(updated.xAxis[0].axisLabel.color, "#FAFAF9");
  assert.equal(updated.legend.textStyle.fontSize, 12);
  assert.equal(updated.series, option.series);
  assert.equal(option.xAxis[0].axisLabel.color, "#000000");
  assert.equal(applyReportChartColors(option, null), option);
});
