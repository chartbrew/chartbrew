const IMAGE_THEMES = Object.freeze({
  dark: Object.freeze({
    axis: "#71717A",
    background: "#09090B",
    card: "#18181B",
    divider: "#3F3F46",
    foreground: "#FAFAFA",
    muted: "#A1A1AA",
    positive: "#22C55E",
    negative: "#EF4444",
  }),
  light: Object.freeze({
    axis: "#A1A1AA",
    background: "#F4F4F5",
    card: "#FFFFFF",
    divider: "#E4E4E7",
    foreground: "#18181B",
    muted: "#71717A",
    positive: "#16A34A",
    negative: "#DC2626",
  }),
});

function normalizeHexColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error("Custom image background must be an opaque hex color");
  }
  return value.toUpperCase();
}

function resolveImageTheme({ background = { mode: "default" }, theme = "light" } = {}) {
  const mode = theme === "dark" ? "dark" : "light";
  const base = IMAGE_THEMES[mode];
  if (background.mode === "custom") {
    return {
      ...base,
      background: normalizeHexColor(background.color),
      mode,
    };
  }
  if (background.mode === "gradient") {
    return {
      ...base,
      background: normalizeHexColor(background.from),
      backgroundGradient: {
        from: normalizeHexColor(background.from),
        to: normalizeHexColor(background.to),
      },
      mode,
    };
  }
  return { ...base, mode };
}

function buildEChartsImageTheme(colors) {
  const axis = {
    axisLabel: { color: colors.foreground },
    axisLine: { lineStyle: { color: colors.divider } },
    splitLine: { lineStyle: { color: colors.divider } },
  };
  return {
    backgroundColor: "transparent",
    categoryAxis: axis,
    gauge: {
      detail: { color: colors.foreground },
      itemStyle: { color: colors.foreground },
      title: { color: colors.muted },
    },
    legend: { textStyle: { color: colors.foreground } },
    textStyle: { color: colors.foreground, fontFamily: "Chartbrew Inter Tight" },
    timeAxis: axis,
    title: { textStyle: { color: colors.foreground } },
    valueAxis: axis,
  };
}

module.exports = {
  IMAGE_THEMES,
  buildEChartsImageTheme,
  normalizeHexColor,
  resolveImageTheme,
};
