const { resolveImageLayout } = require("../../../shared/visualization/imageLayout");
const {
  IMAGE_RENDER_LIMITS,
  assertImageDimensions,
  assertPreparedRows,
  createImageTooLargeError,
} = require("../../modules/chartImage/imageLimits");
const { MAX_LOGO_UPLOAD_SIZE_BYTES, isValidLogoImageBuffer } = require("../../modules/logoUploadSecurity");
const { renderChartbrewMark } = require("./chartbrewMark");
const { getEmbeddedFontCss } = require("./fontAsset");
const { resolveImageTheme } = require("./imageTheme");
const { renderEChartsSvg } = require("./renderEChartsSvg");
const { renderMetricSvg } = require("./renderMetricSvg");
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

function renderChartFragment(document, layout, colors) {
  const preset = getPreset(document.preparedData);
  const input = {
    chart: document.chart || {},
    colors,
    height: layout.chart.height,
    locale: document.locale,
    preparedData: document.preparedData,
    renderContext: document.renderContext,
    visualization: document.visualization,
    width: layout.chart.width,
  };
  if (GRAPHICAL_PRESETS.has(preset)) return renderEChartsSvg(input);
  if (METRIC_PRESETS.has(preset)) return renderMetricSvg(input);
  throw new Error(`Image rendering is not supported for preset: ${preset}`);
}

function renderHeader(document, layout, colors) {
  if (!layout.header?.height) return "";
  const scale = layout.scale;
  const logoSize = Math.round(30 * scale);
  let textX = layout.header.x;
  let logo = "";
  if (document.content.logo) {
    logo = `<image x="${layout.header.x}" y="${layout.header.y}" width="${logoSize}" height="${logoSize}" `
      + `preserveAspectRatio="xMidYMid meet" href="${escapeXml(document.metadata.logoDataUri)}"/>`;
    textX += logoSize + Math.round(12 * scale);
  }
  const company = document.content.companyName ? renderText({
    color: colors.foreground,
    fontSize: Math.round(18 * scale),
    fontWeight: 700,
    text: document.metadata.companyName,
    width: Math.max(80, layout.header.width * 0.55),
    x: textX,
    y: layout.header.y + Math.round(23 * scale),
  }) : "";
  const dashboard = document.content.dashboardName ? renderText({
    anchor: "end",
    color: colors.muted,
    fontSize: Math.round(14 * scale),
    fontWeight: 600,
    text: document.metadata.dashboardName,
    width: Math.max(80, layout.header.width * 0.36),
    x: layout.header.x + layout.header.width,
    y: layout.header.y + Math.round(22 * scale),
  }) : "";
  return `${logo}${company}${dashboard}`;
}

function renderFooter(document, layout, colors) {
  if (!layout.footer?.height) return "";
  const scale = layout.scale;
  const dividerY = layout.footer.y - Math.round(10 * scale);
  const date = document.content.dateRange ? renderText({
    color: colors.foreground,
    fontSize: Math.round(13 * scale),
    fontWeight: 600,
    text: document.metadata.dateRange,
    width: layout.footer.width * 0.55,
    x: layout.footer.x,
    y: layout.footer.y + Math.round(13 * scale),
  }) : "";
  const updated = document.content.lastUpdated ? renderText({
    color: colors.muted,
    fontSize: Math.round(12 * scale),
    text: document.metadata.lastUpdated,
    width: layout.footer.width * 0.55,
    x: layout.footer.x,
    y: layout.footer.y + Math.round(31 * scale),
  }) : "";
  let branding = "";
  if (document.content.branding === "chartbrew") {
    const markSize = Math.round(19 * scale);
    const labelX = layout.footer.x + layout.footer.width;
    const markX = labelX - Math.round(164 * scale);
    const markY = layout.footer.y + Math.round(6 * scale);
    branding = renderChartbrewMark({ color: colors.muted, size: markSize, x: markX, y: markY })
      + renderText({
        anchor: "end",
        color: colors.muted,
        fontSize: Math.round(12 * scale),
        fontWeight: 600,
        text: "Made with Chartbrew",
        width: Math.round(150 * scale),
        x: labelX,
        y: layout.footer.y + Math.round(21 * scale),
      });
  }
  return `<line x1="${layout.footer.x}" y1="${dividerY}" x2="${layout.footer.x + layout.footer.width}" `
    + `y2="${dividerY}" stroke="${colors.divider}"/>${date}${updated}${branding}`;
}

function composeImageSvg(input) {
  const document = normalizeDocument(input);
  const colors = resolveImageTheme({ background: document.background, theme: document.theme });
  const layout = resolveImageLayout(document);
  const chartSvg = renderChartFragment(document, layout, colors);
  const chart = embedServerSvg(chartSvg, {
    ...layout.chart,
    idPrefix: "chart",
  });
  const title = document.content.title?.show ? renderText({
    color: colors.foreground,
    fontSize: Math.round(28 * layout.scale),
    fontWeight: 700,
    text: document.content.title.text,
    width: layout.title.width,
    x: layout.title.x,
    y: layout.title.y + Math.round(28 * layout.scale),
  }) : "";
  const subtitle = document.content.subtitle?.show ? renderText({
    color: colors.muted,
    fontSize: Math.round(16 * layout.scale),
    text: document.content.subtitle.text,
    width: layout.subtitle.width,
    x: layout.subtitle.x,
    y: layout.subtitle.y + Math.round(18 * layout.scale),
  }) : "";
  const card = layout.card
    ? `<rect x="${layout.card.x}" y="${layout.card.y}" width="${layout.card.width}" `
      + `height="${layout.card.height}" rx="${Math.round(24 * layout.scale)}" fill="${colors.card}"/>`
    : "";
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">`,
    `<style>${getEmbeddedFontCss()}</style>`,
    `<rect width="${document.width}" height="${document.height}" fill="${colors.background}"/>`,
    card,
    renderHeader(document, layout, colors),
    title,
    subtitle,
    chart,
    renderFooter(document, layout, colors),
    "</svg>",
  ].join("");

  if (Buffer.byteLength(svg) > IMAGE_RENDER_LIMITS.maxSvgBytes) {
    throw createImageTooLargeError("Composed SVG exceeds the image size limit");
  }
  return svg;
}

module.exports = {
  GRAPHICAL_PRESETS,
  METRIC_PRESETS,
  composeImageSvg,
  getPreset,
  isSafeLogoDataUri,
  normalizeDocument,
};
