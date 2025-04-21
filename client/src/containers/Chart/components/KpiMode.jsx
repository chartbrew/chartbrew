import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import {
  Chip,
  Progress, Tooltip,
} from "@heroui/react";
import { LuArrowUpRight, LuArrowDownRight } from "react-icons/lu";

import determineType from "../../../modules/determineType";
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

  const _getKpi = (data) => {
    let finalData;
    if (data && Array.isArray(data)) {
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i]
          && (determineType(data[i]) !== "array" || determineType(data[i]) !== "object")
        ) {
          finalData = data[i];
          break;
        }
      }

      if (!finalData) {
        finalData = `${data[data.length - 1]}`;
      }
    }

    if (`${parseFloat(finalData)}` === `${finalData}`) {
      return parseFloat(finalData)?.toLocaleString();
    }

    return `${finalData}`;
  };

  const _renderGrowth = (c) => {
    if (!c) return (<span />);
    const { status, comparison } = c;
    const formattedComparison = comparison % 1 === 0 ? Math.round(comparison).toFixed(0) : comparison.toFixed(2);
    return (
      <div>
        <Tooltip content={`compared to last ${chart.timeInterval}`} placement="bottom">
          <div className="w-full py-1">
            <Chip
              size="sm"
              variant="flat"
              radius="sm"
              color={status === "neutral" ? "default" : status === "positive" ? "success" : "danger"}
              startContent={status === "positive" ? <LuArrowUpRight size={14} /> : status === "negative" ? <LuArrowDownRight size={14} /> : ""}
            >
              {`${formattedComparison}%`}
            </Chip>
          </div>
        </Tooltip>
      </div>
    );
  };

  const _hasGoal = (goals, index) => {
    return goals && goals.length > 0 && goals.find((g) => g.goalIndex === index);
  };

  const _renderGoal = (goals, index) => {
    const goal = goals.find((g) => g.goalIndex === index);
    const color = chart.ChartDatasetConfigs[index] && chart.ChartDatasetConfigs[index].datasetColor;
    if (!goal) return (<span />);
    const {
      max, value, formattedMax,
    } = goal;
    if ((!max && max !== 0) || (!value && value !== 0)) return (<span />);

    return (
      <div className="pt-2 w-full">
        <div className="flex justify-between mb-1">
          <div className="text-xs text-default-500">{`${((value / max) * 100).toFixed()}%`}</div>
          <div className="text-xs text-default-500">{formattedMax}</div>
        </div>
        <Progress
          value={value}
          maxValue={max}
          // size="sm"
          css={{
            "& .nextui-progress-bar": {
              background: color
            }
          }}
          aria-label="Goal progress"
        />
      </div>
    );
  };

  return (
    <div ref={containerRef} className={"flex h-full w-full gap-2 items-center justify-center align-middle flex-wrap"}>
      {!chart?.chartData?.data?.datasets && (
        <div className={`${isCompact ? "p-0" : "p-3"}`}>
          <Row justify="center" align="center">
            <Text
              b
              className={`${chartSize === 1 || chartSize === 2 ? "text-3xl" : "text-4xl"} text-default-800`}
            >
              {chart.chartData && chart.chartData.data && _getKpi(chart.chartData.data)}
            </Text>
          </Row>
        </div>
      )}
      {chart?.chartData?.data?.datasets.map((dataset, index) => {
        if (isCompact && index > 0) return null;

        return (
          <div key={dataset.label} className={`p-2 ${_hasGoal(chart.chartData.goals, index) && isCompact ? "w-full" : ""} gap-4`}>
            {chart.ChartDatasetConfigs[index] && (
              <div className={`flex items-center ${_hasGoal(chart.chartData.goals, index) ? "justify-start" : "justify-center"}`}>
                <Text className={`mt-${chart.showGrowth ? "[-5px]" : 0} text-center text-default-600`}>
                  <span>
                    {dataset.label}
                  </span>
                </Text>
              </div>
            )}

            <div className={`flex items-center ${_hasGoal(chart.chartData.goals, index) ? "justify-between" : "justify-center"} gap-4`}>
              <div
                className={`${chartSize === 1 || chartSize === 2 ? "text-3xl" : "text-4xl"} text-default-800 font-bold font-tw`}
                key={dataset.label}
              >
                {dataset.data && _getKpi(dataset.data)}
              </div>
              {_hasGoal(chart.chartData.goals, index) && chart.showGrowth && chart.chartData.growth && (
                <div>
                  {_renderGrowth(chart.chartData.growth[index])}
                </div>
              )}
            </div>
            
            {!_hasGoal(chart.chartData.goals, index) && chart.showGrowth && chart.chartData.growth && (
              <Row justify="center" align="center">
                {_renderGrowth(chart.chartData.growth[index])}
              </Row>
            )}

            {_hasGoal(chart.chartData.goals, index) && (
              <Row justify="center" align="center">
                {_renderGoal(chart.chartData.goals, index)}
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
