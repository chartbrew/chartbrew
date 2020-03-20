import React, { Component } from "react";
import PropTypes from "prop-types";

import {
  Accordion, Button, Icon, Popup, Header, Label, Message
} from "semantic-ui-react";
import moment from "moment";

import { secondaryTransparent } from "../config/colors";

/*
  Component used for displaying the object's attributes
*/
class ObjectExplorer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      accordionActive: "",
      visualiseDataset: false,
    };

    this.objectMapper = {};
  }

  _onSelectXField = (key) => {
    const { subType, onChange } = this.props;
    // display a warning if the user didn't select a date field and subtype is timeseries
    if (subType.toLowerCase().indexOf("timeseries") > -1) {
      if (this.objectMapper[key] !== "date") {
        this.setState({ notDateWarning: true });
      } else {
        this.setState({ notDateWarning: false });
      }
      // display a warning if the user selected something outside or in multiple arrays
      if (key.indexOf("[]") === -1 || key.split("[]").length - 1 > 1) { // eslint-disable-line
        this.setState({ arrayWarning: true });
      } else {
        this.setState({ arrayWarning: false });
      }
    }

    onChange({ xAxis: key });
  }

  _makeAccordion(key, uniqueKey, data) {
    const { accordionActive } = this.state;
    const { type, subType, xAxisField } = this.props;

    let newUniqueKey = `${uniqueKey}.${key}`;

    // cheeky way of detecting the arrays in the back-end
    if (data instanceof Array) {
      newUniqueKey += "[]";
    }

    // save the uniqueKey along with the data type in the object mapper
    let dataType;
    if (data !== null && typeof data === "object" && data instanceof Array) {
      dataType = "array";
    }
    if (data !== null && typeof data === "object" && !(data instanceof Array)) {
      dataType = "object";
    }
    if (typeof data !== "object" && !(data instanceof Array) && typeof data === "boolean") {
      dataType = "boolean";
    }
    if (typeof data !== "object" && !(data instanceof Array) && typeof data === "number") {
      dataType = "number";
    }
    if (typeof data !== "object" && !(data instanceof Array) && typeof data === "string") {
      dataType = "string";
    }
    if (typeof data !== "object" && !(data instanceof Array) && moment(data).isValid()
      && ((typeof data === "number" && data.toString().length > 9) || (typeof data !== "number"))) {
      dataType = "date";
    }

    this.objectMapper[newUniqueKey] = dataType;

    return (
      <div key={newUniqueKey}>
        <Accordion.Accordion
          style={{
            backgroundColor: newUniqueKey.split(".").length % 2 === 0 ? secondaryTransparent(0.1) : "white",
          }}
        >
          <Accordion.Title
            active={accordionActive.indexOf(newUniqueKey) > -1}
            onClick={() => {
              if (accordionActive === newUniqueKey) {
                this.setState({ accordionActive: newUniqueKey.substring(0, newUniqueKey.lastIndexOf(".")) });
              } else {
                this.setState({ accordionActive: newUniqueKey });
              }
            }}
          >
            <span>{key}</span>
            {dataType === "array"
              && <Label color="teal" style={{ float: "right" }}>Array</Label>}
            {dataType === "object"
              && <Label color="orange" style={{ float: "right" }}>Object</Label>}
            {dataType === "boolean"
              && <Label style={{ float: "right" }}>Boolean</Label>}
            {dataType === "number"
              && <Label color="blue" style={{ float: "right" }}>Number</Label>}
            {dataType === "string"
              && <Label color="violet" style={{ float: "right" }}>String</Label>}
            {dataType === "date"
              && <Label color="olive" style={{ float: "right" }}>Date</Label>}
          </Accordion.Title>
          <Accordion.Content
            active={accordionActive.indexOf(newUniqueKey) > -1}
          >
            {data !== null && typeof data === "object" && !(data instanceof Array)
              && Object.keys(data).map((dataKey) => {
                return (this._makeAccordion(dataKey, newUniqueKey, data[dataKey]));
              })}
            {data !== null && data instanceof Array && data[0]
              && Object.keys(data[0]).map((dataKey) => {
                return (this._makeAccordion(dataKey, newUniqueKey, data[0][dataKey]));
              })}
            {typeof data !== "object" && !(data instanceof Array) && data.toString()}
          </Accordion.Content>
        </Accordion.Accordion>
        {key !== "0"
          && (
          <div style={{ paddingTop: 10, paddingBottom: 10 }}>
            {(type === "line" || type === "bar")
              && subType.toLowerCase().indexOf("timeseries") > -1
              && (
              <Popup
                trigger={(
                  <Button
                    secondary={xAxisField === newUniqueKey}
                    icon
                    labelPosition="left"
                    onClick={() => this._onSelectXField(newUniqueKey)}
                  >
                    <Icon name="calendar alternate" />
                    Select
                  </Button>
                )}
                position="bottom center"
                content="Select this as your Date field"
              />
              )}

            {subType === "pattern"
              && (
              <Popup
                trigger={(
                  <Button
                    secondary={xAxisField === newUniqueKey}
                    icon
                    labelPosition="left"
                    onClick={() => this._onSelectXField(newUniqueKey)}
                  >
                    <Icon name="checkmark" />
                    Select
                  </Button>
                )}
                position="bottom center"
                content="Select this as your field"
              />
              )}
          </div>
          )}
      </div>
    );
  }

  render() {
    const {
      visualiseDataset, arrayWarning, notDateWarning,
    } = this.state;
    const { objectData } = this.props;

    return (
      <div style={styles.container}>
        <Header as="h4">
          Click here to visualise and select your fields
        </Header>
        {visualiseDataset
          && (
          <Button
            icon
            labelPosition="right"
            floated="right"
            onClick={() => this.setState({ visualiseDataset: false })}
          >
            <Icon name="minus" />
            Minimize
          </Button>
          )}
        <Accordion styled fluid style={{ maxHeight: "300px", overflow: "auto" }}>
          <Accordion.Title
            active={visualiseDataset}
            onClick={() => this.setState({ visualiseDataset: !visualiseDataset })}
          >
            <span>Root</span>
            {objectData instanceof Array
              && <Label color="teal" style={{ float: "right" }}>Array</Label>}
            {!(objectData instanceof Array)
              && <Label color="orange" style={{ float: "right" }}>Object</Label>}
          </Accordion.Title>
          <Accordion.Content active={visualiseDataset}>
            <div>
              <p>Select the root object or array</p>
            </div>
            {objectData instanceof Array
              && Object.keys(objectData[0]).map((key) => {
                return this._makeAccordion(key, "root[]", objectData[0][key]);
              })}
            {!(objectData instanceof Array)
              && Object.keys(objectData).map((key) => {
                return this._makeAccordion(key, "root", objectData[key]);
              })}
          </Accordion.Content>
        </Accordion>
        {notDateWarning
          && (
          <Message warning onDismiss={() => this.setState({ notDateWarning: false })}>
            <Message.Header>Have you selected a Date?</Message.Header>
            <p>{"We think that the field you selected might not be of Date type and your chart might not show as expected."}</p>
          </Message>
          )}
        {arrayWarning
          && (
          <Message warning onDismiss={() => this.setState({ arrayWarning: false })}>
            <Message.Header>The Date field needs to be inside a single array</Message.Header>
            <p>{"The chart generator will not be able to process the information correctly when the selected date field is not part of an array or when it's nested in multiple arrays."}</p>
          </Message>
          )}
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
  },
};

ObjectExplorer.defaultProps = {
  objectData: [],
  type: "",
  subType: "",
  xAxisField: "",
  onChange: () => {},
};

ObjectExplorer.propTypes = {
  objectData: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object,
  ]),
  onChange: PropTypes.func,
  type: PropTypes.string,
  subType: PropTypes.string,
  xAxisField: PropTypes.string,
};

export default ObjectExplorer;
