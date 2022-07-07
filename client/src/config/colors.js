export const primary = "#1a7fa0";
export const secondary = "#f69977";
export const teal = "#88BFc4";
export const blue = "#103751";
export const orange = "#cf6b4e";
export const lightGray = "#ECEFF1";
export const darkBlue = "#0c293c";
export const dark = "#09151C";
export const positive = "#0FC457";
export const negative = "#EF4444";
export const neutral = "#767676";

export function primaryTransparent(opacity = 1.0) {
  return `rgba(26, 127, 160, ${opacity})`;
}

export function secondaryTransparent(opacity = 1.0) {
  return `rgba(246, 153, 119, ${opacity})`;
}

export function whiteTransparent(opacity = 1.0) {
  return `rgba(255, 255, 255, ${opacity})`;
}

export function blackTransparent(opacity = 1.0) {
  return `rgba(0, 0, 0, ${opacity})`;
}

export function darkTransparent(opacity = 1.0) {
  return `rgba(9, 21, 28, ${opacity})`;
}

export const chartColors = ["#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD", "#8C564B", "#CFECF9", "#7F7F7F", "#BCBD22", "#17BECF"];

export const Colors = {
  primary,
  secondary,
  teal,
  blue,
  orange,
  lightGray,
  darkBlue,
  dark,
  positive,
  negative,
  neutral,
};
