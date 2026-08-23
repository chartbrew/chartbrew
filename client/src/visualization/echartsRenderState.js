function getSeries(option) {
  if (!option?.series) return [];
  return Array.isArray(option.series) ? option.series : [option.series];
}

function getAxis(option, name) {
  const axis = option?.[name];
  return Array.isArray(axis) ? axis[0] : axis;
}

export function getEChartsPreset(option) {
  const series = getSeries(option);
  if (series.some((item) => item.type === "gauge")) return "gauge";
  if (series.some((item) => item.type === "radar")) return "radar";
  if (series.some((item) => item.coordinateSystem === "polar")) return "polar";
  if (series.some((item) => ["heatmap", "scatter"].includes(item.type)) && option.visualMap) {
    return "matrix";
  }
  if (series.some((item) => item.type === "pie")) {
    return series.some((item) => Array.isArray(item.radius)) ? "doughnut" : "pie";
  }
  if (series.some((item) => item.type === "bar")) {
    const xAxis = getAxis(option, "xAxis");
    const yAxis = getAxis(option, "yAxis");
    return ["value", "log"].includes(xAxis?.type) && yAxis?.type === "category"
      ? "horizontalBar"
      : "bar";
  }
  if (series.some((item) => item.type === "line")) {
    return series.some((item) => item.areaStyle) ? "area" : "line";
  }
  return null;
}

export function isCompatibleEChartsRender(type, render) {
  return render?.renderer === "echarts"
    && Boolean(render.configuration)
    && getEChartsPreset(render.configuration) === type;
}

export function selectEChartsRender({ loading, previous, render, type }) {
  if (isCompatibleEChartsRender(type, render)) return { ...render, type };
  return loading ? previous : null;
}
