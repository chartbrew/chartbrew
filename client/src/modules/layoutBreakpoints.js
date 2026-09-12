export { widths as widthSize, cols, margin } from "../../../shared/dashboard/layout.mjs";
import { widths as widthSize } from "../../../shared/dashboard/layout.mjs";

const rowHeight = 150;
export const heightSize = { xxxl: 5 * rowHeight, xxl: 5 * rowHeight, xl: 5 * rowHeight, lg: 5 * rowHeight, md: 4 * rowHeight, sm: 3 * rowHeight, xs: 2 * rowHeight, xxs: rowHeight };

export const getWidthBreakpoint = (containerRef) => {
  if (!containerRef?.current?.offsetWidth) return "md";
  // find the breakpoint of the chart
  const containerWidth = containerRef.current.offsetWidth;
  let chartBreakpoint;
  Object.keys(widthSize).forEach((breakpoint) => {
    if (containerWidth < widthSize[breakpoint]) {
      chartBreakpoint = breakpoint;
    }
  });

  return chartBreakpoint;
};

export const getHeightBreakpoint = (containerRef) => {
  if (!containerRef?.current?.offsetHeight) return "md";
  // find the breakpoint of the chart
  const containerHeight = containerRef.current.offsetHeight;
  let chartBreakpoint;
  Object.keys(heightSize).forEach((breakpoint) => {
    if (containerHeight < heightSize[breakpoint]) {
      chartBreakpoint = breakpoint;
    }
  });

  return chartBreakpoint;
};
