import React, { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Separator, Chip, Switch, Tooltip, Link, Checkbox, Input, Popover,
  Label, ListBox, Select,
  Badge, TextField, InputGroup,
} from "@heroui/react";
import AceEditor from "react-ace";
import _ from "lodash";
import toast from "react-hot-toast";
import { v4 as uuid } from "uuid";
import { Calendar } from "react-date-range";
import { format, formatISO } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  LuTriangleAlert, LuCalendarDays, LuInfo, LuPlay, LuPlus, LuCirclePlus,
  LuRefreshCw, LuTrash, LuUndo, LuX, LuCircleX, LuVariable,
} from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import {
  getConnection, testRequest,
} from "../../../slices/connection";
import fieldFinder from "../../../modules/fieldFinder";
import { secondary } from "../../../config/colors";
import determineType from "../../../modules/determineType";
import Container from "../../../components/Container";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Row from "../../../components/Row";
import VariableSettingsDrawer from "../../../components/VariableSettingsDrawer";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import {
  getDataRequestBuilderMetadata,
  runDataRequest,
  selectDataRequests,
  createVariableBinding,
  updateVariableBinding,
} from "../../../slices/dataset";
import DataTransform from "../../Dataset/DataTransform";
import { selectTeam } from "../../../slices/team";

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
  const {
    dataRequest = null, connection, onSave, onDelete,
  } = props;

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
  const [saveLoading, setSaveLoading] = useState(false);
  const [limit, setLimit] = useState(0);
  const [orderBy, setOrderBy] = useState("");
  const [orderByDirection, setOrderByDirection] = useState("desc");
  const [requestError, setRequestError] = useState("");
  const [showTransform, setShowTransform] = useState(false);
  const [variableSettings, setVariableSettings] = useState(null);
  const [variableLoading, setVariableLoading] = useState(false);

  const { isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();

  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const team = useSelector(selectTeam);

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      setFirestoreRequest(dataRequest);
      _initializeConditions(dataRequest);
    }
  }, []);

  useEffect(() => {
    if (!connection?.id || !team?.id) return;

    if (params.datasetId && dataRequest?.dataset_id && dataRequest?.id) {
      _onFetchCollections();
      return;
    }

    dispatch(getConnection({ team_id: team?.id, connection_id: connection.id }))
      .then((data) => {
        _onFetchCollections(data.payload);
      })
      .catch(() => {});
  }, [connection?.id, dataRequest?.dataset_id, params.datasetId, team?.id]);

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
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === dataRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, firestoreRequest]);

  const _onTransformSave = (transformConfig) => {
    const updatedRequest = { ...firestoreRequest, transform: transformConfig };
    setFirestoreRequest(updatedRequest);
    onSave(updatedRequest);
  };

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
            color: o.type === "date" ? "warning"
              : o.type === "number" ? "accent"
                : o.type === "string" ? "success"
                  : o.type === "boolean" ? "danger-soft"
                    : "default"
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

  const _onTest = (request = firestoreRequest, resetCache = false) => {
    setRequestLoading(true);

    if (request === null) request = firestoreRequest;
    const requestToSave = _.cloneDeep(request);
    requestToSave.configuration = {
      ...requestToSave.configuration,
      limit,
      orderBy,
      orderByDirection,
    };

    setFirestoreRequest(requestToSave);

    onSave(requestToSave).then(() => {
      _onRunRequest(resetCache);
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

  const _onRunRequest = (resetCache) => {
    setIndexUrl("");
    setRequestError("");
    let getCache = !invalidateCache;

    if (resetCache) {
      getCache = false;
    }

    dispatch(runDataRequest({
      team_id: team?.id,
      dataset_id: params.datasetId,
      dataRequest_id: dataRequest.id,
      getCache,
    }))
      .then((data) => {
        if (data?.error) {
          setRequestLoading(false);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setRequestError(data.error?.message);

          if (data.error?.message && data.error.message.indexOf("COLLECTION_GROUP_ASC") > -1) {
            setIndexUrl(data.error.message.substring(data.error.message.indexOf("https://")));
          }
        }
        const result = data.payload;
        if (result?.status?.statusCode >= 400) {
          toast.error("The request failed. Please check your request 🕵️‍♂️");          
          setRequestError(result.response);
        }
        if (result?.response?.dataRequest?.responseData?.data) {
          setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
          _populateFieldOptions(result.response.dataRequest.responseData.data, "main");
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

  const _onFetchCollections = (conn = null) => {
    setCollectionsLoading(true);

    if (params.datasetId && dataRequest?.dataset_id && dataRequest?.id) {
      return dispatch(getDataRequestBuilderMetadata({
        team_id: team?.id,
        dataset_id: dataRequest.dataset_id,
        dataRequest_id: dataRequest.id,
      }))
        .then((data) => {
          if (data.payload?.collections) {
            setCollectionData(data.payload.collections);
          }
          setCollectionsLoading(false);
        })
        .catch(() => {
          setCollectionsLoading(false);
        });
    }

    return dispatch(testRequest({ team_id: team?.id, connection: conn }))
      .then((data) => {
        if (data?.error) {
          setCollectionsLoading(false);
          return;
        }
        
        return data?.payload?.json();
      })
      .then((data) => {
        if (data) {
          setCollectionData(data);
          setCollectionsLoading(false);
        }
      })
      .catch(() => {
        setCollectionsLoading(false);
      });
  };

  const _onChangeQuery = (query) => {
    _onTest({ ...firestoreRequest, query }, true);
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

  const _toggleSubCollections = (selected) => {
    let newRequest = _.clone(dataRequest);
    if (!dataRequest.configuration) {
      newRequest = { ...newRequest, configuration: { showSubCollections: selected } };
    } else {
      newRequest = {
        ...newRequest,
        configuration: {
          ...newRequest.configuration,
          showSubCollections: selected,
        }
      };
    }

    _onTest(newRequest, true);
  };

  const _onSelectSubCollection = (subCollection) => {
    const newRequest = {
      ...dataRequest,
      configuration: { ...dataRequest.configuration, selectedSubCollection: subCollection },
    };

    _onTest(newRequest);
  };

  // Helper function to detect if a string contains variables
  const _hasVariables = (value) => {
    if (!value || typeof value !== "string") return false;
    const variableRegex = /\{\{([^}]+)\}\}/g;
    return variableRegex.test(value);
  };

  // Helper function to get the first variable from a string
  const _getFirstVariable = (value) => {
    if (!value || typeof value !== "string") return null;
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const match = variableRegex.exec(value);
    if (match) {
      return {
        variable: match[1].trim(),
        placeholder: match[0]
      };
    }
    return null;
  };

  const _onVariableClick = (variable) => {
    let selectedVariable = firestoreRequest.VariableBindings?.find((v) => v.name === variable.variable);
    if (selectedVariable) {
      setVariableSettings(selectedVariable);
    } else {
      setVariableSettings({
        name: variable.variable,
        type: "string",
        value: "",
      });
    }
  };

  const _onVariableSave = async () => {
    setVariableLoading(true);
    try {
      let response;
      if (variableSettings.id) {
        response = await dispatch(updateVariableBinding({
          team_id: team?.id,
          dataset_id: dataRequest.dataset_id,
          dataRequest_id: dataRequest.id,
          variable_id: variableSettings.id,
          data: variableSettings,
        }));
      } else {
        response = await dispatch(createVariableBinding({
          team_id: team?.id,
          dataset_id: dataRequest.dataset_id,
          dataRequest_id: dataRequest.id,
          data: variableSettings,
        }));
      }

      // Use the updated dataRequest from the API response, but preserve the current configuration
      if (response.payload) {
        setFirestoreRequest({
          ...firestoreRequest,
          ...response.payload,
          query: firestoreRequest.query, // Preserve the current query being edited
          configuration: firestoreRequest.configuration,
        });
      }

      setVariableLoading(false);
      setVariableSettings(null);
      toast.success("Variable saved successfully");
    } catch (error) {
      setVariableLoading(false);
      toast.error("Failed to save variable");
    }
  };

  return (
    <div style={styles.container} className="pl-1 pr-1 md:pl-4 md:pr-4">
      <div className="grid grid-cols-12 gap-4">
        <div className={"col-span-12 md:col-span-7 mb-4"}>
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div className="flex flex-row items-center gap-2">
              <Button auto
                size="sm"
                onPress={() => _onSavePressed()}
                isPending={saveLoading || requestLoading}
              >
                {(saveLoading || requestLoading) ? <ButtonSpinner /> : null}
                {"Save"}
              </Button>
              <Tooltip>
                <Tooltip.Trigger>
                  <Badge.Anchor className="relative inline-flex">
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={() => setShowTransform(true)}
                    >
                      Transform
                    </Button>
                    {firestoreRequest.transform?.enabled && (
                      <Badge
                        size="sm"
                        className="min-h-2 min-w-2 p-0"
                        aria-label="Transformations active"
                      />
                    )}
                  </Badge.Anchor>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom" className="z-99999">
                  Apply transformations to the data
                </Tooltip.Content>
              </Tooltip>
              <Tooltip>
                <Tooltip.Trigger>
                  <Button isIconOnly
                    auto
                    size="sm"
                    variant="secondary"
                    onPress={() => onDelete()}
                  >
                    <LuTrash />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom" className="z-99999">
                  Delete this data request
                </Tooltip.Content>
              </Tooltip>
            </div>
          </Row>
          <div className="h-4" />
          <Row>
            <Separator />
          </Row>
          <div className="h-8" />
          <Row>
            <Text>Select one of your collections:</Text>
          </Row>
          <div className="h-2" />
          <Row wrap="wrap" className="pl-0 firestorebuilder-collections-tut gap-1">
            {collectionData?.length > 0 && collectionData?.map((collection) => (
              <Fragment key={collection._queryOptions.collectionId}>
                <Chip
                  variant={firestoreRequest.query !== collection._queryOptions.collectionId ? "soft" : "primary"}
                  color={firestoreRequest.query !== collection._queryOptions.collectionId ? "default" : "accent"}
                  onClick={() => _onChangeQuery(collection._queryOptions.collectionId)}
                  className="min-w-[50px] text-center cursor-pointer"
                  size="lg"
                >
                  {collection._queryOptions.collectionId}
                </Chip>
              </Fragment>
            ))}
            {(!collectionData || collectionData?.length === 0) && !collectionsLoading && (
              <span className="text-sm italic">No collections found</span>
            )}
          </Row>
          <div className="h-4" />
          <Row>
            <Button
              size="sm"
              onPress={() => _onFetchCollections()}
              isPending={collectionsLoading}
              variant="tertiary"
            >
              {collectionsLoading ? <ButtonSpinner /> : <LuRefreshCw size={16} />}
              Refresh collections
            </Button>
          </Row>

          <div className="h-4" />
          <Separator />
          <div className="h-4" />

          <Row align="center">
            <Label>
              {"Filter the collection "}
            </Label>
            <div className="w-2" />
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <div><LuInfo size={16} /></div>
              </Tooltip.Trigger>
              <Tooltip.Content>These filters are applied on the main collection only.</Tooltip.Content>
            </Tooltip>
          </Row>
          <div className="h-2" />
          {conditions.length > 0 && (
            <div className="text-xs italic text-default-500 flex items-center gap-1">
              <div><LuVariable size={16} /></div>
              {"You can add {{variable_name}} in filter values. Click on the variable icon to configure them."}
            </div>
          )}
          <div className="h-2" />
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
              hasVariables={_hasVariables}
              getFirstVariable={_getFirstVariable}
              onVariableClick={_onVariableClick}
            />
          </Row>
          <div className="h-4" />
          <Separator />
          <div className="h-4" />
          <div className="flex flex-row items-end gap-2">
            <TextField fullWidth name="firestore-order-by">
              <Label>Order by</Label>
              <Input
                placeholder="Enter field name"
                value={orderBy}
                onChange={(e) => setOrderBy(e.target.value)}
                variant="secondary"
              />
            </TextField>
            <Select
              variant="secondary"
              onChange={(value) => setOrderByDirection(value)}
              value={orderByDirection || null}
              selectionMode="single"
              label="Direction"
              size="sm"
              aria-label="Select a direction"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="desc" textValue="Descending">
                    Descending
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="asc" textValue="Ascending">
                    Ascending
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="h-4" />
          <Row>
            <TextField className="max-w-[300px]" name="firestore-limit">
              <Label>Limit (leave empty or 0 for unlimited)</Label>
              <Input
                placeholder="Enter limit"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                variant="secondary"
              />
            </TextField>
          </Row>

          <div className="h-4" />
          <Separator />
          <div className="h-4" />

          <Row>
            <Text>{"Data settings"}</Text>
          </Row>
          <div className="h-2" />
          <Row className="firestorebuilder-settings-tut" align="flex-start">
            <Switch
              id="firestore-subcollections"
              onChange={_toggleSubCollections}
              isSelected={
                !!firestoreRequest?.configuration?.showSubCollections
              }
              size="sm"
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <Label htmlFor="firestore-subcollections">Add sub-collections to the response</Label>
              </Switch.Content>
            </Switch>
          </Row>

          {showSubUI && dataRequest && dataRequest.configuration && (
            <div className="mt-4">
              <Separator />
              <div className="h-4" />
              <Row>
                <Text>Fetch sub-collection data only</Text>
              </Row>
              <div className="h-2" />
              <Row wrap="wrap" className={"gap-1 items-center"}>
                {dataRequest.configuration.subCollections.map((subCollection) => (
                  <Fragment key={subCollection}>
                    <Chip
                      variant={dataRequest.configuration.selectedSubCollection !== subCollection ? "soft" : "primary"}
                      onClick={() => _onSelectSubCollection(subCollection)}
                      className="rounded-sm min-w-[50px] text-center cursor-pointer"
                    >
                      {subCollection}
                    </Chip>
                  </Fragment>
                ))}

                <Button
                  onPress={() => _onSelectSubCollection("")}
                  isDisabled={!dataRequest.configuration.selectedSubCollection}
                  variant="ghost"
                  size="sm"
                >
                  <LuX />
                  Clear selection
                </Button>
              </Row>

              <div className="h-2" />
              <Separator />
              <div className="h-2" />

              {dataRequest.configuration.selectedSubCollection && (
                <>
                  <Row align="center">
                    <Text>
                      {"Filter the sub-collection "}
                    </Text>
                    <div className="w-1" />
                    <Tooltip>
                      <Tooltip.Trigger>
                        <div><LuInfo /></div>
                      </Tooltip.Trigger>
                      <Tooltip.Content>These filters are applied on the sub-collection only.</Tooltip.Content>
                    </Tooltip>
                  </Row>
                  <div className="h-2" />
                  <div className="text-sm italic text-default-500 flex items-center gap-1">
                    <div><LuVariable /></div>
                    {"You can add {{variable_name}} in filter values. Click on the variable icon to configure them."}
                  </div>
                  <div className="h-2" />
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
                      hasVariables={_hasVariables}
                      getFirstVariable={_getFirstVariable}
                      onVariableClick={_onVariableClick}
                    />
                  </Row>
                  {indexUrl && (
                    <>
                      <div className="h-2" />
                      <Separator />
                      <div className="h-2" />
                      <Row>
                        <Container className={"bg-blue-50 p-10 rounded-xs border-2 border-blue-300 border-solid"}>
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

          <div className="h-40" />
        </div>
        <div className={"col-span-12 md:col-span-5"}>
          <Container>
            <Row className="firestorebuilder-request-tut">
              <Button
                isPending={requestLoading}
                onPress={() => _onTest()}
                className={"w-full"} variant="primary"
              >
                {requestLoading ? <ButtonSpinner /> : null}
                Get Firestore data
                {!requestLoading ? <LuPlay /> : null}
              </Button>
            </Row>
            <div className="h-4" />
            <Row align="center">
              <Checkbox
                id="firestore-use-cache"
                isSelected={!invalidateCache}
                onChange={(selected) => setInvalidateCache(!selected)}
              >
                <Checkbox.Control className="size-4 shrink-0">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>
                  <Label htmlFor="firestore-use-cache" className="text-sm">Use cached data</Label>
                </Checkbox.Content>
              </Checkbox>
              <div className="w-2" />
              <Tooltip>
                <Tooltip.Trigger>
                  <div><LuInfo /></div>
                </Tooltip.Trigger>
                <Tooltip.Content className="max-w-[500px]">
                  Use cache to avoid hitting the Firestore API every time you request data. The cache will be cleared when you change any of the settings.
                </Tooltip.Content>
              </Tooltip>
            </Row>
            <div className="h-4" />
            <Row className="firestorebuilder-result-tut">
              <div className="w-full">
                <AceEditor
                  mode="json"
                  theme={isDark ? "one_dark" : "tomorrow"}
                  style={{ borderRadius: 10 }}
                  height="450px"
                  width="none"
                  value={requestError || result || ""}
                  name="resultEditor"
                  readOnly
                  editorProps={{ $blockScrolling: false }}
                  className="rounded-md border border-solid border-content3"
                />
              </div>
            </Row>
          </Container>
        </div>
      </div>

      <DataTransform
        isOpen={showTransform}
        onClose={() => setShowTransform(false)}
        onSave={_onTransformSave}
        initialTransform={firestoreRequest.transform}
      />

      <VariableSettingsDrawer
        variable={variableSettings}
        onClose={() => setVariableSettings(null)}
        onPatch={(patch) => setVariableSettings((v) => (v ? { ...v, ...patch } : v))}
        onSave={_onVariableSave}
        savePending={variableLoading}
        defaultValueFieldName="firestore-variable-default"
      />
    </div>
  );
}

function Conditions(props) {
  const {
    fieldOptions, conditions, updateCondition, onChangeConditionValues,
    onRemoveCondition, onApplyCondition, onRevertCondition, onAddCondition,
    hasVariables, getFirstVariable, onVariableClick,
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
                <Tooltip>
                  <Tooltip.Trigger>
                    <div><LuTriangleAlert className="text-secondary" /></div>
                  </Tooltip.Trigger>
                  <Tooltip.Content>This condition might not work on the current collection.</Tooltip.Content>
                </Tooltip>
              )}
              <Select
                variant="secondary"
                value={condition.field || null}
                selectionMode="single"
                onChange={(value) => updateCondition(condition.id, value, "field")}
                label="Field"
                placeholder="Select a field"
                aria-label="Select a field"
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {fieldOptions.map((option) => (
                      <ListBox.Item
                        key={option.value}
                        id={option.value}
                        textValue={condition?.field?.substring(condition.field.lastIndexOf(".") + 1)}
                      >
                        <Row className={"gap-2"}>
                          <Chip className="min-w-[70px] justify-center" color={option.label.color} variant="soft" size="sm">
                            {option.label.content}
                          </Chip>
                          {option.text}
                        </Row>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <Select
                variant="secondary"
                value={condition.operator || null}
                onChange={(value) => updateCondition(condition.id, value, "operator")}
                selectionMode="single"
                label="Operator"
                placeholder="Select an operator"
                aria-label="Select an operator"
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {operators.map((option) => (
                      <ListBox.Item key={option.value} id={option.value} textValue={option.key}>
                        {option.text}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              {(!condition.field
                || (_.find(fieldOptions, { value: condition.field })
                  && _.find(fieldOptions, { value: condition.field }).type !== "date"))
                  && (condition.operator !== "array-contains-any"
                  && condition.operator !== "in"
                  && condition.operator !== "not-in")
                && (
                  <TextField
                    aria-label="Condition value"
                    isDisabled={condition.operator === "isNotNull" || condition.operator === "isNull"}
                  >
                    <InputGroup variant="secondary">
                      <InputGroup.Input
                        placeholder="Enter a value"
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, e.target.value, "value")}
                      />
                      {hasVariables && hasVariables(condition.value) ? (
                        <InputGroup.Suffix className="pr-0">
                          <Tooltip>
                            <Tooltip.Trigger>
                              <Button
                                isIconOnly
                                onPress={() => onVariableClick(getFirstVariable(condition.value))}
                                variant="ghost"
                                size="sm"
                              >
                                <LuVariable />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Configure variable</Tooltip.Content>
                          </Tooltip>
                        </InputGroup.Suffix>
                      ) : null}
                    </InputGroup>
                  </TextField>
                )}
              {_.find(fieldOptions, { value: condition.field })
                && _.find(fieldOptions, { value: condition.field }).type === "date" && (
                  <Popover>
                    <Popover.Trigger>
                      <TextField
                        aria-label="Condition date value"
                        isDisabled={condition.operator === "isNotNull" || condition.operator === "isNull"}
                      >
                        <InputGroup variant="secondary">
                          <InputGroup.Input
                            readOnly
                            placeholder="Click to select a date"
                            value={
                              (condition.value && format(new Date(condition.value), "Pp", { locale: enGB }))
                              || "Click to select a date"
                            }
                          />
                          <InputGroup.Suffix>
                            <LuCalendarDays />
                          </InputGroup.Suffix>
                        </InputGroup>
                      </TextField>
                    </Popover.Trigger>
                    <Popover.Content>
                      <Popover.Dialog>
                        <Calendar
                          date={(condition.value && new Date(condition.value)) || new Date()}
                          onChange={(date) => updateCondition(condition.id, formatISO(date), "value")}
                          locale={enGB}
                          color={secondary}
                        />
                      </Popover.Dialog>
                    </Popover.Content>
                  </Popover>
              )}

              {(condition.operator === "array-contains-any"
                || condition.operator === "in"
                || condition.operator === "not-in")
                && (
                  <div className="flex flex-col">
                    <form id="condition-values" onSubmit={(e) => e.preventDefault()}>
                      <TextField aria-label="Add value to condition">
                        <InputGroup variant="secondary">
                          <InputGroup.Input
                            placeholder="Enter a value"
                            value={tempConditionValue}
                            onChange={(e) => setTempConditionValue(e.target.value)}
                          />
                          <InputGroup.Suffix className="pr-0">
                            <Button
                              variant="ghost"
                              isIconOnly
                              onPress={() => _onAddConditionValue(condition)}
                              type="submit"
                              form="condition-values"
                              size="sm"
                            >
                              <LuCirclePlus />
                            </Button>
                          </InputGroup.Suffix>
                        </InputGroup>
                      </TextField>
                    </form>
                    <div className="h-2" />
                    <div className="flex flex-row flex-wrap gap-1">
                      {condition.values && condition.values.map((v) => (
                        <Chip
                          key={v}
                          size="sm"
                          onClick={() => _onRemoveConditionValue(condition, v)}
                          variant="tertiary"
                        >
                          {v}
                          <LuCircleX />
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
            </Row>

            <Row align="center" className="gap-2">
              {!condition.saved && (condition.value || condition.operator === "isNotNull" || condition.operator === "isNull" || (condition.values && condition.values.length > 0)) && (
                <>
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        isIconOnly
                        onPress={() => onApplyCondition(condition.id)}
                        size="sm"
                        variant="tertiary"
                      >
                        <LuCirclePlus />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Apply this filter</Tooltip.Content>
                  </Tooltip>
                </>
              )}

              {!condition.saved
                && condition.id && (condition.value || condition.values.length > 0)
                && (
                  <>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button
                          isIconOnly
                          onPress={() => onRevertCondition(condition.id)}
                          size="sm"
                          variant="tertiary"
                        >
                          <LuUndo />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Undo changes</Tooltip.Content>
                    </Tooltip>
                  </>
                )}

              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    onPress={() => onRemoveCondition(condition.id)}
                    size="sm"
                    variant="tertiary"
                  >
                    <LuCircleX />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Remove filter</Tooltip.Content>
              </Tooltip>
            </Row>
            <Separator />
          </Fragment>
        );
      })}
      <Row>
        <Button
          onPress={onAddCondition}
          size="sm"
          variant="ghost"
        >
          <LuPlus />
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
  hasVariables: PropTypes.func,
  getFirstVariable: PropTypes.func,
  onVariableClick: PropTypes.func,
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

FirestoreBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  dataRequest: PropTypes.object,
  onDelete: PropTypes.func.isRequired,
};

export default FirestoreBuilder;
