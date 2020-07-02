import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

import {
  Card, Label, Image, Icon, Header, Button,
} from "semantic-ui-react";

// types
import lineChartImage from "../../../assets/lineChart.PNG";
import barChartImage from "../../../assets/barChart.PNG";
import radarChartImage from "../../../assets/radarChart.PNG";
import polarChartImage from "../../../assets/polarChart.PNG";
import pieChartImage from "../../../assets/pieChart.PNG";
import doughnutChartImage from "../../../assets/doughnutChart.PNG";

// subTypes
import lcTimeseriesImage from "../../../assets/timeSeries.PNG";
import lcAddTimeseriesImage from "../../../assets/addTimeSeries.PNG";
import bcTimeseriesImage from "../../../assets/timeSeriesBar.PNG";
import bcAddTimeseriesImage from "../../../assets/addTimeSeriesBar.PNG";
import barChartPatternImage from "../../../assets/barChartPattern.png";
import pieChartPatternImage from "../../../assets/pieChartPattern.png";
import doughnutChartPatternImage from "../../../assets/doughnutChartPattern.png";
import radarChartPatternImage from "../../../assets/radarChartPattern.png";
import polarChartPatternImage from "../../../assets/polarChartPattern.png";

/*
  Description
*/
function ChartTypesSelector(props) {
  const [selected, setSelected] = useState(null);
  const [chartType, setChartType] = useState({});
  const [loading, setLoading] = useState(false);

  const {
    type, subType, onChange, chartCards, onClose,
  } = props;

  useEffect(() => {
    setChartType({ type, subType });
    if (type && !selected) {
      for (let i = 0; i < chartCards.length; i++) {
        if (chartCards[i].type === type) {
          _saveSelected(chartCards[i]);
          break;
        }
      }
    }
  }, [type, subType]);

  const _saveSelected = (card) => {
    setSelected(card);
  };

  const _onTypeSelect = (card) => {
    // reset the subType when changing the main type
    let { subType } = card;
    if (selected && card.type !== selected.type) {
      subType = "";
    }
    setSelected(card);

    setChartType({ type: card.type, subType });
  };

  const _onSubTypeSelect = (card) => {
    setChartType({ type: selected.type, subType: card.subType });
  };

  const _onSave = () => {
    setLoading(true);
    onChange(chartType)
      .then(() => {
        setLoading(false);
        onClose();
      })
      .catch(() => setLoading(false));
  };

  return (
    <div style={styles.container}>
      {!selected && (
        <>
          <Button
            size="small"
            icon
            labelPosition="left"
            onClick={onClose}
          >
            <Icon name="chevron left" />
            Back
          </Button>
          <Header>
            Select your chart style
          </Header>
          <Card.Group stackable centered itemsPerRow={3}>
            {chartCards.map((card) => {
              return (
                <Card
                  key={card.type}
                  onClick={() => _onTypeSelect(card)}
                  color={card.type === chartType.type ? "blue" : null}
                >
                  <Image src={card.src} />
                  {card.type === chartType.type && (
                    <Label corner="right" color="blue">
                      <Icon name="checkmark" />
                    </Label>
                  )}
                  <Card.Content>
                    <Card.Header>{card.name}</Card.Header>
                  </Card.Content>
                </Card>
              );
            })}
          </Card.Group>
        </>
      )}
      {selected && (
        <>
          <Button
            size="small"
            icon
            labelPosition="left"
            onClick={() => setSelected(null)}
          >
            <Icon name="chevron left" />
            Back
          </Button>
          {chartType.subType && (
            <Button
              size="small"
              icon
              labelPosition="right"
              onClick={_onSave}
              loading={loading}
              primary
            >
              <Icon name="checkmark" />
              Save
            </Button>
          )}
          <Header>
            Select a Sub Type
          </Header>
          <Card.Group stackable centered itemsPerRow={2}>
            {selected.subTypes.map((subTypeObj) => {
              return (
                <Card
                  key={subTypeObj.subType}
                  onClick={() => _onSubTypeSelect(subTypeObj)}
                  color={subTypeObj.subType === chartType.subType ? "olive" : null}
                >
                  <Image src={subTypeObj.src} />
                  {subTypeObj.subType === chartType.subType
                    && (
                    <Label corner="right" color="olive">
                      <Icon name="checkmark" />
                    </Label>
                    )}
                  <Card.Content>
                    <Card.Header>{subTypeObj.name}</Card.Header>
                  </Card.Content>
                </Card>
              );
            })}
          </Card.Group>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  typeContainer: {
    maxHeight: window.innerHeight - 300,
    overflowX: "auto",
  }
};

ChartTypesSelector.defaultProps = {
  chartCards: [{
    type: "line",
    name: "Line Chart",
    src: lineChartImage,
    subTypes: [{
      subType: "lcTimeseries",
      name: "Time Series",
      src: lcTimeseriesImage,
    }, {
      subType: "lcAddTimeseries",
      name: "Time Series (Aggregating)",
      src: lcAddTimeseriesImage,
    }],
  }, {
    type: "bar",
    name: "Bar Chart",
    src: barChartImage,
    subTypes: [{
      subType: "bcTimeseries",
      name: "Time Series",
      src: bcTimeseriesImage,
    }, {
      subType: "bcAddTimeseries",
      name: "Time Series (Aggregating)",
      src: bcAddTimeseriesImage,
    }, {
      subType: "pattern",
      name: "Patterns, Trends, Preferences",
      src: barChartPatternImage,
    }],
  }, {
    type: "pie",
    name: "Pie Chart",
    src: pieChartImage,
    subTypes: [{
      subType: "pattern",
      name: "Patterns, Trends, Preferences",
      src: pieChartPatternImage,
    }],
  }, {
    type: "doughnut",
    name: "Doughnut Chart",
    src: doughnutChartImage,
    subTypes: [{
      subType: "pattern",
      name: "Patterns, Trends, Preferences",
      src: doughnutChartPatternImage,
    }],
  }, {
    type: "radar",
    name: "Radar Chart",
    src: radarChartImage,
    subTypes: [{
      subType: "pattern",
      name: "Patterns, Trends, Preferences",
      src: radarChartPatternImage,
    }],
  }, {
    type: "polar",
    name: "Polar Chart",
    src: polarChartImage,
    subTypes: [{
      subType: "pattern",
      name: "Patterns, Trends, Preferences",
      src: polarChartPatternImage,
    }],
  }],
  onChange: () => {},
  type: "",
  subType: "",
};

ChartTypesSelector.propTypes = {
  chartCards: PropTypes.array,
  type: PropTypes.string,
  subType: PropTypes.string,
  onChange: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

export default ChartTypesSelector;
