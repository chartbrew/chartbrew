import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Card, Spacer, Tooltip, Dropdown, Button, Modal, Input, Link as LinkNext,
  Popover, Chip, CardHeader, CircularProgress, PopoverTrigger,
  PopoverContent, DropdownMenu, DropdownTrigger, DropdownItem, ModalHeader,
  ModalBody, ModalFooter, CardBody, ModalContent, Select, SelectItem,
  Badge,
  Divider,
  Kbd,
} from "@heroui/react";
import {
  LuBell, LuCalendarClock, LuCheck, LuChevronDown, LuEllipsisVertical, LuFileDown,
  LuLayoutDashboard, LuLink, LuListFilter, LuLock, LuLockOpen,
  LuRefreshCw, LuSettings, LuShare, LuTrash, LuMonitor, LuMonitorX, LuX,
  LuCircleCheck, LuVariable,
} from "react-icons/lu";

import moment from "moment";
import _ from "lodash";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import {
  removeChart, runQuery, runQueryWithFilters, getChart, updateChart,
} from "../../slices/chart";
import canAccess from "../../config/canAccess";
import LineChart from "./components/LineChart";
import BarChart from "./components/BarChart";
import RadarChart from "./components/RadarChart";
import PolarChart from "./components/PolarChart";
import DoughnutChart from "./components/DoughnutChart";
import PieChart from "./components/PieChart";
import TableContainer from "./components/TableView/TableContainer";
import ChartFilters from "./components/ChartFilters";
import useInterval from "../../modules/useInterval";
import Row from "../../components/Row";
import Text from "../../components/Text";
import KpiMode from "./components/KpiMode";
import useChartSize from "../../modules/useChartSize";
import DatasetAlerts from "../AddChart/components/DatasetAlerts";
import isMac from "../../modules/isMac";
import GaugeChart from "./components/GaugeChart";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { exportChartToExcel, canExportChart } from "../../modules/exportChart";
import ChartSharing from "./components/ChartSharing";

const getFiltersFromStorage = (projectId) => {
  try {
    const filters = JSON.parse(window.localStorage.getItem("_cb_filters"));
    return filters[projectId] || null;
  } catch (e) {
    return null;
  }
};

/*
  This is the container that generates the Charts together with the menu
*/
function Chart(props) {
  const {
    chart,
    isPublic = false,
    print = "",
    height = 300,
    showExport = false,
    editingLayout = false,
    onEditLayout = () => {},
  } = props;

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);

  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [publicModal, setPublicModal] = useState(false);
  const [embedModal, setEmbedModal] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [updateFrequency, setUpdateFrequency] = useState(false);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);
  const [publicLoading, setPublicLoading] = useState(false);
  const [dashboardFilters, setDashboardFilters] = useState(
    getFiltersFromStorage(params.projectId)
  );
  const [conditions, setConditions] = useState([]);
  const [redraw, setRedraw] = useState(false);
  const [updateFreqType, setUpdateFreqType] = useState("hours");
  const [customUpdateFreq, setCustomUpdateFreq] = useState("");
  const [autoUpdateError, setAutoUpdateError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [alertsModal, setAlertsModal] = useState(false);
  const [alertsDatasetId, setAlertsDatasetId] = useState(null);
  const chartSize = useChartSize(chart.layout);
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef(null);

  useInterval(async () => {
    // Get the current filters and check if we have variables
    const currentFilters = params.projectId ? getFiltersFromStorage(params.projectId) : null;
    const hasVariables = currentFilters && currentFilters.some(f => f.type === "variable");
    
    // If we have filters or variables, we should use filtering instead of just getting the chart
    if ((currentFilters && currentFilters.length > 0) || hasVariables) {
      // Just run filtering, which will get the filtered data
      await _runFiltering(currentFilters, params.projectId);
    } else {
      // No filters, just get the base chart data
      await dispatch(getChart({
        project_id: chart.project_id,
        chart_id: chart.id,
        password: isPublic ? window.localStorage.getItem("reportPassword") : null,
        fromInterval: true
      }));
    }
  }, !isPublic && chart.autoUpdate > 0 && chart.autoUpdate < 600 ? chart.autoUpdate * 1000 : 600000);

  useEffect(() => {
    if (customUpdateFreq && updateFreqType) {
      if (updateFreqType === "days") {
        setUpdateFrequency(customUpdateFreq * 3600 * 24);
      } else if (updateFreqType === "hours") {
        setUpdateFrequency(customUpdateFreq * 3600);
      } else if (updateFreqType === "minutes") {
        setUpdateFrequency(customUpdateFreq * 60);
      } else if (updateFreqType === "seconds") {
        setUpdateFrequency(customUpdateFreq);
      }
    }
  }, [customUpdateFreq, updateFreqType]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setIsCompact(containerRef.current.offsetHeight < 200);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const _shouldCompact = () => {
    if (isCompact && (chart.type === "kpi" || chart.type === "gauge" || chart.type === "bar")) {
      return true;
    }
    return false;
  }

  const _onGetChartData = () => {
    const { projectId } = params;

    const filters = getFiltersFromStorage(projectId);

    const unsortedVarFilters = filters?.filter((f) => f.type === "variable");
    const variableFilters = {};
    if (unsortedVarFilters?.length > 0) {
      unsortedVarFilters.forEach((f) => {
        if (f.variable && f.value) {
          variableFilters[f.variable] = f.value;
        }
      });
    }

    const otherFilters = filters?.filter((f) => f.type !== "variable");
    
    // Filter out date filters that don't apply to this chart (same logic as _runFiltering)
    const applicableFilters = otherFilters?.filter((filter) => {
      if (filter.type === "date" && filter.charts && Array.isArray(filter.charts)) {
        return filter.charts.includes(chart.id);
      }
      return true; // Keep all non-date filters
    });

    // TODO: add filters and variables to the query instead of running filtering again
    setChartLoading(true);
    dispatch(runQuery({
      project_id: projectId,
      chart_id: chart.id,
      filters: applicableFilters,
      variables: variableFilters,
    }))
      .then(() => {
        setChartLoading(false);

        setDashboardFilters(filters);
        if (applicableFilters && applicableFilters.length > 0 && _chartHasFilter(applicableFilters)) {
          _runFiltering(applicableFilters);
        }
      })
      .catch((error) => {
        if (error === 413) {
          setChartLoading(false);
        } else {
          setChartLoading(false);
          setError(true);
        }
      });
  };

  const _runFiltering = async (filters, projectId = params.projectId) => {
    if (!chart.ChartDatasetConfigs) return;

    // Get all conditions from the chart's datasets
    let identifiedConditions = [];
    chart.ChartDatasetConfigs.forEach((cdc) => {
      if (Array.isArray(cdc.Dataset?.conditions)) {
        identifiedConditions = [...identifiedConditions, ...cdc.Dataset.conditions];
      }
    });

    // If no filters are provided, get them from localStorage
    const allFilters = filters || getFiltersFromStorage(projectId) || [];
    
    // Separate variable filters from other filters
    const variableFilters = allFilters.filter((f) => f.type === "variable");
    const otherFilters = allFilters.filter((f) => f.type !== "variable");

    // Convert variable filters to the expected format { [variable_name]: variable_value }
    const variables = {};
    variableFilters.forEach((f) => {
      if (f.variable && f.value) {
        variables[f.variable] = f.value;
      }
    });

    // Filter out date filters that don't apply to this chart
    const applicableFilters = otherFilters.filter((filter) => {
      if (filter.type === "date" && filter.charts && Array.isArray(filter.charts)) {
        return filter.charts.includes(chart.id);
      }
      return true; // Keep all non-date filters
    });

    // Make an API call if there are filters to apply OR if there are variables
    if (applicableFilters.length > 0 || Object.keys(variables).length > 0) {
      await dispatch(runQueryWithFilters({
        project_id: chart.project_id,
        chart_id: chart.id,
        filters: applicableFilters,
        variables,
      }));
    }
  };

  const _onGetChart = () => {
    dispatch(getChart({ project_id: params.projectId, chart_id: chart.id }));
  };

  const _onDeleteChartConfirmation = () => {
    setDeleteModal(true);
  };

  const _onDeleteChart = () => {
    setChartLoading(true);
    dispatch(removeChart({ project_id: params.projectId, chart_id: chart.id }))
      .then(() => {
        setChartLoading(false);
        setDeleteModal(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
        setDeleteModal(false);
      });
  };

  const _onPublicConfirmation = () => {
    if (chart.public) {
      setTimeout(() => {
        _onPublic(chart);
      }, 100);
    } else {
      setPublicModal(true);
    }
  };

  const _onPublic = () => {
    setPublicModal(false);
    setPublicLoading(true);

    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { public: !chart.public },
      justUpdates: true,
    }))
      .then(() => {
        setChartLoading(false);
        setPublicLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
        setPublicLoading(false);
      });
  };

  const _onChangeReport = () => {
    setChartLoading(true);

    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { onReport: !chart.onReport },
    }))
      .then(() => {
        setChartLoading(false);
      })
      .catch(() => {
        setChartLoading(false);
        setError(true);
      });
  };

  const _onEmbed = () => {
    setEmbedModal(true);
  };

  const _onOpenEmbed = () => {
    if (chart.Chartshares && chart.Chartshares.length > 0) {
      // open the chart in a new tab
      window.open(
        `/chart/${chart.Chartshares[0].shareString}/embedded`,
        "_blank"
      );
    }
  };

  const _openUpdateModal = () => {
    setUpdateModal(true);
    setUpdateFrequency(chart.autoUpdate);
  };

  const _openAlertsModal = () => {
    setAlertsModal(true);
    setAlertsDatasetId(chart?.ChartDatasetConfigs?.[0]?.id);
  };

  const _getUpdateFreqText = (value) => {
    let text = "Update schedule";

    if (value === 60) text = "minute";
    else if (value === 300) text = "5 minutes";
    else if (value === 900) text = "15 minutes";
    else if (value === 1800) text = "30 minutes";
    else if (value === 3600) text = "1 hour";
    else if (value === 10800) text = "3 hours";
    else if (value === 21600) text = "6 hours";
    else if (value === 43200) text = "12 hours";
    else if (value === 86400) text = "day";
    else if (value === 604800) text = "week";
    else if (value === 2592000) text = "month";
    else if (value < 120 && value > 0) text = `${value} seconds`;
    else if (value > 119 && value < 3600) {
      text = `${Math.floor(value / 60)} minutes`;
    } else if (value > 3600 && value < 86400) {
      text = `${Math.floor(value / 3600)} hours`;
    } else if (value > 86400 && value < 604800) {
      text = `${Math.floor(value / 86400)} days`;
    }

    return text;
  };

  const _onChangeAutoUpdate = (frequency = updateFrequency) => {
    if (updateFreqType === "seconds" && frequency < 10 && frequency > 0) {
      setAutoUpdateError("Invalid update frequency");
      return;
    }

    setAutoUpdateLoading(true);
    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { autoUpdate: frequency },
      justUpdates: true,
    }))
      .then(() => {
        setAutoUpdateLoading(false);
        setUpdateModal(false);
      })
      .catch(() => {
        setAutoUpdateLoading(false);
        setError(true);
        setUpdateModal(false);
      });
  };

  const _chartHasFilter = (dashFilters = dashboardFilters) => {
    let found = false;
    if (chart.ChartDatasetConfigs) {
      chart.ChartDatasetConfigs.forEach((cdConfig) => {
        if (cdConfig.Dataset?.fieldsSchema) {
          Object.keys(cdConfig.Dataset.fieldsSchema).forEach((key) => {
            if (_.find(dashFilters, (o) => o.field === key)) {
              found = true;
            }
          });
        }
      });
    }

    // Also check for date filters that apply to this specific chart
    if (dashFilters && Array.isArray(dashFilters)) {
      dashFilters.forEach((filter) => {
        if (filter.type === "date" && filter.charts && Array.isArray(filter.charts)) {
          if (filter.charts.includes(chart.id)) {
            found = true;
          }
        }
      });
    }

    return found;
  };

  const _checkIfFilters = () => {
    let filterCount = 0;
    if (!chart.ChartDatasetConfigs) return false;

    chart.ChartDatasetConfigs.forEach((d) => {
      if (Array.isArray(d.Dataset?.conditions)) {
        filterCount += d.Dataset.conditions.filter((c) => c.exposed).length;
      }
    });

    return filterCount > 0;
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  };

  const _onExport = () => {
    setExportLoading(true);
    
    try {
      // Check if chart can be exported
      if (!canExportChart(chart)) {
        toast.error("This chart cannot be exported - no data available");
        setExportLoading(false);
        return;
      }

      // Use client-side export with the already filtered data
      exportChartToExcel(chart);
      toast.success("Chart exported successfully");
      setExportLoading(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export chart");
      setExportLoading(false);
    }
  };

  const _onPublicExport = (chart) => {
    setExportLoading(true);
    
    try {
      // Check if chart can be exported
      if (!canExportChart(chart)) {
        toast.error("This chart cannot be exported - no data available");
        setExportLoading(false);
        return;
      }

      // Use client-side export with the already filtered data
      exportChartToExcel(chart);
      toast.success("Chart exported successfully");
      setExportLoading(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export chart");
      setExportLoading(false);
    }
  };

  const _getUpdatedTime = (chart) => {
    const updatedAt = chart.chartDataUpdated || chart.lastAutoUpdate;
    if (moment().diff(moment(updatedAt), "days") > 1) {
      return moment(updatedAt).calendar();
    }

    return moment(updatedAt).fromNow();
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

    _runFiltering(newConditions);
  };

  const _onClearFilter = (condition) => {
    const newConditions = [...conditions];
    const clearIndex = _.findIndex(conditions, { id: condition.id });
    if (clearIndex > -1) newConditions.splice(clearIndex, 1);

    setConditions(newConditions);
    _runFiltering(newConditions);
  };

  const _onPublishChart = async () => {
    const res = await dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { draft: false },
    }));

    if (res.error) {
      toast.error("There was a problem publishing your chart");
    } else {
      toast.success("Chart published successfully");
    }
  };

  const _onGetVariables = () => {
    const cdcs = chart.ChartDatasetConfigs;
    const variables = [];
    cdcs.forEach((cdc) => {
      if (cdc?.configuration?.variables) {
        variables.push(...cdc.configuration.variables);
      }
    });

    return variables;
  };

  const { projectId } = params;

  return (
    <motion.div
      animate={{ opacity: [0, 1] }}
      transition={{ duration: 0.7 }}
      style={styles.container}
      ref={containerRef}
    >
      {error && (
        <Text color="danger" onClick={() => setError(false)}>
          {"There was a problem with your request. Please refresh the page and try again."}
        </Text>
      )}
      {chart && (
        <Card
          shadow="none"
          className={`h-full bg-content1 border-solid border-1 border-divider ${print && "min-h-[350px] shadow-none border-solid border-1 border-content4"}`}
        >
          <CardHeader className={`pb-0 grid grid-cols-12 items-start ${isCompact ? "h-0 p-0 overflow-hidden" : ""}`}>
            <div className={`col-span-6 sm:col-span-8 flex items-start justify-start ${isCompact ? "hidden" : ""}`}>
              <div>
                <Row align="center" className={"flex-wrap gap-1"}>
                  {chart.draft && (
                    <Chip color="secondary" variant="flat" size="sm" radius="sm">Draft</Chip>
                  )}
                  <>
                    {_canAccess("projectEditor") && !editingLayout && (
                      <Link to={`/${params.teamId}/${params.projectId}/chart/${chart.id}/edit`}>
                        <div className={"text-foreground font-bold text-sm"}>{chart.name}</div>
                      </Link>
                    )}
                    {(!_canAccess("projectEditor") || editingLayout) && (
                      <Text b>{chart.name}</Text>
                    )}
                  </>
                </Row>
                {chart.chartData && (
                  <Row justify="flex-start" align="center" className={"gap-1"}>
                    {!chartLoading && !chart.loading && (
                      <>
                        <span className="text-[10px] text-default-500" title="Last updated">{`${_getUpdatedTime(chart)}`}</span>
                      </>
                    )}
                    {(chartLoading || chart.loading) && (
                      <>
                        <CircularProgress classNames={{ svg: "w-4 h-4" }} aria-label="Updating chart" />
                        <Spacer x={1} />
                        <span className="text-[10px] text-default-500">{"Updating..."}</span>
                      </>
                    )}
                    {chart.autoUpdate > 0 && (
                      <Tooltip content={`Updates every ${_getUpdateFreqText(chart.autoUpdate)}`}>
                        <div>
                          <LuCalendarClock size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {chart.public && !isPublic && !print && (
                      <Tooltip content="This chart is public">
                        <div>
                          <LuLockOpen size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {(chart.onReport && !isPublic && !print && !chart.draft) && (
                      <Tooltip content="Visible on your report and snapshots">
                        <div>
                          <LuMonitor size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {(!chart.onReport || chart.draft) && (
                      <Tooltip
                        content={chart.draft ? "Drafts are not visible on report and snapshots" : "Hidden on reports and snapshots"}
                      >
                        <div>
                          <LuMonitorX size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {chart?.Alerts?.length > 0 && (
                      <Tooltip content="This chart has alerts">
                        <div className="hover:text-primary cursor-pointer" onClick={_openAlertsModal}>
                          <LuBell size={12} />
                        </div>
                      </Tooltip>
                    )}
                    {_onGetVariables()?.length > 0 && (
                      <Tooltip content="This chart has variables">
                        <div>
                          <LuVariable size={12} />
                        </div>
                      </Tooltip>
                    )}
                  </Row>
                )}
              </div>
            </div>
            <div className={`col-span-6 sm:col-span-4 flex items-start justify-end ${isCompact ? "absolute right-2 top-2" : ""}`}>
              {_checkIfFilters() && (
                <div className="flex items-start gap-1">
                  {chartSize?.[2] > 3 && (
                    <ChartFilters
                      chart={chart}
                      onAddFilter={_onAddFilter}
                      onClearFilter={_onClearFilter}
                      conditions={conditions}
                      inline
                      size="sm"
                      amount={1}
                    />
                  )}
                  <Popover>
                    <PopoverTrigger>
                      <LinkNext className="text-gray-500">
                        <Badge
                          color="primary"
                          content={conditions.length}
                          size="sm"
                          isInvisible={!conditions || conditions.length === 0}
                        >
                          <LuListFilter className="text-default-500" />
                        </Badge>
                      </LinkNext>
                    </PopoverTrigger>
                    <PopoverContent className="pt-3">
                      <ChartFilters
                        chart={chart}
                        onAddFilter={_onAddFilter}
                        onClearFilter={_onClearFilter}
                        conditions={conditions}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {projectId && !print && (
                <Dropdown aria-label="Select a chart option">
                  <DropdownTrigger>
                    <LinkNext className="text-gray-500 cursor-pointer chart-settings-tutorial">
                      <LuEllipsisVertical className="text-default-500" />
                    </LinkNext>
                  </DropdownTrigger>
                  <DropdownMenu disabledKeys={["status"]}>
                    <DropdownItem
                      startContent={(chartLoading || chart.loading) ? <CircularProgress classNames={{ svg: "w-5 h-5" }} size="sm" aria-label="Refreshing chart" /> : <LuRefreshCw />}
                      onPress={_onGetChartData}
                      textValue="Refresh chart"
                    >
                      Refresh chart
                    </DropdownItem>
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuSettings />}
                        onPress={() => navigate(`/${params.teamId}/${params.projectId}/chart/${chart.id}/edit`)}
                        textValue="Edit chart"
                      >
                        Edit chart
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && chart.draft && (
                      <DropdownItem
                        startContent={<LuCircleCheck />}
                        onPress={_onPublishChart}
                        textValue="Publish chart"
                      >
                        Publish chart
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuLayoutDashboard className={editingLayout ? "text-primary" : ""} />}
                        onPress={onEditLayout}
                        showDivider
                        textValue={editingLayout ? "Complete layout" : "Edit layout"}
                        endContent={<Kbd keys={[isMac ? "command" : "ctrl", "e"]}>E</Kbd>}
                      >
                        <span className={editingLayout ? "text-primary" : ""}>
                          {editingLayout ? "Complete layout" : "Edit layout"}
                        </span>
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuCalendarClock />}
                        onPress={_openUpdateModal}
                        textValue="Auto-update"
                      >
                        Auto-update
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuBell />}
                        onPress={_openAlertsModal}
                        textValue="Alerts"
                        endContent={
                          chart?.Alerts?.length > 0 && (
                          <Chip color="default" size="sm" variant="flat">
                            {chart?.Alerts?.length}
                          </Chip>
                        )}
                      >
                        Alerts
                      </DropdownItem>
                    )}
                    <DropdownItem
                      startContent={exportLoading ? <CircularProgress size="sm" aria-label="Exporting chart" /> : <LuFileDown />}
                      onPress={_onExport}
                      textValue="Export to Excel"
                    >
                      Export to Excel
                    </DropdownItem>
                    {!chart.draft && _canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={chart.onReport ? <LuMonitorX /> : <LuMonitor />}
                        onPress={_onChangeReport}
                        textValue={chart.onReport ? "Remove from report" : "Add to report"}
                        showDivider
                      >
                        {chart.onReport ? "Remove from report" : "Add to report"}
                      </DropdownItem>
                    )}
                    {!chart.draft && chart.public && _canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={chart.public ? <LuLockOpen /> : <LuLock />}
                        onPress={_onPublicConfirmation}
                        textValue={chart.public ? "Make private" : "Make public"}
                      >
                        {"Make private"}
                      </DropdownItem>
                    )}
                    {!chart.draft && _canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuShare />}
                        onPress={_onEmbed}
                        textValue="Embed & Share"
                      >
                        {"Embed & Share"}
                      </DropdownItem>
                    )}
                    {!chart.draft && chart.shareable && (
                      <DropdownItem
                        startContent={<LuLink />}
                        onPress={_onOpenEmbed}
                        textValue="Open in a new tab"
                        showDivider
                      >
                        {"Open in a new tab"}
                      </DropdownItem>
                    )}
                    {_canAccess("projectEditor") && (
                      <DropdownItem
                        startContent={<LuTrash />}
                        color="danger"
                        onPress={_onDeleteChartConfirmation}
                        textValue="Delete chart"
                        showDivider
                      >
                        Delete chart
                      </DropdownItem>
                    )}
                    <DropdownItem key="status" isReadOnly className="opacity-100" textValue="Chart details">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-default-500">Last updated: {_getUpdatedTime(chart)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {chart.autoUpdate > 0 && (
                            <div className="flex items-center gap-1">
                              <LuCalendarClock size={12} />
                              <span className="text-[10px] text-default-500">Updates every {_getUpdateFreqText(chart.autoUpdate)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {chart.public && !isPublic && !print && (
                            <div className="flex items-center gap-1">
                              <LuLockOpen size={12} />
                              <span className="text-[10px] text-default-500">Public chart</span>
                            </div>
                          )}
                          {(!chart.onReport || chart.draft) && (
                            <div className="flex items-center gap-1">
                              <LuMonitorX size={12} />
                              <span className="text-[10px] text-default-500">{chart.draft ? "Draft" : "Hidden on report"}</span>
                            </div>
                          )}
                          {chart?.Alerts?.length > 0 && (
                            <div className="flex items-center gap-1">
                              <LuBell size={12} />
                              <span className="text-[10px] text-default-500">Has alerts</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              )}

              {showExport && (
                <Dropdown aria-label="Select an export option">
                  <DropdownTrigger>
                    <LinkNext className="text-gray-500 cursor-pointer">
                      <LuEllipsisVertical className="text-default-500" />
                    </LinkNext>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem
                      startContent={exportLoading ? <CircularProgress size="sm" aria-label="Exporting chart" /> : <LuFileDown />}
                      onClick={() => _onPublicExport(chart)}
                      textValue="Export to Excel"
                    >
                      <Text>Export to Excel</Text>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              )}
            </div>
          </CardHeader>
          <CardBody
            className={`${_shouldCompact() ? "pt-0 pb-0" : "pt-2 pb-4"} overflow-y-hidden`}
          >
            {chart.chartData && (
              <div className="h-full">
                {chart.type === "line"
                  && (
                    <LineChart
                      chart={chart}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "bar"
                  && (
                    <BarChart
                      chart={chart}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "pie"
                  && (
                  <PieChart
                    chart={chart}
                    height={height}
                    redraw={redraw}
                    redrawComplete={() => setRedraw(false)}
                  />
                  )}
                {chart.type === "doughnut"
                  && (
                    <DoughnutChart
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "radar"
                  && (
                  <RadarChart
                    chart={chart}
                    height={height}
                    redraw={redraw}
                    redrawComplete={() => setRedraw(false)}
                  />
                  )}
                {chart.type === "polar"
                  && (
                    <PolarChart
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "table"
                  && (
                    <div className="h-full">
                      <TableContainer
                        tabularData={chart.chartData}
                        datasets={chart.ChartDatasetConfigs}
                      />
                    </div>
                  )}
                {(chart.type === "kpi" || chart.type === "avg")
                  && (
                    <KpiMode
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
                {chart.type === "gauge"
                  && (
                    <GaugeChart
                      chart={chart}
                      height={height}
                      redraw={redraw}
                      redrawComplete={() => setRedraw(false)}
                    />
                  )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} backdrop="blur">
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Are you sure you want to remove this chart?</Text>
          </ModalHeader>
          <ModalBody>
            <Text>
              {"All the chart data will be removed and you won't be able to see it on your dashboard anymore if you proceed with the removal."}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="warning"
              onClick={() => setDeleteModal(false)}
              auto
            >
              Go back
            </Button>
            <Button
              color="danger"
              endContent={<LuTrash />}
              onClick={_onDeleteChart}
              isLoading={chartLoading}
            >
              Remove completely
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* MAKE CHART PUBLIC MODAL */}
      <Modal onClose={() => setPublicModal(false)} isOpen={publicModal}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Are you sure you want to make your chart public?</Text>
          </ModalHeader>
          <ModalBody>
            <Text>
              {"Public charts will show in your Public Dashboard page and it can be viewed by everyone with access to the unique sharing link. Nobody other than you and your team will be able to edit or update the chart data."}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color="warning"
              auto
              onClick={() => setPublicModal(false)}
            >
              Go back
            </Button>
            <Button
              isLoading={publicLoading}
              color="primary"
              endContent={<LuLockOpen />}
              onClick={_onPublic}
            >
              Make the chart public
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* AUTO-UPDATE MODAL */}
      <Modal isOpen={updateModal} className="w-[500px]" onClose={() => setUpdateModal(false)}>
        <ModalContent>
          <ModalHeader>
            <Text size="h4">Set up auto-update for your chart</Text>
          </ModalHeader>
          <ModalBody>
            <div>
              <Row align="center">
                <Select
                  label="Select a preset"
                  selectionMode="single"
                  selectedKeys={[`${updateFrequency}`]}
                  onSelectionChange={(key) => {
                    setUpdateFrequency(parseInt(key[0].value));
                  }}
                  variant="bordered"
                  aria-label="Select a preset"
                >
                    <SelectItem key="0" onClick={() => setUpdateFrequency(0)} textValue="Don't auto update">
                      {"Don't auto update"}
                    </SelectItem>
                    <SelectItem key="60" onClick={() => setUpdateFrequency(60)} textValue="Every minute">
                      Every minute
                    </SelectItem>
                      <SelectItem key="300" onClick={() => setUpdateFrequency(300)} textValue="Every 5 minutes">
                      Every 5 minutes
                    </SelectItem>
                    <SelectItem key="900" onClick={() => setUpdateFrequency(900)} textValue="Every 15 minutes">
                      Every 15 minutes
                    </SelectItem>
                    <SelectItem key="1800" onClick={() => setUpdateFrequency(1800)} textValue="Every 30 minutes">
                      Every 30 minutes
                    </SelectItem>
                    <SelectItem key="3600" onClick={() => setUpdateFrequency(3600)} textValue="Every hour">
                      Every hour
                    </SelectItem>
                    <SelectItem key="10800" onClick={() => setUpdateFrequency(10800)} textValue="Every 3 hours">
                      Every 3 hours
                    </SelectItem>
                    <SelectItem key="21600" onClick={() => setUpdateFrequency(21600)} textValue="Every 6 hours">
                      Every 6 hours
                    </SelectItem>
                    <SelectItem key="43200" onClick={() => setUpdateFrequency(43200)} textValue="Every 12 hours">
                      Every 12 hours
                    </SelectItem>
                    <SelectItem key="86400" onClick={() => setUpdateFrequency(86400)} textValue="Every day">
                      Every day
                    </SelectItem>
                    <SelectItem key="604800" onClick={() => setUpdateFrequency(604800)} textValue="Every week">
                      Every week
                    </SelectItem>
                    <SelectItem key="2592000" onClick={() => setUpdateFrequency(2592000)} textValue="Every month">
                      Every month
                    </SelectItem>
                </Select>
              </Row>
              <Spacer y={4} />
              <Row>
                <Text>Or enter a custom frequency:</Text>
              </Row>
              <Row align="center" className={"gap-2"}>
                <Input
                  type="number"
                  labelPlacement="outside"
                  startContent={(<Text className={"text-default-400"}>Every</Text>)}
                  onChange={(e) => setCustomUpdateFreq(e.target.value)}
                  value={customUpdateFreq}
                  variant="bordered"
                  disableAnimation
                  min={updateFreqType === "seconds" ? 10 : 1}
                />
                <Dropdown aria-label="Select a time unit">
                  <DropdownTrigger>
                    <Button
                      variant="bordered"
                      color="default"
                      endContent={(
                        <div>
                          <LuChevronDown />
                        </div>
                      )}
                    >
                      {updateFreqType}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem key="seconds" onClick={() => setUpdateFreqType("seconds")} textValue="Seconds">
                      <Text>Seconds</Text>
                    </DropdownItem>
                    <DropdownItem key="minutes" onClick={() => setUpdateFreqType("minutes")} textValue="Minutes">
                      <Text>Minutes</Text>
                    </DropdownItem>
                    <DropdownItem key="hours" onClick={() => setUpdateFreqType("hours")} textValue="Hours">
                      <Text>Hours</Text>
                    </DropdownItem>
                    <DropdownItem key="days" onClick={() => setUpdateFreqType("days")} textValue="Days">
                      <Text>Days</Text>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </Row>
              {autoUpdateError && (
                <>
                  <Spacer y={2} />
                  <Row>
                    <Text color="danger">{autoUpdateError}</Text>
                  </Row>
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              color={"warning"}
              onClick={() => setUpdateModal(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              endContent={<LuX />}
              variant="flat"
              color="danger"
              isLoading={autoUpdateLoading}
              onClick={() => {
                setUpdateFrequency(0);
                _onChangeAutoUpdate(0);
              }}
              size="sm"
            >
              Stop auto-updating
            </Button>
            <Button
              endContent={<LuCheck />}
              color="primary"
              isLoading={autoUpdateLoading}
              onClick={() => _onChangeAutoUpdate()}
              size="sm"
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* EMBED CHART MODAL */}
      {chart && (
        <ChartSharing
          chart={chart}
          isOpen={embedModal}
          onClose={() => setEmbedModal(false)}
        />
      )}


      {/* ALERTS MODAL */}
      <Modal isOpen={alertsModal} onClose={() => setAlertsModal(false)}>
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">{"Alerts"}</div>
          </ModalHeader>
          <ModalBody>
            <div className="text-sm">{"Select a dataset to set up alerts for"}</div>
            <Select
              selectionMode="single"
              selectedKeys={[`${alertsDatasetId}`]}
              onSelectionChange={(keys) => {
                setAlertsDatasetId(keys.currentKey);
              }}
              variant="bordered"
              aria-label="Select a dataset"
            >
              {chart?.ChartDatasetConfigs?.map((config) => (
                <SelectItem key={config.id} value={config.id} textValue={config.legend}>
                  {config.legend}
                </SelectItem>
              ))}
            </Select>

            {alertsDatasetId && (
              <>
                <Divider />
                {chart?.Alerts?.length > 0 && (
                  <div className="text-sm">{"Your current alerts:"}</div>
                )}

                <DatasetAlerts
                  chartType={chart.type}
                  chartId={chart.id}
                  cdcId={alertsDatasetId}
                  projectId={chart.project_id}
                  onChanged={_onGetChart}
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setAlertsModal(false)}
              auto
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100%",
  },
  draft: {
    marginRight: 10,
  },
  filterBtn: (addPadding) => ({
    position: "absolute",
    right: addPadding ? 40 : 10,
    top: 10,
    backgroundColor: "transparent",
    boxShadow: "none",
  }),
  titleArea: (isKpi) => ({
    paddingLeft: isKpi ? 15 : 0,
  }),
};

Chart.propTypes = {
  chart: PropTypes.object.isRequired,
  isPublic: PropTypes.bool,
  onChangeOrder: PropTypes.func,
  print: PropTypes.string,
  height: PropTypes.number,
  showExport: PropTypes.bool,
  password: PropTypes.string,
  editingLayout: PropTypes.bool,
  onEditLayout: PropTypes.func,
  onDashboard: PropTypes.bool,
};

export default Chart;
