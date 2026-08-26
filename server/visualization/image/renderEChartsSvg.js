const echarts = require("echarts");

const { buildEChartsOption } = require("../compilers/echarts");
const { assertImageDimensions, assertPreparedRows, IMAGE_RENDER_LIMITS } = require("../../modules/chartImage/imageLimits");
const { buildEChartsImageTheme } = require("./imageTheme");
const { canonicalizeSvgIds } = require("./safeSvg");
const { FONT_FAMILY } = require("./fontAsset");

function applyStaticFont(value) {
  if (Array.isArray(value)) return value.map((item) => applyStaticFont(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    return [key, key === "fontFamily" ? FONT_FAMILY : applyStaticFont(item)];
  }));
}

function buildStaticOption(option) {
  const normalized = applyStaticFont(option);
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
  height,
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
      pixelRatio: 1,
      reducedMotion: true,
      surface: "social",
      theme: colors.mode,
      width,
    },
    visualization,
  }));
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
      throw new Error("Chart SVG exceeds the image size limit");
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
};
