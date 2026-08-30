import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import {
  Chip,
  ProgressBar, Tooltip,
} from "@heroui/react";
import { LuArrowUpRight, LuArrowDownRight } from "react-icons/lu";

import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { getWidthBreakpoint } from "../../../modules/layoutBreakpoints";

function KpiMode(props) {
  const { chart } = props;
  const [chartSize, setChartSize] = useState(2);
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setIsCompact(containerRef.current.offsetWidth < 300 || containerRef.current.offsetHeight < 200);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    switch (getWidthBreakpoint(containerRef)) {
      case "xxs":
      case "xs":
        setChartSize(1);
        break;
      case "sm":
        setChartSize(2);
        break;
      case "md":
        setChartSize(3);
        break;
      case "lg":
        setChartSize(4);
        break;
    }
  }, [containerRef.current]);

  const _renderGrowth = (c) => {
    if (!c) return (<span />);
    const { status, comparison } = c;
    const formattedComparison = Math.abs(comparison % 1 === 0 ? Math.round(comparison).toFixed(0) : comparison.toFixed(2));
    return (
      <div>
        <Tooltip>
          <Tooltip.Trigger>
            <div className="w-full py-1">
              <Chip
                size="sm"
                variant="soft"
                color={status === "neutral" ? "default" : status === "positive" ? "success" : "danger"}
              >
                {status === "positive" ? <LuArrowUpRight size={14} /> : status === "negative" ? <LuArrowDownRight size={14} /> : null}
                <Chip.Label>{`${formattedComparison}%`}</Chip.Label>
              </Chip>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content placement="bottom">
            {`compared to last ${chart.timeInterval}`}
          </Tooltip.Content>
        </Tooltip>
      </div>
    );
  };

  const _renderGoal = (item) => {
    if (item.goal === null || item.valueNumber === null) return (<span />);

    return (
      <div className="pt-2 w-full">
        <div className="flex justify-between mb-1">
          <div className="text-xs text-default-500">{`${((item.valueNumber / item.goal) * 100).toFixed()}%`}</div>
          <div className="text-xs text-default-500">{item.formattedGoal}</div>
        </div>
        <ProgressBar
          value={Number.isFinite(Number(item.valueNumber)) ? Number(item.valueNumber) : 0}
          maxValue={item.goal}
          minValue={0}
          size="sm"
          aria-label="Goal progress"
        >
          <ProgressBar.Track>
            <ProgressBar.Fill style={item.color ? { backgroundColor: item.color } : undefined} />
          </ProgressBar.Track>
        </ProgressBar>
      </div>
    );
  };

  const items = chart.render?.configuration?.items || [];

  return (
    <div ref={containerRef} className={"flex h-full w-full gap-2 items-center justify-center align-middle flex-wrap"}>
      {items.map((item, index) => {
        if (isCompact && index > 0) return null;
        const hasGoal = item.goal !== null && item.goal !== undefined;

        return (
          <div key={item.id} className={`${isCompact ? "p-0" : "p-2"} ${hasGoal && isCompact ? "w-full" : ""} gap-4`}>
            {item.label && (
              <div className={`flex items-center ${hasGoal ? "justify-start" : "justify-center"}`}>
                <Text className={`${chart.showGrowth ? "-mt-[5px]" : "mt-0"} text-center text-muted`}>
                  <span>{item.label}</span>
                </Text>
              </div>
            )}

            <div className={`flex items-center ${hasGoal ? "justify-between" : "justify-center"} gap-4`}>
              <div
                className={`${chartSize === 1 || chartSize === 2 ? "text-3xl" : "text-4xl"} text-default-800 font-bold font-tight`}
                key={item.id}
              >
                {item.value ?? "—"}
              </div>
              {hasGoal && chart.showGrowth && item.comparison !== null && (
                <div>
                  {_renderGrowth(item)}
                </div>
              )}
            </div>
            
            {!hasGoal && chart.showGrowth && item.comparison !== null && (
              <Row justify="center" align="center">
                {_renderGrowth(item)}
              </Row>
            )}

            {hasGoal && (
              <Row justify="center" align="center">
                {_renderGoal(item)}
              </Row>
            )}
          </div>
        );
      })}
    </div>
  );
}

KpiMode.propTypes = {
  chart: PropTypes.object.isRequired,
};

export default KpiMode;
