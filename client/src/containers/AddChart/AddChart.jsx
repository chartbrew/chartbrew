import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Link as LinkNext, Tooltip, Input, Button, ProgressCircle, Switch, Alert,
} from "@heroui/react";
import toast from "react-hot-toast";
import _ from "lodash";
import { LuArrowLeft, LuCheck, LuPencilLine } from "react-icons/lu";
import { useNavigate, useParams } from "react-router";

import { ButtonSpinner } from "../../components/ButtonSpinner";
import ChartPreview from "./components/ChartPreview";
import ChartSettings from "./components/ChartSettings";
import ChartDescription from "./components/ChartDescription";
import {
  createChart, createCdc, updateChart, runQuery, runQueryWithFilters, selectCharts,
} from "../../slices/chart";
import { getChartAlerts, clearAlerts } from "../../slices/alert";
import ChartDatasets from "./components/ChartDatasets";
import getDashboardLayout from "../../modules/getDashboardLayout";
import { selectDatasetsNoDrafts } from "../../slices/dataset";
import { placeNewWidget } from "../../modules/autoLayout";
import { chartColors } from "../../config/colors";
import getDatasetDisplayName from "../../modules/getDatasetDisplayName";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";

const AUTO_NAME_PENDING_STORAGE_KEY = "__cb_pending_chart_dataset_name";
const AUTO_NAME_PLACEHOLDER = "__cb_auto_name_chart__";
const defaultChart = {
  type: "line",
  subType: "lcTimeseries",
};

const _getStoredPendingChartIds = () => {
  if (typeof window === "undefined") return [];

  try {
    const storedIds = window.sessionStorage.getItem(AUTO_NAME_PENDING_STORAGE_KEY);
    return storedIds ? JSON.parse(storedIds) : [];
  } catch (error) {
    return [];
  }
};

const _savePendingChartIds = (chartIds) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTO_NAME_PENDING_STORAGE_KEY, JSON.stringify(chartIds));
};

const _rememberPendingChartName = (chartId) => {
  const storedIds = _getStoredPendingChartIds();
  if (storedIds.includes(chartId)) return;
  _savePendingChartIds([...storedIds, chartId]);
};

const _clearPendingChartName = (chartId) => {
  const storedIds = _getStoredPendingChartIds();
  _savePendingChartIds(storedIds.filter((storedId) => storedId !== chartId));
};

const _shouldAutoNameChart = (chartId) => _getStoredPendingChartIds().includes(chartId);

const _getNewChartLayout = (charts) => {
  const layouts = getDashboardLayout(charts);
  const chartLayout = {};

  Object.keys(layouts).forEach((bp) => {
    const w = bp === "lg" ? 4 : bp === "md" ? 5 : bp === "sm" ? 3 : bp === "xs" ? 2 : 2;
    const pos = placeNewWidget(layouts[bp] || [], { w, h: 2 }, bp);
    chartLayout[bp] = [pos.x, pos.y, pos.w, pos.h];
  });

  return chartLayout;
};

/*
  Container used for setting up a new chart
*/
function AddChart() {
  const [newChart, setNewChart] = useState(defaultChart);
  const [editingTitle, setEditingTitle] = useState(false);
  const [chartName, setChartName] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [saveRequired, setSaveRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [useCache, setUseCache] = useState(true);
  const [creatingDatasetId, setCreatingDatasetId] = useState(null);
  const [creatingNewDataset, setCreatingNewDataset] = useState(false);

  const charts = useSelector(selectCharts);
  const datasets = useSelector(selectDatasetsNoDrafts);
  const datasetLoading = useSelector((state) => state.dataset.loading);
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const projectId = parseInt(params.projectId, 10);

  const currentUserRole = team?.TeamRoles?.find((teamRole) => teamRole.user_id === user?.id);
  const isProjectScopedEditor = ["projectAdmin", "projectEditor"].includes(currentUserRole?.role)
    && currentUserRole?.projects?.includes(projectId);
  const missingChartDatasets = _.uniqBy(
    (newChart.ChartDatasetConfigs || []).filter((cdc) => (
      cdc?.dataset_id && !datasets.some((dataset) => dataset.id === parseInt(cdc.dataset_id, 10))
    )),
    "dataset_id"
  );
  // Do not key this on local state that flips with datasetLoading — that remounted ChartDatasets
  // (two branches) and reset its fetch ref, re-dispatching getDatasets in a loop.
  const showMissingDatasetAlert = isProjectScopedEditor
    && !datasetLoading
    && missingChartDatasets.length > 0;
  const missingSeriesLabels = missingChartDatasets
    .map((cdc) => cdc.legend)
    .filter(Boolean);
  const missingDatasetDescription = "This chart uses datasets "
    + "that your project role cannot access because "
    + "they are not tagged with this dashboard. "
    + "Ask a team owner or team admin to tag the dataset with this dashboard, then reload the editor."
    + `${missingSeriesLabels.length > 0
      ? ` Affected series: ${missingSeriesLabels.slice(0, 3).join(", ")}${missingSeriesLabels.length > 3 ? ", ..." : ""}.`
      : ""}`;

  useEffect(() => {
    dispatch(clearAlerts());

    if (params.chartId) {
      // also fetch the chart's datasets and alerts
      dispatch(getChartAlerts({
        project_id: params.projectId,
        chart_id: params.chartId
      }));
    }
  }, [dispatch, params.chartId, params.projectId]);

  useEffect(() => {
    charts.map((chart) => {
      if (chart.id === parseInt(params.chartId, 10)) {
        if (!_.isEqual(chart, newChart)) {
          setNewChart(chart);
          setChartName(chart.name);
        }
      }
      return chart;
    });
  }, [charts, newChart, params.chartId]);

  useEffect(() => {
    let found = false;
    charts.map((chart) => {
      if (chart.id === parseInt(params.chartId, 10)) {
        if (!_.isEqual(chart, newChart)) {
          setSaveRequired(true);
          found = true;
        }
      }
      return chart;
    });
    if (!found) setSaveRequired(false);
  }, [charts, newChart, params.chartId]);

  const _onNameChange = (value) => {
    setChartName(value);
  };

  const _onSubmitNewName = () => {
    setEditingTitle(false);
    _onChangeChart({ name: chartName });
  };

  const _createChart = async (name) => {
    const chartData = {
      ...defaultChart,
      name,
      layout: _getNewChartLayout(charts),
    };

    return dispatch(createChart({ project_id: params.projectId, data: chartData })).unwrap();
  };

  const _onCreateFromDataset = async (dataset) => {
    setCreatingDatasetId(dataset.id);

    try {
      const datasetName = getDatasetDisplayName(dataset) || "Untitled dataset";
      const chart = await _createChart(datasetName);

      await dispatch(createCdc({
        project_id: chart.project_id,
        chart_id: chart.id,
        data: {
          dataset_id: dataset.id,
          legend: datasetName,
          datasetColor: chartColors.blue.hex,
          fill: false,
          order: 0,
        },
      })).unwrap();

      try {
        await dispatch(runQuery({
          project_id: chart.project_id,
          chart_id: chart.id,
          noSource: false,
          skipParsing: false,
          getCache: true,
        })).unwrap();
      } catch (error) {
        // The chart editor can recover from a failed first run.
      }

      navigate(`${chart.id}/edit`);
    } catch (error) {
      toast.error("Oups! Can't create the chart. Please try again.");
    } finally {
      setCreatingDatasetId(null);
    }
  };

  const _onCreateDataset = async () => {
    setCreatingNewDataset(true);

    try {
      const chart = await _createChart(AUTO_NAME_PLACEHOLDER);
      _rememberPendingChartName(chart.id);
      navigate(`/datasets/new?create=true&project_id=${params.projectId}&chart_id=${chart.id}`);
    } catch (error) {
      toast.error("Oups! Can't start the chart setup. Please try again.");
    } finally {
      setCreatingNewDataset(false);
    }
  };

  const _onChangeGlobalSettings = ({
    pointRadius, displayLegend, dateRange, includeZeros, timeInterval, currentEndDate,
    fixedStartDate, maxValue, minValue, xLabelTicks, stacked, horizontal, dataLabels,
    dateVarsFormat, isLogarithmic, dashedLastPoint, defaultRowsPerPage,
  }) => {
    const tempChart = {
      pointRadius: typeof pointRadius !== "undefined" ? pointRadius : newChart.pointRadius,
      displayLegend: typeof displayLegend !== "undefined" ? displayLegend : newChart.displayLegend,
      startDate: dateRange?.startDate || dateRange?.startDate === null
        ? dateRange.startDate : newChart.startDate,
      endDate: dateRange?.endDate || dateRange?.endDate === null
        ? dateRange.endDate : newChart.endDate,
      timeInterval: timeInterval || newChart.timeInterval,
      includeZeros: typeof includeZeros !== "undefined" ? includeZeros : newChart.includeZeros,
      currentEndDate: typeof currentEndDate !== "undefined" ? currentEndDate : newChart.currentEndDate,
      fixedStartDate: typeof fixedStartDate !== "undefined" ? fixedStartDate : newChart.fixedStartDate,
      minValue: typeof minValue !== "undefined" ? minValue : newChart.minValue,
      maxValue: typeof maxValue !== "undefined" ? maxValue : newChart.maxValue,
      xLabelTicks: typeof xLabelTicks !== "undefined" ? xLabelTicks : newChart.xLabelTicks,
      stacked: typeof stacked !== "undefined" ? stacked : newChart.stacked,
      horizontal: typeof horizontal !== "undefined" ? horizontal : newChart.horizontal,
      dataLabels: typeof dataLabels !== "undefined" ? dataLabels : newChart.dataLabels,
      dateVarsFormat: dateVarsFormat !== "undefined" ? dateVarsFormat : newChart.dateVarsFormat,
      isLogarithmic: typeof isLogarithmic !== "undefined" ? isLogarithmic : newChart.isLogarithmic,
      dashedLastPoint: typeof dashedLastPoint !== "undefined" ? dashedLastPoint : newChart.dashedLastPoint,
      defaultRowsPerPage: typeof defaultRowsPerPage !== "undefined" ? defaultRowsPerPage : newChart.defaultRowsPerPage,
    };

    let skipParsing = false;
    if (pointRadius
      || displayLegend
      || minValue
      || maxValue
      || xLabelTicks
      || stacked
      || horizontal
      || dashedLastPoint
    ) {
      skipParsing = true;
    }

    _onChangeChart(tempChart, skipParsing);
  };

  const _onChangeChart = (data, skipParsing) => {
    let shouldSkipParsing = skipParsing;
    setNewChart({ ...newChart, ...data });
    setLoading(true);
    return dispatch(updateChart({ project_id: params.projectId, chart_id: params.chartId, data }))
      .then((newData) => {
        if (!toastOpen) {
          toast.success("Updated the chart 📈", {
            onClose: () => setToastOpen(false),
            onOpen: () => setToastOpen(true),
          });
        }

        if (skipParsing || data.datasetColor || data.fillColor || data.type) {
          shouldSkipParsing = true;
        }

        // run the preview refresh only when it's needed
        if (!data.name) {
          if (data.subType || data.type) {
            _onRefreshData();
          } else {
            _onRefreshPreview(shouldSkipParsing);
          }
        }

        setLoading(false);
        return Promise.resolve(newData);
      })
      .catch((e) => {
        toast.error("Oups! Can't save the chart. Please try again.");
        setLoading(false);
        return Promise.reject(e);
      });
  };

  const _onRefreshData = (filters = []) => {
    if (!params.chartId) return;

    const getCache = useCache;

    return dispatch(runQuery({
      project_id: params.projectId,
      chart_id: params.chartId,
      noSource: false,
      skipParsing: false,
      filters,
      getCache
    }))
      .then(() => {
        if (conditions.length > 0) {
          return dispatch(runQueryWithFilters({
            project_id: params.projectId,
            chart_id: newChart.id,
            filters: conditions,
          }));
        }

        return true;
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        toast.error("We couldn't fetch the data. Please check your dataset settings and try again", {
          autoClose: 2500,
        });
        setLoading(false);
      });
  };

  const _onRefreshPreview = (skipParsing = true, filters = []) => {
    if (!params.chartId) return;
    dispatch(runQuery({
      project_id: params.projectId,
      chart_id: params.chartId,
      noSource: true,
      skipParsing,
      filters,
      getCache: true
    }))
      .then(() => {
        if (conditions.length > 0) {
          return dispatch(runQueryWithFilters({
            project_id: params.projectId,
            chart_id: newChart.id,
            filters: conditions
          }));
        }

        return true;
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const _onAddFilter = (condition) => {
    let found = false;
    const newConditions = conditions.map((c) => {
      let newCondition = c;
      if (c.id === condition.id) {
        newCondition = condition;
        found = true;
      }
      return newCondition;
    });
    if (!found) newConditions.push(condition);
    setConditions(newConditions);

    dispatch(runQueryWithFilters({
      project_id: params.projectId,
      chart_id: newChart.id,
      filters: [condition]
    }));
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = _.findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    dispatch(runQueryWithFilters({
      project_id: params.projectId,
      chart_id: newChart.id,
      filters: [condition],
    }));
  };

  useEffect(() => {
    if (!params.chartId || !newChart?.id || !_shouldAutoNameChart(newChart.id)) {
      return;
    }

    const datasetName = newChart.ChartDatasetConfigs?.[0]?.legend;
    if (!datasetName) {
      return;
    }

    _clearPendingChartName(newChart.id);

    if (newChart.name === datasetName) {
      setChartName(datasetName);
      return;
    }

    setChartName(datasetName);
    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: params.chartId,
      data: { name: datasetName },
    })).unwrap().catch(() => {
      toast.error("Oups! Can't update the chart name. Please try again.");
    });
  }, [dispatch, newChart, params.chartId, params.projectId]);

  if (!params.chartId) {
    return (
      <div className="pt-4">
        <ChartDescription
          datasets={datasets}
          creatingDatasetId={creatingDatasetId}
          creatingNewDataset={creatingNewDataset}
          onCreateFromDataset={_onCreateFromDataset}
          onCreateDataset={_onCreateDataset}
        />
        <div className="h-2" />
      </div>
    );
  }

  if (params.chartId && !newChart?.id) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <ProgressCircle aria-label="Loading chart" />
      </div>
    );
  }

  if (newChart.ChartDatasetConfigs?.length === 0 || datasets.length === 0) {
    return (
      <div className="mt-4 max-w-xl mx-auto border-1 border-divider rounded-lg p-4 bg-content1">
        <Button
          onPress={() => navigate(`/dashboard/${params.projectId}`)}
          variant="tertiary"
          size="sm"
          startContent={<LuArrowLeft size={16} />}
        >
          Back to dashboard
        </Button>
        <div className="h-4" />
        {showMissingDatasetAlert && (
          <>
            <Alert
              color="warning"
              status="accent"
              title="Dataset access required"
              description={missingDatasetDescription}
            />
            <div className="h-4" />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {showMissingDatasetAlert && (
        <>
          <Alert
            color="warning"
            variant="solid"
            title="Dataset access required"
            description={missingDatasetDescription}
          />
          <div className="h-4" />
        </>
      )}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5 add-dataset-tut">
          <div className={"bg-content1 rounded-lg mx-auto p-4 w-full border-1 border-solid border-divider"}>
            <ChartDatasets chartId={newChart.id} />
          </div>
        </div>
        <div className="col-span-12 md:col-span-7">
          <div className="flex items-center justify-between flex-wrap gap-2 py-4 px-4 border-1 border-divider bg-content1 rounded-lg">
            <div className="flex items-center gap-2">
              {!editingTitle
                && (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <LinkNext onPress={() => setEditingTitle(true)} className="flex items-center gap-2 cursor-pointer" color="foreground">
                        <div className="text-lg font-bold text-foreground">
                          {newChart.name}
                        </div>
                        <LuPencilLine size={18} className="text-foreground-500" />
                      </LinkNext>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Edit the chart name</Tooltip.Content>
                  </Tooltip>
                )}

              {editingTitle && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  _onSubmitNewName();
                }}>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter a title"
                      value={chartName}
                      onChange={(e) => _onNameChange(e.target.value)}
                      labelPlacement="outside"
                      size="sm"
                    />
                    <Button
                      color="primary"
                      type="submit"
                      onPress={_onSubmitNewName}
                      size="sm"
                      isIconOnly

                    >
                      <LuCheck size={16} />
                    </Button>
                  </div>
                </form>
              )}
            </div>
            <div className="flex items-center justify-end gap-4">
              <div className="flex items-center gap-2">
                <div className="text-sm text-foreground">Draft</div>
                <Switch
                  isSelected={newChart.draft}
                  onChange={() => _onChangeChart({ draft: !newChart.draft })}
                  size="sm"
                />
              </div>
              <Button
                color={saveRequired ? "primary" : "success"}
                onPress={() => _onChangeChart({})}
                isPending={loading}
                startContent={loading ? <ButtonSpinner /> : undefined}
                size="sm"
                variant={saveRequired ? "solid" : "flat"}
              >
                {saveRequired && "Save chart"}
                {!saveRequired && "Chart saved"}
              </Button>
            </div>
          </div>
          <div className="h-2" />
          <div className="bg-content1 rounded-lg border-1 border-solid border-divider">
            <ChartPreview
              chart={newChart}
              onChange={_onChangeChart}
              onRefreshData={_onRefreshData}
              onRefreshPreview={_onRefreshPreview}
              onAddFilter={_onAddFilter}
              onClearFilter={_onClearFilter}
              conditions={conditions}
              useCache={useCache}
              changeCache={() => setUseCache(!useCache)}
            />
          </div>
          <div className="h-4" />
          <div className="bg-content1 rounded-lg border-1 border-solid border-divider">
            {params.chartId && newChart.type && newChart.ChartDatasetConfigs?.length > 0 && (
              <ChartSettings
                chart={newChart}
                onChange={_onChangeGlobalSettings}
                onComplete={(skipParsing = false) => _onRefreshPreview(skipParsing)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddChart;
