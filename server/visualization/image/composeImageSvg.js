const { resolveImageLayout } = require("../../../shared/visualization/imageLayout");
const {
  IMAGE_RENDER_LIMITS,
  assertImageDimensions,
  assertPreparedRows,
  createImageTooLargeError,
} = require("../../modules/chartImage/imageLimits");
const { MAX_LOGO_UPLOAD_SIZE_BYTES, isValidLogoImageBuffer } = require("../../modules/logoUploadSecurity");
const { getEmbeddedFontCss } = require("./fontAsset");
const { resolveImageTheme } = require("./imageTheme");
const { renderEChartsSvg } = require("./renderEChartsSvg");
const { getMetricItems, renderKpiOverlaySvg, renderMetricSvg } = require("./renderMetricSvg");
const { embedServerSvg, escapeXml, renderText, sanitizePlainText } = require("./safeSvg");

const GRAPHICAL_PRESETS = new Set([
  "bar",
  "doughnut",
  "gauge",
  "horizontalBar",
  "line",
  "matrix",
  "pie",
  "polar",
  "radar",
]);
const METRIC_PRESETS = new Set(["avg", "kpi"]);
const KPI_OVERLAY_PRESETS = new Set(["bar", "line"]);
const LOGO_DATA_URI = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([a-z0-9+/=]+)$/i;

function isSafeLogoDataUri(dataUri) {
  if (typeof dataUri !== "string") return false;
  const match = dataUri.match(LOGO_DATA_URI);
  if (!match) return false;
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_LOGO_UPLOAD_SIZE_BYTES) return false;
  return isValidLogoImageBuffer(buffer, mimeType);
}

function getPreset(preparedData) {
  const presets = [...new Set((preparedData.results || []).map((result) => result.mark))];
  if (presets.length !== 1) throw new Error("Image rendering requires one chart preset");
  return presets[0];
}

function normalizeDocument(document) {
  if (!document || typeof document !== "object") throw new Error("Image document is required");
  const width = Number(document.width);
  const height = Number(document.height);
  assertImageDimensions(width, height);
  assertPreparedRows(document.preparedData);
  const metadata = document.metadata || {};
  const requested = document.content || {};
  const content = document.layout === "chartOnly" ? {} : {
    branding: requested.branding === "chartbrew" ? "chartbrew" : "whiteLabel",
    companyName: Boolean(requested.companyName && metadata.companyName),
    dashboardName: Boolean(requested.dashboardName && metadata.dashboardName),
    dateRange: Boolean(requested.dateRange && metadata.dateRange),
    lastUpdated: Boolean(requested.lastUpdated && metadata.lastUpdated),
    logo: Boolean(requested.logo && metadata.logoDataUri),
    subtitle: {
      show: Boolean(requested.subtitle?.show && requested.subtitle?.text),
      text: sanitizePlainText(requested.subtitle?.text, 240),
    },
    title: {
      show: Boolean(requested.title?.show && requested.title?.text),
      text: sanitizePlainText(requested.title?.text, 160),
    },
  };

  if (content.logo && !isSafeLogoDataUri(metadata.logoDataUri)) {
    throw new Error("Project logo data is invalid");
  }

  return {
    ...document,
    content,
    height,
    layout: document.layout === "chartOnly" ? "chartOnly" : "shareCard",
    metadata: {
      companyName: sanitizePlainText(metadata.companyName, 160),
      dashboardName: sanitizePlainText(metadata.dashboardName, 160),
      dateRange: sanitizePlainText(metadata.dateRange, 160),
      lastUpdated: sanitizePlainText(metadata.lastUpdated, 160),
      logoDataUri: metadata.logoDataUri || null,
    },
    width,
  };
}

function getChartRenderSize(layout) {
  const renderScale = Math.max(1, layout.scale || 1);
  return {
    detailScale: Math.max(1, (layout.detailScale || 1) / renderScale),
    height: Math.max(1, Math.round(layout.chart.height / renderScale)),
    width: Math.max(1, Math.round(layout.chart.width / renderScale)),
  };
}

function renderChartFragment(document, layout, colors) {
  const preset = getPreset(document.preparedData);
  const renderSize = getChartRenderSize(layout);
  const input = {
    chart: document.chart || {},
    colors,
    detailScale: renderSize.detailScale,
    height: renderSize.height,
    locale: document.locale,
    preparedData: document.preparedData,
    renderContext: document.renderContext,
    visualization: document.visualization,
    width: renderSize.width,
  };
  if (GRAPHICAL_PRESETS.has(preset)) return renderEChartsSvg(input);
  if (METRIC_PRESETS.has(preset)) return renderMetricSvg(input);
  throw new Error(`Image rendering is not supported for preset: ${preset}`);
}

function resolveChartComposition(document, layout, colors) {
  const preset = getPreset(document.preparedData);
  if (document.chart?.mode !== "kpichart" || !KPI_OVERLAY_PRESETS.has(preset)) {
    return { chart: layout.chart, overlay: null };
  }

  const items = getMetricItems({
    chart: document.chart,
    preparedData: document.preparedData,
    renderContext: document.renderContext,
    visualization: document.visualization,
  }).filter((item) => item.valueNumber !== null);
  if (items.length === 0) return { chart: layout.chart, overlay: null };

  const scale = layout.textScales?.content || layout.scale;
  const overlayHeight = Math.round(76 * scale);
  const gap = Math.round(8 * scale);
  const minimumChartHeight = Math.round(120 * layout.scale);
  if (layout.chart.height < overlayHeight + gap + minimumChartHeight) {
    return { chart: layout.chart, overlay: null };
  }

  const overlay = {
    height: overlayHeight,
    width: layout.chart.width,
    x: layout.chart.x,
    y: layout.chart.y,
  };
  const chart = {
    ...layout.chart,
    height: layout.chart.height - overlayHeight - gap,
    y: layout.chart.y + overlayHeight + gap,
  };
  return {
    chart,
    overlay: {
      ...overlay,
      svg: renderKpiOverlaySvg({
        chart: document.chart,
        colors,
        detailScale: layout.detailScale,
        height: overlay.height,
        items,
        scale,
        width: overlay.width,
      }),
    },
  };
}

function renderIdentity(document, layout, colors) {
  if (!layout.identity?.height) return "";
  const scale = layout.textScales?.identity || layout.scale;
  const logoClearance = layout.card
    ? layout.card.y - layout.identity.y - Math.round(4 * layout.scale)
    : layout.identity.height;
  const logoSize = Math.max(1, Math.min(Math.round(28 * scale), logoClearance));
  const ink = canvasInkColor(colors, true);
  const muted = canvasInkColor(colors);
  let textX = layout.identity.x;
  let logo = "";
  if (document.content.logo) {
    logo = `<image x="${layout.identity.x}" y="${layout.identity.y + Math.round((layout.identity.height - logoSize) / 2)}" `
      + `width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" `
      + `href="${escapeXml(document.metadata.logoDataUri)}"/>`;
    textX += logoSize + Math.round(12 * scale);
  }
  const company = document.content.companyName ? renderText({
    color: ink,
    fontSize: Math.round(16 * scale),
    fontWeight: 700,
    text: document.metadata.companyName,
    width: Math.max(80, layout.identity.width * 0.5),
    x: textX,
    y: layout.identity.y + Math.round(16 * scale),
  }) : "";
  const dashboard = document.content.dashboardName ? renderText({
    anchor: "end",
    color: muted,
    fontSize: Math.round(14 * scale),
    fontWeight: 500,
    text: document.metadata.dashboardName,
    width: Math.max(80, layout.identity.width * 0.4),
    x: layout.identity.x + layout.identity.width,
    y: layout.identity.y + Math.round(16 * scale),
  }) : "";
  return `${logo}${company}${dashboard}`;
}

function hexLuminance(backgroundHex) {
  const value = Number.parseInt(`${backgroundHex}`.slice(1), 16);
  if (!Number.isFinite(value)) return 1;
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;
}

function canvasInkColor(colors, strong = false) {
  const hexes = colors.backgroundGradient
    ? [colors.backgroundGradient.from, colors.backgroundGradient.to]
    : [colors.background];
  const luminance = hexes.reduce((sum, hex) => sum + hexLuminance(hex), 0) / hexes.length;
  if (luminance < 0.45) return strong ? "#FAFAFA" : "#E4E4E7";
  return strong ? "#18181B" : "#52525B";
}

function renderBranding(document, layout, colors) {
  if (!layout.branding?.height || document.content.branding !== "chartbrew") return "";
  const scale = layout.textScales?.branding || layout.scale;
  const prefixSize = Math.round(11 * scale);
  const markSize = Math.round(20 * scale);
  const gap = Math.max(10, Math.round(10 * scale));
  const prefixWidth = Math.round((64 / 12) * prefixSize);
  const chartWidth = Math.round((30 / 12) * markSize);
  const brewWidth = Math.round((26 / 12) * markSize);
  const endX = layout.branding.x + layout.branding.width;
  const brewX = endX - brewWidth;
  const chartX = brewX - chartWidth;
  const prefixX = chartX - gap - prefixWidth;
  const baseline = layout.branding.y + Math.round(16 * scale);
  const prefixColor = canvasInkColor(colors);
  const markColor = canvasInkColor(colors, true);
  return renderText({
    color: prefixColor,
    fontSize: prefixSize,
    fontWeight: 400,
    text: "Powered by",
    width: 240,
    x: prefixX,
    y: baseline,
  })
    + renderText({
      color: markColor,
      fontSize: markSize,
      fontWeight: 700,
      text: "chart",
      width: 240,
      x: chartX,
      y: baseline,
    })
    + renderText({
      color: markColor,
      fontSize: markSize,
      fontWeight: 400,
      text: "brew",
      width: 240,
      x: brewX,
      y: baseline,
    });
}

function composeImageSvg(input) {
  const document = normalizeDocument(input);
  const colors = resolveImageTheme({ background: document.background, theme: document.theme });
  const layout = resolveImageLayout(document);
  const composition = resolveChartComposition(document, layout, colors);
  const chartDetailScale = composition.overlay
    ? Math.max(1, layout.detailScale * (composition.chart.height / layout.chart.height))
    : layout.detailScale;
  const chartLayout = {
    ...layout,
    chart: composition.chart,
    detailScale: chartDetailScale,
  };
  const chartSvg = renderChartFragment(document, chartLayout, colors);
  const chart = embedServerSvg(chartSvg, {
    ...composition.chart,
    idPrefix: "chart",
  });
  const kpiOverlay = composition.overlay ? embedServerSvg(composition.overlay.svg, {
    ...composition.overlay,
    idPrefix: "kpi-overlay",
  }) : "";
  const title = document.content.title?.show ? renderText({
    color: colors.foreground,
    fontSize: Math.round(28 * (layout.textScales?.content || layout.scale)),
    fontWeight: 700,
    text: document.content.title.text,
    width: layout.title.width,
    x: layout.title.x,
    y: layout.title.y + Math.round(28 * (layout.textScales?.content || layout.scale)),
  }) : "";
  const subtitle = document.content.subtitle?.show ? renderText({
    color: colors.muted,
    fontSize: Math.round(16 * (layout.textScales?.content || layout.scale)),
    text: document.content.subtitle.text,
    width: layout.subtitle.width,
    x: layout.subtitle.x,
    y: layout.subtitle.y + Math.round(18 * (layout.textScales?.content || layout.scale)),
  }) : "";
  const card = layout.card
    ? `<rect x="${layout.card.x}" y="${layout.card.y}" width="${layout.card.width}" `
      + `height="${layout.card.height}" rx="${Math.round(24 * layout.scale)}" fill="${colors.card}"/>`
    : "";
  const canvasColor = document.layout === "chartOnly" && document.background?.mode !== "custom"
    && document.background?.mode !== "gradient"
    ? colors.card
    : colors.background;
  const canvasFill = colors.backgroundGradient
    ? [
      "<defs>",
      "<linearGradient id=\"cb-canvas-bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">",
      `<stop offset="0%" stop-color="${colors.backgroundGradient.from}"/>`,
      `<stop offset="100%" stop-color="${colors.backgroundGradient.to}"/>`,
      "</linearGradient>",
      "</defs>",
      `<rect width="${document.width}" height="${document.height}" fill="url(#cb-canvas-bg)"/>`,
    ].join("")
    : `<rect width="${document.width}" height="${document.height}" fill="${canvasColor}"/>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">`,
    `<style>${getEmbeddedFontCss()}</style>`,
    canvasFill,
    card,
    renderIdentity(document, layout, colors),
    title,
    subtitle,
    kpiOverlay,
    chart,
    renderBranding(document, layout, colors),
    "</svg>",
  ].join("");

  if (Buffer.byteLength(svg) > IMAGE_RENDER_LIMITS.maxSvgBytes) {
    throw createImageTooLargeError("Composed SVG exceeds the image size limit");
  }
  return svg;
}

module.exports = {
  GRAPHICAL_PRESETS,
  KPI_OVERLAY_PRESETS,
  METRIC_PRESETS,
  composeImageSvg,
  getPreset,
  isSafeLogoDataUri,
  normalizeDocument,
  resolveChartComposition,
};
