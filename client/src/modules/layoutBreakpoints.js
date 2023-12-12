export const widthSize = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 240 };

const rowHeight = 150;
export const heightSize = { lg: 5 * rowHeight, md: 4 * rowHeight, sm: 3 * rowHeight, xs: 2 * rowHeight, xxs: rowHeight };

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