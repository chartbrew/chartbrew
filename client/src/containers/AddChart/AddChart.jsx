import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Link as LinkNext, Spacer, Tooltip, Input, Button, Switch,
} from "@heroui/react";
import toast from "react-hot-toast";
import _ from "lodash";
import { useWindowSize } from "react-use";
import { LuCheck, LuPencilLine } from "react-icons/lu";
import { useNavigate, useParams } from "react-router";

import ChartPreview from "./components/ChartPreview";
import ChartSettings from "./components/ChartSettings";
import ChartDescription from "./components/ChartDescription";
import {
  createChart, updateChart, runQuery, runQueryWithFilters, selectCharts,
} from "../../slices/chart";
import { getChartAlerts, clearAlerts } from "../../slices/alert";
import { getTemplates, selectTemplates } from "../../slices/template";
import Row from "../../components/Row";
import Text from "../../components/Text";
import ChartDatasets from "./components/ChartDatasets";
import getDashboardLayout from "../../modules/getDashboardLayout";
import { selectConnections } from "../../slices/connection";
import { selectDatasetsNoDrafts } from "../../slices/dataset";

/*
  Container used for setting up a new chart
*/
function AddChart() {
  const [titleScreen, setTitleScreen] = useState(true);
  const [newChart, setNewChart] = useState({
    type: "line",
    subType: "lcTimeseries",
  });
  const [editingTitle, setEditingTitle] = useState(false);
  const [chartName, setChartName] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [saveRequired, setSaveRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [useCache, setUseCache] = useState(true);

  const { height } = useWindowSize();

  const charts = useSelector(selectCharts);
  const templates = useSelector(selectTemplates);
  const connections = useSelector(selectConnections);
  const datasets = useSelector(selectDatasetsNoDrafts);

  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(clearAlerts());

    if (params.chartId) {
      charts.map((chart) => {
        if (chart.id === parseInt(params.chartId, 10)) {
          setNewChart(chart);
        }
        return chart;
      });
      setTitleScreen(false);

      // also fetch the chart's datasets and alerts
      dispatch(getChartAlerts({
        project_id: params.projectId,
        chart_id: params.chartId
      }));
    }

    dispatch(getTemplates(params.teamId));
  }, []);

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
  }, [charts]);

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
  }, [newChart]);

  const _onNameChange = (value) => {
    setChartName(value);
  };

  const _onSubmitNewName = () => {
    setEditingTitle(false);
    _onChangeChart({ name: chartName });
  };

  const _onCreateClicked = () => {
    const tempChart = { ...newChart, name: chartName };

    // add chart at the end of the dashboard
    const layouts = getDashboardLayout(charts);
    let bottomY = 0;
    const chartLayout = {};
    Object.keys(layouts).map((bp) => {
      layouts[bp].forEach((item) => {
        const bottom = item.y + item.h;
        if (bottom > bottomY) {
          bottomY = bottom;
        }
      });

      chartLayout[bp] = [
        0,
        bottomY,
        bp === "lg" ? 4 : bp === "md" ? 5 : bp === "sm" ? 3 : bp === "xs" ? 2 : 2,
        2,
      ];
    });

    tempChart.layout = chartLayout;

    return dispatch(createChart({ project_id: params.projectId, data: tempChart }))
      .then((res) => {
        setNewChart(res.payload);
        setTitleScreen(false);
        navigate(`${res.payload.id}/edit`);
        return true;
      })
      .catch(() => {
        return false;
      });
  };

  const _onChangeGlobalSettings = ({
    pointRadius, displayLegend, dateRange, includeZeros, timeInterval, currentEndDate,
    fixedStartDate, maxValue, minValue, xLabelTicks, stacked, horizontal, dataLabels,
    dateVarsFormat, isLogarithmic,
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
    };

    let skipParsing = false;
    if (pointRadius
      || displayLegend
      || minValue
      || maxValue
      || xLabelTicks
      || stacked
      || horizontal
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

    dispatch(runQuery({
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

  if (titleScreen) {
    return (
      <div style={{ textAlign: "center" }}>
        <ChartDescription
          name={chartName}
          onChange={_onNameChange}
          onCreate={_onCreateClicked}
          teamId={params.teamId}
          projectId={params.projectId}
          connections={connections}
          templates={templates}
          noConnections={connections.length === 0}
        />
        <Spacer y={2} />
      </div>
    );
  }

  if (datasets.length === 0 || newChart.ChartDatasetConfigs?.length === 0) {
    return (
      <div className={"bg-content1 rounded-lg mx-auto p-4 mt-4 max-w-lg"}>
        <ChartDatasets chartId={newChart.id} />
      </div>
    );
  }

  return (
    <div style={styles.container(height)} className="md:pl-4 md:pr-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <Row align="center" wrap="wrap" justify="space-between">
            <Row className="chart-name-tut">
              {!editingTitle
                && (
                  <Tooltip content="Edit the chart name">
                    <LinkNext onPress={() => setEditingTitle(true)} className="flex items-center" color="primary">
                      <LuPencilLine />
                      <Spacer x={0.5} />
                      <Text b>
                        {newChart.name}
                      </Text>
                    </LinkNext>
                  </Tooltip>
                )}

              {editingTitle && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  _onSubmitNewName();
                }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Input
                      placeholder="Enter a title"
                      value={chartName}
                      onChange={(e) => _onNameChange(e.target.value)}
                      variant="bordered"
                      labelPlacement="outside"
                    />
                    <Spacer x={0.5} />
                    <Button
                      color="success"
                      type="submit"
                      onClick={_onSubmitNewName}
                      size="sm"
                      isIconOnly

                    >
                      <LuCheck />
                    </Button>
                  </div>
                </form>
              )}
            </Row>
            <Row className="chart-actions-tut" align="center" justify="flex-end">
              <div style={{ display: "flex" }}>
                <Switch
                  isSelected={newChart.draft}
                  onChange={() => _onChangeChart({ draft: !newChart.draft })}
                  size="sm"
                />
                <Spacer x={0.5} />
                <Text>Draft</Text>
              </div>
              <Spacer x={4} />
              <Button
                color={saveRequired ? "primary" : "success"}
                onClick={() => _onChangeChart({})}
                isLoading={loading}
                size="sm"
                variant={saveRequired ? "solid" : "flat"}
              >
                {saveRequired && "Save chart"}
                {!saveRequired && "Chart saved"}
              </Button>
            </Row>
          </Row>
          <Spacer y={2} />
          <Row className="chart-type-tut bg-content1 rounded-lg">
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
          </Row>
          <Spacer y={4} />
          <Row>
            {params.chartId && newChart.type && newChart.ChartDatasetConfigs?.length > 0 && (
              <ChartSettings
                chart={newChart}
                onChange={_onChangeGlobalSettings}
                onComplete={(skipParsing = false) => _onRefreshPreview(skipParsing)}
              />
            )}
          </Row>
        </div>

        <div className="col-span-12 md:col-span-5 add-dataset-tut">
          <div className={"bg-content1 rounded-lg mx-auto p-4 w-full"}>
            <ChartDatasets chartId={newChart.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: (height) => ({
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
    minHeight: height,
  }),
  mainContent: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  mainSegment: {
    minHeight: 600,
  },
  topBuffer: {
    marginTop: 20,
  },
  addDataset: {
    marginTop: 10,
  },
  datasetButtons: {
    marginBottom: 10,
    marginRight: 3,
  },
  editTitle: {
    cursor: "pointer",
  },
  tutorialBtn: {
    boxShadow: "none",
    marginTop: -10,
  },
};

export default AddChart;
