import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";

import VariableSettingsDrawer from "../../components/VariableSettingsDrawer";
import DataTransform from "../../containers/Dataset/DataTransform";
import {
  createVariableBinding,
  deleteVariableBinding,
  runDataRequest,
  selectDataRequests,
  updateVariableBinding,
} from "../../slices/dataset";
import { runSourceAction } from "../../slices/connection";
import { selectTeam } from "../../slices/team";
import { JiraBuilderProvider } from "./components/jira-builder-context";
import JiraConfigStep from "./components/jira-config-step";
import JiraPreviewStep from "./components/jira-preview-step";
import JiraResourceStep from "./components/jira-resource-step";
import JiraSummarySidebar from "./components/jira-summary-sidebar";
import {
  DATE_VARIABLES,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  MODE_OPTIONS,
  RESOURCE_OPTIONS,
  TRANSFORM_OPTIONS,
} from "./jira-builder.constants";
import {
  getDefaultDateRange,
  getDefaultsForResource,
  getPlaceholderVariableName,
  getPreviewColumns,
  getPreviewRows,
  mergeConfiguration,
  normalizeDateRangeValue,
  withVisualJql,
} from "./jira-builder.utils";

function getOptionLabel(options, value, fallback = "Not set") {
  const match = options.find((option) => (option.value || option.id) === value);
  return match?.label || fallback;
}

function JiraBuilder(props) {
  const {
    dataRequest, onChangeRequest, onSave, onDelete,
  } = props;

  const [jiraRequest, setJiraRequest] = useState(dataRequest || {});
  const [configuration, setConfiguration] = useState(mergeConfiguration(dataRequest));
  const [mode, setMode] = useState(configuration.mode || "visual");
  const [previewPayload, setPreviewPayload] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [showConfigPreview, setShowConfigPreview] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraBoards, setJiraBoards] = useState([]);
  const [jiraSprints, setJiraSprints] = useState([]);
  const [variableSettings, setVariableSettings] = useState(null);
  const [variableDatePart, setVariableDatePart] = useState(null);
  const [variableLoading, setVariableLoading] = useState(false);
  const [variableDeleteLoading, setVariableDeleteLoading] = useState(false);

  const params = useParams();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const connectionId = jiraRequest.connection_id
    || dataRequest.connection_id
    || dataRequest.Connection?.id
    || dataRequest.connection?.id;

  useEffect(() => {
    const nextRequest = {
      ...jiraRequest,
      method: "GET",
      route: null,
      pagination: true,
      items: configuration.resource === "sprint_issues" ? "issues" : "issues",
      itemsLimit: configuration.pagination?.maxRecords || 5000,
      offset: "startAt",
      paginationField: null,
      template: "jira",
      useGlobalHeaders: true,
      configuration: {
        ...configuration,
        mode,
      },
    };
    setJiraRequest(nextRequest);
    onChangeRequest(nextRequest);
  }, [configuration, mode]);

  useEffect(() => {
    if (!dataRequest?.id) return;

    const nextConfiguration = mergeConfiguration(dataRequest);
    setJiraRequest(dataRequest);
    setConfiguration(nextConfiguration);
    setMode(nextConfiguration.mode || "visual");
  }, [dataRequest?.id]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((item) => item.id === dataRequest.id);
      if (selectedResponse?.response) {
        setPreviewPayload(selectedResponse.response);
      }
    }
  }, [stateDrs, dataRequest.id]);

  const updateConfiguration = (updates) => {
    setConfiguration((current) => ({
      ...current,
      ...updates,
    }));
  };

  const updateVisual = (updates) => {
    setConfiguration((current) => withVisualJql(current, updates));
  };

  const getVariableBinding = (name) => {
    return [
      ...(jiraRequest.VariableBindings || []),
      ...(dataRequest.VariableBindings || []),
    ]
      .find((variableBinding) => variableBinding.name === name);
  };

  const getDatePickerValue = (datePart) => {
    const value = configuration.visual?.[datePart];
    const variableName = getPlaceholderVariableName(value);
    const defaultRange = getDefaultDateRange();
    const fallback = defaultRange[datePart];

    if (variableName) {
      return normalizeDateRangeValue(getVariableBinding(variableName)?.default_value, fallback);
    }

    return normalizeDateRangeValue(value, fallback);
  };

  const openDateVariableSettings = (datePart) => {
    const variableName = getPlaceholderVariableName(configuration.visual?.[datePart])
      || DATE_VARIABLES[datePart];
    const selectedVariable = getVariableBinding(variableName);

    setVariableDatePart(datePart);
    setVariableSettings(selectedVariable || {
      name: variableName,
      type: "date",
      default_value: getDatePickerValue(datePart),
      required: false,
    });
  };

  const onVariableSave = async () => {
    setVariableLoading(true);

    try {
      let currentRequest = jiraRequest;

      if (!currentRequest.id) {
        const savedRequest = await onSave(currentRequest);
        currentRequest = {
          ...currentRequest,
          ...(savedRequest?.payload || {}),
        };
        setJiraRequest(currentRequest);
      }

      let response;
      if (variableSettings.id) {
        response = await dispatch(updateVariableBinding({
          team_id: team.id,
          dataset_id: currentRequest.dataset_id,
          dataRequest_id: currentRequest.id,
          variable_id: variableSettings.id,
          data: variableSettings,
        }));
      } else {
        response = await dispatch(createVariableBinding({
          team_id: team.id,
          dataset_id: currentRequest.dataset_id,
          dataRequest_id: currentRequest.id,
          data: variableSettings,
        }));
      }

      if (response.payload) {
        setJiraRequest({
          ...currentRequest,
          ...response.payload,
          configuration,
        });
      }

      if (variableDatePart && variableSettings?.name) {
        updateVisual({ [variableDatePart]: `{{${variableSettings.name}}}` });
      }

      setVariableLoading(false);
      setVariableDatePart(null);
      setVariableSettings(null);
      toast.success("Variable saved successfully");
    } catch (error) {
      setVariableLoading(false);
      toast.error("Failed to save variable");
    }
  };

  const onVariableDelete = async () => {
    if (!variableSettings?.id) return;

    setVariableDeleteLoading(true);

    try {
      const response = await dispatch(deleteVariableBinding({
        team_id: team.id,
        dataset_id: jiraRequest.dataset_id,
        dataRequest_id: jiraRequest.id,
        variable_id: variableSettings.id,
      }));

      if (response.payload) {
        setJiraRequest({
          ...jiraRequest,
          ...response.payload,
          configuration,
        });
      }

      if (variableDatePart) {
        updateVisual({ [variableDatePart]: getDatePickerValue(variableDatePart) });
      }

      setVariableDeleteLoading(false);
      setVariableDatePart(null);
      setVariableSettings(null);
      toast.success("Variable deleted successfully");
    } catch (error) {
      setVariableDeleteLoading(false);
      toast.error("Failed to delete variable");
    }
  };

  const updateTransform = (updates) => {
    setConfiguration((current) => ({
      ...current,
      transform: {
        ...current.transform,
        ...updates,
      },
    }));
  };

  const runJiraAction = (action, actionParams = {}) => {
    if (!team?.id || !connectionId) return Promise.resolve([]);

    return dispatch(runSourceAction({
      team_id: team.id,
      connection_id: connectionId,
      action,
      params: actionParams,
    })).unwrap().then((result) => {
      if (Array.isArray(result)) return result;
      if (result?.error) throw new Error(result.error);
      return [];
    });
  };

  const loadProjects = () => {
    if (!team?.id || !connectionId) return;

    setMetadataLoading(true);
    runJiraAction("listProjects")
      .then((projects) => setJiraProjects(projects))
      .catch(() => toast.error("Could not load Jira projects."))
      .finally(() => setMetadataLoading(false));
  };

  const loadBoards = (projectKeyOrId = "") => {
    if (!team?.id || !connectionId) return;

    setMetadataLoading(true);
    runJiraAction("listBoards", {
      projectKeyOrId: projectKeyOrId || undefined,
      maxResults: 50,
    })
      .then((boards) => setJiraBoards(boards))
      .catch(() => toast.error("Could not load Jira boards."))
      .finally(() => setMetadataLoading(false));
  };

  const loadSprints = (boardId) => {
    if (!team?.id || !connectionId || !boardId) {
      setJiraSprints([]);
      return;
    }

    setMetadataLoading(true);
    runJiraAction("listSprints", {
      boardId,
      maxResults: 50,
      state: configuration.state || undefined,
    })
      .then((sprints) => setJiraSprints(sprints))
      .catch(() => toast.error("Could not load Jira sprints."))
      .finally(() => setMetadataLoading(false));
  };

  const selectResource = (resource) => {
    setConfiguration((current) => {
      const defaults = getDefaultsForResource(resource, current);
      return {
        ...current,
        ...defaults,
        fields: defaults.fields || current.fields,
        pagination: {
          ...current.pagination,
          ...(defaults.pagination || {}),
        },
        transform: {
          ...(defaults.transform || { type: "raw" }),
        },
      };
    });
    setMode("visual");
  };

  useEffect(() => {
    loadProjects();
    loadBoards();
  }, [team?.id, connectionId]);

  useEffect(() => {
    if (configuration.resource === "sprints" || configuration.resource === "sprint_issues") {
      loadSprints(configuration.boardId);
    }
  }, [configuration.resource, configuration.boardId, configuration.state]);

  const saveConfiguration = () => {
    setSaveLoading(true);
    onSave(jiraRequest)
      .then(() => setSaveLoading(false))
      .catch(() => setSaveLoading(false));
  };

  const testRequest = () => {
    setRequestLoading(true);
    onSave(jiraRequest).then((savedRequest) => {
      dispatch(runDataRequest({
        team_id: team?.id,
        dataset_id: savedRequest?.payload?.dataset_id || jiraRequest.dataset_id,
        dataRequest_id: savedRequest?.payload?.id || jiraRequest.id,
        getCache: false,
      }))
        .then((data) => {
          const response = data.payload?.response?.dataRequest?.responseData;
          const payload = response || data.payload;
          setPreviewPayload(payload);
          setRequestLoading(false);
        })
        .catch((error) => {
          toast.error("The Jira request failed. Please check your configuration.");
          setPreviewPayload(error);
          setRequestLoading(false);
        });
    }).catch((error) => {
      toast.error("The Jira request could not be saved before testing.");
      setPreviewPayload(error);
      setRequestLoading(false);
    });
  };

  const previewRows = useMemo(() => getPreviewRows(previewPayload), [previewPayload]);
  const previewColumns = useMemo(() => getPreviewColumns(previewPayload), [previewPayload]);
  const previewSummary = previewRows.length > 0 ? `${previewRows.length} rows` : "Run preview";
  const hasPreviewResult = previewPayload !== null;
  const previewFallback = hasPreviewResult ? JSON.stringify(previewPayload, null, 2) : "";
  const modeLabel = getOptionLabel(MODE_OPTIONS, mode, mode);
  const resourceLabel = getOptionLabel(RESOURCE_OPTIONS, configuration.resource, configuration.resource);
  const transformLabel = getOptionLabel(
    TRANSFORM_OPTIONS,
    configuration.transform?.type || "raw",
    configuration.transform?.type || "Raw table",
  );
  const groupByLabel = getOptionLabel(
    GROUP_BY_OPTIONS,
    configuration.transform?.groupBy || "status",
    configuration.transform?.groupBy || "Status",
  );
  const metricLabel = getOptionLabel(
    METRIC_OPTIONS,
    configuration.transform?.metric || "count",
    configuration.transform?.metric || "Count issues",
  );

  const contextValue = {
    configuration,
    getDatePickerValue,
    groupByLabel,
    hasPreviewResult,
    metricLabel,
    mode,
    modeLabel,
    metadataLoading,
    onDelete,
    previewColumns,
    previewFallback,
    previewRows,
    previewSummary,
    requestLoading,
    resourceLabel,
    saveConfiguration,
    saveLoading,
    selectResource,
    jiraBoards,
    jiraProjects,
    jiraSprints,
    loadBoards,
    loadSprints,
    setMode,
    setShowConfigPreview,
    setShowTransform,
    openDateVariableSettings,
    showConfigPreview,
    showTransform,
    testRequest,
    transformLabel,
    updateConfiguration,
    updateTransform,
    updateVisual,
  };

  return (
    <JiraBuilderProvider value={contextValue}>
      <div className="grid grid-cols-12 gap-5 px-2 pb-5 lg:px-4">
        <div className="col-span-12 flex flex-col gap-5 xl:col-span-8 2xl:col-span-9">
          <JiraResourceStep />
          <JiraConfigStep />
          <JiraPreviewStep />
        </div>

        <JiraSummarySidebar />

        {showTransform && (
          <DataTransform
            isOpen={showTransform}
            onClose={() => setShowTransform(false)}
            initialTransform={jiraRequest.transform}
            onSave={(transform) => {
              setJiraRequest({ ...jiraRequest, transform });
              onChangeRequest({ ...jiraRequest, transform });
            }}
          />
        )}

        <VariableSettingsDrawer
          variable={variableSettings}
          onClose={() => {
            setVariableDatePart(null);
            setVariableSettings(null);
          }}
          onPatch={(patch) => setVariableSettings((variable) => (variable ? { ...variable, ...patch } : variable))}
          onSave={onVariableSave}
          onDelete={onVariableDelete}
          savePending={variableLoading}
          deletePending={variableDeleteLoading}
        />
      </div>
    </JiraBuilderProvider>
  );
}

JiraBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default JiraBuilder;
