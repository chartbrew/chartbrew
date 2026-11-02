const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const db = require("../../models/models");
const { buildChartRuntimeContext } = require("../chartRuntimeFilters");
const {
  MAX_LOGO_UPLOAD_SIZE_BYTES,
  isValidLogoImageBuffer,
  resolveSafeUploadPath,
} = require("../logoUploadSecurity");
const { loadPreparedSnapshot } = require("../preparedSnapshot");
const runtimeCache = require("../runtimeCache");
const { buildProjectionDomain } = require("../../visualization/seriesProjection");
const { sanitizePlainText } = require("../../visualization/image/safeSvg");
const {
  GRAPHICAL_PRESETS,
  METRIC_PRESETS,
} = require("../../visualization/image/composeImageSvg");
const { assertPreparedRows } = require("./imageLimits");
const { ChartImageError } = require("./imageResponse");

const LOGO_MIME_TYPES = Object.freeze({
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
});
const MAX_LOGO_DIMENSION = 4096;
const MAX_LOGO_PIXELS = 16_000_000;

function toPlain(value) {
  return typeof value?.toJSON === "function" ? value.toJSON() : value;
}

function normalizeTimezone(value) {
  const timezone = typeof value === "string" && value ? value : "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch (_error) {
    return "UTC";
  }
}

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateRange(startValue, endValue, locale, timezone) {
  const start = toValidDate(startValue);
  const end = toValidDate(endValue);
  if (!start || !end || start > end) return "";
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: timezone,
  });
  return typeof formatter.formatRange === "function"
    ? formatter.formatRange(start, end)
    : `${formatter.format(start)} – ${formatter.format(end)}`;
}

function resolveDateRange({ chart, locale, preparedData, timezone, visualization }) {
  try {
    const runtimeContext = buildChartRuntimeContext(chart, [], {}, timezone);
    if (runtimeContext.effectiveDateRange) {
      return formatDateRange(
        runtimeContext.effectiveDateRange.startDate,
        runtimeContext.effectiveDateRange.endDate,
        locale,
        timezone
      );
    }
    const projected = buildProjectionDomain({
      chart,
      preparedData,
      runtimeContext: null,
      timezone,
      visualization,
    });
    if (!projected.timeRange) return "";
    const exclusiveEnd = toValidDate(projected.timeRange.end);
    if (exclusiveEnd) exclusiveEnd.setMilliseconds(exclusiveEnd.getMilliseconds() - 1);
    return formatDateRange(projected.timeRange.start, exclusiveEnd, locale, timezone);
  } catch (_error) {
    return "";
  }
}

async function isSafeRasterLogoBuffer(buffer) {
  try {
    const metadata = await sharp(buffer, {
      limitInputPixels: MAX_LOGO_PIXELS,
      sequentialRead: true,
    }).metadata();
    return Number.isInteger(metadata.width)
      && Number.isInteger(metadata.height)
      && metadata.width > 0
      && metadata.height > 0
      && metadata.width <= MAX_LOGO_DIMENSION
      && metadata.height <= MAX_LOGO_DIMENSION
      && (metadata.pages || 1) === 1;
  } catch (_error) {
    return false;
  }
}

function formatLastUpdated(value, locale, timezone) {
  const date = toValidDate(value);
  if (!date) return "";
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
  return `Updated ${formatted}`;
}

function getLogoFileName(logoPath) {
  if (typeof logoPath !== "string") return null;
  const normalized = logoPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/")) return null;
  const fileName = normalized.slice("uploads/".length);
  if (!fileName || fileName !== path.basename(fileName)) return null;
  return fileName;
}

async function readLogoFromRoot(root, fileName) {
  const candidate = resolveSafeUploadPath(root, fileName);
  if (!candidate) return null;
  try {
    const [realRoot, realFile] = await Promise.all([
      fs.promises.realpath(root),
      fs.promises.realpath(candidate),
    ]);
    if (!realFile.startsWith(`${realRoot}${path.sep}`)) return null;
    const stat = await fs.promises.stat(realFile);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_LOGO_UPLOAD_SIZE_BYTES) return null;
    const mimeType = LOGO_MIME_TYPES[path.extname(realFile).toLowerCase()];
    if (!mimeType) return null;
    const buffer = await fs.promises.readFile(realFile);
    if (!isValidLogoImageBuffer(buffer, mimeType)) return null;
    if (mimeType !== "image/svg+xml" && !await isSafeRasterLogoBuffer(buffer)) return null;
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (_error) {
    return null;
  }
}

async function loadProjectLogoDataUri(logoPath, options = {}) {
  const fileName = getLogoFileName(logoPath);
  if (!fileName) return null;
  const roots = options.uploadRoots || [
    path.resolve(__dirname, "../../uploads"),
    path.resolve(process.cwd(), "uploads"),
  ];
  const candidates = await Promise.all(
    [...new Set(roots)].map((root) => readLogoFromRoot(root, fileName))
  );
  return candidates.find(Boolean) || null;
}

function getImagePreset(preparedData) {
  const presets = [...new Set((preparedData?.results || []).map((result) => result.mark))];
  if (presets.length !== 1) throw new ChartImageError("IMAGE_PRESET_UNSUPPORTED");
  const preset = presets[0];
  if (!GRAPHICAL_PRESETS.has(preset) && !METRIC_PRESETS.has(preset)) {
    throw new ChartImageError("IMAGE_PRESET_UNSUPPORTED");
  }
  return preset;
}

function resolveBranding(requestedBranding) {
  return requestedBranding === "whiteLabel" ? "whiteLabel" : "chartbrew";
}

async function loadChartImageDocument(access, request, dependencies = {}) {
  const models = dependencies.db || db;
  const snapshotLoader = dependencies.loadPreparedSnapshot || loadPreparedSnapshot;
  const fingerprintLoader = dependencies.buildChartFingerprints
    || runtimeCache.buildChartFingerprints.bind(runtimeCache);
  const logoLoader = dependencies.loadProjectLogoDataUri || loadProjectLogoDataUri;

  const [chartRecord, projectRecord, teamRecord] = await Promise.all([
    models.Chart.unscoped().findOne({
      attributes: { exclude: ["chartData", "preparedData"] },
      where: { id: access.chartId, project_id: access.projectId },
    }),
    models.Project.findOne({
      attributes: ["dashboardTitle", "id", "logo", "name", "team_id", "timezone"],
      where: { id: access.projectId, team_id: access.teamId },
    }),
    models.Team.findOne({
      attributes: ["id", "name", "showBranding"],
      where: { id: access.teamId },
    }),
  ]);
  if (!chartRecord || !projectRecord || !teamRecord) {
    throw new ChartImageError("RESOURCE_NOT_FOUND");
  }

  const chart = toPlain(chartRecord);
  const project = toPlain(projectRecord);
  const team = toPlain(teamRecord);
  if (["markdown", "table"].includes(chart.type)) {
    throw new ChartImageError("IMAGE_PRESET_UNSUPPORTED");
  }

  const snapshot = await snapshotLoader(access.chartId);
  if (!snapshot?.preparedData || !chart.visualization) {
    throw new ChartImageError("IMAGE_DATA_UNAVAILABLE");
  }
  const timezone = normalizeTimezone(project.timezone);
  let fingerprints;
  try {
    fingerprints = await fingerprintLoader(access.chartId, project.timezone);
  } catch (error) {
    throw new ChartImageError("IMAGE_DATA_UNAVAILABLE", { cause: error });
  }
  const migratedHorizontalSnapshot = !snapshot.visualizationFingerprint
    && chart.type === "horizontalBar"
    && snapshot.preparedData.results.every((result) => result.mark === "horizontalBar");
  if (snapshot.visualizationFingerprint !== fingerprints.visualization
    && !migratedHorizontalSnapshot) {
    throw new ChartImageError("IMAGE_DATA_UNAVAILABLE");
  }

  const preset = getImagePreset(snapshot.preparedData);
  try {
    assertPreparedRows(snapshot.preparedData);
  } catch (error) {
    throw new ChartImageError("IMAGE_TOO_LARGE", { cause: error });
  }

  let logoDataUri = null;
  const operationalCodes = [];
  if (request.layout === "shareCard" && request.content.logo && project.logo) {
    logoDataUri = await logoLoader(project.logo);
    if (!logoDataUri) operationalCodes.push("LOGO_UNAVAILABLE");
  }
  const dateRange = resolveDateRange({
    chart,
    locale: request.locale,
    preparedData: snapshot.preparedData,
    timezone,
    visualization: chart.visualization,
  });
  const updatedAt = snapshot.updatedAt || snapshot.preparedData.generatedAt;
  const branding = resolveBranding(request.content.branding);

  return {
    document: {
      background: request.background,
      chart,
      content: {
        ...request.content,
        branding,
        subtitle: request.content.subtitle,
        title: {
          ...request.content.title,
          text: request.content.title.text === null
            ? sanitizePlainText(chart.name, 160)
            : request.content.title.text,
        },
      },
      height: request.height,
      layout: request.layout,
      locale: request.locale,
      metadata: {
        companyName: sanitizePlainText(team.name, 160),
        dashboardName: sanitizePlainText(project.dashboardTitle || project.name, 160),
        dateRange,
        lastUpdated: formatLastUpdated(updatedAt, request.locale, timezone),
        logoDataUri,
      },
      preparedData: snapshot.preparedData,
      renderContext: { timezone },
      theme: request.theme,
      visualization: chart.visualization,
      width: request.width,
    },
    operationalCodes,
    preset,
  };
}

module.exports = {
  MAX_LOGO_DIMENSION,
  MAX_LOGO_PIXELS,
  formatDateRange,
  formatLastUpdated,
  getImagePreset,
  getLogoFileName,
  isSafeRasterLogoBuffer,
  loadChartImageDocument,
  loadProjectLogoDataUri,
  normalizeTimezone,
  resolveBranding,
  resolveDateRange,
};
