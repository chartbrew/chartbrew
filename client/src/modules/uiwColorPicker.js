import {
  hexToHsva,
  hslStringToHsva,
  hsvaStringToHsva,
  rgbaStringToHsva,
  validHex,
} from "@uiw/color-convert";

const TRANSPARENT_COLOR_VALUES = new Set(["transparent", "rgba(0,0,0,0)", "rgba(0, 0, 0, 0)"]);

export function normalizeColorForUiwPicker(color, fallback = "#000000") {
  if (color && typeof color === "object" && "h" in color && "s" in color && "v" in color) {
    return {
      ...color,
      a: typeof color.a === "number" ? color.a : 1,
    };
  }

  if (typeof color !== "string") {
    return hexToHsva(fallback);
  }

  const trimmedColor = color.trim();
  if (!trimmedColor || TRANSPARENT_COLOR_VALUES.has(trimmedColor.toLowerCase())) {
    return hexToHsva(fallback);
  }

  if (validHex(trimmedColor)) {
    return hexToHsva(trimmedColor);
  }

  if (trimmedColor.startsWith("rgb")) {
    return rgbaStringToHsva(trimmedColor);
  }

  if (trimmedColor.startsWith("hsl")) {
    return hslStringToHsva(trimmedColor);
  }

  if (trimmedColor.startsWith("hsv")) {
    return hsvaStringToHsva(trimmedColor);
  }

  return hexToHsva(fallback);
}
