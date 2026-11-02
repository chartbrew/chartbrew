const { appendCharts, cols, breakpoints } = require("../../../../shared/dashboard/layout.mjs");

function buildTemplateLayouts(charts, { existingCharts = [], custom = breakpoints } = {}) {
  const ordered = charts.map((chart, index) => ({ chart, priority: chart.layoutIntent?.priority ?? index + 1000 }))
    .sort((a, b) => a.priority - b.priority).map(({ chart }) => chart);
  return appendCharts(existingCharts, ordered, custom);
}

module.exports = { BREAKPOINT_COLS: cols, BREAKPOINTS: breakpoints, buildTemplateLayouts };
