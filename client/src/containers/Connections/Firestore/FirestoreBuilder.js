import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Grid, Button, Row, Text, Spacer, Divider, Badge, Switch, Tooltip,
  Link, Loading, Checkbox, Dropdown, Input, Popover, Container, useTheme,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";
import uuid from "uuid/v4";
import { Calendar } from "react-date-range";
import { format, formatISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { HiRefresh } from "react-icons/hi";
import {
  CloseSquare, Danger, InfoCircle, Play, Plus, Calendar as CalendarIcon, TickSquare,
} from "react-iconly";
import { FaUndoAlt } from "react-icons/fa";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

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
  const [subFieldOptions, setSubFieldOptions] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [conditions, setConditions] = useState([{
    id: uuid(),
    field: "",
    operator: "==",
    value: "",
    values: [],
  }]);
  const [showSubUI, setShowSubUI] = useState(false);
  const [indexUrl, setIndexUrl] = useState("");
  const [useCache, setUseCache] = useState(false);

  const { isDark } = useTheme();

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

    setUseCache(!!window.localStorage.getItem("_cb_use_cache"));
  }, []);

  useEffect(() => {
    onChangeRequest(firestoreRequest);
  }, [firestoreRequest, connection]);

  useEffect(() => {
    if (dataRequest && dataRequest.configuration) {
      if (dataRequest.configuration.mainCollectionSample) {
        _populateFieldOptions(dataRequest.configuration.mainCollectionSample, "main");
      }

      if (dataRequest.configuration.subCollectionSample) {
        _populateFieldOptions(dataRequest.configuration.subCollectionSample, "sub");
      }
    }
  }, [dataRequest]);

  useEffect(() => {
    if (dataRequest
      && dataRequest.configuration
      && dataRequest.configuration.subCollections
      && dataRequest.configuration.subCollections.length > 0
    ) {
      setShowSubUI(true);
    } else {
      setShowSubUI(false);
    }
  }, [dataRequest]);

  const _populateFieldOptions = (sampleData, type) => {
    const tempFieldOptions = [];

    fieldFinder(sampleData).forEach((o) => {
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
            color: o.type === "date" ? "secondary"
              : o.type === "number" ? "primary"
                : o.type === "string" ? "success"
                  : o.type === "boolean" ? "warning"
                    : "neutral"
          },
        });
      }
    });

    if (type === "main") {
      setFieldOptions(tempFieldOptions);
    }

    if (type === "sub") {
      setSubFieldOptions(tempFieldOptions);
    }
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
    setIndexUrl("");
    runRequest(match.params.projectId, match.params.chartId, dataset.id, useCache)
      .then((result) => {
        setRequestLoading(false);
        const jsonString = JSON.stringify(result.data, null, 2);
        setResult(jsonString);
      })
      .catch((error) => {
        setRequestLoading(false);
        toast.error("The request failed. Please check your request 🕵️‍♂️");
        setResult(JSON.stringify(error, null, 2));

        if (error.message && error.message.indexOf("9 FAILED_PRECONDITION") > -1) {
          setIndexUrl(error.message.substring(error.message.indexOf("https://")));
        }
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

  const _onApplyCondition = (id, collection) => {
    const newConditions = conditions.map((item) => {
      const newItem = { ...item };
      if (item.id === id) {
        newItem.saved = true;
        newItem.collection = collection;

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

  const _onAddCondition = (collection) => {
    const newConditions = [...conditions, {
      id: uuid(),
      field: "",
      operator: "==",
      value: "",
      saved: false,
      values: [],
      collection,
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
      newRequest = { ...newRequest, configuration: { showSubCollections: false } };
    } else {
      newRequest = {
        ...newRequest,
        configuration: {
          ...newRequest.configuration,
          showSubCollections: !newRequest.configuration.showSubCollections,
        }
      };
    }

    _onTest(newRequest);
  };

  const _onSelectSubCollection = (subCollection) => {
    const newRequest = {
      ...dataRequest,
      configuration: { ...dataRequest.configuration, selectedSubCollection: subCollection },
    };

    _onTest(newRequest);
  };

  const _onChangeUseCache = () => {
    if (window.localStorage.getItem("_cb_use_cache")) {
      window.localStorage.removeItem("_cb_use_cache");
      setUseCache(false);
    } else {
      window.localStorage.setItem("_cb_use_cache", true);
      setUseCache(true);
    }
  };

  return (
    <div style={styles.container}>
      <Grid.Container>
        <Grid xs={12} sm={6} md={showSubUI ? 4 : 6}>
          <Container>
            <Row>
              <Text b>Select one of your collections:</Text>
            </Row>
            <Spacer y={0.5} />
            <Row wrap="wrap" css={{ pl: 0 }} className="firestorebuilder-collections-tut">
              {collectionData.map((collection) => (
                <>
                  <Badge
                    key={collection._queryOptions.collectionId}
                    variant={firestoreRequest.query !== collection._queryOptions.collectionId ? "bordered" : "default"}
                    color="primary"
                    onClick={() => _onChangeQuery(collection._queryOptions.collectionId)}
                    as="a"
                  >
                    {collection._queryOptions.collectionId}
                  </Badge>
                  <Spacer x={0.1} />
                </>
              ))}
            </Row>
            <Spacer y={0.5} />
            <Row>
              <Button
                size="sm"
                icon={<HiRefresh />}
                onClick={_onFetchCollections}
                disabled={collectionsLoading}
                auto
                bordered
                css={{ border: "none" }}
              >
                Refresh collections
              </Button>
            </Row>

            <Spacer y={0.5} />
            <Divider />
            <Spacer y={0.5} />

            <Row>
              <Text b>{"Data settings"}</Text>
            </Row>
            <Spacer y={0.5} />
            <Row className="firestorebuilder-settings-tut" align="flex-start">
              <Switch
                onChange={_toggleSubCollections}
                checked={
                  dataRequest.configuration && dataRequest.configuration.showSubCollections
                }
                size="sm"
              />
              <Spacer x={0.2} />
              <Text>Add sub-collections to the response</Text>
            </Row>

            <Spacer y={0.5} />
            <Divider />
            <Spacer y={0.5} />

            <Row align="center">
              <Text b>
                {"Filter the collection "}
              </Text>
              <Spacer x={0.5} />
              <Tooltip
                content="These filters are applied on the main collection only."
                css={{ zIndex: 10000 }}
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>

            <Row className="firestorebuilder-query-tut">
              <Conditions
                conditions={
                  conditions.filter((c) => (
                    !c.collection || (c.collection === dataRequest.query)
                  ))
                }
                fieldOptions={fieldOptions}
                onAddCondition={() => _onAddCondition(dataRequest.query)}
                onApplyCondition={(id) => _onApplyCondition(id, dataRequest.query)}
                onRevertCondition={_onRevertCondition}
                onRemoveCondition={_onRemoveCondition}
                updateCondition={_updateCondition}
                onChangeConditionValues={_onChangeConditionValues}
                collection={dataRequest.query}
              />
            </Row>
          </Container>
        </Grid>
        {showSubUI && dataRequest && dataRequest.configuration && (
          <Grid xs={12} sm={6} md={4}>
            <Container>
              <Row>
                <Text b>Fetch sub-collection data</Text>
              </Row>
              <Spacer y={0.5} />
              <Row wrap="wrap">
                {dataRequest.configuration.subCollections.map((subCollection) => (
                  <>
                    <Badge
                      key={subCollection}
                      color="secondary"
                      variant={dataRequest.configuration.selectedSubCollection !== subCollection ? "bordered" : "default"}
                      onClick={() => _onSelectSubCollection(subCollection)}
                      as="a"
                    >
                      {subCollection}
                    </Badge>
                    <Spacer x={0.1} />
                  </>
                ))}
              </Row>
              <Spacer y={0.5} />
              <Row>
                <Button
                  color="error"
                  onClick={() => _onSelectSubCollection("")}
                  icon={<CloseSquare />}
                  disabled={!dataRequest.configuration.selectedSubCollection}
                  auto
                  css={{ border: "none" }}
                  bordered
                >
                  Clear selection
                </Button>
              </Row>

              <Spacer y={0.5} />
              <Divider />
              <Spacer y={0.5} />

              {dataRequest.configuration.selectedSubCollection && (
                <>
                  <Row align="center">
                    <Text b>
                      {"Filter the sub-collection "}
                    </Text>
                    <Spacer x={0.2} />
                    <Tooltip
                      content="These filters are applied on the sub-collection only."
                      css={{ zIndex: 10000 }}
                    >
                      <InfoCircle size="small" />
                    </Tooltip>
                  </Row>
                  <Spacer y={0.5} />
                  <Row>
                    <Conditions
                      conditions={
                        conditions.filter((c) => (
                          c.collection === dataRequest.configuration.selectedSubCollection
                        ))
                      }
                      fieldOptions={subFieldOptions}
                      onAddCondition={() => {
                        _onAddCondition(dataRequest.configuration.selectedSubCollection);
                      }}
                      onApplyCondition={(id) => {
                        _onApplyCondition(id, dataRequest.configuration.selectedSubCollection);
                      }}
                      onRevertCondition={_onRevertCondition}
                      onRemoveCondition={_onRemoveCondition}
                      updateCondition={_updateCondition}
                      onChangeConditionValues={_onChangeConditionValues}
                      collection={dataRequest.query}
                    />
                  </Row>
                  {indexUrl && (
                    <>
                      <Spacer y={0.5} />
                      <Divider />
                      <Spacer y={0.5} />
                      <Row>
                        <Container css={{ backgroundColor: "$blue200", p: 10 }}>
                          <Row>
                            <Text h5>
                              {"To be able to filter this sub-collection, you will need to set up an index."}
                            </Text>
                          </Row>
                          <Row>
                            <Text>
                              <Link href={indexUrl} target="_blank" rel="noopener noreferrer">
                                {"Click here to set it up in two clicks"}
                              </Link>
                            </Text>
                          </Row>
                        </Container>
                      </Row>
                    </>
                  )}
                </>
              )}
            </Container>
          </Grid>
        )}
        <Grid xs={12} sm={showSubUI ? 12 : 6} md={showSubUI ? 4 : 6}>
          <Container>
            <Row className="firestorebuilder-request-tut">
              <Button
                iconRight={requestLoading ? <Loading type="points" /> : <Play />}
                disabled={requestLoading}
                onClick={() => _onTest()}
                shadow
                css={{ width: "100%" }}
              >
                Get Firestore data
              </Button>
            </Row>
            <Spacer y={0.5} />
            <Row align="center">
              <Checkbox
                label="Use cache"
                isSelected={!!useCache}
                onChange={_onChangeUseCache}
                size="sm"
              />
              <Spacer x={0.2} />
              <Tooltip
                content="Use cache to avoid hitting the Firestore API every time you request data. The cache will be cleared when you change any of the settings."
                css={{ zIndex: 10000, maxWidth: 500 }}
              >
                <InfoCircle size="small" />
              </Tooltip>
            </Row>
            <Spacer y={0.5} />
            <Row className="firestorebuilder-result-tut">
              <div style={{ width: "100%" }}>
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="450px"
                  width="none"
                  value={result || ""}
                  name="resultEditor"
                  readOnly
                  editorProps={{ $blockScrolling: false }}
                />
              </div>
            </Row>
          </Container>
        </Grid>
      </Grid.Container>
    </div>
  );
}

function Conditions(props) {
  const {
    fieldOptions, conditions, updateCondition, onChangeConditionValues,
    onRemoveCondition, onApplyCondition, onRevertCondition, onAddCondition,
  } = props;

  const [tempConditionValue, setTempConditionValue] = useState("");

  return (
    <Container className="datasetdata-filters-tut" css={{ pr: 0, pl: 0 }}>
      {conditions && conditions.length === 0 && (
        <Row>
          <Button
            icon={<Plus />}
            onClick={onAddCondition}
            auto
            bordered
            css={{ border: "none" }}
          >
            Add filter
          </Button>
        </Row>
      )}

      {conditions && conditions.map((condition, index) => {
        return (
          <Fragment key={condition.id}>
            <Row align="center" wrap="wrap">
              {!_.find(fieldOptions, { value: condition.field }) && condition.saved && (
                <>
                  <Tooltip
                    content="This condition might not work on the current collection."
                    css={{ zIndex: 10000 }}
                  >
                    <Danger primaryColor={secondary} />
                  </Tooltip>
                  <Spacer x={0.2} />
                </>
              )}
              <Dropdown>
                <Dropdown.Trigger>
                  <Input
                    value={(condition.field && condition.field.substring(condition.field.lastIndexOf(".") + 1)) || "field"}
                    animated={false}
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={(key) => updateCondition(condition.id, key, "field")}
                  selectedKeys={[condition.field]}
                  selectionMode="single"
                  css={{ minWidth: "fit-content" }}
                >
                  {fieldOptions.map((option) => (
                    <Dropdown.Item key={option.value} value={option.value}>
                      <Container css={{ p: 0, m: 0 }}>
                        <Row>
                          <Badge color={option.label.color}>{option.label.content}</Badge>
                          <Spacer x={0.2} />
                          <Text>{option.text}</Text>
                        </Row>
                      </Container>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>

              <Spacer x={0.2} />

              <Dropdown>
                <Dropdown.Trigger>
                  <Input
                    value={
                      (
                        _.find(operators, { value: condition.operator })
                        && _.find(operators, { value: condition.operator }).key
                      )
                      || "="
                    }
                    animated={false}
                  />
                </Dropdown.Trigger>
                <Dropdown.Menu
                  onAction={(key) => updateCondition(condition.id, key, "operator")}
                  selectedKeys={[condition.operator]}
                  selectionMode="single"
                >
                  {operators.map((option) => (
                    <Dropdown.Item key={option.value}>
                      {option.text}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
              <Spacer x={0.3} />
              {(!condition.field
                || (_.find(fieldOptions, { value: condition.field })
                  && _.find(fieldOptions, { value: condition.field }).type !== "date"))
                  && (condition.operator !== "array-contains-any"
                  && condition.operator !== "in"
                  && condition.operator !== "not-in")
                && (
                  <Input
                    placeholder="Enter a value"
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, e.target.value, "value")}
                    disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                    bordered
                    animated={false}
                    size="sm"
                  />
                )}
              {_.find(fieldOptions, { value: condition.field })
                && _.find(fieldOptions, { value: condition.field }).type === "date" && (
                  <Popover>
                    <Popover.Trigger>
                      <Input
                        placeholder="Enter a value"
                        contentRight={<CalendarIcon />}
                        value={(condition.value && format(new Date(condition.value), "Pp", { locale: enGB })) || "Click to select a date"}
                        disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                        bordered
                        animated={false}
                        size="sm"
                      />
                    </Popover.Trigger>
                    <Popover.Content>
                      <Calendar
                        date={(condition.value && new Date(condition.value)) || new Date()}
                        onChange={(date) => updateCondition(condition.id, formatISO(date), "value")}
                        locale={enGB}
                        color={secondary}
                      />
                    </Popover.Content>
                  </Popover>
              )}

              {(condition.operator === "array-contains-any"
                || condition.operator === "in"
                || condition.operator === "not-in")
                && (
                  <>
                    {condition.addingValue && (
                      <>
                        <Input
                          placeholder="Enter a value"
                          value={tempConditionValue}
                          onChange={(e) => setTempConditionValue(e.target.value)}
                          bordered
                          size="sm"
                          animated={false}
                        />
                        <Spacer x={0.2} />
                        <Button
                          icon={<Plus />}
                          color="success"
                          onClick={() => {
                            onChangeConditionValues(
                              condition.id,
                              {
                                value: condition.values.concat([tempConditionValue]),
                              }
                            );
                            updateCondition(condition.id, false, "addingValue");
                            setTempConditionValue("");
                          }}
                          size="sm"
                          bordered
                          css={{ minWidth: "fit-content" }}
                        />
                        <Spacer x={0.1} />
                        <Button
                          icon={<CloseSquare />}
                          color="warning"
                          onClick={() => {
                            setTempConditionValue("");
                            updateCondition(condition.id, false, "addingValue");
                          }}
                          size="sm"
                          bordered
                          css={{ minWidth: "fit-content" }}
                        />
                      </>
                    )}

                    {!condition.addingValue && condition.values && condition.values.map((item) => (
                      <>
                        <Badge color="secondary" key={item} size="sm">
                          <span style={{ paddingLeft: 5 }}>{item}</span>
                          <Spacer x={0.1} />
                          <Link
                            onClick={() => {
                              onChangeConditionValues(
                                condition.id, {
                                  value: condition.values.filter((i) => i !== item),
                                }
                              );
                            }}
                          >
                            <CloseSquare size="small" primaryColor="white" />
                          </Link>
                        </Badge>
                        <Spacer x={0.1} />
                      </>
                    ))}

                    {!condition.addingValue && (
                      <Badge
                        variant="bordered"
                        onClick={() => updateCondition(condition.id, true, "addingValue")}
                        size="sm"
                      >
                        <Plus size="small" />
                        <Spacer x={0.1} />
                        <span>{"Add a Value"}</span>
                      </Badge>
                    )}
                  </>
                )}

              <Spacer x={0.5} />

              <Tooltip
                content="Remove filter"
                css={{ zIndex: 10000 }}
              >
                <Button
                  icon={<CloseSquare />}
                  color="error"
                  onClick={() => onRemoveCondition(condition.id)}
                  size="sm"
                  flat
                  css={{ minWidth: "fit-content" }}
                />
              </Tooltip>
              <Spacer x={0.2} />

              {!condition.saved && (condition.value || condition.operator === "isNotNull" || condition.operator === "isNull" || (condition.values && condition.values.length > 0)) && (
                <>
                  <Tooltip
                    content="Apply this filter"
                    css={{ zIndex: 10000 }}
                  >
                    <Button
                      icon={<TickSquare />}
                      color="success"
                      onClick={() => onApplyCondition(condition.id)}
                      size="sm"
                      flat
                      css={{ minWidth: "fit-content" }}
                    />
                  </Tooltip>
                  <Spacer x={0.2} />
                </>
              )}

              {!condition.saved
                && condition.id && (condition.value || condition.values.length > 0)
                && (
                  <>
                    <Tooltip
                      content="Undo changes"
                      css={{ zIndex: 10000 }}
                    >
                      <Button
                        icon={<FaUndoAlt />}
                        color="warning"
                        onClick={() => onRevertCondition(condition.id)}
                        size="sm"
                        flat
                        css={{ minWidth: "fit-content" }}
                      />
                    </Tooltip>
                    <Spacer x={0.2} />
                  </>
                )}

              {index === conditions.length - 1 && (
                <Tooltip
                  content="Add a new filter"
                  css={{ zIndex: 10000 }}
                >
                  <Button
                    icon={<Plus />}
                    onClick={onAddCondition}
                    size="sm"
                    flat
                    css={{ minWidth: "fit-content" }}
                  />
                </Tooltip>
              )}
            </Row>
            <Spacer y={0.2} />
          </Fragment>
        );
      })}
    </Container>
  );
}
Conditions.propTypes = {
  onRevertCondition: PropTypes.func.isRequired,
  onChangeConditionValues: PropTypes.func.isRequired,
  onRemoveCondition: PropTypes.func.isRequired,
  onApplyCondition: PropTypes.func.isRequired,
  updateCondition: PropTypes.func.isRequired,
  onAddCondition: PropTypes.func.isRequired,
  conditions: PropTypes.array.isRequired,
  fieldOptions: PropTypes.array.isRequired,
};

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
    runRequest: (projectId, chartId, datasetId, getCache) => {
      return dispatch(runRequestAction(projectId, chartId, datasetId, getCache));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
    testRequest: (projectId, data) => dispatch(testRequestAction(projectId, data)),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(FirestoreBuilder));
