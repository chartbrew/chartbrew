export const widthSize = { xxxl: 3840, xxl: 2560, xl: 1600, lg: 1200, md: 996, sm: 768, xs: 480, xxs: 240 };

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

export const cols = { xxxl: 16, xxl: 16, xl: 14, lg: 12, md: 10, sm: 8, xs: 6, xxs: 4 };

export const margin = { xxxl: [12, 12], xxl: [12, 12], xl: [12, 12], lg: [12, 12], md: [12, 12], sm: [12, 12], xs: [12, 12], xxs: [12, 12] };
