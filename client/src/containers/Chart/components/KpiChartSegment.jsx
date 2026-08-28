import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Chip,
  Tooltip,
} from "@heroui/react";

import { getKpiMetricCapacity } from "../../../visualization/responsiveLayout";
import { LuArrowDownRight, LuArrowUpRight } from "react-icons/lu";

function KpiChartSegment(props) {
  const {
    chart, compact = false, detailScale = 1, editMode,
  } = props;
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
      className="w-full shrink-0 sm:max-w-full"
      ref={containerRef}
      style={{ paddingInline: Math.round((compact ? 4 : 8) * detailScale) }}
    >
      <div
        className="flex min-w-0 flex-row flex-nowrap items-start"
        style={{ gap: Math.round((compact ? 12 : 20) * detailScale) }}
      >
        {visibleGrowth.map((c) => {
          const formattedComparison = c?.comparison && typeof c.comparison === "number" 
            ? Math.abs(c.comparison % 1 === 0 ? Math.round(c.comparison).toFixed(0) : c.comparison.toFixed(2))
            : "0";

          return (
            <div
              className="min-w-0"
              key={c.label}
              style={{ paddingBottom: compact ? 0 : Math.round(8 * detailScale) }}
            >
              <div
                className="flex flex-row items-center whitespace-nowrap"
                style={{ gap: Math.round(8 * detailScale) }}
              >
                <div
                  className="font-tight font-bold text-default-800"
                  style={{ fontSize: Math.round(24 * detailScale), lineHeight: 1.25 }}
                >
                  {`${c.value?.toLocaleString()}`}
                </div>
                {chart.showGrowth && (
                  <Tooltip delay={0} placement="bottom">
                    <Tooltip.Trigger className="flex justify-center">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={c.status === "neutral" ? "default" : c.status === "positive" ? "success" : "danger"}
                        style={{
                          borderRadius: 9999,
                          fontSize: Math.round(12 * detailScale),
                          minHeight: Math.round(24 * detailScale),
                        }}
                      >
                        {c.status === "positive" ? <LuArrowUpRight size={14 * detailScale} /> : c.status === "negative" ? <LuArrowDownRight size={14 * detailScale} /> : null}
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
                <span
                  className={growth.length > 1 ? "text-foreground" : "text-muted"}
                  style={{ fontSize: Math.round(14 * detailScale), lineHeight: 1.4 }}
                >
                  <span style={growth.length > 1 && c.color ? { color: c.color } : undefined}>
                    {c.label}
                  </span>
                </span>
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
  detailScale: PropTypes.number,
  editMode: PropTypes.bool.isRequired,
};

export default KpiChartSegment;
