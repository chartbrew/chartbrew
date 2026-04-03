import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Modal,
  Input,
  Tooltip,
  Checkbox,
  Separator,
  Tabs,
  ProgressCircle,
  Badge,
  Label,
} from "@heroui/react";
import AceEditor from "react-ace";
import toast from "react-hot-toast";
import { LuCheck, LuInfo, LuPlay, LuPlus, LuTrash } from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { createVariableBinding, runDataRequest, selectDataRequests, updateVariableBinding } from "../../../slices/dataset";
import SavedQueries from "../../../components/SavedQueries";
import Row from "../../../components/Row";
import VariableSettingsDrawer, { QUERY_REQUIRED_HINT } from "../../../components/VariableSettingsDrawer";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { createSavedQuery, updateSavedQuery } from "../../../slices/savedQuery";
import SqlAceEditor from "../../../components/SqlAceEditor";

import VisualSQL from "./VisualSQL";
import { getConnection } from "../../../slices/connection";
import AiQuery from "../../Dataset/AiQuery";
import QueryResultsTable from "./QueryResultsTable";
import DataTransform from "../../Dataset/DataTransform";
import { selectTeam } from "../../../slices/team";

/*
  The query builder for Mysql and Postgres
*/
function SqlBuilder(props) {
  const {
    dataRequest, onChangeRequest, onSave,
    connection: initialConnection,
    onDelete,
  } = props;

  const [sqlRequest, setSqlRequest] = useState({
    query: "SELECT * FROM users WHERE created_at > {{start_date}} AND status = {{user_status}};",
  });
  const [savedQuery, setSavedQuery] = useState(null);
  const [savedQuerySummary, setSavedQuerySummary] = useState("");
  const [saveQueryModal, setSaveQueryModal] = useState(false);
  const [savingQuery, setSavingQuery] = useState(false);
  const [updatingSavedQuery, setUpdatingSavedQuery] = useState(false);
  const [, setRequestSuccess] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState("");
  const [invalidateCache, setInvalidateCache] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("sql");
  const [activeResultsTab, setActiveResultsTab] = useState("table");
  const [showTransform, setShowTransform] = useState(false);
  const [variableSettings, setVariableSettings] = useState(null);
  const [variableLoading, setVariableLoading] = useState(false);

  const { isDark } = useTheme();
  const params = useParams();
  const dispatch = useDispatch();
  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const storedConnection = useSelector((state) => state.connection.data.find((c) => c.id === dataRequest?.connection_id));
  const team = useSelector(selectTeam);
  const connection = storedConnection?.id ? { ...initialConnection, ...storedConnection } : initialConnection;

  const schemaInitRef = useRef(false);

  useEffect(() => {
    if (dataRequest) {
      setSqlRequest({ ...sqlRequest, ...dataRequest });
    }
  }, []);

  useEffect(() => {
    onChangeRequest(sqlRequest);
  }, [sqlRequest]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === sqlRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, sqlRequest]);

  useEffect(() => {
    if (requestError) {
      setActiveResultsTab("json");
    }
  }, [requestError]);

  useEffect(() => {
    if (storedConnection?.id && !storedConnection.schema && !schemaInitRef.current) {
      schemaInitRef.current = true;
      _onTest(dataRequest, true);
    }
  }, [dataRequest, storedConnection]);

  const _onSaveQueryConfirmation = () => {
    setSaveQueryModal(true);
  };

  const _onSaveQuery = () => {
    setSavingQuery(true);
    dispatch(createSavedQuery({
      team_id: team.id,
      data: {
        query: sqlRequest.query,
        summary: savedQuerySummary,
        type: connection.type,
      },
    }))
      .then((savedQuery) => {
        setSavingQuery(false);
        setSavedQuery(savedQuery.id);
        setSaveQueryModal(false);
      })
      .catch(() => {
        setSavingQuery(false);
        setSaveQueryModal(false);
        toast.error("There was a problem with saving your query 😳");
      });
  };

  const _onUpdateSavedQuery = () => {
    setUpdatingSavedQuery(true);
    dispatch(updateSavedQuery({
      team_id: team.id,
      data: {
        ...savedQuery,
        query: sqlRequest.query,
      },
    }))
      .then(() => {
        setUpdatingSavedQuery(false);
        toast.success("The query was updated 👍");
      })
      .catch(() => {
        setUpdatingSavedQuery(false);
        toast.error("There was a problem with saving your query 😿");
      });
  };

  const _onChangeQuery = (value, testAfter = false, noError = false) => {
    const newSqlRequest = { ...sqlRequest, query: value };
    setSqlRequest(newSqlRequest);
    
    if (testAfter) {
      _onTest(newSqlRequest, noError);
    }
  };

  const _onTest = (dr = dataRequest, noError = false) => {
    setRequestLoading(true);
    setRequestSuccess(false);
    setRequestError(false);

    onSave(dr).then(() => {
      const getCache = !invalidateCache;
      dispatch(runDataRequest({
        team_id: team.id,
        dataset_id: dr.dataset_id,
        dataRequest_id: dr.id,
        getCache
      }))
        .then(async (data) => {
          const result = data.payload;
          if (!noError && result?.status?.statusCode >= 400) {
            setRequestError(result.response);
          }
          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setRequestSuccess(true);
          }

          await dispatch(getConnection({
            team_id: team.id,
            connection_id: dr.connection_id,
          }));

          setRequestLoading(false);
        })
        .catch((error) => {
          setRequestLoading(false);
          setRequestError(error);
          setResult(JSON.stringify(error, null, 2));
          toast.error("The request failed. Please check your query 🕵️‍♂️");
        });
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(sqlRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  const _onTransformSave = (transformConfig) => {
    const updatedRequest = { ...sqlRequest, transform: transformConfig };
    setSqlRequest(updatedRequest);
    onSave(updatedRequest);
  };

  const _onVariableClick = (variable) => {
    let selectedVariable = sqlRequest.VariableBindings.find((v) => v.name === variable.variable);
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
          team_id: team.id,
          dataset_id: dataRequest.dataset_id,
          dataRequest_id: dataRequest.id,
          variable_id: variableSettings.id,
          data: variableSettings,
        }));
      } else {
        response = await dispatch(createVariableBinding({
          team_id: team.id,
          dataset_id: dataRequest.dataset_id,
          dataRequest_id: dataRequest.id,
          data: variableSettings,
        }));
      }

      // Use the updated dataRequest from the API response, but preserve the current query
      if (response.payload) {
        setSqlRequest({
          ...sqlRequest,
          ...response.payload,
          query: sqlRequest.query, // Preserve the current query being edited
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

  if (!connection) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <ProgressCircle aria-label="Loading connection..." />
      </div>
    );
  }

  const blockTabSwitch = saveLoading || requestLoading;

  return (
    <div style={styles.container} className="pl-1 pr-1 sm:pl-4 sm:pr-4">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 sm:col-span-6 md:col-span-5">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div className="flex flex-row items-center gap-2">
              <Button
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
                    {sqlRequest.transform?.enabled && (
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
          <Separator />
          <div className="h-4" />
          <Tabs
            variant="secondary"
            selectedKey={activeTab}
            aria-busy={blockTabSwitch}
            onSelectionChange={(key) => {
              if (blockTabSwitch) return;
              setActiveTab(key);
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="sql">
                  <Tabs.Indicator />
                  SQL Query
                </Tabs.Tab>
                <Tabs.Tab id="visual">
                  <Tabs.Indicator />
                  <div className="flex items-center gap-1">
                    <Text>Visual Query</Text>
                  </div>
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <div className="h-4" />
          <>
            {activeTab === "visual" && (
              <div>
                <VisualSQL
                  query={sqlRequest.query}
                  schema={connection.schema}
                  updateQuery={(query) => _onChangeQuery(query, true)}
                  type={connection.type}
                  onVariableClick={_onVariableClick}
                />
                <div className="h-8" />
                <Separator />
                <div className="h-4" />
              </div>
            )}
            {activeTab === "sql" && (
              <div>
                <Row>
                  <SqlAceEditor
                    mode="pgsql"
                    theme={isDark ? "one_dark" : "tomorrow"}
                    height="300px"
                    width="none"
                    value={sqlRequest.query || ""}
                    onChange={(value) => {
                      _onChangeQuery(value);
                    }}
                    onVariableClick={_onVariableClick}
                    name="queryEditor"
                    className="sqlbuilder-query-tut"
                  />
                </Row>
              </div>
            )}
          </>
          <div className="h-4" />
          <div className="sqlbuilder-buttons-tut flex flex-row items-center gap-1">
            <Button
              onPress={() => _onTest()}
              isPending={requestLoading}
              fullWidth
            >
              {requestLoading ? <ButtonSpinner /> : null}
              Run query
              {!requestLoading ? <LuPlay /> : null}
            </Button>
          </div>
          <div className="h-4" />
          <Row align="center">
            <Checkbox
              id="sqlbuilder-use-cache"
              isSelected={!invalidateCache}
              onChange={(selected) => setInvalidateCache(!selected)}
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="sqlbuilder-use-cache" className="text-sm">Use cached data</Label>
              </Checkbox.Content>
            </Checkbox>
            <div className="w-1" />
            <Tooltip>
              <Tooltip.Trigger>
                <div><LuInfo /></div>
              </Tooltip.Trigger>
              <Tooltip.Content className="max-w-[400px]">
                Chartbrew will use cached data for extra editing speed ⚡️. The cache gets automatically invalidated when you change any query settings.
              </Tooltip.Content>
            </Tooltip>
          </Row>

          {activeTab === "sql" && (
            <div className="flex flex-col gap-2">
              <AiQuery
                query={sqlRequest.query}
                dataRequest={dataRequest}
                onChangeQuery={_onChangeQuery}
              />
            </div>
          )}

          <div className="h-8" />
          <Separator />
          <div className="h-8" />
          <Row>
            <Text b>Saved queries</Text>
          </Row>
          <div className="h-4" />
          <div className="flex flex-row gap-2">
            <Button
              isPending={savingQuery}
              onPress={_onSaveQueryConfirmation}
              variant="tertiary"
              size="sm"
            >
              {savingQuery ? <ButtonSpinner /> : null}
              {!savedQuery && "Save this query"}
              {savedQuery && "Save as new"}
              {!savingQuery ? <LuPlus /> : null}
            </Button>

            {savedQuery && (
              <>
                <Button
                  variant="tertiary"
                  onPress={_onUpdateSavedQuery}
                  isPending={updatingSavedQuery}
                  size="sm"
                >
                  {updatingSavedQuery ? <ButtonSpinner /> : null}
                  {"Update current query"}
                  {!updatingSavedQuery ? <LuCheck /> : null}
                </Button>
              </>
            )}
          </div>
          <div className="h-8" />
          <Row className="sqlbuilder-saved-tut">
            <SavedQueries
              selectedQuery={savedQuery}
              onSelectQuery={(savedQuery) => {
                setSavedQuery(savedQuery.id);
                _onChangeQuery(savedQuery.query);
              }}
              type={connection.type}
              style={styles.savedQueriesContainer}
            />
          </Row>
          <div className="h-16" />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-7">
          <Tabs
            variant="secondary"
            selectedKey={activeResultsTab}
            aria-busy={blockTabSwitch}
            onSelectionChange={(key) => {
              if (blockTabSwitch) return;
              setActiveResultsTab(key);
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="table">
                  <Tabs.Indicator />
                  Table
                </Tabs.Tab>
                <Tabs.Tab id="json">
                  <Tabs.Indicator />
                  JSON
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <div className="h-4" />

          {activeResultsTab === "table" && (
            <div className="w-full">
              <QueryResultsTable result={result} />
            </div>
          )}

          {activeResultsTab === "json" && (
            <div>
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
                  className="sqlbuilder-result-tut rounded-md border border-solid border-content3"
                />
              </div>
            </div>
          )}
          <div className="h-4" />
          {result && (
            <Row>
              <Text size="sm">This is a sample response and might not show all the data.</Text>
            </Row>
          )}
        </div>
      </div>

      {/* Save query modal */}
      <Modal.Backdrop isOpen={saveQueryModal} onOpenChange={setSaveQueryModal}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
          <Modal.Header className="flex flex-col">
            <Modal.Heading>Save your query for later</Modal.Heading>
            <div className="text-sm font-normal">{"You can then re-use this query for other datasets"}</div>
          </Modal.Header>
          <Modal.Body>
            <Input
              label="Write a short description for your query"
              placeholder="Type a summary here"
              fullWidth
              onChange={(e) => setSavedQuerySummary(e.target.value)}
              variant="secondary"
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline"
              onPress={() => setSaveQueryModal(false)}
            >
              Close
            </Button>
            <Button
              isDisabled={!savedQuerySummary}
              onPress={_onSaveQuery}
            >
              Save the query
              <LuCheck size={18} />
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <DataTransform
        isOpen={showTransform}
        onClose={() => setShowTransform(false)}
        onSave={_onTransformSave}
        initialTransform={sqlRequest.transform}
      />

      <VariableSettingsDrawer
        variable={variableSettings}
        onClose={() => setVariableSettings(null)}
        onPatch={(patch) => setVariableSettings((v) => (v ? { ...v, ...patch } : v))}
        onSave={_onVariableSave}
        savePending={variableLoading}
        requiredWithoutDefaultHint={QUERY_REQUIRED_HINT}
      />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
  },
  savedQueriesContainer: {
    maxHeight: 170,
    overflow: "auto",
  },
};

SqlBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default SqlBuilder;
