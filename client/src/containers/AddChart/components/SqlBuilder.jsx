import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button, Spacer, Modal, Input, Tooltip, Checkbox, Divider,
  ModalHeader, ModalBody, ModalFooter, ModalContent, Tabs, Tab,
  CircularProgress, Badge, Drawer, DrawerHeader, DrawerBody,
  Select, SelectItem, DrawerFooter, DrawerContent, Code, Switch,
} from "@heroui/react";
import AceEditor from "react-ace";
import toast from "react-hot-toast";
import { LuCheck, LuChevronsRight, LuInfo, LuPlay, LuPlus, LuTrash } from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { createVariableBinding, runDataRequest, selectDataRequests, updateVariableBinding } from "../../../slices/dataset";
import SavedQueries from "../../../components/SavedQueries";
import Row from "../../../components/Row";
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
  const [requestSuccess, setRequestSuccess] = useState(false);
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
  const connection = useSelector((state) => state.connection.data.find((c) => c.id === dataRequest?.connection_id));
  const team = useSelector(selectTeam);

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
    if (connection?.id && !connection.schema && !schemaInitRef.current) {
      schemaInitRef.current = true;
      _onTest(dataRequest, true);
    }
  }, [connection]);

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
        <CircularProgress aria-label="Loading connection..." />
      </div>
    );
  }

  return (
    <div style={styles.container} className="pl-1 pr-1 sm:pl-4 sm:pr-4">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 sm:col-span-6 md:col-span-5">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div className="flex flex-row items-center gap-2">
              <Button
                color="primary"
                auto
                size="sm"
                onPress={() => _onSavePressed()}
                isLoading={saveLoading || requestLoading}
              >
                {"Save"}
              </Button>
              <Badge color="success" content="" placement="top-right" shape="circle" isInvisible={!sqlRequest.transform?.enabled}>
                <Button
                  color="primary"
                  variant="flat"
                  size="sm"
                  onPress={() => setShowTransform(true)}
                >
                  Transform
                </Button>
              </Badge>
              <Tooltip content="Delete this data request" placement="bottom" css={{ zIndex: 99999 }}>
                <Button
                  color="danger"
                  isIconOnly
                  auto
                  size="sm"
                  variant="flat"
                  onPress={() => onDelete()}
                >
                  <LuTrash />
                </Button>
              </Tooltip>
            </div>
          </Row>
          <Spacer y={2} />
          <Divider />
          <Spacer y={2} />
          <Tabs variant="light" selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key)}>
            <Tab
              title="SQL Query"
              key="sql"
            />
            <Tab
              title={(
                <div className="flex items-center gap-1">
                  <Text>Visual Query</Text>
                </div>
              )}
              key="visual"
            />
          </Tabs>
          <Spacer y={2} />
          <Divider />
          <Spacer y={4} />
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
                <Spacer y={4} />
                <Divider />
                <Spacer y={2} />
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
          <Spacer y={2} />
          <div className="sqlbuilder-buttons-tut flex flex-row items-center gap-1">
            <Button
              color={requestSuccess ? "primary" : requestError ? "danger" : "primary"}
              endContent={<LuPlay />}
              onPress={() => _onTest()}
              isLoading={requestLoading}
              fullWidth
            >
              Run query
            </Button>
          </div>
          <Spacer y={2} />
          <Row align="center">
            <Checkbox
              isSelected={!invalidateCache}
              onChange={() => setInvalidateCache(!invalidateCache)}
              size="sm"
            >
              {"Use cached data"}
            </Checkbox>
            <Spacer x={0.5} />
            <Tooltip
              content={"Chartbrew will use cached data for extra editing speed ⚡️. The cache gets automatically invalidated when you change any query settings."}
              className="max-w-[400px]"
            >
              <div><LuInfo /></div>
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

          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
          <Row>
            <Text b>Saved queries</Text>
          </Row>
          <Spacer y={2} />
          <div className="flex flex-row gap-2">
            <Button
              endContent={<LuPlus />}
              isLoading={savingQuery}
              onPress={_onSaveQueryConfirmation}
              variant="flat"
              size="sm"
            >
              {!savedQuery && "Save this query"}
              {savedQuery && "Save as new"}
            </Button>

            {savedQuery && (
              <>
                <Button
                  variant="flat"
                  endContent={<LuCheck />}
                  onPress={_onUpdateSavedQuery}
                  isLoading={updatingSavedQuery}
                  size="sm"
                >
                  {"Update current query"}
                </Button>
              </>
            )}
          </div>
          <Spacer y={4} />
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
          <Spacer y={8} />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-7">
          <Tabs variant="light" selectedKey={activeResultsTab} onSelectionChange={(key) => setActiveResultsTab(key)}>
            <Tab title="Table" key="table" />
            <Tab title="JSON" key="json" />
          </Tabs>
          <Spacer y={2} />

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
                  className="sqlbuilder-result-tut rounded-md border-1 border-solid border-content3"
                />
              </div>
            </div>
          )}
          <Spacer y={2} />
          {result && (
            <Row>
              <Text size="sm">This is a sample response and might not show all the data.</Text>
            </Row>
          )}
        </div>
      </div>

      {/* Save query modal */}
      <Modal isOpen={saveQueryModal} size="small" onClose={() => setSaveQueryModal(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col">
            <div className="font-bold">{"Save your query for later"}</div>
            <div className="text-sm font-normal">{"You can then re-use this query for other datasets"}</div>
          </ModalHeader>
          <ModalBody>
            <Input
              label="Write a short description for your query"
              placeholder="Type a summary here"
              fullWidth
              onChange={(e) => setSavedQuerySummary(e.target.value)}
              variant="bordered"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setSaveQueryModal(false)}
            >
              Close
            </Button>
            <Button
              disabled={!savedQuerySummary}
              endContent={<LuCheck />}
              onPress={_onSaveQuery}
              color="primary"
            >
              Save the query
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <DataTransform
        isOpen={showTransform}
        onClose={() => setShowTransform(false)}
        onSave={_onTransformSave}
        initialTransform={sqlRequest.transform}
      />
    
      <Drawer
        isOpen={!!variableSettings}
        onClose={() => setVariableSettings(null)}
        placement="right"
        classNames={{
          base: "sm:data-[placement=right]:m-2 sm:data-[placement=left]:m-2 rounded-medium",
        }}
        style={{
          marginTop: "54px",
        }}
        backdrop="transparent"
      >
        <DrawerContent>
          <DrawerHeader
            className="flex flex-row items-center border-b-1 border-divider gap-2 px-2 py-2 justify-between bg-content1/50 backdrop-saturate-150 backdrop-blur-lg"
          >
            <Tooltip content="Close">
              <Button
                isIconOnly
                onPress={() => setVariableSettings(null)}
                size="sm"
                variant="light"
              >
                <LuChevronsRight />
              </Button>
            </Tooltip>
            <div className="text-sm font-bold">Variable settings</div>
            <div className="flex flex-row items-center gap-2">
              <Code color="primary" radius="sm" variant="flat" className="text-sm">
                {variableSettings?.name}
              </Code>
            </div>
          </DrawerHeader>
          <DrawerBody>
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable name</div>
              <pre className="text-primary">
                {variableSettings?.name}
              </pre>
            </div>
            <Spacer y={1} />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable type</div>
              <Select
                label="Select a type"
                placeholder="Select a variable type"
                fullWidth
                selectedKeys={[variableSettings?.type]}
                onSelectionChange={(keys) => setVariableSettings({ ...variableSettings, type: keys.currentKey })}
                variant="bordered"
              >
                <SelectItem key="string">String</SelectItem>
                <SelectItem key="number">Number</SelectItem>
                <SelectItem key="boolean">Boolean</SelectItem>
                <SelectItem key="date">Date</SelectItem>
              </Select>
            </div>
            <Spacer y={1} />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Default value</div>
              <Input
                placeholder="Type a value here"
                fullWidth
                variant="bordered"
                value={variableSettings?.default_value}
                onChange={(e) => setVariableSettings({ ...variableSettings, default_value: e.target.value })}
                description={variableSettings?.required && !variableSettings?.default_value && "This variable is required. The query will fail if you don't provide a value."}
              />
            </div>
            <Spacer y={1} />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Required</div>
              <Switch
                isSelected={variableSettings?.required}
                onValueChange={(selected) => setVariableSettings({ ...variableSettings, required: selected })}
                size="sm"
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="flat"
              onPress={() => setVariableSettings(null)}
            >
              Close
            </Button>
            <Button
              color="primary"
              onPress={_onVariableSave}
              isLoading={variableLoading}
            >
              Save
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
