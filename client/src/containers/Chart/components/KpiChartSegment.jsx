import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Chip,
  Tooltip,
} from "@heroui/react";

import Text from "../../../components/Text";
import { getKpiMetricCapacity } from "../../../visualization/responsiveLayout";
import { LuArrowDownRight, LuArrowUpRight } from "react-icons/lu";

function KpiChartSegment(props) {
  const { chart, compact, editMode } = props;
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const growth = Array.isArray(chart.chartData?.growth) ? chart.chartData.growth : [];
  const visibleCount = getKpiMetricCapacity(containerWidth, editMode);
  const visibleGrowth = growth.slice(0, visibleCount);
  const hiddenGrowth = growth.slice(visibleCount);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const updateWidth = () => setContainerWidth(container.clientWidth);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`${compact ? "px-1" : "px-unit-sm"} w-full shrink-0 sm:max-w-full`}
      ref={containerRef}
    >
      <div className={`flex min-w-0 flex-row flex-nowrap items-start ${compact ? "gap-3" : "gap-5"}`}>
        {visibleGrowth.map((c) => {
          const formattedComparison = c?.comparison && typeof c.comparison === "number" 
            ? Math.abs(c.comparison % 1 === 0 ? Math.round(c.comparison).toFixed(0) : c.comparison.toFixed(2))
            : "0";

          return (
            <div
              className={`min-w-0 ${compact ? "pb-0" : "pb-2"}`}
              key={c.label}
            >
              <div className="flex flex-row items-center gap-2 whitespace-nowrap">
                <div className="font-tight text-2xl font-bold text-default-800">
                  {`${c.value?.toLocaleString()}`}
                </div>
                {chart.showGrowth && (
                  <Tooltip delay={0} placement="bottom">
                    <Tooltip.Trigger className="flex justify-center">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={c.status === "neutral" ? "default" : c.status === "positive" ? "success" : "danger"}
                      >
                        {c.status === "positive" ? <LuArrowUpRight size={14} /> : c.status === "negative" ? <LuArrowDownRight size={14} /> : null}
                        <Chip.Label>{`${formattedComparison}%`}</Chip.Label>
                      </Chip>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      {`compared to last ${chart.timeInterval}`}
                    </Tooltip.Content>
                  </Tooltip>
                )}
              </div>
              <div className="truncate">
                <Text size="sm" className={growth.length > 1 ? undefined : "text-muted"}>
                  <span style={growth.length > 1 && c.color ? { color: c.color } : undefined}>
                    {c.label}
                  </span>
                </Text>
              </div>
            </div>
          );
        })}
        {hiddenGrowth.length > 0 && (
          <Tooltip delay={0} placement="bottom">
            <Tooltip.Trigger className="mt-1 shrink-0">
              <button type="button" className="text-xs text-default-500">
                {`+${hiddenGrowth.length}`}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              {hiddenGrowth.map((item) => item.label).join(", ")}
            </Tooltip.Content>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

KpiChartSegment.propTypes = {
  chart: PropTypes.object.isRequired,
  compact: PropTypes.bool,
  editMode: PropTypes.bool.isRequired,
};

KpiChartSegment.defaultProps = {
  compact: false,
};

export default KpiChartSegment;
