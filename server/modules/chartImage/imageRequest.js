const { resolveImageSize } = require("../../../shared/visualization/imageLayout");
const { sanitizePlainText } = require("../../visualization/image/safeSvg");
const { normalizeHexColor } = require("../../visualization/image/imageTheme");
const { IMAGE_RENDER_LIMITS } = require("./imageLimits");
const { ChartImageError } = require("./imageResponse");

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ROOT_KEYS = new Set(["background", "content", "layout", "locale", "size", "theme", "version"]);
const SIZE_KEYS = new Set(["preset", "sourceHeight", "sourceWidth"]);
const BACKGROUND_KEYS = new Set(["color", "from", "mode", "to"]);
const CONTENT_KEYS = new Set([
  "branding",
  "companyName",
  "dashboardName",
  "dateRange",
  "lastUpdated",
  "logo",
  "subtitle",
  "title",
]);
const TEXT_KEYS = new Set(["show", "text"]);
const LAYOUTS = new Set(["chartOnly", "shareCard"]);
const SIZE_PRESETS = new Set(["landscape", "mobile", "original"]);
const THEMES = new Set(["dark", "light"]);
const BRANDING = new Set(["chartbrew", "whiteLabel"]);

function invalidOptions(cause) {
  return new ChartImageError("INVALID_IMAGE_OPTIONS", { cause });
}

function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidOptions();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw invalidOptions();
  return value;
}

function assertAllowedKeys(value, allowedKeys) {
  assertObject(value);
  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_KEYS.has(key) || !allowedKeys.has(key)) throw invalidOptions();
  });
}

function normalizeBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw invalidOptions();
  return value;
}

function normalizeTextOption(value, defaults, maxCodePoints) {
  if (value === undefined) return { ...defaults };
  assertAllowedKeys(value, TEXT_KEYS);
  const show = normalizeBoolean(value.show, defaults.show);
  if (value.text === undefined) return { show, text: defaults.text };
  if (typeof value.text !== "string") throw invalidOptions();
  const text = sanitizePlainText(value.text, maxCodePoints + 1);
  if ([...text].length > maxCodePoints) throw invalidOptions();
  return { show, text };
}

function normalizeLocale(value = "en-US") {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) throw invalidOptions();
  if (!/^[a-z0-9-]+$/i.test(value)) throw invalidOptions();
  try {
    const locales = Intl.getCanonicalLocales(value);
    if (locales.length !== 1) throw invalidOptions();
    new Intl.DateTimeFormat(locales[0]).format(new Date(0));
    return locales[0];
  } catch (error) {
    if (error instanceof ChartImageError) throw error;
    throw invalidOptions(error);
  }
}

function normalizeSize(value = { preset: "landscape" }) {
  assertAllowedKeys(value, SIZE_KEYS);
  const preset = value.preset || "landscape";
  if (!SIZE_PRESETS.has(preset)) throw invalidOptions();
  if (preset !== "original") {
    if (value.sourceWidth !== undefined || value.sourceHeight !== undefined) throw invalidOptions();
    return { preset, ...resolveImageSize({ preset }) };
  }

  const sourceWidth = value.sourceWidth;
  const sourceHeight = value.sourceHeight;
  if (typeof sourceWidth !== "number" || typeof sourceHeight !== "number"
    || !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)
    || sourceWidth <= 0 || sourceHeight <= 0
    || sourceWidth > IMAGE_RENDER_LIMITS.maxOriginalSourceDimension
    || sourceHeight > IMAGE_RENDER_LIMITS.maxOriginalSourceDimension
    || (sourceWidth * sourceHeight) > IMAGE_RENDER_LIMITS.maxOriginalSourcePixels
  ) {
    throw invalidOptions();
  }
  return {
    preset,
    sourceHeight,
    sourceWidth,
    ...resolveImageSize({ preset, sourceHeight, sourceWidth }),
  };
}

function normalizeBackground(value = { mode: "default" }) {
  assertAllowedKeys(value, BACKGROUND_KEYS);
  const mode = value.mode || "default";
  if (mode === "default") {
    if (value.color !== undefined || value.from !== undefined || value.to !== undefined) {
      throw invalidOptions();
    }
    return { mode };
  }
  if (mode === "custom") {
    if (value.color === undefined || value.from !== undefined || value.to !== undefined) {
      throw invalidOptions();
    }
    try {
      return { color: normalizeHexColor(value.color), mode };
    } catch (error) {
      throw invalidOptions(error);
    }
  }
  if (mode !== "gradient" || value.from === undefined || value.to === undefined) throw invalidOptions();
  if (value.color !== undefined) throw invalidOptions();
  try {
    return {
      from: normalizeHexColor(value.from),
      mode,
      to: normalizeHexColor(value.to),
    };
  } catch (error) {
    throw invalidOptions(error);
  }
}

function normalizeContent(value = {}) {
  assertAllowedKeys(value, CONTENT_KEYS);
  const branding = value.branding === undefined ? null : value.branding;
  if (branding !== null && !BRANDING.has(branding)) throw invalidOptions();
  return {
    branding,
    companyName: normalizeBoolean(value.companyName, true),
    dashboardName: normalizeBoolean(value.dashboardName, true),
    dateRange: normalizeBoolean(value.dateRange, false),
    lastUpdated: normalizeBoolean(value.lastUpdated, false),
    logo: normalizeBoolean(value.logo, true),
    subtitle: normalizeTextOption(value.subtitle, { show: false, text: "" }, 240),
    title: normalizeTextOption(value.title, { show: true, text: null }, 160),
  };
}

function normalizeImageRequest(value) {
  try {
    assertAllowedKeys(value, ROOT_KEYS);
    if (value.version !== 1) throw invalidOptions();
    const layout = value.layout || "shareCard";
    const theme = value.theme || "light";
    if (!LAYOUTS.has(layout) || !THEMES.has(theme)) throw invalidOptions();
    const size = normalizeSize(value.size);
    return {
      background: normalizeBackground(value.background),
      content: normalizeContent(value.content),
      height: size.height,
      layout,
      locale: normalizeLocale(value.locale),
      size,
      theme,
      version: 1,
      width: size.width,
    };
  } catch (error) {
    if (error instanceof ChartImageError) throw error;
    throw invalidOptions(error);
  }
}

module.exports = {
  normalizeImageRequest,
  normalizeLocale,
  normalizeSize,
};
