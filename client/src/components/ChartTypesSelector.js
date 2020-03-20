import React, { Component } from "react";
import PropTypes from "prop-types";

import {
  Card, Label, Image, Icon, Grid, Header
} from "semantic-ui-react";

// types
import lineChartImage from "../assets/lineChart.PNG";
import barChartImage from "../assets/barChart.PNG";
import radarChartImage from "../assets/radarChart.PNG";
import polarChartImage from "../assets/polarChart.PNG";
import pieChartImage from "../assets/pieChart.PNG";
import doughnutChartImage from "../assets/doughnutChart.PNG";

// subTypes
import lcTimeseriesImage from "../assets/timeSeries.PNG";
import lcAddTimeseriesImage from "../assets/addTimeSeries.PNG";
import bcTimeseriesImage from "../assets/timeSeriesBar.PNG";
import bcAddTimeseriesImage from "../assets/addTimeSeriesBar.PNG";
import barChartPatternImage from "../assets/barChartPattern.png";
import pieChartPatternImage from "../assets/pieChartPattern.png";
import doughnutChartPatternImage from "../assets/doughnutChartPattern.png";
import radarChartPatternImage from "../assets/radarChartPattern.png";
import polarChartPatternImage from "../assets/polarChartPattern.png";

/*
  Description
*/
class ChartTypesSelector extends Component {
  constructor(props) {
    super(props);

    this.state = {
      selected: null,
    };
  }

  componentDidMount() {
    const { type, chartCards } = this.props;
    const { selected } = this.state;

    if (type && !selected) {
      for (let i = 0; i < chartCards.length; i++) {
        if (chartCards[i].type === type) {
          this._saveSelected(chartCards[i]);
          break;
        }
      }
    }
  }

  componentDidUpdate(prevProps) {
    const { chartCards } = this.props;
    const { selected } = this.state;

    if (prevProps.type && !selected) {
      for (let i = 0; i < chartCards.length; i++) {
        if (chartCards[i].type === prevProps.type) {
          this._saveSelected(chartCards[i]);
          break;
        }
      }
    }
  }

  _saveSelected = (card) => {
    this.setState({ selected: card });
  }

  _onTypeSelect = (card) => {
    const { onChange } = this.props;
    const { selected } = this.state;
    // reset the subType when changing the main type
    let { subType } = card;
    if (selected && card.type !== selected.type) {
      subType = "";
    }
    this.setState({ selected: card });

    onChange({ type: card.type, subType });
  }

  _onSubTypeSelect = (card) => {
    const { onChange } = this.props;
    const { selected } = this.state;

    onChange({ type: selected.type, subType: card.subType });
  }

  render() {
    const { type, chartCards, subType } = this.props;
    const { selected } = this.state;

    return (
      <div style={styles.container}>
        <Grid stackable centered columns={2} divided>
          <Grid.Column width={!type ? 16 : 6}>
            <div style={type ? styles.typeContainer : {}}>
              <Card.Group stackable centered itemsPerRow={!type ? 3 : 1}>
                {chartCards.map((card) => {
                  return (
                    <Card
                      key={card.type}
                      onClick={() => this._onTypeSelect(card)}
                      color={card.type === type ? "blue" : null}
                    >
                      <Image src={card.src} />
                      {card.type === type && (
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
            </div>
          </Grid.Column>
          {selected && (
            <Grid.Column width={!type ? 0 : 10}>
              <Header>
                Select a Sub Type
              </Header>
              <Card.Group stackable centered itemsPerRow={2}>
                {selected.subTypes.map((subTypeObj) => {
                  return (
                    <Card
                      key={subTypeObj.subType}
                      onClick={() => this._onSubTypeSelect(subTypeObj)}
                      color={subTypeObj.subType === subType ? "olive" : null}
                    >
                      <Image src={subTypeObj.src} />
                      {subTypeObj.subType === subType
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
            </Grid.Column>
          )}
        </Grid>
      </div>
    );
  }
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
};

export default ChartTypesSelector;
