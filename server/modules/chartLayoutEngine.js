/**
 * Chart Layout Engine
 *
 * Handles automatic layout calculation for charts on the dashboard.
 * Ported from client-side autoLayout.js to maintain consistent behavior
 * between AI-created charts and manually created charts.
 */

// Layout breakpoints and columns (exact match from layoutBreakpoints.js)
const layoutBreakpoints = {
  cols: {
    xxxl: 16, xxl: 16, xl: 14, lg: 12, md: 10, sm: 8, xs: 6, xxs: 4
  },
  rowHeight: 150,
  margin: [12, 12]
};

// Safe default layout for all breakpoints to prevent dashboard breakage
const DEFAULT_CHART_LAYOUT = {
  xxxl: [0, 0, 8, 2], // Half width on xxxl screens
  xxl: [0, 0, 8, 2], // Half width on xxl screens
  xl: [0, 0, 7, 2], // Half width on xl screens
  lg: [0, 0, 6, 2], // Half width on large screens
  md: [0, 0, 5, 3], // Half width on medium screens
  sm: [0, 0, 4, 3], // Half width on small screens
  xs: [0, 0, 3, 3], // Half width on extra small screens
  xxs: [0, 0, 2, 3] // Half width on extra extra small screens
};

/**
 * Helper to check if two rectangles overlap (from autoLayout.js)
 * @param {Object} a - Rectangle with x, y, w, h properties
 * @param {Object} b - Rectangle with x, y, w, h properties
 * @returns {boolean} - True if rectangles overlap
 */
function rectanglesOverlap(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return !(ax2 <= b.x || bx2 <= a.x || ay2 <= b.y || by2 <= a.y);
}

/**
 * Convert chart layout array [x, y, w, h] to object format
 * @param {Array} layoutArray - Layout array [x, y, w, h]
 * @returns {Object|null} - Layout object or null if invalid
 */
function layoutArrayToObject(layoutArray) {
  if (!Array.isArray(layoutArray) || layoutArray.length !== 4) return null;
  return {
    x: layoutArray[0],
    y: layoutArray[1],
    w: layoutArray[2],
    h: layoutArray[3]
  };
}

/**
 * Get dashboard layouts grouped by breakpoint (like getDashboardLayout in frontend)
 * @param {Array} existingCharts - Array of existing chart objects
 * @returns {Object} - Layouts grouped by breakpoint
 */
function getDashboardLayouts(existingCharts = []) {
  const layouts = {};

  // Initialize each breakpoint with empty array
  Object.keys(layoutBreakpoints.cols).forEach((bp) => {
    layouts[bp] = [];
  });

  // Extract layout for each breakpoint from each chart
  existingCharts.forEach((chart) => {
    if (chart.layout) {
      Object.keys(layoutBreakpoints.cols).forEach((bp) => {
        const layoutArray = chart.layout[bp];
        const layoutObj = layoutArrayToObject(layoutArray);
        if (layoutObj) {
          layouts[bp].push(layoutObj);
        }
      });
    }
  });

  return layouts;
}

/**
 * Place a new widget on a specific breakpoint (ported from autoLayout.js placeNewWidget)
 * Scans from top-left (0,0) to find the first available position without collision
 * @param {Array} existingLayout - Existing layout items for this breakpoint
 * @param {Object} widget - Widget to place with w and h properties
 * @param {string} bp - Breakpoint name
 * @returns {Object} - Position object with x, y, w, h
 */
function placeNewWidget(existingLayout, widget, bp) {
  const bpCols = layoutBreakpoints.cols[bp] || 12;
  const items = Array.isArray(existingLayout) ? existingLayout : [];
  const w = (bp === "xs" || bp === "xxs") ? bpCols : Math.max(1, Math.min(widget.w || 2, bpCols));
  const h = Math.max(1, widget.h || 2);

  if (items.length === 0) {
    return {
      x: 0, y: 0, w, h
    };
  }

  const placed = items.map((it) => ({ ...it }));

  // Scan rows from 0 to a safe upper bound
  const maxY = placed.reduce((acc, it) => Math.max(acc, it.y + it.h), 0);
  const upper = maxY + 50; // generous bound

  if (bp === "xs" || bp === "xxs") {
    // Always stack to bottom full width
    return {
      x: 0, y: maxY, w, h
    };
  }

  for (let y = 0; y <= upper; y += 1) {
    for (let x = 0; x <= bpCols - w; x += 1) {
      const candidate = {
        x, y, w, h
      };
      const collision = placed.some((it) => rectanglesOverlap(candidate, it));
      if (!collision) {
        return candidate;
      }
    }
  }

  // Fallback at bottom
  const bottom = placed.reduce((acc, it) => Math.max(acc, it.y + it.h), 0);
  return {
    x: 0, y: bottom, w, h
  };
}

/**
 * Calculate default layout position for a new chart (matching frontend logic)
 * Places the chart in the first available position on each breakpoint
 * @param {Array} existingCharts - Array of existing chart objects
 * @param {number} chartSize - Chart size (unused, kept for API compatibility)
 * @returns {Object} - Layout object with positions for all breakpoints
 */
function calculateChartLayout(existingCharts = []) {
  // Get existing layouts grouped by breakpoint
  const layouts = getDashboardLayouts(existingCharts);
  const chartLayout = {};

  // Calculate position for each breakpoint separately (like frontend does)
  Object.keys(layouts).forEach((bp) => {
    // Determine width based on breakpoint and chartSize
    let w;
    if (bp === "lg") {
      w = 4; // default for lg
    } else if (bp === "md") {
      w = 5;
    } else if (bp === "sm") {
      w = 3;
    } else if (bp === "xs" || bp === "xxs") {
      w = 2;
    } else {
      w = 4; // default for xl, xxl, xxxl
    }

    // Place the widget on this breakpoint
    const pos = placeNewWidget(layouts[bp] || [], { w, h: 2 }, bp);
    chartLayout[bp] = [pos.x, pos.y, pos.w, pos.h];
  });

  return chartLayout;
}

/**
 * Ensure layout has all required breakpoints to prevent dashboard breakage
 * @param {Object} layout - Layout object to validate
 * @returns {Object} - Complete layout with all breakpoints
 */
function ensureCompleteLayout(layout) {
  if (!layout || typeof layout !== "object") {
    return { ...DEFAULT_CHART_LAYOUT };
  }

  // Start with default and override with provided values
  const completeLayout = { ...DEFAULT_CHART_LAYOUT };

  // Ensure each breakpoint is properly defined
  Object.keys(DEFAULT_CHART_LAYOUT).forEach((bp) => {
    if (layout[bp] && Array.isArray(layout[bp]) && layout[bp].length === 4) {
      completeLayout[bp] = [...layout[bp]];
    }
  });

  return completeLayout;
}

module.exports = {
  calculateChartLayout,
  ensureCompleteLayout,
  layoutBreakpoints,
  DEFAULT_CHART_LAYOUT,
};
