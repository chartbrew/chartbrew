export const HIGH_DENSITY_SERIES_THRESHOLD = 20;
export const HIGH_DENSITY_POINT_THRESHOLD = 2000;
export const MAX_RENDERED_SERIES = 250;
export const MAX_RENDERED_POINTS = 50000;

const isPresentValue = (value) => value !== null && value !== undefined;

export const getCartesianChartComplexity = (data, chartType) => {
  const datasets = Array.isArray(data?.datasets) ? data.datasets : [];
  const densePointCount = datasets.reduce((total, dataset) => {
    return total + (Array.isArray(dataset?.data) ? dataset.data.length : 0);
  }, 0);
  const presentPointCount = datasets.reduce((total, dataset) => {
    if (!Array.isArray(dataset?.data)) return total;
    return total + dataset.data.reduce((count, value) => {
      return count + (isPresentValue(value) ? 1 : 0);
    }, 0);
  }, 0);
  const renderedPointCount = chartType === "bar" ? presentPointCount : densePointCount;
  const seriesCount = datasets.length;

  return {
    blocked: seriesCount > MAX_RENDERED_SERIES || renderedPointCount > MAX_RENDERED_POINTS,
    densePointCount,
    highDensity: seriesCount >= HIGH_DENSITY_SERIES_THRESHOLD
      || renderedPointCount >= HIGH_DENSITY_POINT_THRESHOLD,
    presentPointCount,
    renderedPointCount,
    seriesCount,
  };
};

export const compactBarChartData = (data, horizontal = false) => {
  if (!Array.isArray(data?.labels) || !Array.isArray(data?.datasets)) return data;

  return {
    ...data,
    datasets: data.datasets.map((dataset) => {
      if (!Array.isArray(dataset?.data)) return dataset;
      const alreadyParsed = dataset.data.some((value) => {
        return isPresentValue(value) && typeof value === "object";
      });
      if (alreadyParsed) return dataset;

      const compactData = [];
      dataset.data.forEach((value, index) => {
        if (!isPresentValue(value)) return;
        const label = data.labels[index];
        compactData.push(horizontal ? { x: value, y: label } : { x: label, y: value });
      });

      return {
        ...dataset,
        data: compactData,
      };
    }),
  };
};

export const applyCartesianPerformanceOptions = (options, complexity, chartType) => {
  if (!complexity.highDensity) return options;

  const intersect = chartType === "bar";
  options.animation = false;
  options.normalized = true;
  options.interaction = {
    intersect,
    mode: "nearest",
  };
  options.hover = {
    intersect,
    mode: "nearest",
  };

  if (options.plugins?.tooltip) {
    options.plugins.tooltip.intersect = intersect;
    options.plugins.tooltip.mode = "nearest";
  }

  return options;
};
