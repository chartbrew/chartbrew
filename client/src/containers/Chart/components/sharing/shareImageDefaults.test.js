import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShareImageOptions,
  canExportChartImage,
  canManageChartLinks,
  getShareImageDefaults,
  getShareImageFileName,
  resolveShareImageDimensions,
  SHARE_IMAGE_BACKGROUND_PRESETS,
  SHARE_IMAGE_COLOR_PRESETS,
  SHARE_IMAGE_DEFAULT_COLOR,
  SHARE_IMAGE_GRADIENT_PRESETS,
} from "./shareImageDefaults.js";

test("image defaults always use a share card", () => {
  const defaults = getShareImageDefaults({
    chart: { name: "Monthly sales", shareable: false },
    project: { logo: "uploads/logo.png" },
  });
  assert.equal(defaults.layout, "shareCard");
  assert.equal(defaults.sizePreset, "landscape");
  assert.equal(defaults.backgroundMode, "custom");
  assert.equal(defaults.logo, true);
  assert.equal(defaults.branding, "chartbrew");
});

test("export and link permissions remain independent", () => {
  const viewer = { canExport: true, projects: [601], role: "projectViewer" };
  assert.equal(canExportChartImage(viewer, 601), true);
  assert.equal(canManageChartLinks(viewer, 601), false);
  assert.equal(canExportChartImage({ ...viewer, canExport: false }, 601), false);
  assert.equal(canExportChartImage(viewer, 602), false);
  assert.equal(canManageChartLinks({ projects: [601], role: "projectEditor" }, 601), true);
  assert.equal(canManageChartLinks({ projects: [602], role: "projectEditor" }, 601), false);
  assert.equal(canExportChartImage({ role: "teamAdmin" }, 601), true);
});

test("image options resolve current theme and keep temporary text local", () => {
  const settings = getShareImageDefaults({
    chart: { name: "Monthly sales" },
    project: {},
  });
  const request = buildShareImageOptions({
    isDark: true,
    settings: { ...settings, subtitleShow: true, subtitleText: "  Context\u0000  " },
  });
  assert.equal(request.theme, "dark");
  assert.equal(request.content.subtitle.text, "Context");
  assert.equal(request.content.branding, "chartbrew");
  assert.equal(request.layout, "shareCard");
});

test("custom background presets are opaque hex colors", () => {
  const settings = getShareImageDefaults({
    chart: { name: "Monthly sales" },
    project: {},
  });
  const request = buildShareImageOptions({
    isDark: false,
    settings: { ...settings, backgroundMode: "custom", backgroundColor: "#E8DCC8" },
  });
  assert.deepEqual(request.background, { color: "#E8DCC8", mode: "custom" });
});

test("gradient backgrounds send both hex stops", () => {
  const settings = getShareImageDefaults({
    chart: { name: "Monthly sales" },
    project: {},
  });
  const request = buildShareImageOptions({
    isDark: false,
    settings: { ...settings, backgroundMode: "gradient", backgroundGradient: "ocean" },
  });
  assert.deepEqual(request.background, { from: "#103751", mode: "gradient", to: "#1A7FA0" });
});

test("original dimensions match the shared normalization rules", () => {
  assert.deepEqual(resolveShareImageDimensions("original", { height: 300, width: 600 }), {
    height: 600,
    width: 1200,
  });
});

test("download filename is safe", () => {
  assert.equal(
    getShareImageFileName(" Q3 / Revenue: Europe ", { height: 630, width: 1200 }),
    "q3-revenue-europe-1200x630.png"
  );
});

test("share image offers ten solid colors, ten gradients, and photo backgrounds", () => {
  assert.equal(SHARE_IMAGE_COLOR_PRESETS.length, 10);
  assert.equal(SHARE_IMAGE_GRADIENT_PRESETS.length, 10);
  assert.equal(SHARE_IMAGE_BACKGROUND_PRESETS.length, 10);
  assert.equal(SHARE_IMAGE_DEFAULT_COLOR, "#E8DCC8");
});

test("photo backgrounds send a named image id", () => {
  const settings = getShareImageDefaults({
    chart: { name: "Monthly sales" },
    project: {},
  });
  const request = buildShareImageOptions({
    isDark: false,
    settings: { ...settings, backgroundMode: "image", backgroundImage: "monochrome_poly" },
  });
  assert.deepEqual(request.background, { id: "monochrome_poly", mode: "image" });
});
