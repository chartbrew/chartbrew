export const primary = "#1a7fa0";
export const secondary = "#f69977";
export const teal = "#88BFc4";
export const blue = "#103751";
export const orange = "#cf6b4e";
export const lightGray = "#ECEFF1";

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
