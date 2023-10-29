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

// export const chartColors = ["#51BAB0", "#9AE25F", "#FF7597", "#969ECB", "#FBEF89", "#6EE6F5", "#BB86FC", "#FFC479", "#42A5F5", "#F07E7C", "#FF6900", "#FCB900", "#7BDCB5", "#00D084", "#8ED1FC", "#0693E3", "#ABB8C3", "#EB144C", "#F78DA7", "#9900EF", "#009A87"];

export const chartColors = {
  blue: {
    hex: "#4285F4",
    rgb: "rgba(66, 133, 244, 1)",
  },
  amber: {
    hex: "#FF9800",
    rgb: "rgba(255, 152, 0, 1)",
  },
  teal: {
    hex: "#26A69A",
    rgb: "rgba(38, 166, 154, 1)",
  },
  fuchsia: {
    hex: "#D602EE",
    rgb: "rgba(214, 2, 238, 1)",
  },
  lime: {
    hex: "#C0CA33",
    rgb: "rgba(192, 202, 51, 1)",
  },
  deep_fuchsia: {
    hex: "#9C27B0",
    rgb: "rgba(156, 39, 176, 1)",
  },
  orange: {
    hex: "#EE6002",
    rgb: "rgba(238, 96, 2, 1)",
  },
  light_purple: {
    hex: "#C8A1FF",
    rgb: "rgba(200, 161, 255, 1)",
  },
  green: {
    hex: "#43A047",
    rgb: "rgba(67, 160, 71, 1)",
  },
  rose: {
    hex: "#D81B60",
    rgb: "rgba(216, 27, 96, 1)",
  },
  purple: {
    hex: "#6200EE",
    rgb: "rgba(98, 0, 238, 1)",
  },
  yellow: {
    hex: "#FFC107",
    rgb: "rgba(255, 193, 7, 1)",
  },
  deep_purple: {
    hex: "#3B00ED",
    rgb: "rgba(59, 0, 237, 1)",
  },
  error: {
    hex: "#B00020",
    rgb: "rgba(176, 0, 32, 1)",
  },
  pink: {
    hex: "#EB3693",
    rgb: "rgba(235, 54, 147, 1)",
  }
};

export const fillChartColors = [""]

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
