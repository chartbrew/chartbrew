import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Input,
  Tooltip,
  ProgressCircle,
  Drawer,
  Label,
  ListBox,
  Switch,
  Select
} from "@heroui/react";
import AceEditor from "../../components/CodeEditor";
import toast from "react-hot-toast";
import { LuChevronsRight } from "react-icons/lu";
import { useParams } from "react-router";

import { createVariableBinding, runDataRequest, selectDataRequests, updateVariableBinding } from "../../slices/dataset";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import { useTheme } from "../../modules/ThemeContext";
import { getConnection } from "../../slices/connection";
import QueryResultsTable from "../../containers/AddChart/components/QueryResultsTable";
import DataTransform from "../../containers/Dataset/DataTransform";
import SqlAceEditor from "../../components/SqlAceEditor";
import { selectTeam } from "../../slices/team";
import QueryBuilder from "../shared/query-builder";

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

-- Or ask AI to generate a query
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

  return (
    <>
      <QueryBuilder
        request={sqlRequest}
        type={connection.type}
        onChangeQuery={_onChangeQuery}
        onSave={_onSavePressed}
        onDelete={onDelete}
        onRun={() => _onTest()}
        onTransform={() => setShowTransform(true)}
        saving={saveLoading}
        running={requestLoading}
        invalidateCache={invalidateCache}
        onCacheChange={setInvalidateCache}
        resultsTab={activeResultsTab}
        onResultsTabChange={setActiveResultsTab}
        results={activeResultsTab === "table" ? (
          <QueryResultsTable result={result} />
        ) : (
          <AceEditor
            mode="json"
            theme={isDark ? "one_dark" : "tomorrow"}
            height="450px"
            value={requestError || result || ""}
            name="resultEditor"
            readOnly
            className="rounded-xl border border-divider"
          />
        )}
      >
        <SqlAceEditor
          mode="sql"
          theme={isDark ? "one_dark" : "tomorrow"}
          height="360px"
          value={sqlRequest.query || ""}
          onChange={_onChangeQuery}
          onVariableClick={_onVariableClick}
          name="queryEditor"
          className="sqlbuilder-query-tut"
        />
      </QueryBuilder>

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
            className="flex flex-row items-center border-b-1 border-divider gap-2 px-2 py-2 justify-between bg-surface/50 backdrop-saturate-150 backdrop-blur-lg"
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
              <pre className="text-accent">
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
                onChange={(selected) => setVariableSettings({ ...variableSettings, required: selected })}
                size="sm"
                aria-label="Required"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
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
            >
              {variableLoading ? <ButtonSpinner /> : null}
              Save
            </Button>
          </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer>
    </>
  );
}

ClickHouseBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default ClickHouseBuilder;
