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
  Drawer,
  Label,
  ListBox,
  Switch,
  Select
} from "@heroui/react";
import AceEditor from "react-ace";
import toast from "react-hot-toast";
import { LuCheck, LuInfo, LuPlay, LuPlus, LuTrash, LuChevronsRight } from "react-icons/lu";
import { useParams } from "react-router";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-sql";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

import { createVariableBinding, runDataRequest, selectDataRequests, updateVariableBinding } from "../../../slices/dataset";
import SavedQueries from "../../../components/SavedQueries";
import Row from "../../../components/Row";
import { ButtonSpinner } from "../../../components/ButtonSpinner";
import Text from "../../../components/Text";
import { useTheme } from "../../../modules/ThemeContext";
import { createSavedQuery, updateSavedQuery } from "../../../slices/savedQuery";
import { getConnection } from "../../../slices/connection";
import AiQuery from "../../Dataset/AiQuery";
import QueryResultsTable from "../../AddChart/components/QueryResultsTable";
import DataTransform from "../../Dataset/DataTransform";
import SqlAceEditor from "../../../components/SqlAceEditor";
import { selectTeam } from "../../../slices/team";

const initialQuery =
`-- Write your ClickHouse query here with variables
-- Use {{variable_name}} syntax for variables, e.g.:
SELECT 
  count(*) as total_events,
  event_name
FROM events 
WHERE date >= {{start_date}}
  AND status = {{event_status}}
GROUP BY event_name;

-- Or ask the AI assistant below to generate one for you
`;

function ClickHouseBuilder(props) {
  const {
    dataRequest, onChangeRequest, onSave,
    connection: initialConnection,
    onDelete,
  } = props;

  const [sqlRequest, setSqlRequest] = useState({
    query: initialQuery,
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
      setSqlRequest({ ...sqlRequest, ...dataRequest, query: dataRequest.query || sqlRequest.query });
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
    if (storedConnection?.id
      && !storedConnection.schema
      && !schemaInitRef.current
      && dataRequest?.query
      && dataRequest?.query !== initialQuery
    ) {
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
      team_id: team?.id,
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
      team_id: team?.id,
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
        team_id: team?.id,
        dataset_id: dr.dataset_id,
        dataRequest_id: dr.id,
        getCache
      }))
        .then(async (data) => {
          const result = data.payload;

          if (!noError && result?.status?.statusCode >= 400) {
            setRequestError(result.response);
            setResult(JSON.stringify(result.response, null, 2));
            setActiveResultsTab("json");
            toast.error("The request failed. Please check your query 🔎");
            return;
          }

          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setRequestSuccess(true);
          }          

          await dispatch(getConnection({
            team_id: team?.id,
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
    let selectedVariable = sqlRequest.VariableBindings?.find((v) => v.name === variable.variable);
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

  const blockResultsTabSwitch = saveLoading || requestLoading;

  return (
    <div style={styles.container} className="pl-1 pr-1 sm:pl-4 sm:pr-4">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 sm:col-span-6 md:col-span-5">
          <Row justify="space-between" align="center">
            <Text b size={"lg"}>{connection.name}</Text>
            <div className="flex flex-row items-center gap-2">
              <Button auto
                size="sm"
                onPress={() => _onSavePressed()}
                isPending={saveLoading || requestLoading}
                startContent={(saveLoading || requestLoading) ? <ButtonSpinner /> : undefined}
              >
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
                <Tooltip.Content placement="bottom" className="z-[99999]">
                  Apply transformations to the data
                </Tooltip.Content>
              </Tooltip>
              <Tooltip>
                <Tooltip.Trigger>
                  <Button isIconOnly
                    auto
                    size="sm"
                    variant="danger-soft"
                    onPress={() => onDelete()}
                  >
                    <LuTrash />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom" className="z-[99999]">
                  Delete this data request
                </Tooltip.Content>
              </Tooltip>
            </div>
          </Row>
          <div className="h-4" />
          <Separator />
          <div className="h-8" />
          <div>
            <Row>
              <SqlAceEditor
                mode="sql"
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
          <div className="h-4" />
          <div className="sqlbuilder-buttons-tut flex flex-row items-center gap-1">
            <Button endContent={!requestLoading ? <LuPlay /> : undefined}
              onPress={() => _onTest()}
              isPending={requestLoading}
              startContent={requestLoading ? <ButtonSpinner /> : undefined}
              fullWidth
            >
              Run query
            </Button>
          </div>
          <div className="h-4" />
          <Row align="center">
            <Checkbox
              id="clickhouse-use-cache"
              isSelected={!invalidateCache}
              onChange={(selected) => setInvalidateCache(!selected)}
            >
              <Checkbox.Control className="size-4 shrink-0">
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Content>
                <Label htmlFor="clickhouse-use-cache" className="text-sm">Use cached data</Label>
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

          <div className="flex flex-col gap-2">
            <AiQuery
              query={sqlRequest.query}
              dataRequest={dataRequest}
              onChangeQuery={_onChangeQuery}
            />
          </div>

          <div className="h-8" />
          <Separator />
          <div className="h-8" />
          <Row>
            <Text b>Saved queries</Text>
          </Row>
          <div className="h-4" />
          <div className="flex flex-row gap-2">
            <Button
              endContent={!savingQuery ? <LuPlus /> : undefined}
              isPending={savingQuery}
              startContent={savingQuery ? <ButtonSpinner /> : undefined}
              onPress={_onSaveQueryConfirmation}
              variant="tertiary"
              size="sm"
            >
              {!savedQuery && "Save this query"}
              {savedQuery && "Save as new"}
            </Button>

            {savedQuery && (
              <>
                <Button
                  variant="tertiary"
                  endContent={!updatingSavedQuery ? <LuCheck /> : undefined}
                  onPress={_onUpdateSavedQuery}
                  isPending={updatingSavedQuery}
                  startContent={updatingSavedQuery ? <ButtonSpinner /> : undefined}
                  size="sm"
                >
                  {"Update current query"}
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
            aria-busy={blockResultsTabSwitch}
            onSelectionChange={(key) => {
              if (blockResultsTabSwitch) return;
              setActiveResultsTab(key);
            }}
          >
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="table">Table</Tabs.Tab>
                <Tabs.Tab id="json">JSON</Tabs.Tab>
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
                  className="sqlbuilder-result-tut rounded-md border-1 border-solid border-content3"
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
        <Modal.Container size="sm">
          <Modal.Dialog>
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
              variant="secondary"
              onPress={() => setSaveQueryModal(false)}
            >
              Close
            </Button>
            <Button
              isDisabled={!savedQuerySummary}
              endContent={<LuCheck />}
              onPress={_onSaveQuery}
            >
              Save the query
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

      <Drawer
        isOpen={!!variableSettings}
        onOpenChange={(open) => {
          if (!open) setVariableSettings(null);
        }}
      >
        <Drawer.Backdrop variant="transparent" />
        <Drawer.Content
          placement="right"
          className="sm:data-[placement=right]:m-2 sm:data-[placement=left]:m-2 rounded-medium"
          style={{
            marginTop: "54px",
          }}
        >
          <Drawer.Dialog>
          <Drawer.Header
            className="flex flex-row items-center border-b-1 border-divider gap-2 px-2 py-2 justify-between bg-content1/50 backdrop-saturate-150 backdrop-blur-lg"
          >
            <Tooltip>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  onPress={() => setVariableSettings(null)}
                  size="sm"
                  variant="ghost"
                >
                  <LuChevronsRight />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>Close</Tooltip.Content>
            </Tooltip>
            <div className="text-sm font-bold">Variable settings</div>
            <div className="flex flex-row items-center gap-2">
              <code className="rounded-sm bg-accent/20 px-1.5 py-0.5 text-sm text-accent-600">
                {variableSettings?.name}
              </code>
            </div>
          </Drawer.Header>
          <Drawer.Body>
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable name</div>
              <pre className="text-primary">
                {variableSettings?.name}
              </pre>
            </div>
            <div className="h-2" />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Variable type</div>
              <Select
                placeholder="Select a variable type"
                fullWidth
                selectionMode="single"
                value={variableSettings?.type || null}
                onChange={(value) => setVariableSettings({ ...variableSettings, type: value })}
                variant="secondary"
              >
                <Label>Select a type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="string" textValue="String">
                      String
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="number" textValue="Number">
                      Number
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="boolean" textValue="Boolean">
                      Boolean
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="date" textValue="Date">
                      Date
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="h-2" />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Default value</div>
              <Input
                placeholder="Type a value here"
                fullWidth
                variant="secondary"
                value={variableSettings?.default_value}
                onChange={(e) => setVariableSettings({ ...variableSettings, default_value: e.target.value })}
                description={variableSettings?.required && !variableSettings?.default_value && "This variable is required. The query will fail if you don't provide a value."}
              />
            </div>
            <div className="h-2" />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-gray-500">Required</div>
              <Switch
                isSelected={variableSettings?.required}
                onValueChange={(selected) => setVariableSettings({ ...variableSettings, required: selected })}
                size="sm"
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="tertiary"
              onPress={() => setVariableSettings(null)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onPress={_onVariableSave}
              isPending={variableLoading}
              startContent={variableLoading ? <ButtonSpinner /> : undefined}
            >
              Save
            </Button>
          </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
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

ClickHouseBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ClickHouseBuilder;
