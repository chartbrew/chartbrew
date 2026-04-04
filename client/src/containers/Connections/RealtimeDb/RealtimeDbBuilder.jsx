import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Input, InputGroup, Separator, Chip, Checkbox, Tooltip,
  Badge,
  Label,
} from "@heroui/react";
import AceEditor from "../../../components/CodeEditor";
import toast from "react-hot-toast";
import { LuInfo, LuPlay, LuTrash, LuX, LuVariable } from "react-icons/lu";
import { useParams } from "react-router";

import { getConnection } from "../../../slices/connection";
import Row from "../../../components/Row";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
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

/*
  The API Data Request builder
*/
function RealtimeDbBuilder(props) {
  const [firebaseRequest, setFirebaseRequest] = useState({
    route: "",
  });
  const [result, setResult] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [limitValue, setLimitValue] = useState(100);
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [connectionString, setConnectionString] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [variableSettings, setVariableSettings] = useState(null);
  const [variableLoading, setVariableLoading] = useState(false);

  const { isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();

  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const team = useSelector(selectTeam);

  const {
    dataRequest = null, onChangeRequest, connection, onSave, onDelete,
  } = props;

  const onChangeRequestRef = useRef(onChangeRequest);
  useEffect(() => {
    onChangeRequestRef.current = onChangeRequest;
  }, [onChangeRequest]);

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
    let selectedVariable = firebaseRequest.VariableBindings?.find((v) => v.name === variable.variable);
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
        setFirebaseRequest({
          ...firebaseRequest,
          ...response.payload,
          route: firebaseRequest.route, // Preserve the current route being edited
          configuration: firebaseRequest.configuration,
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

  // on init effect
  useEffect(() => {
    if (dataRequest) {
      setFirebaseRequest(dataRequest);
      if (dataRequest?.configuration?.limitToLast) {
        setLimitValue(dataRequest.configuration.limitToLast);
      } else if (dataRequest?.configuration?.limitToFirst) {
        setLimitValue(dataRequest.configuration.limitToFirst);
      }
    }
  }, []);

  useEffect(() => {
    onChangeRequestRef.current(firebaseRequest);
  }, [firebaseRequest, connection?.id]);

  useEffect(() => {
    if (!connection?.id || !team?.id) return;

    if (params.datasetId && dataRequest?.dataset_id && dataRequest?.id) {
      dispatch(getDataRequestBuilderMetadata({
        team_id: team?.id,
        dataset_id: dataRequest.dataset_id,
        dataRequest_id: dataRequest.id,
      }))
        .then((data) => {
          if (data.payload) {
            setConnectionString(data.payload.connectionString || "");
            setProjectId(data.payload.projectId || "");
          }
        })
        .catch(() => {});
      return;
    }

    dispatch(getConnection({ team_id: team?.id, connection_id: connection.id }))
      .then((data) => {
        setConnectionString(data.payload?.connectionString || "");
        if (data?.payload && data.payload?.firebaseServiceAccount) {
          try {
            setProjectId(JSON.parse(data.payload.firebaseServiceAccount).project_id);
          } catch (error) {
            //
          }
        }
      })
      .catch(() => {});
  }, [connection?.id, dataRequest?.dataset_id, dataRequest?.id, dispatch, params.datasetId, team?.id]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === firebaseRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, firebaseRequest]);

  const _onChangeRoute = (value) => {
    setFirebaseRequest({ ...firebaseRequest, route: value });
  };

  const _onTest = () => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError("");

    onSave(firebaseRequest).then(() => {
      const getCache = !invalidateCache;
      dispatch(runDataRequest({
        team_id: team?.id,
        dataset_id: firebaseRequest.dataset_id,
        dataRequest_id: firebaseRequest.id,
        getCache
      }))
        .then((data) => {
          if (data?.error) {
            setRequestLoading(false);
            setRequestError(data.error);
            toast.error("The request failed. Please check your request 🕵️‍♂️");
            setRequestError(data.error?.message || `${data.error}`);
            return;
          }

          const result = data.payload;
          if (result?.status?.statusCode >= 400) {
            setRequestError(result.response);
          }
          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setRequestSuccess(result.status);
          }
          setRequestLoading(false);
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          toast.error("The request failed. Please check your request 🕵️‍♂️");
          setRequestError(error.message || `${error}`);
        });
    });
  };

  const _onChangeLimitValue = (value) => {
    setLimitValue(value);
    if (firebaseRequest.configuration && firebaseRequest.configuration.limitToLast) {
      setFirebaseRequest({
        ...firebaseRequest,
        configuration: {
          ...firebaseRequest.configuration,
          limitToLast: value,
        },
      });
    }

    if (firebaseRequest.configuration && firebaseRequest.configuration.limitToFirst) {
      setFirebaseRequest({
        ...firebaseRequest,
        configuration: {
          ...firebaseRequest.configuration,
          limitToFirst: value,
        },
      });
    }
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(firebaseRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  const _onTransformSave = (transformConfig) => {
    const updatedRequest = { ...firebaseRequest, transform: transformConfig };
    setFirebaseRequest(updatedRequest);
    onSave(updatedRequest);
  };

  return (
    <div style={styles.container} className="pl-1 pr-1 md:pl-4 md:pr-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-7">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div className="flex flex-row items-center gap-2">
              <Button size="sm"
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
                    {firebaseRequest.transform?.enabled && (
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
                    size="sm"
                    variant="danger-soft"
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
          <div className="h-4" />
          <Row>
            <Text>
              {"Enter the data path"}
            </Text>
          </Row>
          <div className="h-2" />
          <div className="text-xs italic text-default-500 flex items-center gap-1">
            <div><LuVariable size={16} /></div>
            {"You can add {{variable_name}} in the data path. Click on the variable icon to configure them."}
          </div>
          <div className="h-2" />
          <Row className="RealtimeDb-route-tut w-full min-w-0 items-stretch gap-2">
            <Input
              readOnly
              aria-label="Firebase Realtime Database base URL"
              value={connectionString || `https://${projectId || "<your_project>"}.firebaseio.com/`}
              variant="secondary"
              fullWidth
              className="pointer-events-none min-w-0 max-w-sm shrink-0"
            />
            <InputGroup fullWidth variant="secondary" className="w-full">
              <InputGroup.Input
                placeholder="Enter the data path"
                autoFocus
                aria-label="Firebase data path"
                value={firebaseRequest.route || ""}
                onChange={(e) => _onChangeRoute(e.target.value)}
                className="w-full flex-1"
              />
              {_hasVariables(firebaseRequest.route) ? (
                <InputGroup.Suffix className="flex items-center pr-1">
                  <Tooltip>
                    <Tooltip.Trigger>
                      <Button
                        isIconOnly
                        onPress={() => _onVariableClick(_getFirstVariable(firebaseRequest.route))}
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
          </Row>
          {(requestSuccess || requestError) && (
            <>
              <div className="h-4" />
              <div className="flex flex-row items-center gap-1">
                {requestSuccess && requestSuccess.statusCode < 300 && (
                  <>
                    <Chip color="success" variant="soft" size="sm">
                      {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                    </Chip>
                  </>
                )}
                {requestSuccess?.statusCode > 300 && (
                  <Chip color="danger" variant="soft" size="sm">
                    {`${requestSuccess.statusCode} ${requestSuccess.statusText}`}
                  </Chip>
                )}
              </div>
            </>
          )}

          <div className="h-4" />
          <Separator />
          <div className="h-4" />

          <Row>
            <Text b>
              Order By
            </Text>
          </Row>
          <div className="h-2" />
          <Row align="center" className={"gap-1"}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    orderBy: "child"
                  }
                })
              )}
            >
              {"Child key"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    orderBy: "key",
                  }
                })
              )}
            >
              {"Key"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    orderBy: "value",
                  }
                })
              )}
            >
              {"Value"}
            </Button>
            {firebaseRequest.configuration && firebaseRequest.configuration.orderBy && (
              <>
                <Button variant="ghost"
                  onPress={() => (
                    setFirebaseRequest({
                      ...firebaseRequest,
                      configuration: {
                        ...firebaseRequest.configuration,
                        orderBy: ""
                      }
                    })
                  )}
                  size="sm"
                >
                  <LuX />
                  {"Disable ordering"}
                </Button>
              </>
            )}
          </Row>
          <div className="h-2" />
          {firebaseRequest.configuration && firebaseRequest.configuration.orderBy === "child" && (
            <Row>
              <Input
                placeholder="Enter a field to order by"
                aria-label="Field to order by"
                value={(firebaseRequest.configuration && firebaseRequest.configuration.key) || ""}
                onChange={(e) => (
                  setFirebaseRequest({
                    ...firebaseRequest,
                    configuration: {
                      ...firebaseRequest.configuration,
                      key: e.target.value
                    }
                  })
                )}
                variant="secondary"
                fullWidth
              />
            </Row>
          )}

          <div className="h-4" />
          <Separator />
          <div className="h-4" />

          <Row>
            <Text b>Limit results</Text>
          </Row>
          <div className="h-2" />

          <Row align="center" className={"gap-1"}>
            <Button
              size="sm"
              variant="outline"
              onPress={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    limitToLast: limitValue,
                    limitToFirst: 0,
                  }
                })
              )}
            >
              Limit to last
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => (
                setFirebaseRequest({
                  ...firebaseRequest,
                  configuration: {
                    ...firebaseRequest.configuration,
                    limitToFirst: limitValue,
                    limitToLast: 0,
                  }
                })
              )}
            >
              Limit to first
            </Button>
            {firebaseRequest.configuration
              && (firebaseRequest.configuration.limitToLast
                || firebaseRequest.configuration.limitToFirst)
              && (
                <Button
                  onPress={() => (
                    setFirebaseRequest({
                      ...firebaseRequest,
                      configuration: {
                        ...firebaseRequest.configuration,
                        limitToFirst: "",
                        limitToLast: "",
                      }
                    })
                  )}
                  variant="ghost"
                  size="sm"
                >
                  <LuX />
                  Disable limit
                </Button>
              )}
          </Row>
          <div className="h-4" />
          <Row>
            <Input
              placeholder="How many records should return?"
              aria-label="Limit result count"
              type="number"
              value={String(limitValue)}
              onChange={(e) => e.target.value && _onChangeLimitValue(e.target.value)}
              isDisabled={
                !firebaseRequest.configuration
                  || (
                    !firebaseRequest.configuration.limitToLast
                    && !firebaseRequest.configuration.limitToFirst
                  )
              }
              variant="secondary"
              fullWidth
            />
          </Row>
        </div>
        <div className="col-span-12 sm:col-span-5">
          <Row className="RealtimeDb-request-tut">
            <Button
              isPending={requestLoading}
              onPress={() => _onTest()}
              fullWidth
              variant="primary"
            >
              {requestLoading ? <ButtonSpinner /> : null}
              Make the request
              {!requestLoading ? <LuPlay /> : null}
            </Button>
          </Row>
          <div className="h-4" />
          <Row align="center">
            <Checkbox
              id="realtimedb-use-cache"
              isSelected={!invalidateCache}
              onChange={(selected) => setInvalidateCache(!selected)}
              variant="secondary"
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="realtimedb-use-cache" className="text-sm">Use cache</Label>
              </Checkbox.Content>
            </Checkbox>
            <div className="w-2" />
            <Tooltip>
              <Tooltip.Trigger>
                <div><LuInfo /></div>
              </Tooltip.Trigger>
              <Tooltip.Content className="max-w-[600px]">
                Use cache to avoid hitting the Firebase API every time you request data. The cache will be cleared when you change any of the settings.
              </Tooltip.Content>
            </Tooltip>
          </Row>
          <div className="h-4" />
          <Row align="center">
            <div className="w-full">
              <AceEditor
                mode="json"
                theme={isDark ? "one_dark" : "tomorrow"}
                height="450px"
                width="none"
                value={requestError || result || ""}
                name="resultEditor"
                readOnly
                editorProps={{ $blockScrolling: false }}
                className="RealtimeDb-result-tut rounded-md border border-divider"
              />
            </div>
          </Row>
          <div className="h-4" />
          <Row align="center">
            <LuInfo />
            <div className="w-2" />
            <Text size="sm">
              {"This is a preview and it might not show all data in order to keep things fast in the UI."}
            </Text>
          </Row>
        </div>
      </div>

      <DataTransform
        isOpen={showTransform}
        onClose={() => setShowTransform(false)}
        onSave={_onTransformSave}
        initialTransform={firebaseRequest.transform}
      />

      <VariableSettingsDrawer
        variable={variableSettings}
        onClose={() => setVariableSettings(null)}
        onPatch={(patch) => setVariableSettings((v) => (v ? { ...v, ...patch } : v))}
        onSave={_onVariableSave}
        savePending={variableLoading}
      />
    </div>
  );
}
const styles = {
  container: {
    flex: 1,
  },
};

RealtimeDbBuilder.propTypes = {
  connection: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  dataRequest: PropTypes.object,
  onDelete: PropTypes.func.isRequired,
};

export default RealtimeDbBuilder;
