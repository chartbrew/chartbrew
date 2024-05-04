import { useState, useEffect, useCallback } from "react";
import gridBreakpoints from "../config/gridBreakpoints";

const useChartSize = (layouts) => {
  const [currentLayout, setCurrentLayout] = useState(null);

  const calculateCurrentLayout = useCallback(() => {
    const screenWidth = window.innerWidth;
    let selectedKey = "xxs"; // Default to the smallest size

    const orderedBreakpoints = Object.keys(gridBreakpoints).sort(
      (a, b) => gridBreakpoints[a] - gridBreakpoints[b]
    );

    orderedBreakpoints.forEach((key) => {
      if (screenWidth >= gridBreakpoints[key]) {
        selectedKey = key;
      }
    });

    if (!layouts?.[selectedKey]) {
      return;
    }

    setCurrentLayout(layouts[selectedKey]);
  }, [layouts]);

  useEffect(() => {
    calculateCurrentLayout();
    // Update layout on window resize
    window.addEventListener("resize", calculateCurrentLayout);
    return () => {
      window.removeEventListener("resize", calculateCurrentLayout);
    };
  }, [calculateCurrentLayout]);

  return currentLayout;
};

export default useChartSize;
