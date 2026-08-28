const echarts = require("echarts");

const { buildEChartsOption } = require("../compilers/echarts");
const {
  assertImageDimensions,
  assertPreparedRows,
  createImageTooLargeError,
  IMAGE_RENDER_LIMITS,
} = require("../../modules/chartImage/imageLimits");
const { buildEChartsImageTheme } = require("./imageTheme");
const { canonicalizeSvgIds } = require("./safeSvg");
const { FONT_FAMILY } = require("./fontAsset");

const DETAIL_KEYS = new Set([
  "axisNameGap",
  "barMaxWidth",
  "barMinWidth",
  "borderRadius",
  "borderWidth",
  "distance",
  "fontSize",
  "itemGap",
  "itemHeight",
  "itemWidth",
  "lineHeight",
  "margin",
  "padding",
  "shadowBlur",
  "shadowOffsetX",
  "shadowOffsetY",
  "symbolSize",
]);
const WIDTH_PARENTS = new Set(["lineStyle", "pointer", "progress"]);

function scaleNumber(value, scale) {
  if (value === 0) return 0;
  return Number((value * scale).toFixed(2));
}

function isScalableDimension(key, parentKey, path) {
  if (DETAIL_KEYS.has(key)) return true;
  if (["bottom", "left", "right", "top"].includes(key) && parentKey === "grid") return true;
  if (key === "length" && parentKey === "axisTick") return true;
  if (!["height", "width"].includes(key)) return false;
  return WIDTH_PARENTS.has(parentKey)
    || path.includes("axisLabel")
    || path.includes("label")
    || path.includes("textStyle");
}

function scaleEChartsDetails(value, scale, key = null, path = []) {
  if (!Number.isFinite(scale) || scale <= 1) return value;
  const parentKey = path[path.length - 1] || null;
  if (typeof value === "number") {
    return isScalableDimension(key, parentKey, path) ? scaleNumber(value, scale) : value;
  }
  if (Array.isArray(value)) {
    if (["borderRadius", "padding", "symbolSize"].includes(key)) {
      return value.map((item) => typeof item === "number" ? scaleNumber(item, scale) : item);
    }
    return value.map((item) => scaleEChartsDetails(item, scale, key, path));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, item]) => {
    return [childKey, scaleEChartsDetails(item, scale, childKey, [...path, key].filter(Boolean))];
  }));
}

function applyStaticFont(value) {
  if (Array.isArray(value)) return value.map((item) => applyStaticFont(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    return [key, key === "fontFamily" ? FONT_FAMILY : applyStaticFont(item)];
  }));
}

function buildStaticOption(option, detailScale = 1) {
  const normalized = scaleEChartsDetails(applyStaticFont(option), detailScale);
  return {
    ...normalized,
    animation: false,
    legend: normalized.legend ? { ...normalized.legend, selectedMode: false } : undefined,
    series: (normalized.series || []).map((series) => ({
      ...series,
      animation: false,
      silent: true,
    })),
    tooltip: {
      ...(normalized.tooltip || {}),
      show: false,
      triggerOn: "none",
    },
  };
}

function renderEChartsSvg({
  chart,
  colors,
  detailScale = 1,
  height,
  locale,
  preparedData,
  renderContext = {},
  visualization,
  width,
}) {
  assertImageDimensions(width, height);
  assertPreparedRows(preparedData);
  const option = buildStaticOption(buildEChartsOption({
    chart,
    preparedData,
    renderContext: {
      ...renderContext,
      height,
      locale,
      pixelRatio: 1,
      reducedMotion: true,
      surface: "social",
      theme: colors.mode,
      width,
    },
    visualization,
  }), detailScale);
  const instance = echarts.init(null, buildEChartsImageTheme(colors), {
    height,
    renderer: "svg",
    ssr: true,
    width,
  });

  try {
    instance.setOption(option, { lazyUpdate: false, notMerge: true });
    const svg = canonicalizeSvgIds(instance.renderToSVGString(), "echarts");
    if (Buffer.byteLength(svg) > IMAGE_RENDER_LIMITS.maxSvgBytes) {
      throw createImageTooLargeError("Chart SVG exceeds the image size limit");
    }
    return svg;
  } finally {
    instance.dispose();
  }
}

module.exports = {
  applyStaticFont,
  buildStaticOption,
  renderEChartsSvg,
  scaleEChartsDetails,
};
