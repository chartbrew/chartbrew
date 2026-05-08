import React, {
  useEffect, useMemo, useRef, useState,
} from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";

import DataTransform from "../../containers/Dataset/DataTransform";
import VariableSettingsDrawer from "../../components/VariableSettingsDrawer";
import {
  createVariableBinding,
  deleteVariableBinding,
  runDataRequest,
  selectDataRequests,
  updateVariableBinding,
} from "../../slices/dataset";
import { selectTeam } from "../../slices/team";
import {
  COMPILED_METRIC_OPTIONS,
  DATE_VARIABLES,
  DIMENSION_OPTIONS,
  INTERVAL_OPTIONS,
  PREVIEW_ROW_LIMIT,
  RESOURCE_LABELS,
  RESOURCE_METRICS,
} from "./stripeOfficial-builder.constants";
import {
  findLabel,
  formatMaxRecords,
  getDefaultDateRange,
  getDefaultFilter,
  getFilterDefinition,
  getPlaceholderVariableName,
  getPreviewColumns,
  getPreviewRecordsProcessed,
  getPreviewRows,
  getPreviewWarnings,
  getSelectedCategory,
  isSearchSupported,
  mergeConfiguration,
  normalizeDateRangeValue,
  sanitizeExpandForResource,
  sanitizeFiltersForResource,
  serializeMetric,
} from "./stripeOfficial-builder.utils";
import { StripeOfficialBuilderProvider } from "./components/stripeOfficial-builder-context";
import StripeOfficialCategoryStep from "./components/stripeOfficial-category-step";
import StripeOfficialConfigStep from "./components/stripeOfficial-config-step";
import StripeOfficialOutputModeSelector from "./components/stripeOfficial-output-mode-selector";
import StripeOfficialPreviewStep from "./components/stripeOfficial-preview-step";
import StripeOfficialSummarySidebar from "./components/stripeOfficial-summary-sidebar";

function StripeOfficialBuilder(props) {
  const {
    dataRequest, onChangeRequest, onSave, onDelete,
  } = props;

  const [stripeRequest, setStripeRequest] = useState(dataRequest || {});
  const [configuration, setConfiguration] = useState(mergeConfiguration(dataRequest));
  const [result, setResult] = useState("");
  const [previewPayload, setPreviewPayload] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [showConfigPreview, setShowConfigPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [variableSettings, setVariableSettings] = useState(null);
  const [variableDatePart, setVariableDatePart] = useState(null);
  const [variableLoading, setVariableLoading] = useState(false);
  const [variableDeleteLoading, setVariableDeleteLoading] = useState(false);
  const hydratedRequestRef = useRef({ id: null, signature: null });

  const params = useParams();
  const dispatch = useDispatch();
  const team = useSelector(selectTeam);
  const stateDrs = useSelector((state) => selectDataRequests(state, params.datasetId));
  const dataRequestConfigurationSignature = useMemo(() => {
    return JSON.stringify(dataRequest?.configuration || {});
  }, [dataRequest?.configuration]);

  const selectedCategory = useMemo(() => {
    return getSelectedCategory(configuration);
  }, [configuration]);

  const metricOptions = useMemo(() => {
    return RESOURCE_METRICS[configuration.resource] || RESOURCE_METRICS.balance_transactions;
  }, [configuration.resource]);

  useEffect(() => {
    const nextRequest = {
      ...stripeRequest,
      method: "GET",
      route: null,
      pagination: true,
      items: "data",
      itemsLimit: configuration.pagination?.maxRecords || 5000,
      offset: "starting_after",
      template: "stripeOfficial",
      useGlobalHeaders: true,
      configuration,
    };
    setStripeRequest(nextRequest);
    onChangeRequest(nextRequest);
  }, [configuration]);

  useEffect(() => {
    if (stateDrs && stateDrs.length > 0) {
      const selectedResponse = stateDrs.find((item) => item.id === dataRequest.id);
      if (selectedResponse?.response) {
        const response = selectedResponse.response;
        setPreviewPayload(response);
        setResult(JSON.stringify(response, null, 2));
      }
    }
  }, [stateDrs, dataRequest.id]);

  useEffect(() => {
    if (!dataRequest?.id) return;

    const requestId = String(dataRequest.id);
    if (
      hydratedRequestRef.current.id === requestId
      && hydratedRequestRef.current.signature === dataRequestConfigurationSignature
    ) {
      return;
    }

    const previousRequestId = hydratedRequestRef.current.id;
    const nextConfiguration = mergeConfiguration(dataRequest);

    hydratedRequestRef.current = {
      id: requestId,
      signature: dataRequestConfigurationSignature,
    };
    setStripeRequest(dataRequest);
    setConfiguration(nextConfiguration);

    if (previousRequestId && previousRequestId !== requestId) {
      setPreviewPayload(null);
      setResult("");
    }
  }, [dataRequest, dataRequestConfigurationSignature]);

  const updateConfiguration = (updates) => {
    setConfiguration({
      ...configuration,
      ...updates,
    });
  };

  const updateDateRange = (updates) => {
    setConfiguration({
      ...configuration,
      dateRange: {
        ...configuration.dateRange,
        ...updates,
      },
    });
  };

  const getVariableBinding = (name) => {
    return [
      ...(stripeRequest.VariableBindings || []),
      ...(dataRequest.VariableBindings || []),
    ]
      .find((variableBinding) => variableBinding.name === name);
  };

  const getDatePickerValue = (datePart) => {
    const value = configuration.dateRange?.[datePart];
    const variableName = getPlaceholderVariableName(value);
    const defaultRange = getDefaultDateRange();
    const fallback = defaultRange[datePart];

    if (variableName) {
      return normalizeDateRangeValue(getVariableBinding(variableName)?.default_value, fallback);
    }

    return normalizeDateRangeValue(value, fallback);
  };

  const openDateVariableSettings = (datePart) => {
    const variableName = getPlaceholderVariableName(configuration.dateRange?.[datePart])
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
      let currentRequest = stripeRequest;

      if (!currentRequest.id) {
        const savedRequest = await onSave(currentRequest);
        currentRequest = {
          ...currentRequest,
          ...(savedRequest?.payload || {}),
        };
        setStripeRequest(currentRequest);
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
        setStripeRequest({
          ...currentRequest,
          ...response.payload,
          configuration,
        });
      }

      if (variableDatePart && variableSettings?.name) {
        updateDateRange({ [variableDatePart]: `{{${variableSettings.name}}}` });
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
        dataset_id: stripeRequest.dataset_id,
        dataRequest_id: stripeRequest.id,
        variable_id: variableSettings.id,
      }));

      if (response.payload) {
        setStripeRequest({
          ...stripeRequest,
          ...response.payload,
          configuration,
        });
      }

      if (variableDatePart) {
        updateDateRange({ [variableDatePart]: getDatePickerValue(variableDatePart) });
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

  const updatePagination = (updates) => {
    setConfiguration({
      ...configuration,
      pagination: {
        ...configuration.pagination,
        ...updates,
      },
    });
  };

  const updateFilterAt = (index, updates) => {
    const filters = [...(configuration.filters || [])];
    const currentFilter = filters[index] || getDefaultFilter(configuration.resource);
    const updatedField = updates.field === "metadata.*" ? "metadata." : updates.field;
    const nextFilter = {
      ...currentFilter,
      ...updates,
      ...(updatedField ? { field: updatedField } : {}),
    };
    const definition = getFilterDefinition(configuration.resource, nextFilter.field);

    if (definition && updates.field) {
      nextFilter.operator = definition.operators.includes(nextFilter.operator)
        ? nextFilter.operator
        : definition.operators[0] || "is";
      nextFilter.value = definition.type === "boolean" ? true : "";
    }

    filters[index] = nextFilter;
    updateConfiguration({ filters });
  };

  const updateMetadataFilterKey = (index, key) => {
    updateFilterAt(index, { field: key ? `metadata.${key}` : "metadata." });
  };

  const toggleExpandField = (field, isSelected) => {
    const nextExpand = new Set(configuration.expand || []);
    if (isSelected) {
      nextExpand.add(field);
    } else {
      nextExpand.delete(field);
    }
    updateConfiguration({ expand: Array.from(nextExpand) });
  };

  const toggleSearchMode = (isSelected) => {
    updateConfiguration({
      queryMode: isSelected ? "search" : "list",
      searchQuery: isSelected ? configuration.searchQuery || "" : "",
    });
  };

  const addFilter = () => {
    const filter = getDefaultFilter(configuration.resource);
    if (!filter) return;
    updateConfiguration({ filters: [...(configuration.filters || []), filter] });
  };

  const removeFilterAt = (index) => {
    updateConfiguration({
      filters: (configuration.filters || []).filter((_, filterIndex) => filterIndex !== index),
    });
  };

  const selectCategory = (category) => {
    if (category.defaultResource.startsWith("compiled_metric:")) {
      const compiledMetric = category.defaultResource.split(":")[1];
      updateConfiguration({
        mode: "compiled_metric",
        compiledMetric,
        queryMode: "list",
        searchQuery: "",
        expand: [],
        filters: [],
        dimension: {
          field: "period",
          type: "date",
          interval: "month",
        },
        currency: "auto",
      });
      return;
    }

    const nextMetric = (RESOURCE_METRICS[category.defaultResource] || [])[0] || { operation: "count" };
    const nextMode = configuration.mode === "raw" ? "raw" : "aggregate";
    updateConfiguration({
      mode: nextMode,
      resource: category.defaultResource,
      compiledMetric: null,
      metric: nextMetric,
      filters: sanitizeFiltersForResource(configuration.filters || [], category.defaultResource),
      expand: sanitizeExpandForResource(configuration.expand || [], category.defaultResource),
      queryMode: isSearchSupported(category.defaultResource) ? configuration.queryMode : "list",
      searchQuery: isSearchSupported(category.defaultResource) ? configuration.searchQuery : "",
      dimension: {
        ...configuration.dimension,
        field: "created",
        type: "date",
      },
    });
  };

  const selectQuickStart = (quickStart) => {
    const isCompiledQuickStart = quickStart.configuration.mode === "compiled_metric";
    setConfiguration({
      ...configuration,
      ...quickStart.configuration,
      metric: quickStart.configuration.metric || configuration.metric,
      dimension: quickStart.configuration.dimension || configuration.dimension,
      filters: isCompiledQuickStart ? [] : quickStart.configuration.filters || configuration.filters || [],
      expand: isCompiledQuickStart
        ? []
        : sanitizeExpandForResource(quickStart.configuration.expand || configuration.expand || [], quickStart.configuration.resource || configuration.resource),
      queryMode: quickStart.configuration.queryMode || "list",
      searchQuery: quickStart.configuration.searchQuery || "",
    });
  };

  const selectCompiledMetric = (compiledMetric) => {
    updateConfiguration({
      mode: "compiled_metric",
      compiledMetric,
      queryMode: "list",
      searchQuery: "",
      expand: [],
      filters: [],
      dimension: {
        field: compiledMetric === "net_cash_flow" ? "created" : "period",
        type: "date",
        interval: configuration.dimension?.interval || "month",
      },
      currency: configuration.currency || "auto",
    });
  };

  const saveConfiguration = () => {
    setSaveLoading(true);
    onSave(stripeRequest)
      .then(() => setSaveLoading(false))
      .catch(() => setSaveLoading(false));
  };

  const testRequest = () => {
    setRequestLoading(true);
    onSave(stripeRequest).then((savedRequest) => {
      dispatch(runDataRequest({
        team_id: team?.id,
        dataset_id: savedRequest?.payload?.dataset_id || stripeRequest.dataset_id,
        dataRequest_id: savedRequest?.payload?.id || stripeRequest.id,
        getCache: false,
      }))
        .then((data) => {
          const response = data.payload?.response?.dataRequest?.responseData;
          const payload = response || data.payload;
          setPreviewPayload(payload);
          setResult(JSON.stringify(payload, null, 2));
          setRequestLoading(false);
        })
        .catch((error) => {
          toast.error("The Stripe request failed. Please check your configuration.");
          setPreviewPayload(error);
          setResult(JSON.stringify(error, null, 2));
          setRequestLoading(false);
        });
    }).catch((error) => {
      toast.error("The Stripe request could not be saved before testing.");
      setPreviewPayload(error);
      setResult(JSON.stringify(error, null, 2));
      setRequestLoading(false);
    });
  };

  const selectedMetric = serializeMetric(configuration.metric || {});
  const selectedDimension = configuration.dimension?.field || "created";
  const selectedInterval = configuration.dimension?.interval || "day";
  const searchSupported = configuration.mode !== "compiled_metric" && isSearchSupported(configuration.resource);
  const compiledMetricOption = COMPILED_METRIC_OPTIONS.find((option) => option.value === configuration.compiledMetric);
  const outputLabel = configuration.mode === "raw"
    ? "Raw table rows"
    : configuration.mode === "compiled_metric" ? "Compiled business metric" : "Aggregated chart data";
  const metricLabel = configuration.mode === "raw"
    ? "Records"
    : configuration.mode === "compiled_metric"
      ? compiledMetricOption?.label || "Compiled metric"
      : findLabel(metricOptions.map((metric) => ({
        value: serializeMetric(metric),
        label: metric.label,
      })), selectedMetric);
  const dimensionLabel = configuration.mode === "raw"
    ? "Latest first"
    : configuration.mode === "compiled_metric"
      ? "Period"
      : findLabel(DIMENSION_OPTIONS, selectedDimension);
  const intervalLabel = configuration.mode === "raw"
    ? ""
    : findLabel(INTERVAL_OPTIONS, selectedInterval);
  const activeFilterCount = (configuration.filters || []).filter((filter) => filter.value || filter.value === true).length;
  const previewRows = useMemo(() => getPreviewRows(previewPayload), [previewPayload]);
  const previewColumns = useMemo(() => getPreviewColumns(previewRows), [previewRows]);
  const previewWarnings = useMemo(() => getPreviewWarnings(previewPayload), [previewPayload]);
  const previewRecordsProcessed = getPreviewRecordsProcessed(previewPayload);
  const previewSummary = previewRows.length > 0
    ? `${Math.min(previewRows.length, PREVIEW_ROW_LIMIT)} of ${formatMaxRecords(previewRows.length)} rows`
    : "Run test";
  const sourceLabel = configuration.mode === "compiled_metric"
    ? compiledMetricOption?.label || "Compiled metric"
    : RESOURCE_LABELS[configuration.resource] || configuration.resource;

  const contextValue = {
    activeFilterCount,
    addFilter,
    configuration,
    dimensionLabel,
    getDatePickerValue,
    intervalLabel,
    metricLabel,
    metricOptions,
    onDelete,
    openDateVariableSettings,
    outputLabel,
    previewColumns,
    previewRecordsProcessed,
    previewRows,
    previewSummary,
    previewWarnings,
    removeFilterAt,
    requestLoading,
    result,
    saveConfiguration,
    saveLoading,
    searchSupported,
    selectedCategory,
    selectedDimension,
    selectedInterval,
    selectedMetric,
    selectCategory,
    selectCompiledMetric,
    selectQuickStart,
    setShowAdvanced,
    setShowConfigPreview,
    setShowTransform,
    showAdvanced,
    showConfigPreview,
    showTransform,
    sourceLabel,
    testRequest,
    toggleExpandField,
    toggleSearchMode,
    updateConfiguration,
    updateDateRange,
    updateFilterAt,
    updateMetadataFilterKey,
    updatePagination,
  };

  return (
    <StripeOfficialBuilderProvider value={contextValue}>
      <div className="grid grid-cols-12 gap-5 px-2 pb-5 lg:px-4">
        <div className="col-span-12 flex flex-col gap-5 xl:col-span-8 2xl:col-span-9">
          <StripeOfficialOutputModeSelector />
          <StripeOfficialCategoryStep />
          <StripeOfficialConfigStep />
          <StripeOfficialPreviewStep />
        </div>

        <StripeOfficialSummarySidebar />

        {showTransform && (
          <DataTransform
            isOpen={showTransform}
            onClose={() => setShowTransform(false)}
            initialTransform={stripeRequest.transform}
            onSave={(transform) => {
              setStripeRequest({ ...stripeRequest, transform });
              onChangeRequest({ ...stripeRequest, transform });
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
    </StripeOfficialBuilderProvider>
  );
}

StripeOfficialBuilder.propTypes = {
  dataRequest: PropTypes.object.isRequired,
  onChangeRequest: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default StripeOfficialBuilder;
