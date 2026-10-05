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
  if (series.some((item) => item.type === "map" || item.coordinateSystem === "geo")) return "map";
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
    return "line";
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

export function getEChartsAnimation(option, firstRender, reducedMotion, renderer) {
  const animation = option.animation !== false && firstRender && !reducedMotion && renderer === "canvas";
  return {
    animation,
    animationDuration: 700,
    animationEasing: "cubicOut",
    series: getSeries(option).map((series) => ({
      ...series,
      animation: animation && series.animation !== false,
      animationDuration: {
        bar: 600,
        gauge: 800,
        line: 800,
        pie: 800,
        radar: 700,
        scatter: 450,
      }[series.type] || 700,
      animationEasing: "cubicOut",
      animationDelay: ["bar", "scatter"].includes(series.type)
        ? (index) => Math.min(index * 30, 180)
        : 0,
      ...(series.type === "pie" ? { animationType: "expansion" } : {}),
    })),
  };
}
