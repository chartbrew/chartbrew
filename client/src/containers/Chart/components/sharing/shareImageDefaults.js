import { getPresetDefinition } from "../../../../visualization/presetRegistry.js";

const IMAGE_SIZE_PRESETS = {
  landscape: { height: 720, width: 1280 },
  mobile: { height: 2340, width: 1080 },
};
const IMAGE_LIMITS = {
  maxDimension: 2400,
  maxPixels: 5_760_000,
  minOriginalShortSide: 480,
};

export const SHARE_IMAGE_COLOR_PRESETS = [
  "#FFFFFF",
  "#F4F4F5",
  "#E8DCC8",
  "#F5C6AA",
  "#C7D2C0",
  "#103751",
  "#1A7FA0",
  "#3F6212",
  "#9F1239",
  "#18181B",
];
export const SHARE_IMAGE_GRADIENT_PRESETS = [
  { from: "#103751", id: "ocean", to: "#1A7FA0" },
  { from: "#312E81", id: "dusk", to: "#DB2777" },
  { from: "#14532D", id: "forest", to: "#0F766E" },
  { from: "#7C2D12", id: "ember", to: "#EA580C" },
  { from: "#18181B", id: "midnight", to: "#1E3A8A" },
  { from: "#0F766E", id: "aurora", to: "#7C3AED" },
  { from: "#C2410C", id: "sunset", to: "#DB2777" },
  { from: "#0C4A6E", id: "glacier", to: "#67E8F9" },
  { from: "#3F6212", id: "meadow", to: "#FDE047" },
  { from: "#881337", id: "rose", to: "#FB7185" },
];
export const SHARE_IMAGE_BACKGROUND_PRESETS = [
  { id: "peachy_circles", ink: "dark" },
  { id: "soft_blue_circles", ink: "dark" },
  { id: "pastel_waves", ink: "dark" },
  { id: "pastel_wash", ink: "dark" },
  { id: "pastel_mint_poly", ink: "dark" },
  { id: "white_geo_grid", ink: "dark" },
  { id: "dreamy_pastel", ink: "dark" },
  { id: "dreamy_aurora", ink: "light" },
  { id: "monochrome_poly", ink: "light" },
  { id: "monochrome_geometric", ink: "light" },
];
export const SHARE_IMAGE_DEFAULT_COLOR = "#E8DCC8";

export function getCurrentTeamRole(team, userId) {
  return team?.TeamRoles?.find((teamRole) => teamRole.user_id === userId) || null;
}

function hasProjectAccess(teamRole, projectId) {
  return ["teamOwner", "teamAdmin"].includes(teamRole?.role)
    || (Array.isArray(teamRole?.projects)
      && teamRole.projects.some((id) => `${id}` === `${projectId}`));
}

export function canManageChartLinks(teamRole, projectId) {
  return ["teamOwner", "teamAdmin"].includes(teamRole?.role)
    || (["projectAdmin", "projectEditor"].includes(teamRole?.role)
      && hasProjectAccess(teamRole, projectId));
}

export function canExportChartImage(teamRole, projectId) {
  if (["teamOwner", "teamAdmin"].includes(teamRole?.role)) return true;
  return ["projectAdmin", "projectEditor", "projectViewer"].includes(teamRole?.role)
    && teamRole.canExport === true
    && hasProjectAccess(teamRole, projectId);
}

export function isShareImagePresetSupported(presetId) {
  const preset = getPresetDefinition(presetId);
  return preset?.releaseState === "ready"
    && preset.surfaces?.includes("social");
}

export function getShareImageDefaults({ chart, project }) {
  return {
    backgroundColor: SHARE_IMAGE_DEFAULT_COLOR,
    backgroundGradient: SHARE_IMAGE_GRADIENT_PRESETS[0].id,
    backgroundImage: SHARE_IMAGE_BACKGROUND_PRESETS[0].id,
    backgroundMode: "custom",
    branding: "chartbrew",
    companyName: true,
    dashboardName: true,
    layout: "shareCard",
    logo: Boolean(project?.logo),
    sizePreset: "landscape",
    subtitleShow: false,
    subtitleText: "",
    theme: "current",
    titleShow: true,
    titleText: chart?.name || "",
  };
}

function cleanPlainText(value, maxCodePoints) {
  const normalized = [...`${value || ""}`.replace(/\r\n?/g, "\n")]
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint === 10 || (codePoint > 31 && codePoint !== 127);
    })
    .join("")
    .trim();
  return [...normalized].slice(0, maxCodePoints).join("");
}

export function resolveShareImageDimensions(sizePreset, sourceSize = {}) {
  if (sizePreset !== "original") return { ...IMAGE_SIZE_PRESETS[sizePreset] };
  const sourceWidth = Number(sourceSize.width);
  const sourceHeight = Number(sourceSize.height);
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0
    || !Number.isFinite(sourceHeight) || sourceHeight <= 0) {
    return { ...IMAGE_SIZE_PRESETS.landscape };
  }
  let width = sourceWidth * 2;
  let height = sourceHeight * 2;
  const shortSide = Math.min(width, height);
  if (shortSide < IMAGE_LIMITS.minOriginalShortSide) {
    const scale = IMAGE_LIMITS.minOriginalShortSide / shortSide;
    width *= scale;
    height *= scale;
  }
  const longSide = Math.max(width, height);
  if (longSide > IMAGE_LIMITS.maxDimension) {
    const scale = IMAGE_LIMITS.maxDimension / longSide;
    width *= scale;
    height *= scale;
  }
  const pixels = width * height;
  if (pixels > IMAGE_LIMITS.maxPixels) {
    const scale = Math.sqrt(IMAGE_LIMITS.maxPixels / pixels);
    width *= scale;
    height *= scale;
  }
  return { height: Math.round(height), width: Math.round(width) };
}

export function buildShareImageOptions({
  isDark,
  settings,
}) {
  const theme = settings.theme === "current"
    ? (isDark ? "dark" : "light")
    : settings.theme;
  const gradient = SHARE_IMAGE_GRADIENT_PRESETS.find((item) => item.id === settings.backgroundGradient)
    || SHARE_IMAGE_GRADIENT_PRESETS[0];
  const image = SHARE_IMAGE_BACKGROUND_PRESETS.find((item) => item.id === settings.backgroundImage)
    || SHARE_IMAGE_BACKGROUND_PRESETS[0];
  const background = settings.backgroundMode === "gradient"
    ? { from: gradient.from, mode: "gradient", to: gradient.to }
    : settings.backgroundMode === "image"
      ? { id: image.id, mode: "image" }
      : settings.backgroundMode === "custom"
        ? { color: settings.backgroundColor, mode: "custom" }
        : { mode: "default" };

  return {
    background,
    content: {
      branding: settings.branding,
      companyName: settings.companyName,
      dashboardName: settings.dashboardName,
      logo: settings.logo,
      subtitle: {
        show: settings.subtitleShow,
        text: cleanPlainText(settings.subtitleText, 240),
      },
      title: {
        show: settings.titleShow,
        text: cleanPlainText(settings.titleText, 160),
      },
    },
    layout: "shareCard",
    theme,
  };
}

export function getShareImageFingerprint(request) {
  return JSON.stringify(request);
}

export function getShareImageFileName(chartName, dimensions) {
  const safeName = `${chartName || "chart"}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "chart";
  return `${safeName}-${dimensions.width}x${dimensions.height}.png`;
}

export function isShareImageBackgroundPreset(color) {
  return SHARE_IMAGE_COLOR_PRESETS.includes(`${color || ""}`.toUpperCase());
}
