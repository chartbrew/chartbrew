import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { ProgressCircle } from "@heroui/react";
import AceEditor from "../../../components/CodeEditor";
import toast from "react-hot-toast";
import { useParams } from "react-router";

import {
  createVariableBinding,
  deleteVariableBinding,
  runDataRequest,
  selectDataRequests,
  updateVariableBinding,
} from "../../../slices/dataset";
import VariableSettingsDrawer, { QUERY_REQUIRED_HINT } from "../../../components/VariableSettingsDrawer";
import { useTheme } from "../../../modules/ThemeContext";
import SqlAceEditor from "../../../components/SqlAceEditor";

import QueryResultsTable from "../../../containers/AddChart/components/QueryResultsTable";
import DataTransform from "../../../containers/Dataset/DataTransform";
import { selectTeam } from "../../../slices/team";
import QueryBuilder from "../query-builder";

/*
  The query builder for Mysql and Postgres
*/
function SqlBuilder(props) {
  const {
    dataRequest, onChangeRequest, onSave,
    connection,
    onDelete,
  } = props;

  const [sqlRequest, setSqlRequest] = useState({
    query: "SELECT * FROM users WHERE created_at > {{start_date}} AND status = {{user_status}};",
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
  const team = useSelector(selectTeam);

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

  const _onChangeQuery = (value) => {
    setSqlRequest({ ...sqlRequest, query: value });
  };

  const _onTest = (dr = sqlRequest) => {
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
        .then((data) => {
          const result = data.payload;
          if (result?.status?.statusCode >= 400) {
            setRequestError(result.response);
          }
          if (result?.response?.dataRequest?.responseData?.data) {
            setResult(JSON.stringify(result.response.dataRequest.responseData.data, null, 2));
            setRequestSuccess(true);
          }

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
        setSqlRequest({
          ...sqlRequest,
          ...response.payload,
          query: sqlRequest.query,
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
            className="rounded-3xl border border-divider"
          />
        )}
      >
        <SqlAceEditor
          mode="pgsql"
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

SqlBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  connection: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default SqlBuilder;
