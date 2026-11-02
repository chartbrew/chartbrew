import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Link,
  Popover,
} from "@heroui/react";
import AceEditor from "../../components/CodeEditor";
import toast from "react-hot-toast";
import { LuInfo } from "react-icons/lu";
import { useParams } from "react-router";

import {
  createVariableBinding,
  deleteVariableBinding,
  runDataRequest,
  selectDataRequests,
  updateVariableBinding,
} from "../../slices/dataset";
import VariableSettingsDrawer, { QUERY_REQUIRED_HINT } from "../../components/VariableSettingsDrawer";
import { useTheme } from "../../modules/ThemeContext";
import QueryResultsTable from "../../containers/AddChart/components/QueryResultsTable";
import DataTransform from "../../containers/Dataset/DataTransform";
import SqlAceEditor from "../../components/SqlAceEditor";
import { selectTeam } from "../../slices/team";
import QueryBuilder from "../shared/query-builder";

/*
  MongoDB query builder with variable support
*/
function MongoQueryBuilder(props) {
  const {
    onChangeRequest, onSave, dataRequest, connection, onDelete,
  } = props;

  const [, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState("");
  const [testingQuery, setTestingQuery] = useState(false);
  const [result, setResult] = useState("");
  const [mongoRequest, setMongoRequest] = useState({
    query: "collection('your_collection').find({status: {{status}}}).limit(100)",
  });
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
  const team = useSelector(selectTeam);

  useEffect(() => {
    if (dataRequest) {
      const newRequest = { ...mongoRequest, ...dataRequest };
      if (!dataRequest.query) newRequest.query = mongoRequest.query;
      setMongoRequest(newRequest);
    }
  }, []);

  useEffect(() => {
    onChangeRequest(mongoRequest);
  }, [mongoRequest]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((o) => o.id === mongoRequest.id);
      if (selectedResponse?.response) {
        setResult(JSON.stringify(selectedResponse.response, null, 2));
      }
    }
  }, [stateDrs, mongoRequest]);

  const _onChangeQuery = (value) => {
    setTestSuccess(false);
    setTestError(false);
    setMongoRequest({ ...mongoRequest, query: value });
  };

  const _onTest = (dr = mongoRequest) => {
    setTestingQuery(true);
    setTestSuccess(false);
    setTestError(false);

    onSave(dr).then(() => {
      const getCache = !invalidateCache;
      dispatch(runDataRequest({
        team_id: team.id,
        dataset_id: dr.dataset_id,
        dataRequest_id: dr.id,
        getCache
      }))
        .then((data) => {
          if (data?.error) {
            setTestingQuery(false);
            setTestError(data.error);
            setResult(JSON.stringify(data.error, null, 2));
            toast.error("The request failed. Please check your query 🕵️‍♂️");
            return;
          }

          const result = data.payload;
          if (result?.status?.statusCode >= 400) {
            setTestError(result.response);
          }
          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setTestSuccess(true);
          }
          setTestingQuery(false);
        })
        .catch((error) => {
          setTestingQuery(false);
          setTestError(error);
          setResult(error);
          toast.error("The request failed. Please check your query 🕵️‍♂️");
        });
    });
  };

  const _onSavePressed = () => {
    setSaveLoading(true);
    onSave(mongoRequest).then(() => {
      setSaveLoading(false);
    }).catch(() => {
      setSaveLoading(false);
    });
  };

  const _onTransformSave = (transformConfig) => {
    const updatedRequest = { ...mongoRequest, transform: transformConfig };
    setMongoRequest(updatedRequest);
    onSave(updatedRequest);
  };

  const _onVariableClick = (variable) => {
    let selectedVariable = mongoRequest.VariableBindings?.find((v) => v.name === variable.variable);
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
        setMongoRequest({
          ...mongoRequest,
          ...response.payload,
          query: mongoRequest.query, // Preserve the current query being edited
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

  const _onVariableDelete = async () => {
    if (!variableSettings?.id) return;

    setVariableLoading(true);
    try {
      const response = await dispatch(deleteVariableBinding({
        team_id: team.id,
        dataset_id: dataRequest.dataset_id,
        dataRequest_id: dataRequest.id,
        variable_id: variableSettings.id,
      }));

      if (response.payload) {
        setMongoRequest({
          ...mongoRequest,
          ...response.payload,
          query: mongoRequest.query,
        });
      }

      setVariableLoading(false);
      setVariableSettings(null);
      toast.success("Variable deleted successfully");
    } catch (error) {
      setVariableLoading(false);
      toast.error("Failed to delete variable");
    }
  };

  return (
    <>
      <QueryBuilder
        request={mongoRequest}
        type={connection.type}
        onChangeQuery={_onChangeQuery}
        onSave={_onSavePressed}
        onDelete={onDelete}
        onRun={() => _onTest()}
        onTransform={() => setShowTransform(true)}
        saving={saveLoading}
        running={testingQuery}
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
            value={testError || result || ""}
            name="resultEditor"
            readOnly
            className="rounded-xl border border-divider"
          />
        )}
        resultsHelp={(
          <Popover>
            <Button size="sm" variant="ghost" className="self-start">
              <LuInfo aria-hidden size={16} />
              Query help
            </Button>
            <Popover.Content className="w-96 max-w-[calc(100vw-2rem)]">
              <Popover.Dialog aria-label="MongoDB query help" className="flex flex-col gap-3 p-3 text-sm">
                <p>
                  Start with <code>collection('collection_name')</code> to select a collection.
                </p>
                <Link href="https://docs.mongodb.com/manual/reference/operator/query-comparison/" target="_blank" rel="noopener noreferrer">
                  Filter documents to fetch only the data you need.
                </Link>
                <Link href="https://docs.mongodb.com/manual/tutorial/project-fields-from-query-results/#return-the-specified-fields-and-the-id-field-only" target="_blank" rel="noopener noreferrer">
                  Exclude unused fields and encoded files to reduce the result size.
                </Link>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        )}
      >
        <SqlAceEditor
          mode="javascript"
          theme={isDark ? "one_dark" : "tomorrow"}
          height="360px"
          value={mongoRequest.query || ""}
          onChange={_onChangeQuery}
          onVariableClick={_onVariableClick}
          name="queryEditor"
          className="mongobuilder-query-tut"
        />
      </QueryBuilder>

      <DataTransform
        isOpen={showTransform}
        onClose={() => setShowTransform(false)}
        onSave={_onTransformSave}
        initialTransform={mongoRequest.transform}
      />

      <VariableSettingsDrawer
        variable={variableSettings}
        onClose={() => setVariableSettings(null)}
        onPatch={(patch) => setVariableSettings((v) => (v ? { ...v, ...patch } : v))}
        onSave={_onVariableSave}
        onDelete={_onVariableDelete}
        savePending={variableLoading}
        deletePending={variableLoading}
        requiredWithoutDefaultHint={QUERY_REQUIRED_HINT}
      />
    </>
  );
}

MongoQueryBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  match: PropTypes.object.isRequired,
  connection: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default MongoQueryBuilder;
