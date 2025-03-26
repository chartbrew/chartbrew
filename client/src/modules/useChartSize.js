import { useState, useEffect, useCallback } from "react";
import { widthSize } from "./layoutBreakpoints";

const useChartSize = (layouts) => {
  const [currentLayout, setCurrentLayout] = useState(null);

  const calculateCurrentLayout = useCallback(() => {
    const screenWidth = window.innerWidth;
    let selectedKey = "xxs"; // Default to the smallest size

    const orderedBreakpoints = Object.keys(widthSize).sort(
      (a, b) => widthSize[a] - widthSize[b]
    );

    orderedBreakpoints.forEach((key) => {
      if (screenWidth >= widthSize[key]) {
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
