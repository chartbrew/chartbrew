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

function hexToRgb(value) {
  const hex = normalizeHexColor(value).slice(1);
  return {
    blue: Number.parseInt(hex.slice(4, 6), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    red: Number.parseInt(hex.slice(0, 2), 16),
  };
}

function rgbToHex({ blue, green, red }) {
  const channel = (value) => Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

function mixColor(color, target, weight) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  return rgbToHex({
    blue: sourceRgb.blue + ((targetRgb.blue - sourceRgb.blue) * weight),
    green: sourceRgb.green + ((targetRgb.green - sourceRgb.green) * weight),
    red: sourceRgb.red + ((targetRgb.red - sourceRgb.red) * weight),
  });
}

function getRelativeLuminance(color) {
  const convert = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const rgb = hexToRgb(color);
  return (0.2126 * convert(rgb.red))
    + (0.7152 * convert(rgb.green))
    + (0.0722 * convert(rgb.blue));
}

function resolveImageTheme({ background = { mode: "default" }, theme = "light" } = {}) {
  const mode = theme === "dark" ? "dark" : "light";
  const base = IMAGE_THEMES[mode];
  if (background.mode !== "custom") return { ...base, mode };

  const custom = normalizeHexColor(background.color);
  const isDark = getRelativeLuminance(custom) < 0.35;
  const foreground = isDark ? "#FAFAFA" : "#18181B";
  const mixTarget = isDark ? "#FFFFFF" : "#000000";
  return {
    axis: mixColor(custom, mixTarget, isDark ? 0.46 : 0.42),
    background: custom,
    card: mixColor(custom, mixTarget, isDark ? 0.06 : 0.025),
    divider: mixColor(custom, mixTarget, isDark ? 0.22 : 0.14),
    foreground,
    mode: isDark ? "dark" : "light",
    muted: mixColor(foreground, custom, 0.42),
    positive: isDark ? "#4ADE80" : "#15803D",
    negative: isDark ? "#F87171" : "#B91C1C",
  };
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
  getRelativeLuminance,
  normalizeHexColor,
  resolveImageTheme,
};
