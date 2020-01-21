import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Form, Segment, Checkbox, Grid, Modal, Button,
  Accordion, Icon, Dropdown, Label,
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
      viewDateRange: (props.startDate && props.endDate && true) || false,
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
    const { onChange } = this.props;
    if (!value) {
      onChange({ startDate: null, endDate: null });
    }

    let isModalOpen = value;
    if (init) {
      isModalOpen = false;
    }

    this.setState({ viewDateRange: value, dateRangeModal: isModalOpen });
  }

  _onAddPoints = (value) => {
    const { onChange } = this.props;
    onChange({ pointRadius: value });
  }

  _onChangeDateRange = (range) => {
    const { onChange } = this.props;
    const startDate = moment(range.selection.startDate).toDate();
    const endDate = moment(range.selection.endDate).toDate();
    onChange({ dateRange: { startDate, endDate } });
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
      type, pointRadius, displayLegend, subType,
      endDate, currentEndDate, timeInterval,
      includeZeros, startDate, onChange,
    } = this.props;
    const {
      activeOption, viewDateRange, selectionRange, dateRangeModal,
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
                        if (pointRadius > 0) {
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
                    onChange={() => onChange({ displayLegend: !displayLegend })}
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
                      <div style={{ padding: 5, marginTop: 5 }}>
                        { startDate && (
                          <Label
                            color="olive"
                            as="a"
                            onClick={() => this.setState({ dateRangeModal: true })}
                          >
                            {moment(startDate).format("ll")}
                          </Label>
                        )}
                        { startDate && (<span> - </span>)}
                        { endDate && (
                          <Label
                            color="olive"
                            as="a"
                            onClick={() => this.setState({ dateRangeModal: true })}
                          >
                            {moment(endDate).format("ll")}
                          </Label>
                        )}
                      </div>
                    </Form.Field>
                    <Form.Field>
                      <Checkbox
                        label="Keep current date as end date"
                        toggle
                        checked={currentEndDate}
                        disabled={!endDate}
                        onChange={() => {
                          onChange({ currentEndDate: !currentEndDate });
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
                        onChange={(e, data) => onChange({ timeInterval: data.value })}
                      />
                    </Form.Field>
                    <Form.Field>
                      <label>Show zeros</label>
                      <Checkbox
                        label="Allow zero dates"
                        toggle
                        checked={includeZeros}
                        onChange={() => onChange({ includeZeros: !includeZeros })}
                      />
                    </Form.Field>
                  </Form.Group>
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
  onChange: () => {},
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
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
};

export default TimeseriesGlobalSettings;
