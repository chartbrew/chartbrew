import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Form, Icon, Input, Checkbox, Accordion, Divider, Header, List, Button,
} from "semantic-ui-react";
import { SketchPicker } from "react-color";
import uuid from "uuid/v4";

import { primary, secondaryTransparent } from "../config/colors";

function getRandomColorRgb() {
  const red = Math.floor(Math.random() * 256);
  const green = Math.floor(Math.random() * 256);
  const blue = Math.floor(Math.random() * 256);
  return `rgba(${red}, ${green}, ${blue}, ${0.5})`;
}

/*
  Component for configuring the Chart and its datasets
*/
class ChartBuilder extends Component {
  constructor(props) {
    super(props);

    this.state = {
      activeOption: "",
    };
  }

  _onChangeXAxis = (value) => {
    const { onChange } = this.props;
    onChange({ xAxis: value });
  }

  _onDatasetColor = (color) => {
    const { onChange } = this.props;
    const datasetColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    onChange({ datasetColor });
  }

  _onFillColor = (color, index) => {
    const {
      onChange, fillColor, dataArray, subType, fill,
    } = this.props;

    // add a fill color for all each pattern
    let newFillColor = fillColor || [];
    if (subType === "pattern") {
      for (let i = 0; i < dataArray.length; i++) {
        if (!newFillColor[i]) {
          newFillColor.push(getRandomColorRgb());
        } else if (i === index) {
          newFillColor[i] = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
        }
      }
    } else {
      newFillColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    }

    onChange({ fillColor: newFillColor, fill });
  }

  _onAddFill = () => {
    const { onChange, fill } = this.props;

    onChange({ fill: !fill });
  }

  _onChangeActiveOption = (option) => {
    const { activeOption } = this.state;
    if (activeOption === option) {
      this.setState({ activeOption: false });
    } else {
      this.setState({ activeOption: option });
    }
  }

  _onAddPattern = () => {
    const { patterns, onChange } = this.props;
    if ((patterns.length === 0 || patterns[patterns.length - 1].value !== "")) {
      patterns.push({
        id: uuid(),
        value: "",
      });
      onChange({ patterns });
    }
  }

  _onRemovePattern = (id) => {
    const { patterns, onChange } = this.props;
    let index = -1;

    for (let i = 0; i < patterns.length; i++) {
      if (id === patterns[i].id) {
        index = i;
        break;
      }
    }

    if (index > -1) {
      patterns.splice(index, 1);
      onChange({ patterns });
    }
  }

  _onChangePattern = (id, value) => {
    const { patterns, onChange } = this.props;
    let index = -1;
    for (let i = 0; i < patterns.length; i++) {
      if (id === patterns[i].id) {
        index = i;
        break;
      }
    }

    if (index > -1) {
      patterns[index].value = value;
      onChange({ patterns });
    }
  }

  renderPatterns() {
    const { patterns } = this.props;
    return (
      <div>
        <Header size="small">Filter values (optional)</Header>
        <Form>
          {patterns.map((pattern) => {
            return (
              <Form.Group key={pattern.id}>
                <Form.Field width={13}>
                  <Input
                    placeholder="Enter something to match values with"
                    value={pattern.value || ""}
                    onChange={(e, data) => this._onChangePattern(pattern.id, data.value)}
                  />
                </Form.Field>

                <Form.Field width={3}>
                  <Button
                    negative
                    icon
                    onClick={() => this._onRemovePattern(pattern.id)}
                  >
                    <Icon name="x" />
                  </Button>
                </Form.Field>
              </Form.Group>
            );
          })}
        </Form>
        {(patterns.length === 0 || patterns[patterns.length - 1] !== "")
          && (
          <List animated verticalAlign="middle">
            <List.Item as="a" onClick={this._onAddPattern}>
              <Icon name="plus" />
              <List.Content>
                <List.Header>
                  Add a new value
                </List.Header>
              </List.Content>
            </List.Item>
          </List>
          )}
      </div>
    );
  }

  render() {
    const {
      patterns, xAxis, subType, legend, type, datasetColor,
      fillColor, dataArray, dataLabels, onChange, fill,
    } = this.props;
    const {
      activeOption,
    } = this.state;

    return (
      <div style={styles.container}>
        <Form>
          <Form.Field width={10}>
            <label>
              <Icon name="calendar alternate" />
              Select a Date field from your dataset
            </label>
            <Input
              placeholder="Enter your desired field"
              value={xAxis || ""}
              onChange={(e, data) => this._onChangeXAxis(data.value)}
            />
          </Form.Field>
        </Form>
        <Divider />

        {subType === "pattern" && patterns && (
          <div>
            {this.renderPatterns()}
            <Divider />
          </div>
        )}

        <Accordion styled>
          <Accordion.Title
            as="h3"
            active={activeOption === "dataset"}
            onClick={() => this._onChangeActiveOption("dataset")}
          >
            <Icon name="dropdown" />
            Dataset options
          </Accordion.Title>
          <Accordion.Content active={activeOption === "dataset"}>
            <Form>
              <Form.Field>
                <label>Name your dataset</label>
                <Input
                  placeholder="What data is your dataset showing?"
                  value={legend || ""}
                  onChange={(event, data) => onChange({ legend: data.value })}
                />
              </Form.Field>
            </Form>
          </Accordion.Content>

          <Accordion.Title
            as="h3"
            active={activeOption === "color"}
            onClick={() => this._onChangeActiveOption("color")}
          >
            <Icon name="dropdown" />
            Color options
          </Accordion.Title>
          <Accordion.Content active={activeOption === "color"}>
            {(type === "line" || type === "bar" || type === "radar") && (
              <Form>
                <Form.Field>
                  <label>Pick a color for your dataset</label>
                  <SketchPicker
                    color={datasetColor || primary}
                    onChangeComplete={(color) => this._onDatasetColor(color.rgb)}
                  />
                </Form.Field>
                {subType !== "pattern"
                  && (
                  <Form.Field>
                    <Checkbox
                      label="Fill the area?"
                      toggle
                      checked={fill}
                      onChange={this._onAddFill}
                    />
                  </Form.Field>
                  )}
                {fill && subType !== "pattern"
                  && (
                  <Form.Field>
                    <label>Choose the color for the chart area</label>
                    <SketchPicker
                      color={subType === "pattern"
                        ? (fillColor && fillColor[0])
                        : fillColor || secondaryTransparent(0.8)}
                      onChangeComplete={(color) => this._onFillColor(color.rgb)}
                    />
                  </Form.Field>
                  )}
              </Form>
            )}

            {subType === "pattern" && (
              <Form>
                {dataArray && dataArray.map((value, index) => {
                  if (value === 0) return (<span key={value} />);
                  // if there are some patterns set up, make sure to not display all the pickers
                  if (patterns.length > 0) {
                    let found = false;
                    for (let i = 0; i < patterns.length; i++) {
                      if (dataLabels[index] === patterns[i].value) {
                        found = true;
                        break;
                      }
                    }

                    if (!found) return (<span key={value} />);
                  }

                  // TODO: fix the key issue for patterns
                  return (
                    <Form.Field key={value}>
                      <Header size="small" dividing>{dataLabels[index]}</Header>
                      <SketchPicker
                        color={
                          (fillColor && fillColor[index])
                          || secondaryTransparent(0.8)
                        }
                        onChangeComplete={(color) => this._onFillColor(color.rgb, index)}
                      />
                    </Form.Field>
                  );
                })}
              </Form>
            )}
          </Accordion.Content>
        </Accordion>
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
};

ChartBuilder.defaultProps = {
  type: "",
  subType: "",
  xAxis: "",
  datasetColor: primary,
  fillColor: [],
  fill: false,
  legend: "",
  patterns: [],
  dataArray: [],
  dataLabels: [],
  onChange: () => {},
};

ChartBuilder.propTypes = {
  type: PropTypes.string,
  subType: PropTypes.string,
  xAxis: PropTypes.string,
  datasetColor: PropTypes.string,
  fillColor: PropTypes.array,
  fill: PropTypes.bool,
  legend: PropTypes.string,
  patterns: PropTypes.array,
  dataArray: PropTypes.array,
  dataLabels: PropTypes.array,
  onChange: PropTypes.func,
};

export default ChartBuilder;
