import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Form, Button, Icon, Label, Header, Divider, Popup, Input, Dropdown, Checkbox,
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
import determineType from "../../../modules/determineType";

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
  const [firestoreRequest, setFirestoreRequest] = useState({
    query: "",
  });
  const [result, setResult] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [collectionData, setCollectionData] = useState([]);
  const [fieldOptions, setFieldOptions] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [conditions, setConditions] = useState([{
    id: uuid(),
    field: "",
    operator: "==",
    value: "",
    items: [],
    values: [],
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

        const finalConditions = newConditions.concat(toAddConditions);
        if (finalConditions.length === 0) {
          setConditions([{
            id: uuid(),
            field: "",
            operator: "==",
            value: "",
            items: [],
            values: [],
          }]);
        } else {
          setConditions(finalConditions);
        }
      }

      setFirestoreRequest(dataRequest);
      _onFetchCollections();

      setTimeout(() => {
        changeTutorial("firestoreBuilder");
      }, 1000);

      if (dataRequest.query) {
        _onRunRequest();
      }
    }
  }, []);

  useEffect(() => {
    onChangeRequest(firestoreRequest);
  }, [firestoreRequest, connection]);

  useEffect(() => {
    if (result && fieldOptions.length === 0) {
      _populateFieldOptions();
    }
  }, [result]);

  const _populateFieldOptions = () => {
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
  };

  const _onTest = (request = firestoreRequest) => {
    setRequestLoading(true);

    if (request === null) request = firestoreRequest; // eslint-disable-line
    const requestToSave = _.cloneDeep(request);
    onSave(requestToSave).then(() => {
      _onRunRequest();
    });
  };

  const _onRunRequest = () => {
    runRequest(match.params.projectId, match.params.chartId, dataset.id)
      .then((result) => {
        setRequestLoading(false);
        const jsonString = JSON.stringify(result.data, null, 2);
        setResult(jsonString);
      })
      .catch((error) => {
        setRequestLoading(false);
        toast.error("The request failed. Please check your request 🕵️‍♂️");
        setResult(JSON.stringify(error, null, 2));
      });
  };

  const _onFetchCollections = () => {
    setCollectionsLoading(true);
    return testRequest(match.params.projectId, connection)
      .then((data) => {
        return data.json();
      })
      .then((data) => {
        setCollectionsLoading(false);
        setCollectionData(data);
      })
      .catch(() => {
        setCollectionsLoading(false);
      });
  };

  const _onChangeQuery = (query) => {
    setFirestoreRequest({ ...firestoreRequest, query });
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
      if (item.id === id) {
        newItem.saved = true;

        let jsonResult;
        try {
          jsonResult = JSON.parse(result);
          if (jsonResult && jsonResult.length === 0) return newItem;
        } catch (e) {
          return newItem;
        }

        // now check to see if the values need to be converted to numbers
        const selectedField = _.find(fieldOptions, (o) => o.value === newItem.field);
        if (selectedField && selectedField.type === "array") {
          const selector = newItem.field.substring(newItem.field.indexOf("].") + 2);
          const arrayValues = _.find(
            jsonResult,
            (o) => o[selector] && o[selector].length > 0
          )[selector];
          if (newItem.operator !== "array-contains" && determineType(arrayValues[0]) === "number") {
            newItem.values = newItem.values.map((v) => parseInt(v, 10));
            newItem.items = newItem.items.map((i) => (
              { text: i.text, value: parseInt(i.value, 10) }
            ));
          } else if (newItem.operator === "array-contains" && determineType(arrayValues[0]) === "number") {
            newItem.value = parseInt(newItem.value, 10);
          }
        }
      }

      return newItem;
    });

    setConditions(newConditions);
    _onSaveConditions(newConditions);
  };

  const _onRevertCondition = (id) => {
    const newConditions = conditions.map((item) => {
      let newItem = { ...item };
      if (item.id === id) {
        const previousItem = _.find(dataRequest.conditions, { id });
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
      operator: "==",
      value: "",
      saved: false,
      items: [],
      values: [],
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
        operator: "==",
        value: "",
        saved: false,
        items: [],
        values: [],
      });
    }

    setConditions(newConditions);
    _onSaveConditions(newConditions);
  };

  const _onSaveConditions = (newConditions) => {
    const savedConditions = newConditions.filter((item) => item.saved);
    const newRequest = { ...firestoreRequest, conditions: savedConditions };
    setFirestoreRequest(newRequest);
    _onTest(newRequest);
  };

  const _onAddConditionValue = (id, { value }) => {
    const newConditions = conditions.map((c) => {
      const newC = c;
      if (newC.id === id) {
        newC.items = [{ text: value, value }, ...newC.items];
      }
      return newC;
    });
    setConditions(newConditions);
  };

  const _onChangeConditionValues = (id, { value }) => {
    const newConditions = conditions.map((c) => {
      const newC = c;
      if (newC.id === id) {
        newC.values = value;
        newC.saved = false;
      }
      return newC;
    });
    setConditions(newConditions);
  };

  const _toggleSubCollections = () => {
    let newRequest = _.clone(dataRequest);
    if (!dataRequest.configuration) {
      newRequest = { ...newRequest, configuration: { subCollections: true } };
    } else {
      newRequest = {
        ...newRequest,
        configuration: {
          ...newRequest.configuration,
          subCollections: !newRequest.configuration.subCollections,
        }
      };
    }

    _onTest(newRequest);
  };

  const _toggleFlipSubCollections = () => {
    let newRequest = _.clone(dataRequest);
    if (!dataRequest.configuration) {
      newRequest = { ...newRequest, configuration: { flipSubCollections: true } };
    } else {
      newRequest = {
        ...newRequest,
        configuration: {
          ...newRequest.configuration,
          flipSubCollections: !newRequest.configuration.flipSubCollections,
        }
      };
    }

    _onTest(newRequest);
  };

  return (
    <div style={styles.container}>
      <Grid columns={2} stackable centered>
        <Grid.Column width={10}>
          <div className="firestorebuilder-collections-tut">
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
            <Button
              primary
              size="small"
              icon="refresh"
              className="tertiary"
              onClick={_onFetchCollections}
              loading={collectionsLoading}
              content="Refresh collections"
            />
          </div>
          <Divider />

          <div className="firestorebuilder-settings-tut">
            <Header as="h4">
              {"Data settings"}
            </Header>

            <Form>
              <Form.Field>
                <Checkbox
                  toggle
                  label="Fetch sub-collections for your documents"
                  onChange={_toggleSubCollections}
                  checked={dataRequest.configuration && dataRequest.configuration.subCollections}
                />
              </Form.Field>
              <Form.Field>
                <Checkbox
                  toggle
                  label="Bring sub-collections on the first level"
                  onChange={_toggleFlipSubCollections}
                  disabled={!dataRequest.configuration || !dataRequest.configuration.subCollections}
                  checked={
                    dataRequest.configuration && dataRequest.configuration.flipSubCollections
                  }
                />
              </Form.Field>
            </Form>
          </div>
          <Divider />

          <div className="firestorebuilder-query-tut">
            <Header as="h4">
              {"Filter the data "}
              <Popup
                trigger={<Icon style={{ fontSize: 16, verticalAlign: "baseline" }} name="question circle" />}
                content="These filters are applied on the main collection only. If you want to filter the sub-collections, you can use the dataset filters after you close this window."
              />
            </Header>
            {conditions.map((condition, index) => {
              return (
                <Grid.Row key={condition.id} style={styles.conditionRow} className="datasetdata-filters-tut">
                  <Grid.Column>
                    {!_.find(fieldOptions, { value: condition.field }) && condition.saved && (
                      <Popup
                        trigger={<Icon name="exclamation triangle" color="orange" />}
                        content="This condition might not work on the current collection."
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
                        || "=="
                      }
                      value={condition.operator}
                      onChange={(e, data) => _updateCondition(condition.id, data.value, "operator")}
                    />

                    {(!condition.field
                      || (_.find(fieldOptions, { value: condition.field })
                        && _.find(fieldOptions, { value: condition.field }).type !== "date"))
                        && (condition.operator !== "array-contains-any"
                          && condition.operator !== "in"
                          && condition.operator !== "not-in")
                          && (
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

                    {(condition.operator === "array-contains-any"
                      || condition.operator === "in"
                      || condition.operator === "not-in")
                      && (
                      <Dropdown
                        options={condition.items}
                        placeholder="Enter values"
                        search
                        selection
                        multiple
                        allowAdditions
                        value={condition.values}
                        onAddItem={(e, data) => _onAddConditionValue(condition.id, data)}
                        onChange={(e, data) => _onChangeConditionValues(condition.id, data)}
                        className="small"
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

                      {!condition.saved && (condition.value || condition.operator === "isNotNull" || condition.operator === "isNull" || condition.values.length > 0) && (
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

                      {!condition.saved && (condition.value || condition.values.length > 0) && (
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
            <Button
              size="small"
              primary
              className="tertiary"
              content="Refresh fields"
              icon="refresh"
              onClick={_populateFieldOptions}
            />
          </div>
        </Grid.Column>
        <Grid.Column width={6}>
          <Form>
            <Form.Field className="firestorebuilder-request-tut">
              <Button
                primary
                icon
                labelPosition="right"
                loading={requestLoading}
                onClick={() => _onTest()}
                fluid
              >
                <Icon name="play" />
                Get Firestore data
              </Button>
            </Form.Field>
            <Form.Field className="firestorebuilder-result-tut">
              <AceEditor
                mode="json"
                theme="tomorrow"
                height="450px"
                width="none"
                value={result || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
              />
            </Form.Field>
          </Form>
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
