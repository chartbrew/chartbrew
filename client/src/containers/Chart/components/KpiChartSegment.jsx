import React from "react";
import PropTypes from "prop-types";
import {
  Spacer, Tooltip,
} from "@nextui-org/react";
import { LuChevronDownCircle, LuChevronUpCircle } from "react-icons/lu";

import Row from "../../../components/Row";
import Text from "../../../components/Text";

function KpiChartSegment(props) {
  const { chart, editMode } = props;

  return (
    <div
      className={"pl-unit-sm pr-unit-sm sm:max-w-full"}
    >
      <Row wrap="wrap">
        {chart.chartData.growth.map((c, index) => {
          if (chart.chartSize === 1 && index > 1) return (<span key={c.label} />);
          else if (editMode && index > 3) return (<span key={c.label} />);
          else if (chart.chartSize === 2 && index > 3) return (<span key={c.label} />);
          else if (chart.chartSize === 3 && index > 5) return (<span key={c.label} />);
          else if (chart.chartSize > 3 && index > 7) return (<span key={c.label} />);

          return (
            <div
              style={{
                padding: 0,
                paddingBottom: 10,
                marginRight: 20 - (chart.chartData.growth.length * 2)
              }}
              key={c.label}
            >
              <Row align="center">
                <Text b className={`${chart.chartSize === 1 ? "text-lg" : "text-xl"} text-default-800`}>
                  {`${c.value?.toLocaleString()}`}
                </Text>
                <Spacer x={1} />
                {chart.showGrowth && (
                  <Tooltip content={`compared to last ${chart.timeInterval}`}>
                    {c.status === "neutral" && (
                      <Text size="sm">{`${c.comparison}%`}</Text>
                    )}
                    {c.status === "negative" && (
                      <Row align="center">
                        <LuChevronDownCircle size={18} className="text-danger" />
                        <Spacer x={0.5} />
                        <Text b size={"0.8em"} className={"text-danger-400"}>{` ${c.comparison}%`}</Text>
                      </Row>
                    )}
                    {c.status === "positive" && (
                      <Row align="center">
                        <LuChevronUpCircle size={18} className="text-success" />
                        <Text b size={"sm"} className={"text-success-400"}>{` ${c.comparison}%`}</Text>
                      </Row>
                    )}
                  </Tooltip>
                )}
              </Row>
              <Row>
                <Text size="sm" className={"text-default-600"}>
                  <span
                    style={
                      chart.Datasets
                      && chart.Datasets[index]
                      && styles.datasetLabelColor(chart.Datasets[index].datasetColor)
                    }
                  >
                    {c.label}
                  </span>
                </Text>
              </Row>
            </div>
          );
        })}
      </Row>
    </div>
  );
}

const styles = {
  growthContainer: {
    boxShadow: "none", border: "none", marginTop: 0, marginBottom: 10
  },
  datasetLabelColor: (color) => ({
    borderBottom: `solid 3px ${color}`,
  }),
};

KpiChartSegment.propTypes = {
  chart: PropTypes.object.isRequired,
  editMode: PropTypes.bool.isRequired,
};

export default KpiChartSegment;
