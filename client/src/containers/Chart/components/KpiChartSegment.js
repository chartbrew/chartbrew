import React from "react";
import PropTypes from "prop-types";
import {
  Header, Icon, Popup, Segment
} from "semantic-ui-react";

import { Colors } from "../../../config/colors";

function KpiChartSegment(props) {
  const { chart, editMode } = props;

  return (
    <Segment.Group horizontal style={styles.growthContainer} compact>
      {chart.chartData.growth.map((c, index) => {
        if (chart.chartSize === 1 && index > 1) return (<span key={c.label} />);
        else if (editMode && index > 3) return (<span key={c.label} />);
        else if (chart.chartSize === 2 && index > 3) return (<span key={c.label} />);
        else if (chart.chartSize === 3 && index > 5) return (<span key={c.label} />);
        else if (chart.chartSize > 3 && index > 7) return (<span key={c.label} />);

        return (
          <Segment
            basic
            compact
            key={c.label}
            style={{
              paddingRight: 16 - (chart.chartData.growth.length * 2)
            }}
          >
            <Header size={chart.chartSize === 1 ? "normal" : "large"}>
              <span>{`${c.value} `}</span>
              {chart.showGrowth && (
                <Popup
                  trigger={(
                    <small style={{ fontSize: "0.6em", display: "inline-block" }}>
                      <Icon
                        name={
                          c.status === "neutral" ? "minus"
                            : `arrow circle ${(c.status === "positive" && "up") || "down"}`
                        }
                        color={
                          c.status === "positive" ? "green" : c.status === "negative" ? "red" : "grey"
                        }
                      />
                      <span style={{ color: Colors[c.status] }}>
                        {`${c.comparison}%`}
                      </span>
                    </small>
                  )}
                  inverted
                  content={
                    `In the last ${chart.timeInterval}`
                  }
                  size="tiny"
                />
              )}
              <Header.Subheader style={chart.chartSize === 1 ? { fontSize: "0.8em" } : {}}>
                <span
                  style={
                    chart.Datasets
                    && chart.Datasets[index]
                    && styles.datasetLabelColor(chart.Datasets[index].datasetColor)
                  }
                >
                  {c.label}
                </span>
              </Header.Subheader>
            </Header>
          </Segment>
        );
      })}
    </Segment.Group>
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
