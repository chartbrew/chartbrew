const DETAIL_KEYS = new Set([
  "axisNameGap",
  "barMaxWidth",
  "barMinWidth",
  "borderRadius",
  "borderWidth",
  "distance",
  "fontSize",
  "itemGap",
  "itemHeight",
  "itemWidth",
  "lineHeight",
  "margin",
  "padding",
  "shadowBlur",
  "shadowOffsetX",
  "shadowOffsetY",
  "symbolSize",
]);
const WIDTH_PARENTS = new Set(["lineStyle", "pointer", "progress"]);

function mapAxis(axis, mapper) {
  if (Array.isArray(axis)) return axis.map(mapper);
  return axis ? mapper(axis) : axis;
}

function compactAxis(axis) {
  const numeric = ["log", "time", "value"].includes(axis.type);
  const splitNumber = Number(axis.splitNumber);
  return {
    ...axis,
    ...(numeric ? {
      splitNumber: Number.isFinite(splitNumber) ? Math.min(splitNumber, 4) : 4,
    } : {}),
    axisLabel: {
      ...axis.axisLabel,
      hideOverlap: true,
    },
  };
}

export function compactEChartsAxes(option) {
  return {
    ...option,
    xAxis: mapAxis(option.xAxis, compactAxis),
    yAxis: mapAxis(option.yAxis, compactAxis),
  };
}

function scaleNumber(value, scale) {
  if (value === 0) return 0;
  return Number((value * scale).toFixed(2));
}

function isScalableDimension(key, parentKey, path) {
  if (DETAIL_KEYS.has(key)) return true;
  if (["bottom", "left", "right", "top"].includes(key) && parentKey === "grid") return true;
  if (key === "length" && parentKey === "axisTick") return true;
  if (!["height", "width"].includes(key)) return false;
  return WIDTH_PARENTS.has(parentKey)
    || path.includes("axisLabel")
    || path.includes("label")
    || path.includes("textStyle");
}

export function scaleEChartsDetails(value, scale, key = null, path = []) {
  if (!Number.isFinite(scale) || scale <= 1) return value;
  const parentKey = path[path.length - 1] || null;
  if (typeof value === "number") {
    return isScalableDimension(key, parentKey, path) ? scaleNumber(value, scale) : value;
  }
  if (Array.isArray(value)) {
    if (["borderRadius", "padding", "symbolSize"].includes(key)) {
      return value.map((item) => typeof item === "number" ? scaleNumber(item, scale) : item);
    }
    return value.map((item) => scaleEChartsDetails(item, scale, key, path));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, item]) => {
    return [childKey, scaleEChartsDetails(item, scale, childKey, [...path, key].filter(Boolean))];
  }));
}
