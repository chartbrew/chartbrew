import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Form, Segment, Checkbox, Grid, Modal, Button,
  Accordion, Icon, Dropdown,
} from "semantic-ui-react";
import moment from "moment";
import { DateRangePicker } from "react-date-range";

import { secondary, primary } from "../config/colors";

class TimeseriesGlobalSettings extends Component {
  constructor(props) {
    super(props);

    this.state = {
      selectionRange: {
        startDate: moment().startOf("month"),
        endDate: moment().endOf("month"),
        key: "selection",
      },
      viewDateRange: false,
      dateRangeModal: false,
    };
  }

  componentDidMount() {
    const { pointRadius, startDate } = this.props;

    if (pointRadius || pointRadius === 0) {
      this._onAddPoints(pointRadius);
    } else {
      this._onAddPoints(3);
    }

    if (startDate) {
      this._onViewRange(true, true);
    }
  }

  _onViewRange = (value, init) => {
    const { onChangeDateRange } = this.props;
    if (!value) {
      onChangeDateRange({ startDate: null, endDate: null });
    }

    let isModalOpen = value;
    if (init) {
      isModalOpen = false;
    }

    this.setState({ viewDateRange: value, dateRangeModal: isModalOpen });
  }

  _onAddPoints = (value) => {
    const { onChangePoint } = this.props;
    onChangePoint(value);
    this.setState({ dataPoints: value });
  }

  _onChangeDateRange = (range) => {
    const { onChangeDateRange } = this.props;
    const startDate = moment(range.selection.startDate).toDate();
    const endDate = moment(range.selection.endDate).toDate();
    onChangeDateRange({ startDate, endDate });
  }

  _onComplete = () => {
    const { onComplete } = this.props;
    this.setState({ dateRangeModal: false });
    onComplete();
  }

  _onChangeActiveOption = (option) => {
    const { activeOption } = this.state;
    if (activeOption === option) {
      this.setState({ activeOption: false });
    } else {
      this.setState({ activeOption: option });
    }
  }

  render() {
    const {
      type, pointRadius, onDisplayLegend, displayLegend, subType,
      onChangeCurrentEndDate, endDate, currentEndDate, timeInterval,
      onChangeTimeInterval, includeZeros, onChangeZeros, startDate,
    } = this.props;
    const {
      activeOption, dataPoints, viewDateRange, selectionRange, dateRangeModal,
    } = this.state;
    return (
      <div style={styles.container}>
        <Accordion fluid styled>
          <Accordion.Title
            active={activeOption === "dataset"}
            onClick={() => this._onChangeActiveOption("dataset")}
          >
            <Icon name="dropdown" />
            Dataset global settings
          </Accordion.Title>
          <Accordion.Content active={activeOption === "dataset"}>
            <Form>
              <Form.Group>
                {type === "line"
                  && (
                  <Form.Field>
                    <Checkbox
                      label="Add data points"
                      toggle
                      checked={pointRadius > 0}
                      onChange={() => {
                        if (dataPoints > 0) {
                          this._onAddPoints(0);
                        } else {
                          this._onAddPoints(3);
                        }
                      }}
                    />
                  </Form.Field>
                  )}
                <Form.Field>
                  <Checkbox
                    label="Add legend"
                    toggle
                    checked={displayLegend}
                    onChange={onDisplayLegend}
                  />
                </Form.Field>
              </Form.Group>
            </Form>
          </Accordion.Content>
          {subType.toLowerCase().indexOf("timeseries") > -1
            && (
            <div>
              <Accordion.Title
                active={activeOption === "daterange"}
                onClick={() => this._onChangeActiveOption("daterange")}
              >
                <Icon name="dropdown" />
                Date settings
              </Accordion.Title>
              <Accordion.Content active={activeOption === "daterange"}>
                <Form>
                  <Form.Group widths="equal" style={{ paddingBottom: 20 }}>
                    <Form.Field>
                      <Checkbox
                        label="Add custom range"
                        toggle
                        checked={viewDateRange}
                        onChange={() => this._onViewRange(!viewDateRange)}
                      />
                    </Form.Field>
                    <Form.Field>
                      <Checkbox
                        label="Keep current date as end date"
                        toggle
                        checked={currentEndDate}
                        disabled={!endDate}
                        onChange={() => {
                          onChangeCurrentEndDate(!currentEndDate);
                        }}
                      />
                    </Form.Field>
                  </Form.Group>
                  <Form.Group widths="equal">
                    <Form.Field>
                      <label>Time interval</label>
                      <Dropdown
                        placeholder="Select the frequency"
                        selection
                        options={[{
                          text: "Hourly",
                          value: "hour",
                        }, {
                          text: "Daily",
                          value: "day",
                        }, {
                          text: "Weekly",
                          value: "week",
                        }, {
                          text: "Monthly",
                          value: "month",
                        }, {
                          text: "Yearly",
                          value: "year",
                        }]}
                        value={timeInterval || "day"}
                        onChange={(e, data) => onChangeTimeInterval(data.value)}
                      />
                    </Form.Field>
                    <Form.Field>
                      <label>Show zeros</label>
                      <Checkbox
                        label="Allow zero dates"
                        toggle
                        checked={includeZeros}
                        onChange={() => onChangeZeros(!includeZeros)}
                      />
                    </Form.Field>
                  </Form.Group>
                  {viewDateRange === "yolo"
                    && (
                    <Form.Field>
                      <Grid centered padded>
                        <Segment textAlign="center" compact>
                          <DateRangePicker
                            direction="horizontal"
                            rangeColors={[secondary, primary]}
                            ranges={[
                              startDate && endDate ? {
                                startDate,
                                endDate,
                                key: "selection",
                              } : selectionRange
                            ]}
                            onChange={this._onChangeDateRange}
                          />
                        </Segment>
                      </Grid>
                    </Form.Field>
                    )}
                </Form>
              </Accordion.Content>
            </div>
            )}
        </Accordion>

        <Modal
          size="small"
          basic
          open={dateRangeModal}
          onClose={() => this.setState({ dateRangeModal: false })}
        >
          <Modal.Header>Set a custom date range for your chart</Modal.Header>
          <Modal.Content>
            <Grid centered padded>
              <Segment textAlign="center" compact>
                <DateRangePicker
                  direction="horizontal"
                  rangeColors={[secondary, primary]}
                  ranges={[
                    startDate && endDate ? {
                      startDate,
                      endDate,
                      key: "selection",
                    } : selectionRange
                  ]}
                  onChange={this._onChangeDateRange}
                />
              </Segment>
            </Grid>
          </Modal.Content>
          <Modal.Actions>
            <Button
              primary
              basic
              inverted
              icon="checkmark"
              labelPosition="right"
              content="Done"
              onClick={this._onComplete}
            />
          </Modal.Actions>
        </Modal>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
  },
};

TimeseriesGlobalSettings.defaultProps = {
  subType: "",
  displayLegend: false,
  pointRadius: 0,
  startDate: null,
  endDate: null,
  includeZeros: true,
  currentEndDate: false,
  timeInterval: "day",
  onDisplayLegend: () => {},
  onChangeDateRange: () => {},
  onChangeZeros: () => {},
  onChangePoint: () => {},
  onChangeCurrentEndDate: () => {},
  onChangeTimeInterval: () => {},
  onComplete: () => {},
};

TimeseriesGlobalSettings.propTypes = {
  type: PropTypes.string.isRequired,
  subType: PropTypes.string,
  displayLegend: PropTypes.bool,
  pointRadius: PropTypes.number,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  includeZeros: PropTypes.bool,
  currentEndDate: PropTypes.bool,
  timeInterval: PropTypes.string,
  onDisplayLegend: PropTypes.func,
  onChangeDateRange: PropTypes.func,
  onChangeZeros: PropTypes.func,
  onChangePoint: PropTypes.func,
  onChangeCurrentEndDate: PropTypes.func,
  onChangeTimeInterval: PropTypes.func,
  onComplete: PropTypes.func,
};

export default TimeseriesGlobalSettings;
