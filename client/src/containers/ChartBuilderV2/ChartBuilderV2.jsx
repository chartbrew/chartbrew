import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Autocomplete, AutocompleteItem, Button, Card, CardBody, Chip, Divider, Input,
  Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem,
  Spacer, Switch,
} from "@heroui/react";
import {
  LuArrowLeft, LuArrowRight, LuChartColumn, LuChartNoAxesColumnIncreasing,
  LuChartPie, LuDatabase, LuLayoutDashboard, LuPlus, LuSave, LuSearch, LuTrash, LuWorkflow,
} from "react-icons/lu";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import moment from "moment";

import {
  createCdc,
  getChartForAuthoring,
  publishChart,
  quickCreateChart,
  removeCdc,
  runQuery,
  selectChart,
  updateChart,
  updateCdc,
} from "../../slices/chart";
import { getProjects, selectProjects } from "../../slices/project";
import { getDatasets, selectDatasets, selectDatasetsNoDrafts } from "../../slices/dataset";
import { getTeamConnections, selectConnections } from "../../slices/connection";
import { selectTeam } from "../../slices/team";
import { chartColors } from "../../config/colors";
import { getDefaultAggregation, getMetricAggregationOptions } from "../../modules/datasetFieldMetadata";
import { getDatasetDisplayName } from "../../modules/getDatasetDisplayName";
import {
  buildDefaultVizConfig,
  getDatasetFieldCatalog,
  getDefaultDimensionField,
  getDefaultMetricField,
  getDimensionFieldOptions,
  getDefaultTimeInterval,
  getMetricFieldOptions,
  isSyntheticMetricFieldId,
  isVisualizationV2Chart,
  V2_CHART_TYPE_OPTIONS,
} from "../../modules/visualizationV2";
import {
  buildChartBuilderUrl,
  buildDatasetEditorUrl,
} from "../../modules/chartAuthoringNavigation";
import V2AdvancedSettings from "./components/V2AdvancedSettings";
import V2QuestionFilters from "./components/V2QuestionFilters";
import V2ChartCanvas from "./components/V2ChartCanvas";

const CHART_TYPE_ICONS = {
  bar: LuChartColumn,
  line: LuChartNoAxesColumnIncreasing,
  pie: LuChartPie,
  doughnut: LuChartPie,
  radar: LuChartNoAxesColumnIncreasing,
  polar: LuChartPie,
  table: LuChartColumn,
  kpi: LuChartNoAxesColumnIncreasing,
  avg: LuChartNoAxesColumnIncreasing,
  gauge: LuChartColumn,
};

const SORT_OPTIONS = [{
  key: "none",
  label: "None",
}, {
  key: "asc",
  label: "Ascending",
}, {
  key: "desc",
  label: "Descending",
}];

const TIME_INTERVAL_OPTIONS = [{
  key: "hour",
  label: "Hour",
}, {
  key: "day",
  label: "Day",
}, {
  key: "week",
  label: "Week",
}, {
  key: "month",
  label: "Month",
}, {
  key: "year",
  label: "Year",
}];

const X_LABEL_TICK_OPTIONS = [{
  key: "default",
  label: "Default",
}, {
  key: "showAll",
  label: "Show all",
}, {
  key: "half",
  label: "Half",
}, {
  key: "third",
  label: "Third",
}, {
  key: "fourth",
  label: "Fourth",
}];

function getChartColorByIndex(index = 0) {
  const colorValues = Object.values(chartColors);
  return colorValues[index % colorValues.length]?.hex || chartColors.blue.hex;
}

function buildBuilderState(chart, dataset, cdc = {}) {
  const vizConfig = cdc?.vizConfig || {};
  const primaryDimension = Array.isArray(vizConfig.dimensions)
    ? (vizConfig.dimensions.find((dimension) => dimension?.role === "x" || dimension?.role === "table") || vizConfig.dimensions[0])
    : null;
  const primaryMetric = Array.isArray(vizConfig.metrics)
    ? (vizConfig.metrics.find((metric) => metric?.enabled !== false) || vizConfig.metrics[0])
    : null;

  return {
    metricFieldId: primaryMetric?.fieldId || getDefaultMetricField(dataset)?.id || "",
    dimensionFieldId: primaryDimension?.fieldId || getDefaultDimensionField(dataset)?.id || "",
    aggregation: primaryMetric?.aggregation || getDefaultMetricField(dataset)?.aggregation || "sum",
    filters: Array.isArray(vizConfig.filters) ? vizConfig.filters : [],
    sortDirection: vizConfig.sort?.[0]?.dir || cdc.sort || "none",
    limit: vizConfig.limit || cdc.maxRecords || "",
    chartType: chart?.type || "line",
    timeInterval: chart?.timeInterval || primaryDimension?.grain || getDefaultTimeInterval(dataset),
    displayLegend: chart?.displayLegend === true,
    dataLabels: chart?.dataLabels === true,
    includeZeros: chart?.includeZeros !== false,
    xLabelTicks: chart?.xLabelTicks || "default",
    defaultRowsPerPage: chart?.defaultRowsPerPage || 10,
  };
}

function getDatasetSourceLabel(dataset = {}) {
  const sources = (dataset?.DataRequests || [])
    .map((request) => request?.Connection?.subType || request?.Connection?.type || request?.Connection?.name)
    .filter(Boolean);

  return [...new Set(sources)].join(", ") || "Unknown source";
}

function ChartBuilderV2() {
  const [startMode, setStartMode] = useState("start");
  const [datasetSearch, setDatasetSearch] = useState("");
  const [creatingDatasetId, setCreatingDatasetId] = useState(null);
  const [creatingNewDataset, setCreatingNewDataset] = useState(false);
  const [activeCdcId, setActiveCdcId] = useState(null);
  const [builderState, setBuilderState] = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [destinationProjectId, setDestinationProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [addDatasetModalOpen, setAddDatasetModalOpen] = useState(false);
  const [addDatasetSearch, setAddDatasetSearch] = useState("");
  const [addingDatasetId, setAddingDatasetId] = useState(null);
  const [removingCdcId, setRemovingCdcId] = useState(null);

  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const chart = useSelector((state) => selectChart(state, params.chartId));
  const datasets = useSelector(selectDatasetsNoDrafts);
  const allDatasets = useSelector(selectDatasets);
  const projects = useSelector(selectProjects);
  const connections = useSelector(selectConnections);
  const team = useSelector(selectTeam);

  const searchParams = new URLSearchParams(location.search);
  const requestedDatasetId = searchParams.get("dataset_id");
  const requestedProjectId = searchParams.get("project_id") || "";
  const ghostProject = projects.find((project) => project.ghost);
  const loadedChartRef = useRef(false);
  const autoCreateRef = useRef(false);

  const chartDatasetConfigs = useMemo(() => {
    if (!Array.isArray(chart?.ChartDatasetConfigs)) {
      return [];
    }

    return [...chart.ChartDatasetConfigs].sort((left, right) => (left?.order || 0) - (right?.order || 0));
  }, [chart?.ChartDatasetConfigs]);
  const cdc = chartDatasetConfigs.find((item) => `${item.id}` === `${activeCdcId}`)
    || chartDatasetConfigs[0]
    || null;
  const dataset = cdc?.Dataset
    || allDatasets.find((item) => `${item.id}` === `${cdc?.dataset_id}`);
  const fieldCatalog = getDatasetFieldCatalog(dataset);
  const metricOptions = getMetricFieldOptions(dataset);
  const availableProjects = projects.filter((project) => !project.ghost);
  const selectedDestinationProject = availableProjects.find((project) => `${project.id}` === `${destinationProjectId}`);
  const destinationLabel = availableProjects.find((project) => `${project.id}` === `${requestedProjectId}`)?.name;
  const datasetEditorUrl = dataset?.id
    ? buildDatasetEditorUrl(dataset.id, {
      chartFlow: "v2",
      chartId: chart?.id || "",
      projectId: requestedProjectId || (!chart?.draft ? chart?.project_id : ""),
      returnTo: "chart",
    })
    : null;

  const recentDatasets = useMemo(() => {
    const searchValue = datasetSearch.trim().toLowerCase();

    return [...datasets]
      .filter((item) => {
        if (!searchValue) {
          return true;
        }

        const haystack = [
          getDatasetDisplayName(item),
          getDatasetSourceLabel(item),
        ].join(" ").toLowerCase();

        return haystack.includes(searchValue);
      })
      .sort((left, right) => {
        return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
      })
      .slice(0, startMode === "browse" ? 30 : 6);
  }, [datasetSearch, datasets, startMode]);

  const addDatasetOptions = useMemo(() => {
    const attachedDatasetIds = new Set(chartDatasetConfigs.map((item) => `${item.dataset_id}`));
    const searchValue = addDatasetSearch.trim().toLowerCase();

    return [...datasets]
      .filter((item) => !attachedDatasetIds.has(`${item.id}`))
      .filter((item) => {
        if (!searchValue) {
          return true;
        }

        const haystack = [
          getDatasetDisplayName(item),
          getDatasetSourceLabel(item),
        ].join(" ").toLowerCase();

        return haystack.includes(searchValue);
      })
      .sort((left, right) => {
        return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
      });
  }, [addDatasetSearch, chartDatasetConfigs, datasets]);

  useEffect(() => {
    if (!team?.id) {
      return;
    }

    dispatch(getProjects({ team_id: team.id }));
    dispatch(getDatasets({ team_id: team.id }));
    dispatch(getTeamConnections({ team_id: team.id }));
  }, [dispatch, team?.id]);

  useEffect(() => {
    if (!params.chartId || chart || loadedChartRef.current) {
      return;
    }

    loadedChartRef.current = true;
    dispatch(getChartForAuthoring({ chart_id: params.chartId }))
      .unwrap()
      .catch(() => {
        toast.error("Could not load the chart builder.");
      });
  }, [chart, dispatch, params.chartId]);

  useEffect(() => {
    if (!chart) {
      return;
    }

    if (!activeCdcId || !chartDatasetConfigs.some((item) => `${item.id}` === `${activeCdcId}`)) {
      setActiveCdcId(chartDatasetConfigs[0]?.id || null);
    }
  }, [activeCdcId, chart, chartDatasetConfigs]);

  useEffect(() => {
    if (!chart) {
      return;
    }

    if (!isVisualizationV2Chart(chart)) {
      navigate(`/dashboard/${chart.project_id}/chart/${chart.id}/edit`, { replace: true });
      return;
    }

    setPublishName(chart.name || "");

    if (chart.draft) {
      setDestinationProjectId((currentValue) => currentValue || requestedProjectId);
    } else {
      setDestinationProjectId(`${chart.project_id}`);
    }

    if (cdc && dataset) {
      setBuilderState(buildBuilderState(chart, dataset, cdc));
    }
  }, [cdc, chart, chartDatasetConfigs, dataset, navigate, requestedProjectId]);

  useEffect(() => {
    if (params.chartId || !requestedDatasetId || autoCreateRef.current || !ghostProject?.id) {
      return;
    }

    const requestedDataset = allDatasets.find((item) => `${item.id}` === `${requestedDatasetId}`);
    if (!requestedDataset) {
      return;
    }

    autoCreateRef.current = true;
    _onCreateFromDataset(requestedDataset);
  }, [allDatasets, ghostProject?.id, params.chartId, requestedDatasetId]);

  const _buildQuickCreatePayload = (selectedDataset) => {
    const dimensionField = getDefaultDimensionField(selectedDataset);
    const metricField = getDefaultMetricField(selectedDataset);
    const chartType = dimensionField?.type === "date" ? "line" : "bar";
    const timeInterval = getDefaultTimeInterval(selectedDataset);

    return {
      name: getDatasetDisplayName(selectedDataset),
      type: chartType,
      subType: "timeseries",
      timeInterval,
      includeZeros: true,
      draft: true,
      chartDatasetConfigs: [{
        dataset_id: selectedDataset.id,
        datasetColor: getChartColorByIndex(chartDatasetConfigs.length),
        fill: false,
        order: 1,
        legend: getDatasetDisplayName(selectedDataset),
        vizVersion: 2,
        vizConfig: buildDefaultVizConfig({
          dataset: selectedDataset,
          chartType,
          dimensionFieldId: dimensionField?.id,
          metricFieldId: metricField?.id,
          aggregation: metricField?.aggregation,
          display: {
            displayLegend: false,
            includeZeros: true,
            xLabelTicks: "default",
            timeInterval,
          },
        }),
      }],
    };
  };

  const _refreshPreview = async (targetChart = chart) => {
    if (!targetChart?.id || !targetChart?.project_id) {
      return;
    }

    await dispatch(runQuery({
      project_id: targetChart.project_id,
      chart_id: targetChart.id,
      noSource: false,
      skipParsing: false,
      getCache: false,
    })).unwrap();
  };

  const _reloadAuthoringChart = async (chartId = chart?.id) => {
    if (!chartId) {
      return null;
    }

    return dispatch(getChartForAuthoring({ chart_id: chartId })).unwrap();
  };

  const _onCreateFromDataset = async (selectedDataset) => {
    if (!ghostProject?.id) {
      toast.error("The temporary chart workspace is not ready yet.");
      return;
    }

    setCreatingDatasetId(selectedDataset.id);
    try {
      const createdChart = await dispatch(quickCreateChart({
        project_id: ghostProject.id,
        data: _buildQuickCreatePayload(selectedDataset),
      })).unwrap();

      try {
        await _refreshPreview(createdChart);
      } catch (error) {
        // The builder can recover from an empty first preview.
      }

      navigate(buildChartBuilderUrl(createdChart.id, {
        projectId: requestedProjectId,
      }));
    } catch (error) {
      toast.error("Could not create the chart draft.");
      autoCreateRef.current = false;
    } finally {
      setCreatingDatasetId(null);
    }
  };

  const _onCreateFromConnection = () => {
    if (connections.length === 0) {
      navigate("/connections/new");
      return;
    }

    setCreatingNewDataset(true);
    const nextUrl = buildDatasetEditorUrl("new", {
      chartFlow: "v2",
      destinationProjectId: requestedProjectId,
    });
    navigate(nextUrl);
  };

  const _buildAdditionalCdcPayload = (selectedDataset) => {
    const dimensionField = getDefaultDimensionField(selectedDataset);
    const metricField = getDefaultMetricField(selectedDataset);
    const timeInterval = getDefaultTimeInterval(selectedDataset);

    return {
      dataset_id: selectedDataset.id,
      datasetColor: chartColors.blue.hex,
      fill: false,
      order: chartDatasetConfigs.length + 1,
      legend: getDatasetDisplayName(selectedDataset),
      vizVersion: 2,
      vizConfig: buildDefaultVizConfig({
        dataset: selectedDataset,
        chartType: chart?.type || "bar",
        dimensionFieldId: dimensionField?.id,
        metricFieldId: metricField?.id,
        aggregation: metricField?.aggregation,
        display: {
          displayLegend: chart?.displayLegend,
          dataLabels: chart?.dataLabels,
          includeZeros: chart?.includeZeros !== false,
          xLabelTicks: chart?.xLabelTicks || "default",
          timeInterval,
          defaultRowsPerPage: chart?.defaultRowsPerPage || 10,
        },
      }),
    };
  };

  const _onAddDatasetToChart = async (selectedDataset) => {
    if (!chart?.id || !chart?.project_id) {
      return;
    }

    setAddingDatasetId(selectedDataset.id);
    try {
      const createdCdc = await dispatch(createCdc({
        project_id: chart.project_id,
        chart_id: chart.id,
        data: _buildAdditionalCdcPayload(selectedDataset),
      })).unwrap();

      if (!chart.displayLegend && chart.type !== "table" && chart.type !== "kpi" && chart.type !== "avg" && chart.type !== "gauge") {
        await dispatch(updateChart({
          project_id: chart.project_id,
          chart_id: chart.id,
          data: {
            displayLegend: true,
          },
        })).unwrap();
      }

      await _reloadAuthoringChart(chart.id);
      setActiveCdcId(createdCdc.id);
      setAddDatasetModalOpen(false);
      setAddDatasetSearch("");

      try {
        await _refreshPreview();
      } catch (error) {
        // The builder can recover from an empty first preview for a new dataset.
      }
    } catch (error) {
      toast.error("Could not attach the dataset to this chart.");
    } finally {
      setAddingDatasetId(null);
    }
  };

  const _onRemoveDatasetFromChart = async (targetCdc) => {
    if (!chart?.id || !chart?.project_id || !targetCdc?.id || chartDatasetConfigs.length <= 1) {
      return;
    }

    setRemovingCdcId(targetCdc.id);
    try {
      await dispatch(removeCdc({
        project_id: chart.project_id,
        chart_id: chart.id,
        cdc_id: targetCdc.id,
      })).unwrap();

      const refreshedChart = await _reloadAuthoringChart(chart.id);
      const remainingCdcs = Array.isArray(refreshedChart?.ChartDatasetConfigs) ? refreshedChart.ChartDatasetConfigs : [];
      const nextCdc = remainingCdcs.find((item) => `${item.id}` !== `${targetCdc.id}`) || remainingCdcs[0] || null;

      setActiveCdcId(nextCdc?.id || null);
      await _refreshPreview(refreshedChart);
    } catch (error) {
      toast.error("Could not remove the dataset from this chart.");
    } finally {
      setRemovingCdcId(null);
    }
  };

  const _onSaveBuilderState = async (nextState) => {
    if (!chart?.id || !cdc?.id || !dataset?.id) {
      return;
    }

    setSaving(true);
    try {
      const vizConfig = buildDefaultVizConfig({
        dataset,
        chartType: nextState.chartType,
        dimensionFieldId: nextState.dimensionFieldId,
        metricFieldId: nextState.metricFieldId,
        aggregation: nextState.aggregation,
        limit: nextState.limit ? Number(nextState.limit) : null,
        sortDirection: nextState.sortDirection === "none" ? null : nextState.sortDirection,
        filters: nextState.filters,
        display: {
          displayLegend: nextState.displayLegend,
          dataLabels: nextState.dataLabels,
          includeZeros: nextState.includeZeros,
          xLabelTicks: nextState.xLabelTicks,
          defaultRowsPerPage: nextState.defaultRowsPerPage,
          timeInterval: nextState.timeInterval,
          datasetColor: cdc.datasetColor || chartColors.blue.hex,
          fillColor: cdc.fillColor || "transparent",
        },
      });

      await dispatch(updateChart({
        project_id: chart.project_id,
        chart_id: chart.id,
        data: {
          type: nextState.chartType,
          subType: nextState.chartType === "line" || nextState.chartType === "bar" ? "timeseries" : chart.subType,
          timeInterval: nextState.timeInterval,
          includeZeros: nextState.includeZeros,
          displayLegend: nextState.displayLegend,
          dataLabels: nextState.dataLabels,
          xLabelTicks: nextState.xLabelTicks,
          defaultRowsPerPage: nextState.defaultRowsPerPage,
        },
      })).unwrap();

      await dispatch(updateCdc({
        project_id: chart.project_id,
        chart_id: chart.id,
        cdc_id: cdc.id,
        data: {
          legend: nextState.metricFieldId
            ? (metricOptions.find((field) => `${field.id}` === `${nextState.metricFieldId}`)?.label || cdc.legend)
            : cdc.legend,
          vizVersion: 2,
          vizConfig,
        },
      })).unwrap();

      await _refreshPreview();
    } catch (error) {
      toast.error("Could not save the chart configuration.");
    } finally {
      setSaving(false);
    }
  };

  const _applyBuilderPatch = async (patch) => {
    const nextState = {
      ...builderState,
      ...patch,
    };

    setBuilderState(nextState);
    await _onSaveBuilderState(nextState);
  };

  const _onPublishChart = async () => {
    if (!chart?.id) {
      return;
    }

    if (!destinationProjectId) {
      toast.error("Choose a dashboard before publishing the chart.");
      return;
    }

    try {
      const publishedChart = await dispatch(publishChart({
        chart_id: chart.id,
        target_project_id: destinationProjectId,
        name: publishName || chart.name,
      })).unwrap();

      toast.success(chart.draft ? "Chart published successfully" : "Chart saved successfully");
      navigate(`/dashboard/${publishedChart.project_id}`);
    } catch (error) {
      toast.error(error.message || "Could not publish the chart.");
    }
  };

  const _renderStartDatasetCard = (item) => {
    const updatedAt = item.updatedAt || item.createdAt;
    const isCreating = creatingDatasetId === item.id;

    return (
      <button
        key={item.id}
        type="button"
        className="w-full rounded-lg border-1 border-divider bg-background px-4 py-4 text-left transition-colors hover:bg-content2"
        onClick={() => _onCreateFromDataset(item)}
        disabled={Boolean(creatingDatasetId) || creatingNewDataset}
      >
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-row items-center gap-3">
              <div className="rounded-lg bg-content2 p-3">
                <LuDatabase size={18} className="text-default-500" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">
                  {getDatasetDisplayName(item)}
                </div>
                <div className="mt-1 flex flex-row flex-wrap items-center gap-2 text-sm text-default-500">
                  <span>{getDatasetSourceLabel(item)}</span>
                  {updatedAt && (
                    <>
                      <span className="text-default-300">•</span>
                      <span>{`Updated ${moment(updatedAt).fromNow()}`}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center gap-3">
            <Chip size="sm" color="success" variant="flat">
              Ready
            </Chip>
            <div className="flex min-w-[72px] items-center justify-end text-sm font-medium text-primary">
              {isCreating ? "Creating..." : "Use"}
              {!isCreating && <LuArrowRight size={16} className="ml-1" />}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const _renderStartScreen = () => {
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-content1 rounded-lg border-1 border-divider p-6">
          <div className="flex flex-row items-start justify-between gap-4 flex-wrap">
            <div className="max-w-3xl">
              <div className="text-3xl font-semibold font-tw">Create a new chart</div>
              <div className="mt-2 text-base text-default-500">
                Choose a prepared dataset to start faster, or create a fresh dataset from a connection.
              </div>
            </div>

            {destinationLabel ? (
              <Chip variant="flat" color="primary" startContent={<LuLayoutDashboard size={14} />}>
                {`Dashboard: ${destinationLabel}`}
              </Chip>
            ) : (
              <Chip variant="flat" color="secondary">
                Draft chart, dashboard chosen on save
              </Chip>
            )}
          </div>

          <Spacer y={5} />

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-6">
              <Card shadow="none" className="border-1 border-divider">
                <CardBody className="gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <LuDatabase size={24} />
                  </div>
                  <div className="text-xl font-semibold">Use existing dataset</div>
                  <div className="text-sm text-default-500">
                    Search recent datasets below and jump straight into the visualize builder.
                  </div>
                  <Button
                    color="primary"
                    variant="light"
                    onPress={() => setStartMode("browse")}
                    endContent={<LuArrowRight />}
                    className="self-start"
                  >
                    Browse all datasets
                  </Button>
                </CardBody>
              </Card>
            </div>
            <div className="col-span-12 md:col-span-6">
              <Card shadow="none" className="border-1 border-divider">
                <CardBody className="gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success-50 text-success">
                    <LuWorkflow size={24} />
                  </div>
                  <div className="text-xl font-semibold">Create from connection</div>
                  <div className="text-sm text-default-500">
                    Start fresh from a connection and continue into visualize once the dataset is prepared.
                  </div>
                  <Button
                    variant="bordered"
                    onPress={_onCreateFromConnection}
                    isLoading={creatingNewDataset}
                    endContent={!creatingNewDataset ? <LuArrowRight /> : null}
                    className="self-start"
                  >
                    Create from connection
                  </Button>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>

        <div className="bg-content1 rounded-lg border-1 border-divider p-4">
          <div className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xl font-semibold">
                {startMode === "browse" ? "Browse datasets" : "Recent datasets"}
              </div>
              <div className="text-sm text-default-500">
                Pick a dataset and we will create a draft chart in the team ghost project.
              </div>
            </div>
            <div className="flex flex-row items-center gap-2">
              {startMode === "browse" && (
                <Button
                  variant="light"
                  onPress={() => setStartMode("start")}
                  startContent={<LuArrowLeft />}
                >
                  Back
                </Button>
              )}
              {startMode !== "browse" && datasets.length > 6 && (
                <Button
                  variant="light"
                  onPress={() => setStartMode("browse")}
                  endContent={<LuArrowRight />}
                >
                  View all
                </Button>
              )}
            </div>
          </div>

          <Spacer y={4} />

          <Input
            placeholder="Search datasets"
            variant="bordered"
            value={datasetSearch}
            onChange={(event) => setDatasetSearch(event.target.value)}
            startContent={<LuSearch size={16} />}
            className="max-w-xl"
          />

          <Spacer y={4} />

          <div className="flex flex-col gap-3">
            {recentDatasets.length === 0 && (
              <div className="rounded-lg border-1 border-dashed border-divider px-4 py-8 text-center text-sm text-default-500">
                No datasets matched this search.
              </div>
            )}
            {recentDatasets.map((item) => _renderStartDatasetCard(item))}
          </div>
        </div>
      </div>
    );
  };

  if (!params.chartId) {
    return _renderStartScreen();
  }

  if (!chart || !cdc || !dataset || !builderState) {
    return (
      <div className="bg-content1 rounded-lg border-1 border-divider p-6">
        <div className="text-lg font-semibold">Loading chart builder</div>
        <div className="text-sm text-default-500 mt-1">
          Preparing the V2 authoring context and loading the linked dataset.
        </div>
      </div>
    );
  }

  const dimensionOptions = getDimensionFieldOptions(dataset);
  const datasetFilters = Array.isArray(dataset?.conditions) ? dataset.conditions : [];
  const selectedMetricOption = metricOptions.find((field) => `${field.id}` === `${builderState.metricFieldId}`);
  const aggregationOptions = getMetricAggregationOptions(selectedMetricOption?.type);
  const selectedDimensionOption = dimensionOptions.find((field) => `${field.id}` === `${builderState.dimensionFieldId}`);

  return (
      <div className="flex flex-col gap-4">
      <div className="bg-content1 rounded-lg border-1 border-divider p-4">
        <div className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex flex-row items-center gap-2 flex-wrap">
              <div className="text-2xl font-semibold font-tw">{chart.name}</div>
              {chart.draft ? (
                <Chip variant="flat" color="secondary">
                  Draft chart
                </Chip>
              ) : (
                <Chip variant="flat" color="primary">
                  Published chart
                </Chip>
              )}
              {selectedDestinationProject && (
                <Chip variant="flat" startContent={<LuLayoutDashboard size={14} />}>
                  {selectedDestinationProject.name}
                </Chip>
              )}
            </div>
            <div className="text-sm text-default-500 mt-1">
              Build the chart question from reusable dataset fields. Dataset filters stay separate from chart filters.
            </div>
            <div className="mt-3 flex flex-row items-center gap-2 flex-wrap">
              <Chip variant="bordered" startContent={<LuDatabase size={14} />}>
                {getDatasetDisplayName(dataset)}
              </Chip>
              <Chip variant="bordered">
                {getDatasetSourceLabel(dataset)}
              </Chip>
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 flex-wrap">
            <Button
              as={Link}
              to={datasetEditorUrl}
              variant="bordered"
            >
              Open dataset
            </Button>
            <Button
              color="primary"
              startContent={<LuSave />}
              onPress={() => setPublishModalOpen(true)}
              isLoading={saving}
            >
              Save chart
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-5">
          <div className="bg-content1 rounded-lg border-1 border-divider p-4 flex flex-col gap-4">
            <div>
              <div className="text-lg font-semibold">Question builder</div>
              <div className="text-sm text-default-500">
                The builder edits only CDC V2 question state and keeps dataset semantics reusable.
              </div>
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold">Datasets</div>
                <Button
                  variant="bordered"
                  size="sm"
                  startContent={<LuPlus size={14} />}
                  onPress={() => setAddDatasetModalOpen(true)}
                >
                  Add dataset
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {chartDatasetConfigs.map((item, index) => {
                  const itemDataset = item.Dataset
                    || allDatasets.find((datasetItem) => `${datasetItem.id}` === `${item.dataset_id}`);
                  const isActive = `${item.id}` === `${cdc?.id}`;

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-row items-center justify-between gap-2 rounded-lg border-1 px-3 py-2 ${
                        isActive ? "border-primary bg-primary-50" : "border-divider bg-background"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setActiveCdcId(item.id)}
                      >
                        <div className="flex flex-row items-center gap-2">
                          <Chip size="sm" variant={isActive ? "solid" : "flat"} color={isActive ? "primary" : "default"}>
                            {`Dataset ${index + 1}`}
                          </Chip>
                          <div className="truncate font-medium text-foreground">
                            {getDatasetDisplayName(itemDataset)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-default-500">
                          {getDatasetSourceLabel(itemDataset)}
                        </div>
                      </button>

                      {chartDatasetConfigs.length > 1 && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          isLoading={removingCdcId === item.id}
                          onPress={() => _onRemoveDatasetFromChart(item)}
                        >
                          <LuTrash size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Chart type</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {V2_CHART_TYPE_OPTIONS.map((option) => {
                  const Icon = CHART_TYPE_ICONS[option.key] || LuChartColumn;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`rounded-lg border-1 p-3 text-left transition-colors ${
                        builderState.chartType === option.key
                          ? "border-primary bg-primary-50 text-primary"
                          : "border-divider bg-background hover:bg-content2"
                      }`}
                      onClick={() => _applyBuilderPatch({ chartType: option.key })}
                    >
                      <div className="flex flex-row items-center gap-2">
                        <Icon size={18} />
                        <span className="font-medium">{option.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-2">
                <div className="text-sm font-semibold">Metrics</div>
                <Chip size="sm" variant="flat">{selectedMetricOption?.label || "No metric"}</Chip>
              </div>
              <Autocomplete
                label="Metric"
                labelPlacement="outside"
                variant="bordered"
                selectedKey={builderState.metricFieldId}
                onSelectionChange={(key) => {
                  const nextMetric = metricOptions.find((field) => `${field.id}` === `${key}`);
                  const nextAggregation = getMetricAggregationOptions(nextMetric?.type)[0]?.value
                    || nextMetric?.aggregation
                    || getDefaultAggregation("metric", nextMetric?.type);

                  _applyBuilderPatch({
                    metricFieldId: key,
                    aggregation: nextAggregation,
                  });
                }}
                aria-label="Metric"
              >
                {metricOptions.map((field) => (
                  <AutocompleteItem key={field.id} textValue={field.label}>
                    {field.label}
                  </AutocompleteItem>
                ))}
              </Autocomplete>
              <Select
                label="Aggregation"
                labelPlacement="outside"
                variant="bordered"
                selectedKeys={[builderState.aggregation]}
                onSelectionChange={(keys) => _applyBuilderPatch({ aggregation: keys.currentKey })}
                aria-label="Aggregation"
                isDisabled={builderState.chartType === "table" || isSyntheticMetricFieldId(builderState.metricFieldId)}
              >
                {aggregationOptions.map((option) => (
                  <SelectItem key={option.value}>{option.text}</SelectItem>
                ))}
              </Select>
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-2">
                <div className="text-sm font-semibold">X axis / Time</div>
                <Chip size="sm" variant="flat">{selectedDimensionOption?.label || "No dimension"}</Chip>
              </div>
              <Autocomplete
                label="Dimension"
                labelPlacement="outside"
                variant="bordered"
                selectedKey={builderState.dimensionFieldId}
                onSelectionChange={(key) => _applyBuilderPatch({ dimensionFieldId: key })}
                aria-label="Dimension"
              >
                {dimensionOptions.map((field) => (
                  <AutocompleteItem key={field.id} textValue={field.label}>
                    {field.label}
                  </AutocompleteItem>
                ))}
              </Autocomplete>
              <Select
                label="Time interval"
                labelPlacement="outside"
                variant="bordered"
                selectedKeys={[builderState.timeInterval]}
                onSelectionChange={(keys) => _applyBuilderPatch({ timeInterval: keys.currentKey })}
                aria-label="Time interval"
                isDisabled={selectedDimensionOption?.type !== "date"}
              >
                {TIME_INTERVAL_OPTIONS.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>

            <Divider />

            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold">Break out by</div>
              <Input
                value="Follow-up slice"
                variant="bordered"
                isDisabled
                description="Breakout dimensions are intentionally deferred until the next V2 authoring slice."
              />
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Dataset filters</div>
              <div className="rounded-lg border-1 border-divider bg-background p-3">
                <div className="mb-2 flex flex-row items-center gap-2 text-sm font-medium">
                  <LuDatabase size={16} />
                  <span>Reusable dataset filters</span>
                </div>
                {datasetFilters.length === 0 && (
                  <div className="text-sm text-default-500">
                    No reusable dataset filters are configured on this dataset.
                  </div>
                )}
                <div className="flex flex-row flex-wrap gap-2">
                  {datasetFilters.map((filter) => (
                    <Chip key={filter.id} variant="bordered" radius="sm">
                      {filter.displayName || filter.field}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Chart filters</div>
              <V2QuestionFilters
                filters={builderState.filters}
                fieldOptions={fieldCatalog}
                onChange={(filters) => _applyBuilderPatch({ filters })}
              />
            </div>

            <Divider />

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <Select
                  label="Sort"
                  labelPlacement="outside"
                  variant="bordered"
                  selectedKeys={[builderState.sortDirection]}
                  onSelectionChange={(keys) => _applyBuilderPatch({ sortDirection: keys.currentKey })}
                  aria-label="Sort direction"
                >
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.key}>{option.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="col-span-12 md:col-span-6">
                <Input
                  label="Limit"
                  labelPlacement="outside"
                  variant="bordered"
                  type="number"
                  min="1"
                  value={`${builderState.limit || ""}`}
                  onChange={(event) => _applyBuilderPatch({ limit: event.target.value })}
                />
              </div>
            </div>

            <Divider />

            <div className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Display</div>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-6">
                  <Switch
                    isSelected={builderState.displayLegend}
                    onValueChange={(value) => _applyBuilderPatch({ displayLegend: value })}
                  >
                    Show legend
                  </Switch>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Switch
                    isSelected={builderState.dataLabels}
                    onValueChange={(value) => _applyBuilderPatch({ dataLabels: value })}
                  >
                    Show data labels
                  </Switch>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Switch
                    isSelected={builderState.includeZeros}
                    onValueChange={(value) => _applyBuilderPatch({ includeZeros: value })}
                  >
                    Include empty buckets
                  </Switch>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Select
                    label="X label density"
                    labelPlacement="outside"
                    variant="bordered"
                    selectedKeys={[builderState.xLabelTicks]}
                    onSelectionChange={(keys) => _applyBuilderPatch({ xLabelTicks: keys.currentKey })}
                    aria-label="X label density"
                  >
                    {X_LABEL_TICK_OPTIONS.map((option) => (
                      <SelectItem key={option.key}>{option.label}</SelectItem>
                    ))}
                  </Select>
                </div>
                {builderState.chartType === "table" && (
                  <div className="col-span-12 md:col-span-6">
                    <Input
                      label="Rows per page"
                      labelPlacement="outside"
                      type="number"
                      min="5"
                      value={`${builderState.defaultRowsPerPage}`}
                      onChange={(event) => _applyBuilderPatch({ defaultRowsPerPage: Number(event.target.value) || 10 })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <Spacer y={4} />

          <V2AdvancedSettings
            chart={chart}
            cdc={cdc}
            dataset={dataset}
          />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <V2ChartCanvas
            chart={chart}
            loading={saving}
            onRefresh={_refreshPreview}
            datasetName={getDatasetDisplayName(dataset)}
            datasetNames={chartDatasetConfigs.map((item) => getDatasetDisplayName(
              item.Dataset || allDatasets.find((datasetItem) => `${datasetItem.id}` === `${item.dataset_id}`),
            )).filter(Boolean)}
          />

          <Spacer y={4} />

          <div className="rounded-lg border-1 border-primary/20 bg-primary-50 px-4 py-3 text-sm text-primary-700">
            <div className="flex flex-row items-start gap-2">
              <LuDatabase size={18} className="mt-0.5" />
              <div>
                Dataset filters are reusable across all charts using this dataset. Chart filters only apply to this chart question.
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={publishModalOpen} onClose={() => setPublishModalOpen(false)}>
        <ModalContent>
          <ModalHeader>{chart.draft ? "Publish chart" : "Save chart"}</ModalHeader>
          <ModalBody>
            <Input
              label="Chart name"
              labelPlacement="outside"
              variant="bordered"
              value={publishName}
              onChange={(event) => setPublishName(event.target.value)}
            />
            <Spacer y={1} />
            <Select
              label="Destination dashboard"
              labelPlacement="outside"
              variant="bordered"
              selectedKeys={destinationProjectId ? [destinationProjectId] : []}
              onSelectionChange={(keys) => setDestinationProjectId(keys.currentKey)}
              aria-label="Destination dashboard"
            >
              {availableProjects.map((project) => (
                <SelectItem key={project.id}>{project.name}</SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={_onPublishChart}
              isDisabled={!publishName || !destinationProjectId}
            >
              {chart.draft ? "Publish chart" : "Save chart"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={addDatasetModalOpen} onClose={() => setAddDatasetModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Add dataset</ModalHeader>
          <ModalBody>
            <Input
              placeholder="Search datasets"
              variant="bordered"
              value={addDatasetSearch}
              onChange={(event) => setAddDatasetSearch(event.target.value)}
              startContent={<LuSearch size={16} />}
            />

            <Spacer y={2} />

            <div className="flex max-h-[420px] flex-col gap-2 overflow-auto">
              {addDatasetOptions.length === 0 && (
                <div className="rounded-lg border-1 border-dashed border-divider px-4 py-8 text-center text-sm text-default-500">
                  No additional datasets matched this search.
                </div>
              )}

              {addDatasetOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-lg border-1 border-divider bg-background px-4 py-3 text-left transition-colors hover:bg-content2"
                  onClick={() => _onAddDatasetToChart(item)}
                  disabled={Boolean(addingDatasetId)}
                >
                  <div className="flex flex-row items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {getDatasetDisplayName(item)}
                      </div>
                      <div className="mt-1 text-sm text-default-500">
                        {getDatasetSourceLabel(item)}
                      </div>
                    </div>

                    <div className="text-sm font-medium text-primary">
                      {addingDatasetId === item.id ? "Adding..." : "Add"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setAddDatasetModalOpen(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default ChartBuilderV2;
