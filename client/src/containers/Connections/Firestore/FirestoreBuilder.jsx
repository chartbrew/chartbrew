import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import {
  Button,Spacer, Divider, Chip, Switch, Tooltip, Link, Checkbox, Input, Popover,
  CircularProgress, Select, SelectItem, PopoverTrigger, PopoverContent,
} from "@nextui-org/react";
import AceEditor from "react-ace";
import _ from "lodash";
import { toast } from "react-toastify";
import uuid from "uuid/v4";
import { Calendar } from "react-date-range";
import { format, formatISO } from "date-fns";
import { enGB } from "date-fns/locale";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  runDataRequest as runDataRequestAction,
} from "../../../actions/dataRequest";
import {
  getConnection as getConnectionAction,
  testRequest as testRequestAction,
} from "../../../actions/connection";
import { changeTutorial as changeTutorialAction } from "../../../actions/tutorial";
import fieldFinder from "../../../modules/fieldFinder";
import { secondary } from "../../../config/colors";
import determineType from "../../../modules/determineType";
import Container from "../../../components/Container";
import Row from "../../../components/Row";
import Text from "../../../components/Text";
import useThemeDetector from "../../../modules/useThemeDetector";
import { IoAdd, IoAddCircle, IoArrowUndoCircle, IoCalendarOutline, IoClose, IoCloseCircle, IoInformationCircleOutline, IoPlay, IoReload, IoTrashBin, IoWarningOutline } from "react-icons/io5";

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
  const [conditions, setConditions] = useState([]);
  const [showSubUI, setShowSubUI] = useState(false);
  const [indexUrl, setIndexUrl] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [fullConnection, setFullConnection] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [limit, setLimit] = useState(0);
  const [orderBy, setOrderBy] = useState("");
  const [orderByDirection, setOrderByDirection] = useState("desc");

  const isDark = useThemeDetector();

  const {
    dataRequest, match, onChangeRequest, runDataRequest,
    connection, onSave, changeTutorial, testRequest,
    onDelete, getConnection, responses,
  } = props;

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      setFirestoreRequest(dataRequest);
      _initializeConditions(dataRequest);

      setTimeout(() => {
        changeTutorial("firestoreBuilder");
      }, 1000);
    }
  }, []);

  useEffect(() => {
    onChangeRequest(firestoreRequest);
    if (connection?.id && !fullConnection?.id) {
      getConnection(match.params.projectId, connection.id)
        .then((data) => {
          setFullConnection(data);
          _onFetchCollections(data);
        })
        .catch(() => {});
    }
  }, [firestoreRequest, connection]);

  useEffect(() => {
    if (dataRequest && dataRequest.configuration) {
      if (dataRequest.configuration.mainCollectionSample) {
        _populateFieldOptions(dataRequest.configuration.mainCollectionSample, "main");
      }

      if (dataRequest.configuration.subCollectionSample) {
        _populateFieldOptions(dataRequest.configuration.subCollectionSample, "sub");
      }

      if (dataRequest.configuration.limit) {
        setLimit(dataRequest.configuration.limit);
      }

      if (dataRequest.configuration.orderBy) {
        setOrderBy(dataRequest.configuration.orderBy);
      }

      if (dataRequest.configuration.orderByDirection) {
        setOrderByDirection(dataRequest.configuration.orderByDirection);
      }
    }

    _initializeConditions();
  }, [dataRequest]);

  useEffect(() => {
    if (dataRequest
      && dataRequest.configuration
      && dataRequest.configuration.subCollections
      && dataRequest.configuration.subCollections.length > 0
      && dataRequest.configuration.showSubCollections
    ) {
      setShowSubUI(true);
    } else {
      setShowSubUI(false);
    }
  }, [dataRequest]);

  useEffect(() => {
    if (responses && responses.length > 0) {
      const selectedResponse = responses.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.data) {
        setResult(JSON.stringify(selectedResponse.data, null, 2));
      } else if (selectedResponse?.error) {
        setResult(JSON.stringify(selectedResponse.error, null, 2));
      }
    }
  }, [responses]);

  const _initializeConditions = (dr = dataRequest) => {
    if (dr && dr.conditions) {
      let newConditions = [...conditions];

      // in case of initialisation, remove the first empty condition
      if (newConditions.length === 1 && !newConditions[0].saved && !newConditions[0].value) {
        newConditions = [];
      }

      const toAddConditions = [];
      for (let i = 0; i < dr.conditions.length; i++) {
        let found = false;
        for (let j = 0; j < newConditions.length; j++) {
          if (newConditions[j].id === dr.conditions[i].id) {
            newConditions[j] = _.clone(dr.conditions[i]);
            found = true;
          }
        }

        if (!found) toAddConditions.push(dr.conditions[i]);
      }

      const finalConditions = newConditions.concat(toAddConditions);
      if (finalConditions.length > 0) {
        setConditions(finalConditions);
      }
    }
  };

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

    if (request === null) request = firestoreRequest;
    const requestToSave = _.cloneDeep(request);
    requestToSave.configuration = {
      ...requestToSave.configuration,
      limit,
      orderBy,
      orderByDirection,
    };

    onSave(requestToSave).then(() => {
      _onRunRequest();
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);

    const tempRequest = {
      ...firestoreRequest,
      configuration: {
        ...firestoreRequest.configuration,
        limit,
        orderBy,
        orderByDirection,
      },
    };

    onSave(tempRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  const _onRunRequest = () => {
    setIndexUrl("");
    const useCache = !invalidateCache;
    runDataRequest(match.params.projectId, match.params.chartId, dataRequest.id, useCache)
      .then((dr) => {
        if (dr?.dataRequest) {
          setFirestoreRequest(dr.dataRequest);
        }
        setRequestLoading(false);
      })
      .catch((error) => {
        setRequestLoading(false);
        toast.error("The request failed. Please check your request 🕵️‍♂️");
        setResult(JSON.stringify(error, null, 2));

        if (error.message && error.message.indexOf("COLLECTION_GROUP_ASC") > -1) {
          setIndexUrl(error.message.substring(error.message.indexOf("https://")));
        }
      });
  };

  const _onFetchCollections = (conn = fullConnection) => {
    setCollectionsLoading(true);
    return testRequest(match.params.projectId, conn)
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

    setConditions(newConditions);
    _onSaveConditions(newConditions);
  };

  const _onSaveConditions = (newConditions) => {
    const savedConditions = newConditions.filter((item) => item.saved);
    const newRequest = { ...firestoreRequest, conditions: savedConditions };
    setFirestoreRequest(newRequest);
    return _onTest(newRequest);
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

  return (
    <div style={styles.container} className="pl-1 pr-1 md:pl-4 md:pr-4">
      <div className="grid grid-cols-12 gap-4">
        <div className={`col-span-12 md:col-span-${showSubUI ? "4" : "6"} mb-4`}>
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div>
              <Row>
                <Button
                  color="primary"
                  auto
                  size="sm"
                  onClick={() => _onSavePressed()}
                  isLoading={saveLoading || requestLoading}
                  variant="flat"
                >
                  {"Save"}
                </Button>
                <Spacer x={1} />
                <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                  <Button
                    color="danger"
                    isIconOnly
                    auto
                    size="sm"
                    variant="bordered"
                    onClick={() => onDelete()}
                  >
                    <IoTrashBin />
                  </Button>
                </Tooltip>
              </Row>
            </div>
          </Row>
          <Spacer y={2} />
          <Row>
            <Divider />
          </Row>
          <Spacer y={4} />
          <Row>
            <Text b>Select one of your collections:</Text>
          </Row>
          <Spacer y={1} />
          <Row wrap="wrap" className="pl-0 firestorebuilder-collections-tut gap-1">
            {collectionsLoading && <CircularProgress />}
            {collectionData.map((collection) => (
              <Fragment key={collection._queryOptions.collectionId}>
                <Chip
                  variant={firestoreRequest.query !== collection._queryOptions.collectionId ? "bordered" : "solid"}
                  color="primary"
                  onClick={() => _onChangeQuery(collection._queryOptions.collectionId)}
                  className="min-w-[50px]"
                >
                  {collection._queryOptions.collectionId}
                </Chip>
              </Fragment>
            ))}
          </Row>
          <Spacer y={1} />
          <Row>
            <Button
              size="sm"
              startContent={<IoReload />}
              onClick={() => _onFetchCollections()}
              isLoading={collectionsLoading}
              variant="light"
            >
              Refresh collections
            </Button>
          </Row>

          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />

          <Row>
            <Text b>{"Data settings"}</Text>
          </Row>
          <Spacer y={1} />
          <Row className="firestorebuilder-settings-tut" align="flex-start">
            <Switch
              onChange={_toggleSubCollections}
              isSelected={
                dataRequest.configuration && dataRequest.configuration.showSubCollections
              }
              size="sm"
            >
              Add sub-collections to the response
            </Switch>
          </Row>

          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />

          <Row align="center">
            <Text b>
              {"Filter the collection "}
            </Text>
            <Spacer x={1} />
            <Tooltip
              content="These filters are applied on the main collection only."
            >
              <div><IoInformationCircleOutline /></div>
            </Tooltip>
          </Row>
          <Spacer y={1} />
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
          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />
          <Row className="firestorebuilder-query-tut">
            <Text b>
              {"Order and limit"}
            </Text>
          </Row>
          <Spacer y={1} />
          <Row align="center">
            <Input
              label="Order by"
              placeholder="Enter field name"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              variant="bordered"
              size="sm"
              fullWidth
            />
            <Spacer x={0.5} />
            <Select
              variant="bordered"
              onSelectionChange={(keys) => setOrderByDirection(keys.currentKey)}
              selectedKeys={[orderByDirection]}
              selectionMode="single"
              label="Direction"
              size="sm"
            >
              <SelectItem key="desc" textValue="Descending">
                Descending
              </SelectItem>
              <SelectItem key="asc" textValue="Ascending">
                Ascending
              </SelectItem>
            </Select>
          </Row>
          <Spacer y={2} />
          <Row>
            <Input
              label="Limit (leave empty or 0 for unlimited)"
              placeholder="Enter limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className={"max-w-[300px]"}
              variant="bordered"
              size="sm"
            />
          </Row>
        </div>
        {showSubUI && dataRequest && dataRequest.configuration && (
          <div className="col-span-12 md:col-span-4">
            <Row>
              <Text b>Fetch sub-collection data</Text>
            </Row>
            <Spacer y={1} />
            <Row wrap="wrap" className={"gap-1"}>
              {dataRequest.configuration.subCollections.map((subCollection) => (
                <Fragment key={subCollection}>
                  <Chip
                    color="secondary"
                    variant={dataRequest.configuration.selectedSubCollection !== subCollection ? "bordered" : "solid"}
                    onClick={() => _onSelectSubCollection(subCollection)}
                    className="min-w-[50px]"
                  >
                    {subCollection}
                  </Chip>
                </Fragment>
              ))}
            </Row>
            <Spacer y={1} />
            <Row>
              <Button
                color="danger"
                onClick={() => _onSelectSubCollection("")}
                startContent={<IoClose />}
                disabled={!dataRequest.configuration.selectedSubCollection}
                variant="light"
                size="sm"
              >
                Clear selection
              </Button>
            </Row>

            <Spacer y={1} />
            <Divider />
            <Spacer y={1} />

            {dataRequest.configuration.selectedSubCollection && (
              <>
                <Row align="center">
                  <Text b>
                    {"Filter the sub-collection "}
                  </Text>
                  <Spacer x={0.5} />
                  <Tooltip
                    content="These filters are applied on the sub-collection only."
                  >
                    <div><IoInformationCircleOutline /></div>
                  </Tooltip>
                </Row>
                <Spacer y={1} />
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
                    <Spacer y={1} />
                    <Divider />
                    <Spacer y={1} />
                    <Row>
                      <Container className={"bg-blue-50 p-10 rounded-sm border-[2px] border-blue-300 border-solid"}>
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
          </div>
        )}
        <div className={`col-span-12 md:col-span-${showSubUI ? "4" : "6"}`}>
          <Container>
            <Row className="firestorebuilder-request-tut">
              <Button
                endContent={<IoPlay />}
                isLoading={requestLoading}
                onClick={() => _onTest()}
                className={"w-full"}
                color="primary"
              >
                Get Firestore data
              </Button>
            </Row>
            <Spacer y={2} />
            <Row align="center">
              <Checkbox
                isSelected={!invalidateCache}
                onChange={() => setInvalidateCache(!invalidateCache)}
                size="sm"
              >
                Use cached data
              </Checkbox>
              <Spacer x={1} />
              <Tooltip
                content="Use cache to avoid hitting the Firestore API every time you request data. The cache will be cleared when you change any of the settings."
                className="max-w-[500px]"
              >
                <IoInformationCircleOutline />
              </Tooltip>
            </Row>
            <Spacer y={2} />
            <Row className="firestorebuilder-result-tut">
              <div className="w-full">
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
        </div>
      </div>
    </div>
  );
}

function Conditions(props) {
  const {
    fieldOptions, conditions, updateCondition, onChangeConditionValues,
    onRemoveCondition, onApplyCondition, onRevertCondition, onAddCondition,
  } = props;

  const [tempConditionValue, setTempConditionValue] = useState("");

  const _onAddConditionValue = (condition) => {
    if (!tempConditionValue) return;
    if (condition.values.includes(tempConditionValue)) return;

    onChangeConditionValues(
      condition.id,
      {
        value: condition.values.concat([tempConditionValue]),
      }
    );
    updateCondition(condition.id, false, "addingValue");
    setTempConditionValue("");
  };

  const _onRemoveConditionValue = (condition, value) => {
    onChangeConditionValues(
      condition.id,
      {
        value: condition.values.filter((i) => i !== value),
      }
    );
  };

  return (
    <div className="datasetdata-filters-tut flex flex-col gap-4">
      {conditions && conditions.map((condition) => {
        return (
          <Fragment key={condition.id}>
            <Row align="center" wrap="wrap" className={"gap-2"}>
              {!_.find(fieldOptions, { value: condition.field }) && condition.saved && (
                <Tooltip
                  content="This condition might not work on the current collection."
                >
                  <div><IoWarningOutline className="text-secondary" /></div>
                </Tooltip>
              )}
              <Select
                variant="bordered"
                selectedKeys={[condition.field]}
                selectionMode="single"
                onSelectionChange={(keys) => updateCondition(condition.id, keys.currentKey, "field")}
                label="Field"
                placeholder="Select a field"
              >
                {fieldOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    textValue={condition?.field?.substring(condition.field.lastIndexOf(".") + 1)}
                  >
                    <Row className={"gap-2"}>
                      <Chip color={option.label.color} className="min-w-[70px] text-center" variant="flat" size="sm">
                        {option.label.content}
                      </Chip>
                      <Text>{option.text}</Text>
                    </Row>
                  </SelectItem>
                ))}
              </Select>

              <Select
                variant="bordered"
                selectedKeys={[condition.operator]}
                onSelectionChange={(keys) => updateCondition(condition.id, keys.currentKey, "operator")}
                selectionMode="single"
                label="Operator"
                placeholder="Select an operator"
              >
                {operators.map((option) => (
                  <SelectItem key={option.value} textValue={option.key}>
                    {option.text}
                  </SelectItem>
                ))}
              </Select>
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
                    isDisabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                    variant="bordered"
                  />
                )}
              {_.find(fieldOptions, { value: condition.field })
                && _.find(fieldOptions, { value: condition.field }).type === "date" && (
                  <Popover>
                    <PopoverTrigger>
                      <Input
                        placeholder="Enter a value"
                        endContent={<IoCalendarOutline />}
                        value={(condition.value && format(new Date(condition.value), "Pp", { locale: enGB })) || "Click to select a date"}
                        disabled={(condition.operator === "isNotNull" || condition.operator === "isNull")}
                        variant="bordered"
                      />
                    </PopoverTrigger>
                    <PopoverContent>
                      <Calendar
                        date={(condition.value && new Date(condition.value)) || new Date()}
                        onChange={(date) => updateCondition(condition.id, formatISO(date), "value")}
                        locale={enGB}
                        color={secondary}
                      />
                    </PopoverContent>
                  </Popover>
              )}

              {(condition.operator === "array-contains-any"
                || condition.operator === "in"
                || condition.operator === "not-in")
                && (
                  <div className="flex flex-col">
                    <form id="condition-values" onSubmit={(e) => e.preventDefault()}>
                      <Input
                        placeholder="Enter a value"
                        value={tempConditionValue}
                        onChange={(e) => setTempConditionValue(e.target.value)}
                        variant="bordered"
                        disableAnimation
                        endContent={(
                          <Button
                            variant="light"
                            color="primary"
                            isIconOnly
                            onClick={() => _onAddConditionValue(condition)}
                            type="submit"
                            form="condition-values"
                            size="sm"
                          >
                            <IoAddCircle />
                          </Button>
                        )}
                      />
                    </form>
                    <Spacer y={1} />
                    <div className="flex flex-row flex-wrap gap-1">
                      {condition.values && condition.values.map((v) => (
                        <Chip
                          key={v}
                          endContent={<IoClose />}
                          size="sm"
                          onClick={() => _onRemoveConditionValue(condition, v)}
                          variant="faded"
                        >
                          {v}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
            </Row>

            <Row align="center" className="gap-2">
              {!condition.saved && (condition.value || condition.operator === "isNotNull" || condition.operator === "isNull" || (condition.values && condition.values.length > 0)) && (
                <>
                  <Tooltip
                    content="Apply this filter"
                  >
                    <Button
                      isIconOnly
                      onClick={() => onApplyCondition(condition.id)}
                      size="sm"
                      variant="faded"
                    >
                      <IoAddCircle />
                    </Button>
                  </Tooltip>
                </>
              )}

              {!condition.saved
                && condition.id && (condition.value || condition.values.length > 0)
                && (
                  <>
                    <Tooltip
                      content="Undo changes"
                    >
                      <Button
                        isIconOnly
                        onClick={() => onRevertCondition(condition.id)}
                        size="sm"
                        variant="faded"
                      >
                        <IoArrowUndoCircle />
                      </Button>
                    </Tooltip>
                  </>
                )}

              <Tooltip content="Remove filter">
                <Button
                  isIconOnly
                  color="danger"
                  onClick={() => onRemoveCondition(condition.id)}
                  size="sm"
                  variant="faded"
                >
                  <IoCloseCircle />
                </Button>
              </Tooltip>
            </Row>
            <Divider />
          </Fragment>
        );
      })}
      <Row>
        <Button
          startContent={<IoAdd />}
          onClick={onAddCondition}
          size="sm"
          variant="light"
          auto
          disableRipple
          color="primary"
        >
          {"Add a new filter"}
        </Button>
      </Row>
    </div>
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
  connection: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  runDataRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  dataRequest: PropTypes.object,
  changeTutorial: PropTypes.func.isRequired,
  testRequest: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  getConnection: PropTypes.func.isRequired,
  responses: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => {
  return {
    dataRequests: state.dataRequest.data,
    responses: state.dataRequest.responses,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    runDataRequest: (projectId, chartId, drId, getCache) => {
      return dispatch(runDataRequestAction(projectId, chartId, drId, getCache));
    },
    changeTutorial: (tutorial) => dispatch(changeTutorialAction(tutorial)),
    testRequest: (projectId, data) => dispatch(testRequestAction(projectId, data)),
    getConnection: (projectId, connectionId) => dispatch(
      getConnectionAction(projectId, connectionId)
    ),
  };
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(FirestoreBuilder));
