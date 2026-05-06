const BREAKPOINT_COLS = {
  xxxl: 16,
  xxl: 16,
  xl: 14,
  lg: 12,
  md: 10,
  sm: 8,
  xs: 6,
  xxs: 4,
};

const BREAKPOINTS = Object.keys(BREAKPOINT_COLS);

const SIZE_PRESETS = {
  kpi: {
    xxxl: [4, 2],
    xxl: [4, 2],
    xl: [3, 2],
    lg: [3, 2],
    md: [5, 2],
    sm: [4, 2],
    xs: [6, 2],
    xxs: [4, 2],
  },
  trend: {
    xxxl: [5, 3],
    xxl: [5, 3],
    xl: [5, 3],
    lg: [4, 3],
    md: [5, 3],
    sm: [4, 3],
    xs: [6, 3],
    xxs: [4, 3],
  },
  comparison: {
    xxxl: [6, 3],
    xxl: [6, 3],
    xl: [7, 3],
    lg: [6, 3],
    md: [5, 3],
    sm: [4, 3],
    xs: [6, 3],
    xxs: [4, 3],
  },
  table: {
    xxxl: [8, 3],
    xxl: [8, 3],
    xl: [7, 3],
    lg: [6, 3],
    md: [10, 3],
    sm: [8, 3],
    xs: [6, 3],
    xxs: [4, 3],
  },
};

function rectanglesOverlap(left, right) {
  const leftX2 = left.x + left.w;
  const leftY2 = left.y + left.h;
  const rightX2 = right.x + right.w;
  const rightY2 = right.y + right.h;
  return !(leftX2 <= right.x || rightX2 <= left.x || leftY2 <= right.y || rightY2 <= left.y);
}

function inferLayoutKind(chartTemplate) {
  if (chartTemplate.layoutIntent?.kind) return chartTemplate.layoutIntent.kind;
  if (chartTemplate.type === "table") return "table";
  if (chartTemplate.type === "kpi" || chartTemplate.chart?.mode === "kpichart") return "kpi";
  if (Array.isArray(chartTemplate.cdcs) && chartTemplate.cdcs.length > 1) return "comparison";
  return "trend";
}

function getSize(chartTemplate, breakpoint) {
  const kind = inferLayoutKind(chartTemplate);
  const preset = SIZE_PRESETS[kind] || SIZE_PRESETS.trend;
  const customSize = chartTemplate.layoutIntent?.sizes?.[breakpoint];
  const [width, height] = customSize || preset[breakpoint];
  const breakpointCols = BREAKPOINT_COLS[breakpoint];
  return {
    w: Math.max(1, Math.min(width, breakpointCols)),
    h: Math.max(1, height),
  };
}

function getExistingItems(existingCharts, breakpoint) {
  return existingCharts
    .map((chart) => {
      const layout = chart.layout?.[breakpoint];
      if (!Array.isArray(layout) || layout.length < 4) return null;
      const [x, y, w, h] = layout;
      return {
        i: `${chart.id}`,
        x,
        y,
        w,
        h,
      };
    })
    .filter(Boolean);
}

function getBottom(items) {
  return items.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0);
}

function placeItem({ item, placed, breakpoint }) {
  const breakpointCols = BREAKPOINT_COLS[breakpoint];

  if (breakpoint === "xs" || breakpoint === "xxs") {
    return {
      ...item,
      x: 0,
      y: getBottom(placed),
      w: breakpointCols,
    };
  }

  const maxX = Math.max(0, breakpointCols - item.w);
  const maxY = getBottom(placed) + 50;
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const candidate = { ...item, x, y };
      if (!placed.some((placedItem) => rectanglesOverlap(candidate, placedItem))) {
        return candidate;
      }
    }
  }

  return {
    ...item,
    x: 0,
    y: getBottom(placed),
  };
}

function getPriority(chartTemplate, index) {
  if (Number.isFinite(chartTemplate.layoutIntent?.priority)) {
    return chartTemplate.layoutIntent.priority;
  }
  return index + 1000;
}

function buildTemplateLayouts(chartTemplates, options = {}) {
  const existingCharts = options.existingCharts || [];
  const orderedCharts = chartTemplates
    .map((chartTemplate, index) => ({
      chartTemplate,
      index,
      priority: getPriority(chartTemplate, index),
    }))
    .sort((left, right) => (left.priority - right.priority) || (left.index - right.index));

  return BREAKPOINTS.reduce((layoutsByChartId, breakpoint) => {
    const placed = getExistingItems(existingCharts, breakpoint);

    orderedCharts.forEach(({ chartTemplate }) => {
      const item = {
        i: chartTemplate.id,
        ...getSize(chartTemplate, breakpoint),
      };
      const placedItem = placeItem({ item, placed, breakpoint });
      placed.push(placedItem);

      if (!layoutsByChartId[chartTemplate.id]) {
        layoutsByChartId[chartTemplate.id] = {};
      }
      layoutsByChartId[chartTemplate.id][breakpoint] = [
        placedItem.x,
        placedItem.y,
        placedItem.w,
        placedItem.h,
      ];
    });

    return layoutsByChartId;
  }, {});
}

module.exports = {
  BREAKPOINT_COLS,
  BREAKPOINTS,
  buildTemplateLayouts,
};
