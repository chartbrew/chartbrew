import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Button, Icon, Label, Header, Divider, Popup, Input, Dropdown,
} from "semantic-ui-react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";
import uuid from "uuid/v4";
import { Calendar } from "react-date-range";
import { format, formatISO } from "date-fns";
import { enGB } from "date-fns/locale";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";

import {
  runRequest as runRequestAction,
} from "../../../actions/dataset";
import {
  testRequest as testRequestAction,
} from "../../../actions/connection";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import fieldFinder from "../../../modules/fieldFinder";
import { secondary } from "../../../config/colors";

export const operators = [{
  key: "=",
  text: "= (is)",
  value: "==",
}, {
  key: "≠",
  text: "≠ (is not)",
  value: "!=",
}, {
  key: "!∅",
  text: "!∅ (is not null)",
  value: "isNotNull",
}, {
  key: "∅",
  text: "∅ (is null)",
  value: "isNull",
}, {
  key: ">",
  text: "> (greater than)",
  value: ">",
}, {
  key: "≥",
  text: "≥ (greater or equal)",
  value: ">=",
}, {
  key: "<",
  text: "< (less than)",
  value: "<",
}, {
  key: "≤",
  text: "≤ (less or equal)",
  value: "<=",
}, {
  key: "array-contains",
  text: "array contains",
  value: "array-contains",
}, {
  key: "array-contains-any",
  text: "array contains any",
  value: "array-contains-any",
}, {
  key: "in",
  text: "value in",
  value: "in",
}, {
  key: "not-in",
  text: "value not in",
  value: "not-in",
}];

/*
  The API Data Request builder
*/
function FirestoreBuilder(props) {
  const [firestoreRequest, setfirestoreRequest] = useState({
    query: "",
  });
  const [result, setResult] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [collectionData, setCollectionData] = useState([]);
  const [fieldOptions, setFieldOptions] = useState([]);
  const [conditions, setConditions] = useState([{
    id: uuid(),
    field: "",
    operator: "is",
    value: "",
  }]);

  const {
    dataRequest, match, onChangeRequest, runRequest, dataset,
    connection, onSave, requests, changeTutorial, testRequest, // eslint-disable-line
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      // get the request data if it exists
      const requestBody = _.find(requests, { options: { id: dataset.id } });
      if (requestBody) {
        setResult(JSON.stringify(requestBody.data, null, 2));
      }

      if (dataRequest && dataRequest.conditions) {
        let newConditions = [...conditions];

        // in case of initialisation, remove the first empty condition
        if (newConditions.length === 1 && !newConditions[0].saved && !newConditions[0].value) {
          newConditions = [];
        }

        const toAddConditions = [];
        for (let i = 0; i < dataRequest.conditions.length; i++) {
          let found = false;
          for (let j = 0; j < newConditions.length; j++) {
            if (newConditions[j].id === dataRequest.conditions[i].id) {
              newConditions[j] = _.clone(dataRequest.conditions[i]);
              found = true;
            }
          }

          if (!found) toAddConditions.push(dataRequest.conditions[i]);
        }

        setConditions(newConditions.concat(toAddConditions));
      }

      setfirestoreRequest(dataRequest);
      _onFetchCollections();

      // setTimeout(() => {
      //   changeTutorial("FirestoreBuilder");
      // }, 1000);

      if (dataRequest.query) {
        _onTest();
      }
    }
  }, []);

  // useEffect(() => {
  //   if (dataRequest && dataRequest.conditions) {
  //     let newConditions = [...conditions];

  //     // in case of initialisation, remove the first empty condition
  //     if (newConditions.length === 1 && !newConditions[0].saved && !newConditions[0].value) {
  //       newConditions = [];
  //     }

  //     const toAddConditions = [];
  //     for (let i = 0; i < dataRequest.conditions.length; i++) {
  //       let found = false;
  //       for (let j = 0; j < newConditions.length; j++) {
  //         if (newConditions[j].id === dataRequest.conditions[i].id) {
  //           newConditions[j] = _.clone(dataRequest.conditions[i]);
  //           found = true;
  //         }
  //       }

  //       if (!found) toAddConditions.push(dataRequest.conditions[i]);
  //     }

  //     setConditions(newConditions.concat(toAddConditions));
  //   }
  // }, [dataRequest]);

  useEffect(() => {
    onChangeRequest(firestoreRequest);
  }, [firestoreRequest, connection]);

  useEffect(() => {
    if (result) {
      const tempFieldOptions = [];

      let resultJSON;
      try {
        resultJSON = JSON.parse(result);
      } catch (err) {
        return;
      }

      fieldFinder(resultJSON).forEach((o) => {
        if (o.field) {
          tempFieldOptions.push({
            key: o.field,
            text: o.field && o.field.replace("root[].", "").replace("root.", ""),
            value: o.field,
            type: o.type,
            label: {
              style: { width: 55, textAlign: "center" },
              content: o.type || "unknown",
              size: "mini",
              color: o.type === "date" ? "olive"
                : o.type === "number" ? "blue"
                  : o.type === "string" ? "teal"
                    : o.type === "boolean" ? "purple"
                      : "grey"
            },
          });
        }
      });

      setFieldOptions(tempFieldOptions);
    }
  }, [result]);

  const _onTest = () => {
    setRequestLoading(true);

    onSave().then(() => {
      runRequest(match.params.projectId, match.params.chartId, dataset.id)
        .then((result) => {
          setRequestLoading(false);
          setResult(JSON.stringify(result.data, null, 2));
        })
        .catch((error) => {
          setRequestLoading(false);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setResult(JSON.stringify(error, null, 2));
        });
    });
  };

  const _onFetchCollections = () => {
    return testRequest(match.params.projectId, connection)
      .then((data) => {
        return data.json();
      })
      .then((data) => {
        setCollectionData(data);
      });
  };

  const _onChangeQuery = (query) => {
    setfirestoreRequest({ ...firestoreRequest, query });
  };

  const _updateCondition = (id, data, type) => {
    const newConditions = conditions.map((condition) => {
      const newCondition = condition;
      if (condition.id === id) {
        newCondition[type] = data;
        newCondition.saved = false;

        if (type === "field") {
          newCondition.value = "";
        }
      }

      return newCondition;
    });

    setConditions(newConditions);
  };

  const _onApplyCondition = (id) => {
    const newConditions = conditions.map((item) => {
      const newItem = { ...item };
      if (item.id === id) newItem.saved = true;

      return newItem;
    });

    setConditions(newConditions);
    _onSaveConditions(newConditions);
  };

  const _onRevertCondition = (id) => {
    const newConditions = conditions.map((item) => {
      let newItem = { ...item };
      if (item.id === id) {
        const previousItem = _.find(dataset.conditions, { id });
        newItem = { ...previousItem };
      }

      return newItem;
    });

    setConditions(newConditions);
  };

  const _onAddCondition = () => {
    const newConditions = [...conditions, {
      id: uuid(),
      field: "",
      operator: "=",
      value: "",
      saved: false,
    }];

    setConditions(newConditions);
  };

  const _onRemoveCondition = (id) => {
    let newConditions = [...conditions];
    newConditions = newConditions.filter((condition) => condition.id !== id);

    if (newConditions.length === 0) {
      newConditions.push({
        id: uuid(),
        field: "",
        operator: "=",
        value: "",
        saved: false,
      });
    }

    setConditions(newConditions);
    _onSaveConditions(newConditions);
  };

  const _onSaveConditions = (newConditions) => {
    const savedConditions = newConditions.filter((item) => item.saved);
    // onChangeRequest({ ...firestoreRequest, conditions: savedConditions });
    setfirestoreRequest({ ...firestoreRequest, conditions: savedConditions });
  };

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered>
        <Grid.Column width={10}>
          <Header as="h4">Select one of your collections:</Header>
          <Label.Group size="large">
            {collectionData.map((collection) => (
              <Label
                key={collection._queryOptions.collectionId}
                basic={firestoreRequest.query !== collection._queryOptions.collectionId}
                color="blue"
                onClick={() => _onChangeQuery(collection._queryOptions.collectionId)}
                as="a"
              >
                {collection._queryOptions.collectionId}
              </Label>
            ))}
          </Label.Group>
          <div>
            <Divider />
            <Button
              size="small"
              icon
              labelPosition="right"
              onClick={_onFetchCollections}
            >
              <Icon name="refresh" />
              Refresh collections
            </Button>
          </div>

          <Header as="h4">Filter the data</Header>
          {conditions.map((condition, index) => {
            return (
              <Grid.Row key={condition.id} style={styles.conditionRow} className="datasetdata-filters-tut">
                <Grid.Column>
                  {!_.find(fieldOptions, { value: condition.field }) && (
                    <Popup
                      trigger={<Icon name="exclamation triangle" color="orange" />}
                      content="This condition will not work on the current collection."
                    />
                  )}
                  {index === 0 && (<label>{"where "}</label>)}
                  {index > 0 && (<label>{"and "}</label>)}
                  <Dropdown
                    icon={null}
                    header="Type to search"
                    className="small button"
                    button
                    options={fieldOptions}
                    search
                    text={(condition.field && condition.field.substring(condition.field.lastIndexOf(".") + 1)) || "field"}
                    value={condition.field}
                    onChange={(e, data) => _updateCondition(condition.id, data.value, "field")}
                  />
                  <Dropdown
                    icon={null}
                    button
                    className="small button"
                    options={operators}
                    search
                    text={
                      (
                        _.find(operators, { value: condition.operator })
                        && _.find(operators, { value: condition.operator }).key
                      )
                      || "="
                    }
                    value={condition.operator}
                    onChange={(e, data) => _updateCondition(condition.id, data.value, "operator")}
                  />

                  {(!condition.field
                    || (_.find(fieldOptions, { value: condition.field })
                      && _.find(fieldOptions, { value: condition.field }).type !== "date")) && (
                      <Input
                        placeholder="Enter a value"
                        size="small"
                        value={condition.value}
                        onChange={(e, data) => _updateCondition(condition.id, data.value, "value")}
                        disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                      />
                  )}
                  {_.find(fieldOptions, { value: condition.field })
                    && _.find(fieldOptions, { value: condition.field }).type === "date" && (
                      <Popup
                        on="click"
                        pinned
                        position="top center"
                        trigger={(
                          <Input
                            placeholder="Enter a value"
                            icon="calendar alternate"
                            iconPosition="left"
                            size="small"
                            value={condition.value && format(new Date(condition.value), "Pp", { locale: enGB })}
                            disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                          />
                        )}
                        content={(
                          <Calendar
                            date={(condition.value && new Date(condition.value)) || new Date()}
                            onChange={(date) => _updateCondition(condition.id, formatISO(date), "value")}
                            locale={enGB}
                            color={secondary}
                          />
                        )}
                      />
                  )}

                  <Button.Group size="small">
                    <Popup
                      trigger={(
                        <Button
                          icon
                          basic
                          style={styles.addConditionBtn}
                          onClick={() => _onRemoveCondition(condition.id)}
                        >
                          <Icon name="minus" />
                        </Button>
                      )}
                      content="Remove condition"
                      position="top center"
                    />

                    {index === conditions.length - 1 && (
                      <Popup
                        trigger={(
                          <Button
                            icon
                            basic
                            style={styles.addConditionBtn}
                            onClick={_onAddCondition}
                          >
                            <Icon name="plus" />
                          </Button>
                        )}
                        content="Add a new condition"
                        position="top center"
                      />
                    )}

                    {!condition.saved && (condition.value || condition.operator === "isNotNull" || condition.operator === "isNull") && (
                      <Popup
                        trigger={(
                          <Button
                            icon
                            basic
                            style={styles.addConditionBtn}
                            onClick={() => _onApplyCondition(condition.id)}
                          >
                            <Icon name="checkmark" color="green" />
                          </Button>
                        )}
                        content="Apply this condition"
                        position="top center"
                      />
                    )}

                    {!condition.saved && condition.value && (
                      <Popup
                        trigger={(
                          <Button
                            icon
                            basic
                            style={styles.addConditionBtn}
                            onClick={() => _onRevertCondition(condition.id)}
                          >
                            <Icon name="undo alternate" color="olive" />
                          </Button>
                        )}
                        content="Undo changes"
                        position="top center"
                      />
                    )}
                  </Button.Group>
                </Grid.Column>

              </Grid.Row>
            );
          })}
        </Grid.Column>
        <Grid.Column width={6}>
          <Form>
            <Form.Field className="FirestoreBuilder-request-tut">
              <Button
                primary
                icon
                labelPosition="right"
                loading={requestLoading}
                onClick={_onTest}
                fluid
              >
                <Icon name="play" />
                Make the request
              </Button>
            </Form.Field>
          </Form>
          <AceEditor
            mode="json"
            theme="tomorrow"
            height="450px"
            width="none"
            value={result || ""}
            onChange={() => setResult(result)}
            name="resultEditor"
            readOnly
            editorProps={{ $blockScrolling: false }}
            className="FirestoreBuilder-result-tut"
          />
        </Grid.Column>
      </Grid>
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
  addConditionBtn: {
    boxShadow: "none",
  },
  conditionRow: {
    paddingTop: 5,
    paddingBottom: 5,
  },
};

FirestoreBuilder.defaultProps = {
  dataRequest: null,
};

FirestoreBuilder.propTypes = {
  dataset: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  requests: PropTypes.array.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
  testRequest: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
  return {
    requests: state.dataset.requests,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runRequest: (projectId, chartId, datasetId) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
    testRequest: (projectId, data) => dispatch(testRequestAction(projectId, data)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(FirestoreBuilder));
