import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Progress, Tooltip,
} from "@heroui/react";

import determineType from "../../../modules/determineType";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import { getWidthBreakpoint } from "../../../modules/layoutBreakpoints";

function KpiMode(props) {
  const { chart } = props;
  const [chartSize, setChartSize] = useState(2);
  const containerRef = React.useRef(null);

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
      return parseFloat(finalData).toLocaleString();
    }

    return `${finalData}`;
  };

  const _renderGrowth = (c) => {
    if (!c) return (<span />);
    const { status, comparison } = c;
    return (
      <div>
        <Tooltip content={`compared to last ${chart.timeInterval}`} placement="bottom">
          <div className="w-full py-1">
            <span
              className={`text-sm ${status === "neutral" ? "text-gray-500" : status === "positive" ? "text-success" : "text-danger"}`}
            >
              {status === "positive" ? "+" : ""}
              {`${comparison}%`}
            </span>
          </div>
        </Tooltip>
      </div>
    );
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
      <div style={{ width: "100%" }} className="pt-2">
        <Progress
          value={value}
          maxValue={max}
          size="sm"
          css={{
            "& .nextui-progress-bar": {
              background: color
            }
          }}
          aria-label="Goal progress"
        />
        <Row justify="space-between">
          <Text size="sm">{`${((value / max) * 100).toFixed()}%`}</Text>
          <Text size="sm">{formattedMax}</Text>
        </Row>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={"flex h-full w-full gap-2 items-center justify-center align-middle flex-wrap"}>
      {!chart?.chartData?.data?.datasets && (
        <div className="p-3">
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
      {chart?.chartData?.data?.datasets.map((dataset, index) => (
        <div key={dataset.label} className="p-2">
          {chart.ChartDatasetConfigs[index] && (
            <Row justify="center" align="center">
              <Text className={`mt-${chart.showGrowth ? "[-5px]" : 0} text-center text-default-600`}>
                <span>
                  {dataset.label}
                </span>
              </Text>
            </Row>
          )}

          <Row justify="center" align="center">
            <Text
              b
              className={`${chartSize === 1 || chartSize === 2 ? "text-3xl" : "text-4xl"} text-default-800`}
              key={dataset.label}
            >
              {dataset.data && _getKpi(dataset.data)}
            </Text>
          </Row>

          {chart.showGrowth && chart.chartData.growth && (
            <Row justify="center" align="center">
              {_renderGrowth(chart.chartData.growth[index])}
            </Row>
          )}

          {chart.chartData.goals && (
            <Row justify="center" align="center">
              {_renderGoal(chart.chartData.goals, index)}
            </Row>
          )}
        </div>
      ))}
    </div>
  );
}

KpiMode.propTypes = {
  chart: PropTypes.object.isRequired,
};

export default KpiMode;
