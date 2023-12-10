import React from "react";
import PropTypes from "prop-types";
import {
  Chip, Progress, Tooltip,
} from "@nextui-org/react";

import determineType from "../../../modules/determineType";
import Row from "../../../components/Row";
import Text from "../../../components/Text";

function KpiMode(props) {
  const { chart } = props;

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
        <Tooltip content={`compared to last ${chart.timeInterval}`}>
          <div className="w-full py-1">
            <Chip
              size="sm"
              variant="flat"
              color={status === "neutral" ? "default" : status === "positive" ? "success" : "danger"}
            >
              <Text
                size="sm"
                className={status === "neutral" ? "text-gray-500" : status === "positive" ? "text-success" : "text-danger"}
              >
                {status === "positive" ? "+" : ""}
                {`${comparison}%`}
              </Text>
            </Chip>
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
      <div style={{ width: "100%", paddingTop: 20 }}>
        <Progress
          value={value}
          maxValue={max}
          size="sm"
          css={{
            "& .nextui-progress-bar": {
              background: color
            }
          }}
        />
        <Row justify="space-between">
          <Text size="sm">{`${((value / max) * 100).toFixed()}%`}</Text>
          <Text size="sm">{formattedMax}</Text>
        </Row>
      </div>
    );
  };

  return (
    <div className={"flex h-full w-full gap-5 items-center justify-center align-middle"}>
      {chart.chartData.data.datasets.map((dataset, index) => (
        <div key={dataset.label} className="p-3">
          <Row justify="center" align="center">
            <Text
              b
              className={`${chart.chartSize === 1 ? "text-3xl" : "text-4xl"} text-default-800`}
              key={dataset.label}
            >
              {dataset.data && _getKpi(dataset.data)}
            </Text>
          </Row>

          {chart.ChartDatasetConfigs[index] && (
            <Row justify="center" align="center">
              <Text className={`mt-${chart.showGrowth ? "[-5px]" : 0} text-center text-default-600`}>
                {chart.showGrowth && chart.chartData.growth && (
                  _renderGrowth(chart.chartData.growth[index])
                )}
                <span
                  style={
                    chart.ChartDatasetConfigs
                      && styles.datasetLabelColor(chart.ChartDatasetConfigs[index].datasetColor)
                    }
                  >
                  {dataset.label}
                </span>
              </Text>
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

const styles = {
  kpiContainer: {
    height: 300, display: "flex", justifyContent: "center", alignItems: "center"
  },
  kpiItem: (size, items, index) => ({
    fontSize: size === 1 ? "2.5em" : "4em",
    textAlign: "center",
    margin: 0,
    marginBottom: size === 1 && index < items - 1 ? (50 - items * 10) : 0,
    marginRight: index < items - 1 && size > 1 ? (40 * size) - (items * 8) : 0,
  }),
  datasetLabelColor: (color) => ({
    borderBottom: `solid 3px ${color}`,
  }),
};

KpiMode.propTypes = {
  chart: PropTypes.object.isRequired,
};

export default KpiMode;
