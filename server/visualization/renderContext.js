const RENDER_CONTEXT_DEFAULTS = Object.freeze({
  dashboard: { width: 800, height: 400, pixelRatio: 1 },
  editor: { width: 800, height: 300, pixelRatio: 1 },
  embed: { width: 800, height: 400, pixelRatio: 1 },
  export: { width: 1200, height: 630, pixelRatio: 2 },
  social: { width: 1200, height: 630, pixelRatio: 2 },
});

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createRenderContext(input = {}) {
  const surface = RENDER_CONTEXT_DEFAULTS[input.surface] ? input.surface : "dashboard";
  const defaults = RENDER_CONTEXT_DEFAULTS[surface];
  return {
    height: normalizePositiveNumber(input.height, defaults.height),
    locale: input.locale || "en",
    pixelRatio: normalizePositiveNumber(input.pixelRatio, defaults.pixelRatio),
    reducedMotion: Boolean(input.reducedMotion),
    surface,
    theme: input.theme === "dark" ? "dark" : "light",
    timezone: input.timezone || "UTC",
    width: normalizePositiveNumber(input.width, defaults.width),
  };
}

module.exports = {
  RENDER_CONTEXT_DEFAULTS,
  createRenderContext,
};
