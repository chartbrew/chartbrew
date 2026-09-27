export const reportColorLabels = {
  page: "Page",
  header: "Header",
  headerText: "Header text",
  surface: "Chart cards",
  text: "Primary text",
  mutedText: "Secondary text",
  border: "Borders",
  accent: "Accent",
  accentText: "Accent text",
};

const light = {
  page: "#F6F5F4", header: "#FFFFFF", headerText: "#242322", surface: "#FFFFFF",
  text: "#242322", mutedText: "#666360", border: "#DFDEDD", accent: "#0276BE", accentText: "#FFFFFF",
};
const dark = {
  page: "#111110", header: "#1C1B1A", headerText: "#FAFAF9", surface: "#1C1B1A",
  text: "#FAFAF9", mutedText: "#AAA6A2", border: "#2A2929", accent: "#98D2F5", accentText: "#102B3D",
};

export const reportThemes = [
  { id: "chartbrew", name: "Chartbrew", appearance: { mode: "system", light, dark } },
  {
    id: "neutral", name: "Neutral",
    appearance: {
      mode: "system",
      light: { ...light, page: "#F4F4F5", header: "#FAFAFA", accent: "#3F3F46", accentText: "#FFFFFF" },
      dark: { ...dark, page: "#141416", header: "#202023", surface: "#202023", accent: "#E4E4E7", accentText: "#27272A" },
    },
  },
  {
    id: "forest", name: "Forest",
    appearance: {
      mode: "system",
      light: { ...light, page: "#F3F6F4", header: "#173F35", headerText: "#F4FBF7", accent: "#236B50" },
      dark: { ...dark, page: "#101915", header: "#19382C", surface: "#1B2822", accent: "#9AD5B4", accentText: "#143224", border: "#7B9384" },
    },
  },
  {
    id: "ocean", name: "Ocean",
    appearance: {
      mode: "system",
      light: { ...light, page: "#F1F7F8", header: "#164653", headerText: "#F0FAFC", accent: "#096778" },
      dark: { ...dark, page: "#10191C", header: "#18343D", surface: "#1B282D", accent: "#8AD5E3", accentText: "#12333B", border: "#82979D" },
    },
  },
  {
    id: "rose", name: "Rose",
    appearance: {
      mode: "system",
      light: { ...light, page: "#FAF4F6", header: "#F5E5EB", headerText: "#54283B", accent: "#9B365D" },
      dark: { ...dark, page: "#1C1418", header: "#3B2330", surface: "#2B2026", accent: "#F0A8C1", accentText: "#492035", border: "#A08491" },
    },
  },
  {
    id: "citrus", name: "Citrus",
    appearance: {
      mode: "system",
      light: { ...light, page: "#F7F8F2", header: "#ECF0C9", headerText: "#363F1B", accent: "#596B1E" },
      dark: { ...dark, page: "#171A12", header: "#30391E", surface: "#252A1D", accent: "#CEDD88", accentText: "#2E3914", border: "#919A7D" },
    },
  },
];

export function normalizeReportColor(value) {
  if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) {
    throw new Error("Enter a color such as #0276BE.");
  }
  const hex = value.slice(1);
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex}`.toUpperCase();
}

export function validateReportAppearance(value) {
  const object = (item) => item && typeof item === "object" && !Array.isArray(item);
  if (!object(value) || Object.keys(value).length !== 3
    || !["system", "light", "dark"].includes(value.mode)) {
    throw new Error("Choose an appearance and supply both light and dark colors.");
  }
  const result = { mode: value.mode };
  for (const mode of ["light", "dark"]) {
    if (!object(value[mode]) || Object.keys(value[mode]).length !== Object.keys(reportColorLabels).length) {
      throw new Error(`Supply all ${mode} colors.`);
    }
    result[mode] = Object.fromEntries(Object.keys(reportColorLabels).map((key) => [key, normalizeReportColor(value[mode][key])]));
  }
  return result;
}

export function initialReportAppearance(project) {
  if (project.reportAppearance) return project.reportAppearance;
  const appearance = structuredClone(reportThemes[0].appearance);
  for (const mode of ["light", "dark"]) {
    for (const [field, key] of [["backgroundColor", "header"], ["titleColor", "headerText"]]) {
      try {
        if (project[field]) appearance[mode][key] = normalizeReportColor(project[field]);
      } catch { /* Legacy CSS colors remain unchanged until a theme is saved. */ }
    }
  }
  return appearance;
}

export function resolveReportMode({ preview, query, mode, prefersDark }) {
  for (const value of [preview, query, mode]) {
    if (value === "light" || value === "dark") return value;
  }
  return prefersDark ? "dark" : "light";
}

export function reportColorVariables(colors) {
  if (!colors) return {};
  return {
    "--background": colors.page,
    "--foreground": colors.text,
    "--surface": colors.surface,
    "--surface-foreground": colors.text,
    "--surface-secondary": `color-mix(in srgb, ${colors.surface} 92%, ${colors.text})`,
    "--surface-secondary-foreground": colors.text,
    "--surface-tertiary": `color-mix(in srgb, ${colors.surface} 85%, ${colors.text})`,
    "--surface-tertiary-foreground": colors.text,
    "--overlay": colors.surface,
    "--overlay-foreground": colors.text,
    "--field-background": colors.surface,
    "--field-foreground": colors.text,
    "--field-placeholder": colors.mutedText,
    "--default": `color-mix(in srgb, ${colors.surface} 92%, ${colors.text})`,
    "--default-foreground": colors.text,
    "--muted": colors.mutedText,
    "--border": colors.border,
    "--separator": colors.border,
    "--accent": colors.accent,
    "--accent-foreground": colors.accentText,
    "--focus": colors.accent,
    "--link": colors.accent,
    "--cb-content1": colors.surface,
    "--cb-content2": colors.page,
    "--cb-content3": colors.border,
    "--cb-content4": colors.border,
    "--cb-default": `color-mix(in srgb, ${colors.surface} 92%, ${colors.text})`,
    "--cb-default-foreground": colors.text,
    "--cb-default-50": colors.surface,
    "--cb-default-100": colors.page,
    "--cb-default-200": colors.border,
    "--cb-default-300": colors.border,
    "--cb-default-400": colors.mutedText,
    "--cb-default-500": colors.mutedText,
    "--cb-default-600": colors.mutedText,
    "--cb-default-700": colors.text,
    "--cb-default-800": colors.text,
    "--cb-default-900": colors.text,
  };
}

export function reportContrastWarnings(colors) {
  const luminance = (hex) => {
    const rgb = normalizeReportColor(hex).slice(1).match(/../g).map((part) => {
      const channel = parseInt(part, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  return [
    ["headerText", "header", 4.5], ["text", "surface", 4.5], ["text", "page", 4.5],
    ["mutedText", "surface", 4.5], ["mutedText", "page", 4.5],
    ["accentText", "accent", 4.5], ["accent", "surface", 3],
  ].filter(([text, background, minimum]) => {
    const a = luminance(colors[text]);
    const b = luminance(colors[background]);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < minimum;
  }).map(([text, background]) => ({ field: text, message: `${reportColorLabels[text]} has low contrast against ${reportColorLabels[background].toLowerCase()}.` }));
}
