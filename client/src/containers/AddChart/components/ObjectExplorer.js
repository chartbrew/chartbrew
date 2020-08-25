import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Accordion, Button, Icon, Popup, Label, Message,
} from "semantic-ui-react";
import moment from "moment";
import _ from "lodash";

import { secondaryTransparent, secondary } from "../../../config/colors";

function getDataType(data) {
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

  return dataType;
}

/*
  Component used for displaying the object's attributes
*/
function ObjectExplorer(props) {
  const [accordionActive, setAccordionActive] = useState("");
  const [visualiseDataset, setVisualiseDataset] = useState(true);
  const [type, setType] = useState("");
  const [subType, setSubType] = useState("");
  const [arrayWarning, setArrayWarning] = useState(false);
  const [notDateWarning, setNotDateWarning] = useState(false);
  const [autoSelect, setAutoSelect] = useState(false);

  const objectMapper = {};

  const {
    onChange, objectData, charts, xAxisField, match,
  } = props;

  useEffect(() => {
    const chart = _.find(charts, { id: match.params.chartId });
    if (chart) {
      setType(chart.type);
      setSubType(chart.subType);
    }
  }, []);

  useEffect(() => {
    if (!xAxisField) {
      let autoKey;
      let potentialKey;
      if (objectData instanceof Array) {
        Object.keys(objectData[0]).map((key) => {
          const dataType = getDataType(objectData[0][key]);
          if (dataType === "date"
            && (key.toLowerCase().indexOf("created") > -1
              || key.toLowerCase().indexOf("timestamp") > -1)
          ) {
            autoKey = `root[].${key}`;
            setAutoSelect(true);
          }
          if (dataType === "date") {
            potentialKey = `root[].${key}`;
          }
          return key;
        });

        if (autoKey) onChange(autoKey);
        if (!autoKey && potentialKey) {
          setAutoSelect(true);
          onChange(potentialKey);
        }
      } else {
        Object.keys(objectData).map((key) => {
          const dataType = getDataType(objectData[key]);
          if (dataType === "date" && key.toLowerCase().indexOf("created") > -1) {
            autoKey = `root.${key}`;
            setAutoSelect(true);
          }
          if (dataType === "date") {
            potentialKey = `root.${key}`;
          }
          return key;
        });

        if (autoKey) onChange(autoKey);
        if (!autoKey && potentialKey) {
          setAutoSelect(true);
          onChange(potentialKey);
        }
      }
    }
  }, [objectData]);

  const _onSelectXField = (key) => {
    // display a warning if the user didn't select a date field and subtype is timeseries
    if (subType.toLowerCase().indexOf("timeseries") > -1) {
      if (objectMapper[key] !== "date") {
        setNotDateWarning(true);
      } else {
        setNotDateWarning(false);
      }
      // display a warning if the user selected something outside or in multiple arrays
      if (key.indexOf("[]") === -1 || key.split("[]").length - 1 > 1) { // eslint-disable-line
        setArrayWarning(true);
      } else {
        setArrayWarning(false);
      }
    }
    setAutoSelect(false);
    onChange(key);
  };

  const _makeAccordion = (key, uniqueKey, data) => {
    let newUniqueKey = `${uniqueKey}.${key}`;

    // cheeky way of detecting the arrays in the back-end
    if (data instanceof Array) {
      newUniqueKey += "[]";
    }

    // save the uniqueKey along with the data type in the object mapper
    const dataType = getDataType(data);
    objectMapper[newUniqueKey] = dataType;

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
                setAccordionActive(newUniqueKey.substring(0, newUniqueKey.lastIndexOf(".")));
              } else {
                setAccordionActive(newUniqueKey);
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
                return (_makeAccordion(dataKey, newUniqueKey, data[dataKey]));
              })}
            {data !== null && data instanceof Array && data[0]
              && Object.keys(data[0]).map((dataKey) => {
                return (_makeAccordion(dataKey, newUniqueKey, data[0][dataKey]));
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
                    onClick={() => _onSelectXField(newUniqueKey)}
                  >
                    <Icon name="calendar alternate" />
                    Select
                  </Button>
                )}
                position="bottom center"
                content="Select this as your Date field"
              />
              )}

            {((subType === "pattern") || (!type && !subType))
              && (
              <Popup
                trigger={(
                  <Button
                    secondary={xAxisField === newUniqueKey}
                    icon
                    labelPosition="left"
                    onClick={() => _onSelectXField(newUniqueKey)}
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
  };

  return (
    <div style={styles.container}>
      {autoSelect && xAxisField && (
        <div style={styles.autoSelectMessage}>
          {"We selected the "}
          <span style={styles.selectedField}>{xAxisField.replace("root[].", "").replace("root.", "")}</span>
          {" field for you"}
        </div>
      )}
      <Accordion styled fluid style={{ maxHeight: "400px", overflow: "auto" }}>
        <Accordion.Title
          active={visualiseDataset}
          onClick={() => setVisualiseDataset(!visualiseDataset)}
        >
          <span>Root</span>
          {objectData instanceof Array
            && <Label color="teal" style={{ float: "right" }}>Array</Label>}
          {!(objectData instanceof Array)
            && <Label color="orange" style={{ float: "right" }}>Object</Label>}
        </Accordion.Title>
        <Accordion.Content active={visualiseDataset}>
          {objectData instanceof Array
            && Object.keys(objectData[0]).map((key) => {
              return _makeAccordion(key, "root[]", objectData[0][key]);
            })}
          {!(objectData instanceof Array)
            && Object.keys(objectData).map((key) => {
              return _makeAccordion(key, "root", objectData[key]);
            })}
        </Accordion.Content>
      </Accordion>
      {notDateWarning
        && (
        <Message warning onDismiss={() => setNotDateWarning(false)}>
          <Message.Header>Have you selected a Date?</Message.Header>
          <p>{"We think that the field you selected might not be of Date type and your chart might not show as expected."}</p>
        </Message>
        )}
      {arrayWarning
        && (
        <Message warning onDismiss={() => setArrayWarning(false)}>
          <Message.Header>The Date field needs to be inside a single array</Message.Header>
          <p>{"The chart generator will not be able to process the information correctly when the selected date field is not part of an array or when it's nested in multiple arrays."}</p>
        </Message>
        )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  selectedField: {
    color: secondary,
  },
  autoSelectMessage: {
    paddingLeft: 5,
    borderLeft: `solid 3px ${secondary}`,
    marginBottom: 10,
  },
};

ObjectExplorer.defaultProps = {
  objectData: [],
  xAxisField: "",
  onChange: () => {},
};

ObjectExplorer.propTypes = {
  objectData: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object,
  ]),
  onChange: PropTypes.func,
  xAxisField: PropTypes.string,
  charts: PropTypes.array.isRequired,
  match: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    charts: state.chart.data,
  };
};

export default withRouter(connect(mapStateToProps)(ObjectExplorer));
